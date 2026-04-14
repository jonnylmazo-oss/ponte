(function () {
  'use strict';

  const FC_KEY  = 'ponte_flashcards';
  const EP_KEY  = 'ponte_error_patterns';
  const API_BASE = (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  ) ? 'http://localhost:3000' : '';

  const CATEGORY_LABELS = {
    'cognate':      'Same in Spanish',
    'false-friend': 'False Friend',
    'divergence':   'Used differently',
    'new':          'New word',
  };

  const CATEGORY_COLORS = {
    'cognate':      '#4A90D9',
    'false-friend': '#F5C842',
    'divergence':   '#F5894A',
    'new':          '#888888',
  };

  // ── Helpers ─────────────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);

  function loadCards() {
    try { return JSON.parse(localStorage.getItem(FC_KEY) || '[]'); }
    catch { return []; }
  }

  function saveCards(cards) {
    localStorage.setItem(FC_KEY, JSON.stringify(cards));
    fetch(API_BASE + '/api/flashcards', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(cards),
    }).catch(function(err) { console.warn('Flashcard sync failed:', err.message); });
  }

  function escapeHTML(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  const PATTERN_LABELS = {
    'false-friend':     'False Friends',
    'divergence':       'Divergent Usage',
    'verb-essere':      'Essere Auxiliary',
    'passato-prossimo': 'Passato Prossimo',
    'clitic-placement': 'Clitic Placement',
    'subjunctive':      'Subjunctive',
    'geminates':        'Geminate Consonants',
    'verb-general':     'Verb Conjugation',
  };

  // ── Error pattern tracking ──────────────────────────────────────────────
  function loadErrorPatterns() {
    try { return JSON.parse(localStorage.getItem(EP_KEY) || '{}'); }
    catch { return {}; }
  }

  function saveErrorPatterns(patterns) {
    localStorage.setItem(EP_KEY, JSON.stringify(patterns));
    window.dispatchEvent(new CustomEvent('ponte:error-patterns-updated'));
  }

  function detectErrorPatterns(card) {
    // Rule-based detection from card fields
    const patterns = [];
    const note = (card.note || '').toLowerCase();
    if (card.category === 'false-friend')           patterns.push('false-friend');
    if (card.category === 'divergence')             patterns.push('divergence');
    if (note.includes('essere'))                    patterns.push('verb-essere');
    if (note.includes('passato prossimo'))          patterns.push('passato-prossimo');
    if (note.includes('clitic') || note.includes('pronoun')) patterns.push('clitic-placement');
    if (note.includes('subjunctive') || note.includes('congiuntivo')) patterns.push('subjunctive');
    if (note.includes('geminate') || note.includes('double consonant')) patterns.push('geminates');
    // Merge with Claude-detected patterns stored on card
    if (Array.isArray(card.grammarPatterns)) {
      card.grammarPatterns.forEach((p) => { if (!patterns.includes(p)) patterns.push(p); });
    }
    // Fallback: if wordType is verb and no patterns yet, tag verb-general
    if (patterns.length === 0 && card.wordType === 'verb') patterns.push('verb-general');
    return patterns;
  }

  function recordErrorPatterns(card) {
    const patterns = detectErrorPatterns(card);
    if (patterns.length === 0) return;
    const stored = loadErrorPatterns();
    const now    = new Date().toISOString();
    patterns.forEach((key) => {
      if (!stored[key]) stored[key] = { count: 0, lastSeen: now, label: PATTERN_LABELS[key] || key };
      stored[key].count++;
      stored[key].lastSeen = now;
      stored[key].label    = PATTERN_LABELS[key] || key;
    });
    saveErrorPatterns(stored);
  }

  // ── Sort due cards: top-3 error patterns first, then by accuracy ─────────
  function sortDueByPatterns(due) {
    const stored   = loadErrorPatterns();
    const ranked   = Object.entries(stored)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 3)
      .map(([key]) => key);

    function accuracy(card) {
      const t = (card.timesCorrect || 0) + (card.timesWrong || 0);
      return t === 0 ? 0.5 : (card.timesCorrect || 0) / t;
    }

    function matchesTop(card) {
      if (ranked.length === 0) return false;
      const cardPatterns = detectErrorPatterns(card);
      return cardPatterns.some((p) => ranked.includes(p));
    }

    const priority = due.filter(matchesTop).sort((a, b) => accuracy(a) - accuracy(b));
    const rest     = due.filter((c) => !matchesTop(c)).sort((a, b) => accuracy(a) - accuracy(b));
    return [...priority, ...rest];
  }

  // ── SM-2 algorithm ─────────────────────────────────────────────────────
  // rating: 'again' | 'hard' | 'easy'
  function applySmTwo(card, rating) {
    const iv = card.interval    !== undefined ? card.interval    : 0;
    const ef = card.easeFactor  !== undefined ? card.easeFactor  : 2.5;
    const rc = card.reviewCount !== undefined ? card.reviewCount : 0;

    let newInterval, newEF;

    if (rating === 'again') {
      newInterval = 1;
      newEF = Math.max(1.3, ef - 0.2);
    } else if (rating === 'hard') {
      if (rc === 0)      newInterval = 1;
      else if (rc === 1) newInterval = 3;
      else               newInterval = Math.round(iv * 1.2);
      newEF = ef; // unchanged on hard
    } else { // 'easy'
      if (rc === 0)      newInterval = 1;
      else if (rc === 1) newInterval = 6;
      else               newInterval = Math.round(iv * ef * 1.3);
      newEF = Math.min(4.0, ef + 0.15);
    }

    const due = new Date();
    due.setDate(due.getDate() + newInterval);

    card.interval     = newInterval;
    card.easeFactor   = newEF;
    card.dueDate      = due.toISOString();
    card.reviewCount  = rc + 1;
    card.lastReviewed = new Date().toISOString();
  }

  // ── Backfill: set dueDate = now for any card missing it ──────────────────
  function backfillDueDates() {
    const cards = loadCards();
    let changed = false;
    const now = new Date().toISOString();
    cards.forEach((c) => {
      if (!c.dueDate) {
        c.dueDate     = now;
        c.interval    = c.interval    !== undefined ? c.interval    : 0;
        c.easeFactor  = c.easeFactor  !== undefined ? c.easeFactor  : 2.5;
        c.reviewCount = c.reviewCount !== undefined ? c.reviewCount : 0;
        changed = true;
      }
    });
    if (changed) saveCards(cards);
  }

  // ── Due helpers ──────────────────────────────────────────────────────────
  function isDue(card) {
    if (!card.dueDate) return true;
    return new Date(card.dueDate).getTime() <= Date.now();
  }

  function countDue(cards) {
    return cards.filter(isDue).length;
  }

  function formatDueLabel(card) {
    if (!card.reviewCount) {
      return '<span class="fc-due-new">New</span>';
    }
    if (isDue(card)) {
      return '<span class="fc-due-today">Due today</span>';
    }
    const diffMs   = new Date(card.dueDate).getTime() - Date.now();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return `<span class="fc-due-future">Due in ${diffDays}d</span>`;
  }

  function formatAbsDate(isoStr) {
    if (!isoStr) return 'soon';
    const d = new Date(isoStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  // ── DOM refs ─────────────────────────────────────────────────────────────
  const fcSearch      = $('fc-search');
  const fcCount       = $('fc-count');
  const fcGrid        = $('fc-grid');
  const fcEmpty       = $('fc-empty');
  const fcBrowse      = $('fc-browse');
  const fcNoDue       = $('fc-no-due');
  const fcNoDueMsg    = $('fc-no-due-msg');
  const fcDrillAnyway = $('fc-drill-anyway');
  const fcDrill       = $('fc-drill');
  const fcDrillDone   = $('fc-drill-done');
  const fcDrillToggle = $('fc-drill-toggle');
  const fcExitDrill   = $('fc-exit-drill');
  const fcDrillStatus = $('fc-drill-status');
  const fcFlipInner   = $('fc-flip-inner');
  const fcFlipWord    = $('fc-flip-word');
  const fcFlipSource  = $('fc-flip-source');
  const fcFlipBtn     = $('fc-flip-btn');
  const fcFlipWordBack = $('fc-flip-word-back');
  const fcFlipAnswer  = $('fc-flip-answer');
  const fcFlipNote    = $('fc-flip-note');
  const fcFlipBase    = $('fc-flip-base');
  const fcAgainBtn    = $('fc-again-btn');
  const fcHardBtn     = $('fc-hard-btn');
  const fcEasyBtn     = $('fc-easy-btn');
  const fcDrillScore  = $('fc-drill-score');
  const fcTrickyList  = $('fc-tricky-list');
  const fcDrillRestart = $('fc-drill-restart');
  const fcSpeakBtn      = $('fc-speak-btn');
  const fcFrontSpeakBtn = $('fc-front-speak-btn');
  const fcToolbar         = $('fc-toolbar');
  const fcSessionStats    = $('fc-session-stats');
  const fcResetScores     = $('fc-reset-scores-btn');
  const fcDrillReverseBtn = $('fc-drill-reverse-btn');
  const fcFlipPrompt      = $('fc-flip-prompt');
  const fcFlipCard        = $('fc-flip-card');

  if (!fcGrid) return; // tab not present in DOM

  // ── Fullscreen helpers ────────────────────────────────────────────────────
  const drillFsHeader = $('drill-fullscreen-header');
  const drillFsStatus = $('drill-fs-status');
  const drillFsExit   = $('drill-fs-exit');

  function enterDrillFullscreen() {
    document.body.classList.add('drill-fullscreen');
    if (drillFsHeader) drillFsHeader.hidden = false;
    if (drillFsExit) drillFsExit.onclick = exitDrill;
  }

  function leaveDrillFullscreen() {
    document.body.classList.remove('drill-fullscreen');
    if (drillFsHeader) drillFsHeader.hidden = true;
  }

  function syncFsStatus(text) {
    if (drillFsStatus) drillFsStatus.textContent = text;
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('drill-fullscreen')) {
      if (!fcDrill.hidden || !fcDrillDone.hidden) exitDrill();
    }
  });

  // ── State ────────────────────────────────────────────────────────────────
  let activeFilter        = 'all';
  let searchQuery         = '';
  let drillQueue          = [];
  let drillTotal          = 0;
  let drillCorrect        = 0;
  let trickyCards         = [];
  let drillWordType       = 'all';
  let sessionCorrect      = 0;
  let sessionAgain        = 0;
  let sessionDrilledCards = new Map(); // id → { italian, interval }
  let drillReverse        = localStorage.getItem('ponte_drill_reverse') === 'true';

  // ── Filter helpers ────────────────────────────────────────────────────────
  function getFiltered() {
    const cards = loadCards();
    return cards.filter((c) => {
      if (activeFilter !== 'all' && c.category !== activeFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          c.italian.toLowerCase().includes(q) ||
          c.english.toLowerCase().includes(q) ||
          c.spanish.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }

  // ── Library render ────────────────────────────────────────────────────────
  function renderLibrary() {
    const filtered = getFiltered();
    const total    = loadCards().length;

    fcCount.textContent = filtered.length === total
      ? `${total} card${total !== 1 ? 's' : ''}`
      : `${filtered.length} of ${total}`;

    if (total === 0) {
      fcEmpty.hidden = false;
      fcGrid.innerHTML = '';
      fcDrillToggle.disabled = true;
      return;
    }
    fcEmpty.hidden = true;
    fcDrillToggle.disabled = filtered.length === 0;

    fcGrid.innerHTML = filtered.map((card) => {
      const color  = CATEGORY_COLORS[card.category] || CATEGORY_COLORS['new'];
      const label  = CATEGORY_LABELS[card.category]  || card.category;
      const source = card.sourceArticle ? `From: ${card.sourceArticle}` : '';

      // Accuracy badge — only if card has been drilled at least once
      let accuracyBadge = '';
      const drillAttempts = (card.timesCorrect || 0) + (card.timesWrong || 0);
      if (drillAttempts > 0) {
        const pct = Math.round((card.timesCorrect / drillAttempts) * 100);
        const dot  = pct >= 80 ? '🟢' : pct >= 50 ? '🟡' : '🔴';
        accuracyBadge = `<span class="fc-accuracy-badge" title="${card.timesCorrect}/${drillAttempts} correct">${dot} ${pct}%</span>`;
      }

      // Due date indicator
      const dueLabel = formatDueLabel(card);

      return `
        <div class="fc-card" data-id="${card.id}">
          <div class="fc-card-body">
            <div class="fc-card-it-row">
              <span class="fc-card-italian">${escapeHTML(card.italian)}</span>
              <button class="speak-btn fc-card-speak-btn" data-word="${escapeHTML(card.italian)}" aria-label="Pronounce" title="Pronounce">🔊</button>
            </div>
            ${card.baseForm ? `<div class="fc-card-base">Base: ${escapeHTML(card.baseForm)} · ${escapeHTML(card.baseFormEN)}</div>` : ''}
            <div class="fc-card-en">${escapeHTML(card.english)}</div>
            ${card.spanish ? `<div class="fc-card-es">${escapeHTML(card.spanish)}</div>` : ''}
            ${card.note ? `<p class="fc-card-note">${escapeHTML(card.note)}</p>` : ''}
            <div class="fc-card-foot">
              <span class="fc-cat-badge" style="border-color:${color};color:${color}">${label}</span>
              ${accuracyBadge}
              ${dueLabel}
              <span class="fc-card-source">${escapeHTML(source)}</span>
              <button class="fc-delete-btn" data-id="${card.id}" aria-label="Delete card">✕</button>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  // ── Delete / Library speak ────────────────────────────────────────────────
  fcGrid.addEventListener('click', (e) => {
    const speakBtn = e.target.closest('.fc-card-speak-btn');
    if (speakBtn) {
      if (window.ponteSpeak) window.ponteSpeak(speakBtn.dataset.word);
      return;
    }
    const btn = e.target.closest('.fc-delete-btn');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const cards = loadCards().filter((c) => c.id !== id);
    saveCards(cards);
    renderLibrary();
    updateBadge();
    window.dispatchEvent(new CustomEvent('ponte:flashcard-saved'));
  });

  // ── Filters ───────────────────────────────────────────────────────────────
  document.querySelectorAll('.fc-filter').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.fc-filter').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.cat;
      renderLibrary();
    });
  });

  fcSearch.addEventListener('input', () => {
    searchQuery = fcSearch.value.trim();
    renderLibrary();
  });

  // ── Word type filter ──────────────────────────────────────────────────────
  document.querySelectorAll('.fc-type-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.fc-type-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      drillWordType = btn.dataset.type;
    });
  });

  // ── Badge update ──────────────────────────────────────────────────────────
  function updateBadge() {
    const cards    = loadCards();
    const count    = cards.length;
    const dueCount = countDue(cards);

    ['fc-badge-sidebar', 'fc-badge-bottom'].forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.textContent = count;
      el.hidden = count === 0;
    });

    // Sidebar: text label "N due today" below the count
    const dueLabelSidebar = $('fc-due-label-sidebar');
    if (dueLabelSidebar) {
      dueLabelSidebar.textContent = `${dueCount} due today`;
      dueLabelSidebar.hidden = dueCount === 0;
    }

    // Bottom nav: red pill badge + accessible title
    const dueBadgeBottom = $('fc-due-badge-bottom');
    if (dueBadgeBottom) {
      dueBadgeBottom.textContent = dueCount;
      dueBadgeBottom.hidden      = dueCount === 0;
      dueBadgeBottom.title       = `${dueCount} card${dueCount !== 1 ? 's' : ''} due for review`;
    }
  }

  // ── Reset Scores ──────────────────────────────────────────────────────────
  fcResetScores && fcResetScores.addEventListener('click', () => {
    if (!confirm('Reset all drill scores? This will clear timesCorrect, timesWrong, and lastDrilled for every card.')) return;
    const cards = loadCards().map((c) => ({
      ...c,
      timesCorrect: 0,
      timesWrong:   0,
      lastDrilled:  null,
    }));
    saveCards(cards);
    renderLibrary();
  });

  // ── Reverse drill mode ────────────────────────────────────────────────────
  function updateReverseBtn() {
    if (!fcDrillReverseBtn) return;
    fcDrillReverseBtn.textContent = drillReverse ? 'Standard 🔄' : 'Reverse 🔄';
    fcDrillReverseBtn.classList.toggle('active', drillReverse);
  }

  fcDrillReverseBtn && fcDrillReverseBtn.addEventListener('click', () => {
    drillReverse = !drillReverse;
    localStorage.setItem('ponte_drill_reverse', drillReverse);
    updateReverseBtn();
    if (!fcDrill.hidden && drillQueue.length) showDrillCard();
  });

  updateReverseBtn();

  // ── Drill mode ────────────────────────────────────────────────────────────
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function updateSessionStats() {
    if (!fcSessionStats) return;
    const total = sessionCorrect + sessionAgain;
    const pct   = total > 0 ? Math.round((sessionCorrect / total) * 100) : 0;
    if (total === 0) {
      fcSessionStats.textContent = '';
      return;
    }
    fcSessionStats.textContent = `${sessionCorrect} correct · ${sessionAgain} again · ${pct}% this session`;
  }

  function showNoDueScreen(notDue) {
    if (!fcNoDue) return;
    // Find soonest due card
    const soonest = [...notDue].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0];
    if (fcNoDueMsg && soonest) {
      fcNoDueMsg.textContent = `Next card due: ${formatAbsDate(soonest.dueDate)}`;
    }
    fcBrowse.hidden  = true;
    fcToolbar.hidden = false;
    fcNoDue.hidden   = false;
  }

  function startDrill(drillAll) {
    let filtered = getFiltered();
    if (drillWordType !== 'all') {
      filtered = filtered.filter((c) => (c.wordType || 'other') === drillWordType);
    }
    if (!filtered.length) return;

    let queue;
    if (drillAll) {
      queue = shuffle([...filtered]);
    } else {
      const due    = filtered.filter(isDue);
      const notDue = filtered.filter((c) => !isDue(c));
      if (due.length === 0) {
        showNoDueScreen(notDue);
        return;
      }
      // Due cards first (sorted by error patterns + accuracy), then not-due cards (shuffled)
      queue = [...sortDueByPatterns(due), ...shuffle(notDue)];
    }

    drillQueue          = queue;
    drillTotal          = drillQueue.length;
    drillCorrect        = 0;
    trickyCards         = [];
    sessionCorrect      = 0;
    sessionAgain        = 0;
    sessionDrilledCards = new Map();
    updateSessionStats();

    if (fcNoDue) fcNoDue.hidden = true;
    fcBrowse.hidden    = true;
    fcToolbar.hidden   = true;
    fcDrillDone.hidden = true;
    if (fcFlipCard) fcFlipCard.style.visibility = 'hidden';
    fcDrill.hidden = false;
    showDrillCard();
    if (fcFlipCard) fcFlipCard.style.visibility = '';
    enterDrillFullscreen();
  }

  fcDrillAnyway && fcDrillAnyway.addEventListener('click', () => {
    if (fcNoDue) fcNoDue.hidden = true;
    startDrill(true);
  });

  function showDrillCard() {
    if (!drillQueue.length) {
      endDrill();
      return;
    }
    const card  = drillQueue[0];
    const done  = drillTotal - drillQueue.length;
    const color = CATEGORY_COLORS[card.category] || CATEGORY_COLORS['new'];
    const label = CATEGORY_LABELS[card.category]  || card.category;

    fcDrillStatus.textContent = `${done} drilled`;
    syncFsStatus(`${done} drilled`);

    if (drillReverse) {
      fcFlipWord.textContent     = card.english;
      fcFlipSource.textContent   = '';
      if (fcFlipPrompt) fcFlipPrompt.textContent = 'What is this in Italian?';
      if (fcFrontSpeakBtn) fcFrontSpeakBtn.hidden = true;

      fcFlipWordBack.textContent = card.italian;
      if (fcFlipBase) {
        fcFlipBase.textContent = card.baseForm ? `Base: ${card.baseForm} · ${card.baseFormEN}` : '';
        fcFlipBase.hidden = !card.baseForm;
      }
      fcFlipAnswer.innerHTML =
        `<span class="fc-cat-badge" style="border-color:${color};color:${color}">${label}</span>`;
      fcFlipNote.textContent = card.note || '';
      fcFlipNote.hidden = !card.note;
    } else {
      fcFlipWord.textContent     = card.italian;
      fcFlipSource.textContent   = card.sourceArticle ? `From: ${card.sourceArticle}` : '';
      if (fcFlipPrompt) fcFlipPrompt.textContent = 'What does this mean?';
      if (fcFrontSpeakBtn) fcFrontSpeakBtn.hidden = false;

      fcFlipWordBack.textContent = card.italian;
      if (fcFlipBase) {
        fcFlipBase.textContent = card.baseForm ? `Base: ${card.baseForm} · ${card.baseFormEN}` : '';
        fcFlipBase.hidden = !card.baseForm;
      }
      fcFlipAnswer.innerHTML = `
        <div class="fc-flip-en">${escapeHTML(card.english)}</div>
        ${card.spanish ? `<div class="fc-flip-es">${escapeHTML(card.spanish)}</div>` : ''}
        <span class="fc-cat-badge" style="border-color:${color};color:${color}">${label}</span>`;
      fcFlipNote.textContent = card.note || '';
      fcFlipNote.hidden = !card.note;
    }

    fcFlipInner.classList.remove('flipped');
    fcFlipBtn.disabled = false;
  }

  function endDrill() {
    fcDrill.hidden     = true;
    fcDrillDone.hidden = false;

    const pct = drillTotal > 0 ? Math.round((drillCorrect / drillTotal) * 100) : 0;
    fcDrillScore.textContent = `${drillCorrect} / ${drillTotal} correct (${pct}%)`;

    // Next review dates for cards drilled this session
    const fcNextReview     = $('fc-next-review');
    const fcNextReviewList = $('fc-next-review-list');
    if (fcNextReview && fcNextReviewList) {
      if (sessionDrilledCards.size > 0) {
        const items = [...sessionDrilledCards.values()].slice(0, 6);
        fcNextReviewList.innerHTML = items.map(({ italian, interval }) => {
          const when = interval === 1 ? 'tomorrow' : `in ${interval} day${interval !== 1 ? 's' : ''}`;
          return `<div class="fc-next-review-item">
            <span class="fc-next-review-word">${escapeHTML(italian)}</span>
            <span class="fc-next-review-when">next review ${when}</span>
          </div>`;
        }).join('');
        fcNextReview.hidden = false;
      } else {
        fcNextReview.hidden = true;
      }
    }

    if (trickyCards.length) {
      fcTrickyList.innerHTML =
        `<p class="fc-tricky-label">Review again:</p>` +
        trickyCards.map((c) =>
          `<span class="fc-tricky-item">${escapeHTML(c.italian)}</span>`
        ).join('');
      fcTrickyList.hidden = false;
    } else {
      fcTrickyList.hidden = true;
    }
  }

  function exitDrill() {
    fcDrill.hidden     = true;
    fcDrillDone.hidden = true;
    if (fcNoDue) fcNoDue.hidden = true;
    fcToolbar.hidden   = false;
    fcBrowse.hidden    = false;
    leaveDrillFullscreen();
    renderLibrary();
    updateBadge();
  }

  // Flip
  fcFlipBtn.addEventListener('click', () => {
    fcFlipInner.classList.add('flipped');
    fcFlipBtn.disabled = true;
    if (drillQueue.length && window.ponteSpeak) {
      setTimeout(() => window.ponteSpeak(drillQueue[0].italian), 350);
    }
  });

  fcFrontSpeakBtn && fcFrontSpeakBtn.addEventListener('click', () => {
    if (drillQueue.length && window.ponteSpeak) {
      window.ponteSpeak(drillQueue[0].italian);
    }
  });

  fcSpeakBtn && fcSpeakBtn.addEventListener('click', () => {
    if (drillQueue.length && window.ponteSpeak) {
      window.ponteSpeak(drillQueue[0].italian);
    }
  });

  // Helper: handle a correct answer (hard or easy) — advance card
  function handleCorrect(rating) {
    if (!fcFlipInner.classList.contains('flipped')) return;
    const card  = drillQueue.shift();
    const now   = new Date().toISOString();
    const cards = loadCards();
    const idx   = cards.findIndex((c) => c.id === card.id);
    if (idx !== -1) {
      applySmTwo(cards[idx], rating);
      cards[idx].timesCorrect = (cards[idx].timesCorrect || 0) + 1;
      cards[idx].lastSeen     = now;
      cards[idx].lastDrilled  = now;
      saveCards(cards);
      sessionDrilledCards.set(card.id, {
        italian:  cards[idx].italian,
        interval: cards[idx].interval,
      });
    }
    if (rating === 'hard') recordErrorPatterns(card);
    drillCorrect++;
    sessionCorrect++;
    updateSessionStats();
    showDrillCard();
  }

  // Again — wrong, re-queue
  fcAgainBtn && fcAgainBtn.addEventListener('click', () => {
    if (!fcFlipInner.classList.contains('flipped')) return;
    const card  = drillQueue.shift();
    const now   = new Date().toISOString();
    const cards = loadCards();
    const idx   = cards.findIndex((c) => c.id === card.id);
    if (idx !== -1) {
      applySmTwo(cards[idx], 'again');
      cards[idx].timesWrong  = (cards[idx].timesWrong || 0) + 1;
      cards[idx].lastSeen    = now;
      cards[idx].lastDrilled = now;
      saveCards(cards);
      sessionDrilledCards.set(card.id, {
        italian:  cards[idx].italian,
        interval: cards[idx].interval,
      });
    }
    recordErrorPatterns(card);
    sessionAgain++;
    updateSessionStats();
    if (!trickyCards.find((c) => c.id === card.id)) trickyCards.push(card);
    const pos = drillQueue.length <= 2
      ? drillQueue.length
      : 2 + Math.floor(Math.random() * (drillQueue.length - 1));
    drillQueue.splice(pos, 0, card);
    drillTotal++;
    showDrillCard();
  });

  // Hard — correct but struggled
  fcHardBtn && fcHardBtn.addEventListener('click', () => handleCorrect('hard'));

  // Easy — correct, knew it instantly
  fcEasyBtn && fcEasyBtn.addEventListener('click', () => handleCorrect('easy'));

  fcDrillToggle.addEventListener('click', () => startDrill(false));
  fcExitDrill.addEventListener('click', exitDrill);
  fcDrillRestart.addEventListener('click', () => startDrill(false));

  // ── Listen for saves from app.js ──────────────────────────────────────────
  window.addEventListener('ponte:flashcard-saved', () => {
    renderLibrary();
    updateBadge();
  });

  // ── Init ─────────────────────────────────────────────────────────────────
  backfillDueDates();
  renderLibrary();
  updateBadge();
})();
