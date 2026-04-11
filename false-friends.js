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
          <div class="ff-card-words">
            <span class="ff-it-word">${esc(c.italian)}</span>
            <span class="ff-sep">≠</span>
            <span class="ff-es-word">${esc(c.spanishLookalike)}</span>
          </div>
          <div class="ff-card-meaning">${esc(c.italianMeaning)}</div>
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
  }

  function exitDrill() {
    state.drillMode = false;
    ffDrill.hidden     = true;
    ffDrillDone.hidden = true;
    ffBrowse.hidden    = false;
    ffDrillToggle.classList.remove('active');
    ffDrillToggle.textContent = '⚡ Drill mode';
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

  // ── Init ───────────────────────────────────────────────────────────────
  renderCards();
})();
