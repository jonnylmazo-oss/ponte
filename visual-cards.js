// ── Visual flashcards (#88) — picture → Italian word recall ────────────────
// Standalone curated deck (data/visual-deck.js), deliberately separate from
// the user's main deck: its SRS state lives in its own localStorage key and
// NOTHING here ever reads or writes ponte_flashcards or the server-side
// flashcards/flashcard_audio Redis keys. Scheduling reuses the main drill's
// SM-2 verbatim via window.ponteApplySmTwo (exposed by flashcards.js), and
// audio reuses window.ponteSpeakCard's existing tiering (flashcard_audio →
// word_audio bank → Web Speech) — the algorithm and the speaker are shared,
// the data is not.
//
// Front = image placeholder for now (labeled with the ENGLISH gloss, never
// the Italian — a front that shows the answer can't test recall; the English
// label is the closest textual stand-in for the eventual illustration).
// Back = Italian word + audio, English gloss as small verification text.
(function () {
  'use strict';

  const SRS_KEY = 'ponte_visual_srs';       // { [entryId]: SRS state record }
  const BAK_KEY = 'ponte_visual_srs_bak';   // pre-write backup, refreshed once per session
  const SESSION_CAP = 20;                   // max cards per session (misses requeue on top)

  const $ = (id) => document.getElementById(id);
  const esc = window.ponteEsc || ((s) => String(s));

  const GROUP_LABELS = {
    body:      'Body',
    animals:   'Animals',
    food:      'Food & drink',
    kitchen:   'Kitchen',
    home:      'Home & bath',
    city:      'City & buildings',
    nature:    'Nature & weather',
    clothing:  'Clothing',
    transport: 'Transport',
    people:    'People & figures',
    school:    'School & office',
    tools:     'Tools',
    sport:     'Sport & play',
  };

  function deck() { return Array.isArray(window.VISUAL_DECK) ? window.VISUAL_DECK : []; }

  // ── SRS state (client-only, standalone) ──────────────────────────────────
  function loadState() {
    try {
      const s = JSON.parse(localStorage.getItem(SRS_KEY));
      return s && typeof s === 'object' && !Array.isArray(s) ? s : {};
    } catch (_) { return {}; }
  }

  let backedUpThisSession = false;
  function saveState(state) {
    const existing = loadState();
    // Same spirit as the main deck's anti-shrink guard: a save must never
    // carry fewer entries than what's already stored — merge instead, so a
    // bad in-memory map can update entries but can't silently drop them.
    const merged = Object.assign({}, existing, state);
    if (!backedUpThisSession && Object.keys(existing).length) {
      try { localStorage.setItem(BAK_KEY, JSON.stringify(existing)); } catch (_) { /* quota — backup is best-effort */ }
      backedUpThisSession = true;
    }
    try { localStorage.setItem(SRS_KEY, JSON.stringify(merged)); } catch (_) { /* quota */ }
    return merged;
  }

  function isDueEntry(rec) {
    if (!rec || !rec.dueDate) return true;             // unseen or unscheduled → due
    return new Date(rec.dueDate).getTime() <= Date.now();
  }

  function counts(group) {
    const state = loadState();
    let due = 0, unseen = 0, total = 0;
    deck().forEach((e) => {
      if (group && e.group !== group) return;
      total++;
      const rec = state[e.id];
      if (!rec) unseen++;
      else if (isDueEntry(rec)) due++;
    });
    return { due, unseen, total };
  }

  // ── Session state ────────────────────────────────────────────────────────
  let queue = [];          // entries still to show (misses re-append)
  let sessionTotal = 0;    // denominator for the status line (grows on requeue)
  let sessionCorrect = 0;  // hard/easy on first sight of a card this session
  let missedIds = new Set();
  let activeGroup = '';    // '' = all groups
  let flipped = false;

  function buildQueue(group) {
    const state = loadState();
    const pool = deck().filter((e) => !group || e.group === group);
    // Seen-and-due first (oldest due first — most overdue is most at risk of
    // being forgotten), then unseen in curated deck order (thematic blocks
    // are deliberate for picture vocabulary). Capped per session.
    const seenDue = pool
      .filter((e) => state[e.id] && isDueEntry(state[e.id]))
      .sort((a, b) => new Date(state[a.id].dueDate || 0) - new Date(state[b.id].dueDate || 0));
    const unseen = pool.filter((e) => !state[e.id]);
    return [...seenDue, ...unseen].slice(0, SESSION_CAP);
  }

  // ── Rendering ────────────────────────────────────────────────────────────
  function renderStart() {
    const startEl = $('vc-start'); const drillEl = $('vc-drill'); const doneEl = $('vc-done');
    if (!startEl) return;
    startEl.hidden = false; drillEl.hidden = true; doneEl.hidden = true;

    const all = counts('');
    const statsEl = $('vc-start-stats');
    if (statsEl) {
      statsEl.innerHTML =
        `<span class="vc-stat"><strong>${all.total}</strong> words</span>` +
        `<span class="vc-stat"><strong>${all.due}</strong> due for review</span>` +
        `<span class="vc-stat"><strong>${all.unseen}</strong> not seen yet</span>`;
    }

    const groupsEl = $('vc-groups');
    if (groupsEl) {
      const chips = [['', 'All']].concat(Object.keys(GROUP_LABELS).map((g) => [g, GROUP_LABELS[g]]));
      groupsEl.innerHTML = chips.map(([g, label]) => {
        const c = counts(g);
        const n = c.due + c.unseen;
        return `<button class="vc-group-chip${g === activeGroup ? ' active' : ''}" data-group="${esc(g)}">` +
          `${esc(label)} <span class="vc-group-count">(${n})</span></button>`;
      }).join('');
    }

    const startBtn = $('vc-start-btn');
    if (startBtn) {
      const c = counts(activeGroup);
      const n = Math.min(SESSION_CAP, c.due + c.unseen);
      startBtn.disabled = n === 0;
      startBtn.textContent = n === 0 ? 'All caught up — nothing due' : `Start session (${n} cards)`;
    }
  }

  function renderCard() {
    const entry = queue[0];
    if (!entry) { renderDone(); return; }
    flipped = false;
    const inner = $('vc-flip-inner');
    if (inner) inner.classList.remove('flipped');

    const done = sessionTotal - queue.length;
    const status = $('vc-drill-status');
    if (status) status.textContent = `${done + 1} / ${sessionTotal}`;

    // The placeholder shows the curated imagePrompt phrase — the literal
    // description of the picture that will eventually sit here — never the
    // Italian, and not the display gloss (which for deck-overlap entries can
    // be a multi-sense string like "staircase / ladder / scale" that no
    // single image will depict).
    const front = $('vc-placeholder-label');
    if (front) front.textContent = `[image: ${entry.imagePrompt || entry.english}]`;
    const groupChip = $('vc-front-group');
    if (groupChip) groupChip.textContent = GROUP_LABELS[entry.group] || entry.group;

    // ── Back: same layout as the standard drill flip-card (flashcards.js
    // renderDrillCard, forward direction) — word row, answer block with
    // English/Spanish/category badge, example, note; absent fields hidden
    // exactly the way the standard card hides them.
    const word = $('vc-back-word');
    if (word) word.textContent = entry.italian;

    const answer = $('vc-back-answer');
    if (answer) {
      const meta = window.ponteCategoryMeta;
      const color = meta && meta.colors[entry.cat];
      const label = meta && meta.labels[entry.cat];
      answer.innerHTML =
        `<div class="fc-flip-en">${esc(entry.english)}</div>` +
        (entry.spanish ? `<div class="fc-flip-es">${esc(entry.spanish)}</div>` : '') +
        // Badge only for deck-overlap entries: category is real data carried
        // from the main deck, not something we'd fabricate for new words.
        (color && label ? `<span class="fc-cat-badge" style="border-color:${color};color:${color}">${esc(label)}</span>` : '');
    }

    const exampleWrap = $('vc-back-example');
    if (exampleWrap) {
      if (entry.example) {
        $('vc-back-example-it').textContent = entry.example;
        const exEn = $('vc-back-example-en');
        exEn.textContent = entry.exampleEN || '';
        exEn.hidden = !entry.exampleEN;
        exampleWrap.hidden = false;
      } else {
        exampleWrap.hidden = true;
      }
    }

    const noteEl = $('vc-back-note');
    if (noteEl) {
      noteEl.textContent = entry.note || '';
      noteEl.hidden = !entry.note;
    }

    const note = $('vc-requeue-note');
    if (note) note.hidden = !missedIds.size;
  }

  function renderDone() {
    const startEl = $('vc-start'); const drillEl = $('vc-drill'); const doneEl = $('vc-done');
    if (drillEl) drillEl.hidden = true;
    if (startEl) startEl.hidden = true;
    if (doneEl) doneEl.hidden = false;
    const score = $('vc-done-score');
    // sessionCorrect counts first-sight hard/easy; firstSightTotal = unique cards shown
    if (score) score.textContent = `${sessionCorrect} / ${firstSightTotal} on first try`;
    const missEl = $('vc-done-missed');
    if (missEl) {
      if (missedIds.size) {
        const byId = new Map(deck().map((e) => [e.id, e]));
        const items = [...missedIds].map((id) => byId.get(id)).filter(Boolean)
          .map((e) => `<span class="vc-missed-item">${esc(e.italian)} <em>(${esc(e.english)})</em></span>`);
        missEl.innerHTML = `<p class="vc-missed-label">Worth another look:</p>` + items.join('');
        missEl.hidden = false;
      } else {
        missEl.hidden = true;
      }
    }
  }

  // ── Session flow ─────────────────────────────────────────────────────────
  let firstSightTotal = 0;
  let seenThisSession = new Set();

  function startSession() {
    queue = buildQueue(activeGroup);
    if (!queue.length) return;
    sessionTotal = queue.length;
    firstSightTotal = queue.length;
    sessionCorrect = 0;
    missedIds = new Set();
    seenThisSession = new Set();
    $('vc-start').hidden = true;
    $('vc-done').hidden = true;
    $('vc-drill').hidden = false;
    renderCard();
  }

  function flip() {
    if (flipped || !queue.length) return;
    flipped = true;
    const inner = $('vc-flip-inner');
    if (inner) inner.classList.add('flipped');
    // Speak on reveal, not on card entry — the front is a picture, the
    // Italian word doesn't exist for the learner until the flip.
    if (window.ponteSpeakCard) window.ponteSpeakCard(queue[0].italian);
  }

  function grade(rating) {
    if (!flipped || !queue.length) return;
    const entry = queue.shift();
    const state = loadState();
    const rec = state[entry.id] || {
      interval: 0, easeFactor: 2.5, dueDate: null,
      reviewCount: 0, lastReviewed: null, timesCorrect: 0, timesWrong: 0,
    };

    const firstSight = !seenThisSession.has(entry.id);
    seenThisSession.add(entry.id);

    if (rating === 'again') {
      rec.timesWrong = (rec.timesWrong || 0) + 1;
      missedIds.add(entry.id);
      queue.push(entry);            // missed cards return later this session
      sessionTotal++;
    } else {
      rec.timesCorrect = (rec.timesCorrect || 0) + 1;
      if (firstSight) sessionCorrect++;
    }

    // Only the LAST grading of a card in a session should set its real SM-2
    // schedule... but matching the main drill's behavior exactly: every
    // grade applies (an 'again' schedules interval 1 / due tomorrow; if the
    // requeued card is then graded easy later in the session, that grade
    // overwrites the schedule — same as re-drilling any due card).
    if (window.ponteApplySmTwo) {
      window.ponteApplySmTwo(rec, rating);
    } else {
      // flashcards.js failed to load — don't lose the review entirely.
      rec.reviewCount = (rec.reviewCount || 0) + 1;
      rec.lastReviewed = new Date().toISOString();
    }
    state[entry.id] = rec;
    saveState(state);
    renderCard();
  }

  // ── Wiring ───────────────────────────────────────────────────────────────
  function bind(id, fn) { const el = $(id); if (el) el.addEventListener('click', fn); }

  bind('vc-start-btn', startSession);
  bind('vc-flip-btn', flip);
  bind('vc-flip-card', function (e) {
    // Tapping the card front flips it (mirrors the main drill affordance);
    // taps on the back's buttons are handled by their own listeners.
    if (!flipped && !e.target.closest('button')) flip();
  });
  bind('vc-again-btn', () => grade('again'));
  bind('vc-hard-btn',  () => grade('hard'));
  bind('vc-easy-btn',  () => grade('easy'));
  bind('vc-back-speak-btn', () => { if (queue.length && window.ponteSpeakCard) window.ponteSpeakCard(queue[0].italian); });
  // Same wiring as the standard drill's Deep-dive button (flashcards.js):
  // opens the shared Deep-dive screen on the current card's Italian word.
  bind('vc-deep-dive-btn', () => {
    if (queue.length && window.ponteDeepDive) window.ponteDeepDive(queue[0].italian);
  });
  bind('vc-exit-btn', () => { if (window.ponteStopOneOff) window.ponteStopOneOff(); renderStart(); });
  bind('vc-done-again-btn', startSession);
  bind('vc-done-back-btn', renderStart);

  const groupsEl = $('vc-groups');
  if (groupsEl) {
    groupsEl.addEventListener('click', (e) => {
      const chip = e.target.closest('.vc-group-chip');
      if (!chip) return;
      activeGroup = chip.dataset.group || '';
      renderStart();
    });
  }

  // Refresh hook for switchTab (mirrors _ponteFCRender / _ponteProgressRender).
  // Only refreshes the start screen — never interrupts a drill in progress.
  window._ponteVCRender = function () {
    const drillEl = $('vc-drill');
    if (drillEl && !drillEl.hidden) return;
    renderStart();
  };

  renderStart();
})();
