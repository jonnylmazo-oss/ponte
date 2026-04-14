(function () {
  'use strict';

  // ── Helpers ────────────────────────────────────────────────────────────
  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function cap(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function dangerIcon(d) {
    return d === 'high' ? '🔴' : d === 'medium' ? '🟡' : '⚪';
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ── State ──────────────────────────────────────────────────────────────
  const state = {
    filter:    'all',
    query:     '',
    drillMode: false,
    drillQueue:   [],
    drillDone:    [],
    drillFirstTry: 0,
    drillSeenIds: new Set(),
    currentCard:  null,
    flipped:      false,
  };

  const scState = {
    filter:    'all',
    query:     '',
    drillMode: false,
    drillQueue:   [],
    drillDone:    [],
    drillFirstTry: 0,
    drillSeenIds: new Set(),
    currentCard:  null,
    flipped:      false,
  };

  // ── Fullscreen helpers ─────────────────────────────────────────────────
  function enterFFFullscreen() {
    const hdr = document.getElementById('drill-fullscreen-header');
    const btn = document.getElementById('drill-fs-exit');
    document.body.classList.add('drill-fullscreen');
    if (hdr) hdr.hidden = false;
    if (btn) btn.onclick = exitDrill;
  }

  function leaveFFFullscreen() {
    const hdr = document.getElementById('drill-fullscreen-header');
    document.body.classList.remove('drill-fullscreen');
    if (hdr) hdr.hidden = true;
  }

  function syncFFStatus(text) {
    const el = document.getElementById('drill-fs-status');
    if (el) el.textContent = text;
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('drill-fullscreen')) {
      if (state.drillMode) exitDrill();
    }
  });

  // ── DOM refs ───────────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);

  const ffSearch      = $('ff-search');
  const ffCount       = $('ff-count');
  const ffGrid        = $('ff-grid');
  const ffBrowse      = $('ff-browse');
  const ffDrill       = $('ff-drill');
  const ffDrillDone   = $('ff-drill-done');
  const ffDrillToggle = $('ff-drill-toggle');
  const ffDrillStatus = $('ff-drill-status');

  const ffFlipInner    = $('ff-flip-inner');
  const ffFlipWord     = $('ff-flip-word');
  const ffFlipWordBack = $('ff-flip-word-back');
  const ffFlipAnswer   = $('ff-flip-answer');
  const ffFlipTip      = $('ff-flip-tip');
  const ffFlipBtn      = $('ff-flip-btn');
  const ffGotBtn       = $('ff-got-btn');
  const ffTrickyBtn    = $('ff-tricky-btn');
  const ffExitDrill    = $('ff-exit-drill');
  const ffDrillScore   = $('ff-drill-score');
  const ffDrillRestart = $('ff-drill-restart');

  // ── Filtering ──────────────────────────────────────────────────────────
  function getFiltered() {
    let cards = falseFriends;
    if (state.filter !== 'all') {
      cards = cards.filter((c) => c.danger === state.filter);
    }
    if (state.query) {
      const q = state.query.toLowerCase();
      cards = cards.filter((c) =>
        c.italian.toLowerCase().includes(q) ||
        c.spanishLookalike.toLowerCase().includes(q) ||
        c.englishMeaning.toLowerCase().includes(q) ||
        c.italianMeaning.toLowerCase().includes(q)
      );
    }
    return cards;
  }

  // ── Browse: render card grid ───────────────────────────────────────────
  function renderCards() {
    const cards = getFiltered();
    ffCount.textContent = `${cards.length} false friend${cards.length !== 1 ? 's' : ''}`;

    if (cards.length === 0) {
      ffGrid.innerHTML = '<p class="ff-empty">No matches. Try a different search.</p>';
      return;
    }

    ffGrid.innerHTML = cards.map((c) => `
      <div class="ff-card" data-id="${c.id}">
        <div class="ff-card-main">
          <div class="ff-it-word">${esc(c.italian)}</div>
          <div class="ff-card-es-line">in Spanish: <span class="ff-es-inline">${esc(c.spanishLookalike)}</span> — ${esc(c.spanishMeaning)}</div>
          <div class="ff-card-it-line">in Italian: <span class="ff-it-inline">${esc(c.italianMeaning)}</span></div>
          <div class="ff-card-foot">
            <span class="ff-danger-badge ff-danger-${c.danger}">${dangerIcon(c.danger)} ${cap(c.danger)}</span>
            <span class="ff-chevron" aria-hidden="true">›</span>
          </div>
        </div>
        <div class="ff-card-detail">
          <div class="ff-card-detail-inner">
            <div class="ff-detail-vs">
              <strong>${esc(c.spanishLookalike)}</strong>
              <span class="ff-detail-arrow">→</span>
              <span class="ff-es-meaning-text">${esc(c.spanishMeaning)}</span>
            </div>
            <div class="ff-detail-example">
              <p class="ff-example-it">${esc(c.example)}</p>
              <p class="ff-example-en">${esc(c.exampleEN)}</p>
            </div>
            <div class="ff-detail-tip">💡 ${esc(c.tip)}</div>
          </div>
        </div>
      </div>
    `).join('');
  }

  // ── Card click: expand / collapse ─────────────────────────────────────
  ffGrid.addEventListener('click', (e) => {
    const card = e.target.closest('.ff-card');
    if (!card) return;
    const wasExpanded = card.classList.contains('expanded');
    document.querySelectorAll('.ff-card.expanded').forEach((c) => {
      c.classList.remove('expanded');
      c.querySelector('.ff-chevron').textContent = '›';
    });
    if (!wasExpanded) {
      card.classList.add('expanded');
      card.querySelector('.ff-chevron').textContent = '⌄';
    }
  });

  // ── Search ─────────────────────────────────────────────────────────────
  ffSearch.addEventListener('input', () => {
    state.query = ffSearch.value;
    renderCards();
  });

  // ── Danger filter ──────────────────────────────────────────────────────
  document.querySelectorAll('.ff-filter').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.filter = btn.dataset.danger;
      document.querySelectorAll('.ff-filter').forEach((b) =>
        b.classList.toggle('active', b === btn)
      );
      renderCards();
    });
  });

  // ── Drill mode ─────────────────────────────────────────────────────────
  function enterDrill() {
    const cards = getFiltered();
    if (cards.length === 0) return;

    state.drillMode    = true;
    state.drillQueue   = shuffle(cards);
    state.drillDone    = [];
    state.drillFirstTry = 0;
    state.drillSeenIds  = new Set();
    state.flipped       = false;

    ffBrowse.hidden    = true;
    ffDrillDone.hidden = true;
    ffDrill.hidden     = false;
    ffDrillToggle.classList.add('active');
    ffDrillToggle.textContent = '✕ Exit drill';

    nextCard();
    enterFFFullscreen();
  }

  function exitDrill() {
    state.drillMode = false;
    ffDrill.hidden     = true;
    ffDrillDone.hidden = true;
    ffBrowse.hidden    = false;
    ffDrillToggle.classList.remove('active');
    ffDrillToggle.textContent = '⚡ Drill mode';
    leaveFFFullscreen();
  }

  function nextCard() {
    if (state.drillQueue.length === 0) {
      showDrillComplete();
      return;
    }

    state.currentCard = state.drillQueue.shift();
    state.flipped     = false;

    ffFlipInner.classList.remove('flipped');
    ffFlipWord.textContent     = state.currentCard.italian;
    ffFlipWordBack.textContent = state.currentCard.italian;

    ffFlipAnswer.innerHTML = `
      <div class="ff-flip-meaning">${esc(state.currentCard.italianMeaning)}</div>
      <div class="ff-flip-compare">
        <span class="ff-flip-ne">≠</span>
        <span>${esc(state.currentCard.spanishLookalike)} &rarr; ${esc(state.currentCard.spanishMeaning)}</span>
      </div>
    `;
    ffFlipTip.textContent = '💡 ' + state.currentCard.tip;

    updateDrillProgress();
  }

  function updateDrillProgress() {
    const total     = state.drillDone.length + state.drillQueue.length + 1;
    const remaining = state.drillQueue.length + 1;
    ffDrillStatus.textContent = `${remaining} / ${total} remaining`;
    syncFFStatus(`${remaining} / ${total}`);
  }

  function showDrillComplete() {
    ffDrill.hidden     = false;
    ffDrillDone.hidden = false;
    ffDrill.hidden     = true;

    const total   = state.drillDone.length;
    const correct = state.drillFirstTry;
    const missed  = total - correct;
    ffDrillScore.textContent =
      correct === total
        ? `${correct} / ${total} on the first try — perfect!`
        : `${correct} / ${total} on the first try · ${missed} needed another look`;
  }

  ffFlipBtn.addEventListener('click', () => {
    if (state.flipped) return;
    state.flipped = true;
    ffFlipInner.classList.add('flipped');
  });

  ffGotBtn.addEventListener('click', () => {
    if (!state.flipped) return;
    if (!state.drillSeenIds.has(state.currentCard.id)) {
      state.drillFirstTry++;
    }
    state.drillDone.push(state.currentCard);
    nextCard();
  });

  ffTrickyBtn.addEventListener('click', () => {
    if (!state.flipped) return;
    state.drillSeenIds.add(state.currentCard.id);
    // Re-insert card in the latter half of the remaining queue
    const q = state.drillQueue;
    const insertAt = Math.max(1, Math.floor(q.length / 2)) +
                     Math.floor(Math.random() * Math.max(1, Math.ceil(q.length / 2)));
    q.splice(Math.min(insertAt, q.length), 0, state.currentCard);
    nextCard();
  });

  ffExitDrill.addEventListener('click', exitDrill);
  ffDrillToggle.addEventListener('click', () => {
    state.drillMode ? exitDrill() : enterDrill();
  });
  ffDrillRestart.addEventListener('click', enterDrill);

  // ── Sub-tab switching ──────────────────────────────────────────────────
  const ffPanelFriends  = $('ff-panel-friends');
  const ffPanelCognates = $('ff-panel-cognates');

  document.querySelectorAll('.ff-subtab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ff-subtab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const panel = btn.dataset.ffPanel;
      ffPanelFriends.hidden  = (panel !== 'friends');
      ffPanelCognates.hidden = (panel !== 'cognates');
      if (panel === 'cognates') scRenderCards();
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // ── SAFE COGNATES ──────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════

  const scSearch      = $('sc-search');
  const scCount       = $('sc-count');
  const scGrid        = $('sc-grid');
  const scBrowse      = $('sc-browse');
  const scDrill       = $('sc-drill');
  const scDrillDone   = $('sc-drill-done');
  const scDrillToggle = $('sc-drill-toggle');
  const scDrillStatus = $('sc-drill-status');
  const scFlipInner   = $('sc-flip-inner');
  const scFlipWord    = $('sc-flip-word');
  const scFlipWordBack= $('sc-flip-word-back');
  const scFlipAnswer  = $('sc-flip-answer');
  const scFlipBtn     = $('sc-flip-btn');
  const scGotBtn      = $('sc-got-btn');
  const scTrickyBtn   = $('sc-tricky-btn');
  const scExitDrill   = $('sc-exit-drill');
  const scDrillScore  = $('sc-drill-score');
  const scDrillRestart= $('sc-drill-restart');

  const SIM_LABELS = {
    'identical':     'Identical',
    'near-identical':'Near-identical',
    'similar-root':  'Similar root',
  };

  function scGetFiltered() {
    let cards = typeof safeCognates !== 'undefined' ? safeCognates : [];
    if (scState.filter !== 'all') {
      cards = cards.filter((c) => c.similarity === scState.filter);
    }
    if (scState.query) {
      const q = scState.query.toLowerCase();
      cards = cards.filter((c) =>
        c.italian.toLowerCase().includes(q) ||
        c.spanish.toLowerCase().includes(q) ||
        c.english.toLowerCase().includes(q)
      );
    }
    return cards;
  }

  function scRenderCards() {
    const cards = scGetFiltered();
    scCount.textContent = `${cards.length} cognate${cards.length !== 1 ? 's' : ''}`;

    if (cards.length === 0) {
      scGrid.innerHTML = '<p class="ff-empty">No matches. Try a different search.</p>';
      return;
    }

    scGrid.innerHTML = cards.map((c) => {
      const simClass = 'sc-sim-' + c.similarity.replace('-', '');
      return `
        <div class="sc-card" data-id="${c.id}">
          <div class="ff-card-main">
            <div class="ff-it-word sc-it-word">${esc(c.italian)}</div>
            <div class="ff-card-es-line">in Spanish: <span class="ff-es-inline">${esc(c.spanish)}</span></div>
            <div class="ff-card-it-line">meaning: <span class="ff-it-inline">${esc(c.english)}</span></div>
            <div class="ff-card-foot">
              <span class="sc-sim-badge ${simClass}">${SIM_LABELS[c.similarity] || c.similarity}</span>
              <span class="ff-chevron" aria-hidden="true">›</span>
            </div>
          </div>
          <div class="ff-card-detail">
            <div class="ff-card-detail-inner">
              <div class="ff-detail-example">
                <p class="ff-example-it">${esc(c.example)}</p>
                <p class="ff-example-en">${esc(c.exampleEN)}</p>
              </div>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  scGrid.addEventListener('click', (e) => {
    const card = e.target.closest('.sc-card');
    if (!card) return;
    const wasExpanded = card.classList.contains('expanded');
    document.querySelectorAll('.sc-card.expanded').forEach((c) => {
      c.classList.remove('expanded');
      c.querySelector('.ff-chevron').textContent = '›';
    });
    if (!wasExpanded) {
      card.classList.add('expanded');
      card.querySelector('.ff-chevron').textContent = '⌄';
    }
  });

  scSearch.addEventListener('input', () => {
    scState.query = scSearch.value;
    scRenderCards();
  });

  document.querySelectorAll('.sc-filter').forEach((btn) => {
    btn.addEventListener('click', () => {
      scState.filter = btn.dataset.sim;
      document.querySelectorAll('.sc-filter').forEach((b) =>
        b.classList.toggle('active', b === btn)
      );
      scRenderCards();
    });
  });

  // ── Safe Cognates drill ──────────────────────────────────────────────
  function scEnterDrill() {
    const cards = scGetFiltered();
    if (cards.length === 0) return;

    scState.drillMode    = true;
    scState.drillQueue   = shuffle(cards);
    scState.drillDone    = [];
    scState.drillFirstTry = 0;
    scState.drillSeenIds  = new Set();
    scState.flipped       = false;

    scBrowse.hidden    = true;
    scDrillDone.hidden = true;
    scDrill.hidden     = false;
    scDrillToggle.classList.add('active');
    scDrillToggle.textContent = '✕ Exit drill';

    scNextCard();
    enterFFFullscreen();
    // Override exit button for SC drill
    const btn = document.getElementById('drill-fs-exit');
    if (btn) btn.onclick = scExitDrillFn;
  }

  function scExitDrillFn() {
    scState.drillMode = false;
    scDrill.hidden     = true;
    scDrillDone.hidden = true;
    scBrowse.hidden    = false;
    scDrillToggle.classList.remove('active');
    scDrillToggle.textContent = '⚡ Drill mode';
    leaveFFFullscreen();
  }

  function scNextCard() {
    if (scState.drillQueue.length === 0) { scShowDrillComplete(); return; }

    scState.currentCard = scState.drillQueue.shift();
    scState.flipped     = false;

    scFlipInner.classList.remove('flipped');
    scFlipWord.textContent     = scState.currentCard.italian;
    scFlipWordBack.textContent = scState.currentCard.italian;

    const simClass = 'sc-sim-' + scState.currentCard.similarity.replace('-', '');
    scFlipAnswer.innerHTML = `
      <div class="sc-flip-english">${esc(scState.currentCard.english)}</div>
      <div class="sc-flip-spanish">🇪🇸 ${esc(scState.currentCard.spanish)}</div>
      <span class="sc-sim-badge ${simClass}">${SIM_LABELS[scState.currentCard.similarity]}</span>
      <div class="sc-flip-example">${esc(scState.currentCard.example)}</div>
      <div class="sc-flip-example-en">${esc(scState.currentCard.exampleEN)}</div>
    `;

    const total     = scState.drillDone.length + scState.drillQueue.length + 1;
    const remaining = scState.drillQueue.length + 1;
    scDrillStatus.textContent = `${remaining} / ${total} remaining`;
    syncFFStatus(`${remaining} / ${total}`);
  }

  function scShowDrillComplete() {
    scDrill.hidden     = true;
    scDrillDone.hidden = false;
    const total   = scState.drillDone.length;
    const correct = scState.drillFirstTry;
    const missed  = total - correct;
    scDrillScore.textContent = correct === total
      ? `${correct} / ${total} on the first try — perfect!`
      : `${correct} / ${total} on the first try · ${missed} needed another look`;
  }

  scFlipBtn.addEventListener('click', () => {
    if (scState.flipped) return;
    scState.flipped = true;
    scFlipInner.classList.add('flipped');
  });

  scGotBtn.addEventListener('click', () => {
    if (!scState.flipped) return;
    if (!scState.drillSeenIds.has(scState.currentCard.id)) scState.drillFirstTry++;
    scState.drillDone.push(scState.currentCard);
    scNextCard();
  });

  scTrickyBtn.addEventListener('click', () => {
    if (!scState.flipped) return;
    scState.drillSeenIds.add(scState.currentCard.id);
    const q = scState.drillQueue;
    const insertAt = Math.max(1, Math.floor(q.length / 2)) +
                     Math.floor(Math.random() * Math.max(1, Math.ceil(q.length / 2)));
    q.splice(Math.min(insertAt, q.length), 0, scState.currentCard);
    scNextCard();
  });

  scExitDrill.addEventListener('click', scExitDrillFn);
  scDrillToggle.addEventListener('click', () => {
    scState.drillMode ? scExitDrillFn() : scEnterDrill();
  });
  scDrillRestart.addEventListener('click', scEnterDrill);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('drill-fullscreen')) {
      if (scState.drillMode) scExitDrillFn();
    }
  });

  // ── Init ───────────────────────────────────────────────────────────────
  renderCards();
})();
