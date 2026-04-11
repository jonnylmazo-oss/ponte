// grammar.js — Grammar tab UI logic for Ponte
// Sub-tabs: Verb Deltas | Pattern Drills | From Your Reading

(function () {
  'use strict';

  // ── Helpers ──────────────────────────────────────────────────────────────
  function esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function cap(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ── State ─────────────────────────────────────────────────────────────────
  let activePanel = 'delta';  // 'delta' | 'drills' | 'reading'

  // Delta card state
  let deltaCategory = 'all';
  let deltaDifficulty = 'all';

  // Drill state
  let drillQueue = [];
  let drillIndex = 0;
  let drillScore = 0;
  let drillAnswered = false;
  let drillCategoryFilter = 'all';

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const tabGrammar    = document.getElementById('tab-grammar');
  const panelDelta    = document.getElementById('grammar-panel-delta');
  const panelDrills   = document.getElementById('grammar-panel-drills');
  const panelReading  = document.getElementById('grammar-panel-reading');

  const subTabBtns = tabGrammar.querySelectorAll('.grammar-subtab');

  // Delta elements
  const catBtns       = tabGrammar.querySelectorAll('.gr-cat-btn');
  const diffBtns      = tabGrammar.querySelectorAll('.gr-diff-btn');
  const deltaCount    = document.getElementById('gr-delta-count');
  const deltaGrid     = document.getElementById('gr-delta-grid');

  // Drill elements
  const drillCatBtns  = tabGrammar.querySelectorAll('.gr-drill-cat-btn');
  const drillCount    = document.getElementById('gr-drill-count');
  const drillProgress = document.getElementById('gr-drill-progress');
  const drillProgressBar = document.getElementById('gr-drill-progress-bar');
  const drillCard     = document.getElementById('gr-drill-card');
  const drillSentence = document.getElementById('gr-drill-sentence');
  const drillOptions  = document.getElementById('gr-drill-options');
  const drillFeedback = document.getElementById('gr-drill-feedback');
  const drillNextBtn  = document.getElementById('gr-drill-next');
  const drillDone     = document.getElementById('gr-drill-done');
  const drillScoreEl  = document.getElementById('gr-drill-score');
  const drillRestartBtn = document.getElementById('gr-drill-restart');

  // ── Sub-tab switching ─────────────────────────────────────────────────────
  subTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.panel;
      switchPanel(target);
    });
  });

  function switchPanel(id) {
    activePanel = id;
    subTabBtns.forEach(b => b.classList.toggle('active', b.dataset.panel === id));
    panelDelta.hidden   = (id !== 'delta');
    panelDrills.hidden  = (id !== 'drills');
    panelReading.hidden = (id !== 'reading');
  }

  // ── Delta Cards ───────────────────────────────────────────────────────────
  catBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      deltaCategory = btn.dataset.cat;
      catBtns.forEach(b => b.classList.toggle('active', b.dataset.cat === deltaCategory));
      renderDeltaCards();
    });
  });

  diffBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      deltaDifficulty = btn.dataset.diff;
      diffBtns.forEach(b => b.classList.toggle('active', b.dataset.diff === deltaDifficulty));
      renderDeltaCards();
    });
  });

  function getFilteredCards() {
    return grammarCards.filter(c => {
      if (deltaCategory !== 'all' && c.category !== deltaCategory) return false;
      if (deltaDifficulty !== 'all' && c.difficulty !== deltaDifficulty) return false;
      return true;
    });
  }

  function categoryLabel(cat) {
    const map = {
      tense: 'Tense',
      pronoun: 'Pronoun',
      subjunctive: 'Subjunctive',
      reflexive: 'Reflexive',
      preposition: 'Preposition',
      geminate: 'Geminate',
      modal: 'Modal'
    };
    return map[cat] || cap(cat);
  }

  function renderDeltaCards() {
    const cards = getFilteredCards();
    deltaCount.textContent = cards.length + ' card' + (cards.length !== 1 ? 's' : '');

    if (!cards.length) {
      deltaGrid.innerHTML = '<p class="gr-empty">No cards match these filters.</p>';
      return;
    }

    deltaGrid.innerHTML = cards.map(c => `
      <div class="gr-card" data-id="${c.id}">
        <div class="gr-card-header">
          <div class="gr-card-meta">
            <span class="gr-cat-badge gr-cat-${esc(c.category)}">${categoryLabel(c.category)}</span>
            <span class="gr-diff-badge">${esc(c.difficulty)}</span>
          </div>
          <div class="gr-card-title">${esc(c.title)}</div>
          <span class="gr-chevron" aria-hidden="true">›</span>
        </div>
        <div class="gr-card-body">
          <div class="gr-card-body-inner">
            <div class="gr-compare">
              <div class="gr-side gr-side-es">
                <div class="gr-side-lang">ES</div>
                <div class="gr-side-label">${esc(c.spanish.label)}</div>
                <div class="gr-side-example">${c.spanish.example}</div>
                <div class="gr-side-note">${c.spanish.note}</div>
              </div>
              <div class="gr-side gr-side-it">
                <div class="gr-side-lang">IT</div>
                <div class="gr-side-label">${esc(c.italian.label)}</div>
                <div class="gr-side-example">${c.italian.example}</div>
                <div class="gr-side-note">${c.italian.note}</div>
              </div>
            </div>
            ${c.trap ? `<div class="gr-trap"><span class="gr-trap-label">Trap</span> ${esc(c.trap)}</div>` : ''}
            ${c.tip  ? `<div class="gr-tip"><span class="gr-tip-label">Tip</span> ${esc(c.tip)}</div>` : ''}
          </div>
        </div>
      </div>
    `).join('');

    // Expand/collapse
    deltaGrid.querySelectorAll('.gr-card').forEach(card => {
      card.querySelector('.gr-card-header').addEventListener('click', () => {
        const wasOpen = card.classList.contains('open');
        // Close all
        deltaGrid.querySelectorAll('.gr-card.open').forEach(c => c.classList.remove('open'));
        if (!wasOpen) card.classList.add('open');
      });
    });
  }

  // ── Pattern Drills ────────────────────────────────────────────────────────
  drillCatBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      drillCategoryFilter = btn.dataset.cat;
      drillCatBtns.forEach(b => b.classList.toggle('active', b.dataset.cat === drillCategoryFilter));
      startDrills();
    });
  });

  function getFilteredDrills() {
    if (drillCategoryFilter === 'all') return grammarDrills.slice();
    // Find card ids matching category
    const catCardIds = new Set(
      grammarCards.filter(c => c.category === drillCategoryFilter).map(c => c.id)
    );
    return grammarDrills.filter(d => catCardIds.has(d.grammarCardId));
  }

  function startDrills() {
    const filtered = getFilteredDrills();
    drillCount.textContent = filtered.length + ' drill' + (filtered.length !== 1 ? 's' : '');
    drillQueue = shuffle(filtered);
    drillIndex = 0;
    drillScore = 0;
    drillDone.hidden = true;
    drillCard.hidden = false;
    showDrill();
  }

  function showDrill() {
    if (drillIndex >= drillQueue.length) {
      showDrillComplete();
      return;
    }

    drillAnswered = false;
    const drill = drillQueue[drillIndex];
    const total = drillQueue.length;

    // Progress
    drillProgress.textContent = `${drillIndex + 1} / ${total}`;
    const pct = Math.round((drillIndex / total) * 100);
    drillProgressBar.style.width = pct + '%';

    // Sentence — replace ___ with a styled blank
    const sentenceHTML = drill.sentence.replace(
      /___/g,
      '<span class="gr-blank">___</span>'
    );
    drillSentence.innerHTML = sentenceHTML;

    // Options — shuffle answer + 3 distractors
    const options = shuffle([drill.answer, ...drill.distractors]);
    drillOptions.innerHTML = options.map(opt => `
      <button class="gr-option" data-val="${esc(opt)}">${esc(opt)}</button>
    `).join('');

    drillFeedback.hidden = true;
    drillFeedback.textContent = '';
    drillNextBtn.hidden = true;

    // Attach option click handlers
    drillOptions.querySelectorAll('.gr-option').forEach(btn => {
      btn.addEventListener('click', () => handleAnswer(btn, drill));
    });
  }

  function handleAnswer(btn, drill) {
    if (drillAnswered) return;
    drillAnswered = true;

    const chosen = btn.dataset.val;
    const correct = chosen === drill.answer;

    if (correct) drillScore++;

    // Mark options
    drillOptions.querySelectorAll('.gr-option').forEach(b => {
      b.disabled = true;
      if (b.dataset.val === drill.answer) b.classList.add('correct');
      else if (b === btn && !correct) b.classList.add('wrong');
    });

    // Show feedback
    drillFeedback.textContent = drill.explanation;
    drillFeedback.className = 'gr-drill-feedback ' + (correct ? 'correct' : 'wrong');
    drillFeedback.hidden = false;

    drillNextBtn.hidden = false;
  }

  drillNextBtn && drillNextBtn.addEventListener('click', () => {
    drillIndex++;
    showDrill();
  });

  function showDrillComplete() {
    drillCard.hidden = true;
    drillDone.hidden = false;
    const total = drillQueue.length;
    drillScoreEl.textContent = `${drillScore} / ${total} correct on first try`;
    drillProgressBar.style.width = '100%';
    drillProgress.textContent = `${total} / ${total}`;
  }

  drillRestartBtn && drillRestartBtn.addEventListener('click', () => {
    startDrills();
  });

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    switchPanel('delta');
    renderDeltaCards();
    startDrills();
  }

  // Only init if grammarCards/grammarDrills are available
  if (typeof grammarCards !== 'undefined' && typeof grammarDrills !== 'undefined') {
    init();
  } else {
    console.error('grammar.js: grammarCards or grammarDrills not found — check data/grammar.js load order');
  }

})();
