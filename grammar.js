// grammar.js — Grammar tab UI — 4-stage learning path

(function () {
  'use strict';

  const API_BASE = (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  ) ? 'http://localhost:3000' : '';

  // ── Helpers ──────────────────────────────────────────────────────────────
  function esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ── Stage definitions ─────────────────────────────────────────────────────
  const STAGES = [
    { id: 1, title: 'Foundation',  subtitle: 'Things that work differently from English', color: '#0066CC' },
    { id: 2, title: 'Traps',       subtitle: 'Things that look familiar but aren\'t',       color: '#F5C842' },
    { id: 3, title: 'Nuance',      subtitle: 'Things English doesn\'t have',                color: '#F5894A' },
    { id: 4, title: 'Fluency',     subtitle: 'What separates intermediate from advanced',   color: '#A855F7' },
  ];

  const LS_VIEWED = 'ponte_grammar_viewed';

  function loadViewed() {
    try { return new Set(JSON.parse(localStorage.getItem(LS_VIEWED) || '[]')); }
    catch { return new Set(); }
  }
  function saveViewed(set) {
    localStorage.setItem(LS_VIEWED, JSON.stringify([...set]));
  }
  let viewedCards = loadViewed();

  // ── Category label map ────────────────────────────────────────────────────
  const CAT_LABELS = {
    tense: 'TENSE', pronoun: 'PRONOUN', subjunctive: 'MOOD',
    reflexive: 'REFLEXIVE', preposition: 'PREPOSITION', geminate: 'PHONOLOGY', modal: 'MODAL',
  };
  function catLabel(cat) { return CAT_LABELS[cat] || cat.toUpperCase(); }

  // ── State ─────────────────────────────────────────────────────────────────
  let activePanel    = 'stages';
  let drillQueue     = [];
  let drillIndex     = 0;
  let drillScore     = 0;
  let drillAnswered  = false;
  let drillCatFilter = 'all';
  let openStageId    = null;
  let viewObserver   = null;
  let drillCardId    = null;

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const tabGrammar   = document.getElementById('tab-grammar');
  if (!tabGrammar) return;

  const panelStages  = document.getElementById('grammar-panel-stages');
  const panelDrills  = document.getElementById('grammar-panel-drills');
  const panelReading = document.getElementById('grammar-panel-reading');

  const subTabBtns   = tabGrammar.querySelectorAll('.grammar-subtab');

  const stageGrid      = document.getElementById('gr-stage-grid');
  const stageTilesWrap = document.getElementById('gr-stage-tiles-wrapper');
  const stageDetail    = document.getElementById('gr-stage-detail');
  const stageTitleEl   = document.getElementById('gr-stage-title');
  const stageCardsEl   = document.getElementById('gr-stage-cards');
  const stageBackBtn   = document.getElementById('gr-stage-back');

  // Drill DOM refs
  const drillCatBtns     = tabGrammar.querySelectorAll('.gr-drill-cat-btn');
  const drillCount       = document.getElementById('gr-drill-count');
  const drillProgress    = document.getElementById('gr-drill-progress');
  const drillProgressBar = document.getElementById('gr-drill-progress-bar');
  const drillCard        = document.getElementById('gr-drill-card');
  const drillSentence    = document.getElementById('gr-drill-sentence');
  const drillSentenceEN  = document.getElementById('gr-drill-sentence-en');
  const drillOptions     = document.getElementById('gr-drill-options');
  const drillFeedback    = document.getElementById('gr-drill-feedback');
  const drillNextBtn     = document.getElementById('gr-drill-next');
  const drillDone        = document.getElementById('gr-drill-done');
  const drillScoreEl     = document.getElementById('gr-drill-score');
  const drillRestartBtn  = document.getElementById('gr-drill-restart');

  // ── Panel switching ───────────────────────────────────────────────────────
  function switchPanel(id) {
    activePanel = id;
    subTabBtns.forEach(b => b.classList.toggle('active', b.dataset.panel === id));
    panelStages.hidden  = (id !== 'stages');
    panelDrills.hidden  = (id !== 'drills');
    panelReading.hidden = (id !== 'reading');
  }

  subTabBtns.forEach(btn => btn.addEventListener('click', () => switchPanel(btn.dataset.panel)));

  // ── Stage tiles ───────────────────────────────────────────────────────────
  function getStageCards(stageId) {
    return grammarCards.filter(c => c.stageId === stageId);
  }

  function renderStageTiles() {
    stageGrid.innerHTML = STAGES.map(stage => {
      const cards = getStageCards(stage.id);
      const done  = cards.filter(c => viewedCards.has(c.id)).length;
      const total = cards.length;
      const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
      return `
        <div class="gr-stage-tile" data-stage="${stage.id}" style="--stage-color:${stage.color}">
          <div class="gr-stage-num">Stage ${stage.id}</div>
          <div class="gr-stage-title-text">${stage.title}</div>
          <div class="gr-stage-subtitle">${stage.subtitle}</div>
          <div class="gr-stage-meta">
            <span class="gr-stage-concept-count">${total} concepts</span>
            <span class="gr-stage-done-count">${done} / ${total} viewed</span>
          </div>
          <div class="gr-stage-bar-track">
            <div class="gr-stage-bar-fill" style="width:${pct}%"></div>
          </div>
        </div>`;
    }).join('');

    stageGrid.querySelectorAll('.gr-stage-tile').forEach(tile => {
      tile.addEventListener('click', () => openStage(parseInt(tile.dataset.stage, 10)));
    });
  }

  function openStage(stageId) {
    openStageId = stageId;
    const stage = STAGES.find(s => s.id === stageId);
    const cards = getStageCards(stageId);

    stageTitleEl.textContent = `Stage ${stage.id}: ${stage.title}`;
    stageTitleEl.style.color = stage.color;

    stageCardsEl.innerHTML = cards.map(card => renderCard(card, stage.color)).join('');

    stageTilesWrap.hidden = true;
    stageDetail.hidden    = false;

    setupViewObserver();

    // Attach "Practice this →" button listeners
    stageCardsEl.querySelectorAll('.gr-practice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const cardId = parseInt(btn.dataset.cardid, 10);
        exitStageDetail();
        switchPanel('drills');
        drillCardId = cardId;
        // Deactivate category buttons — card-specific filter overrides them
        drillCatBtns.forEach(b => b.classList.remove('active'));
        startDrills();
      });
    });

    // Attach "See more examples →" button listeners
    stageCardsEl.querySelectorAll('.gr-more-examples-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const cardId = parseInt(btn.dataset.cardid, 10);
        const card   = grammarCards.find(c => c.id === cardId);
        if (!card) return;

        btn.disabled    = true;
        btn.textContent = 'Loading…';

        const container = document.getElementById('gr-extra-' + cardId);
        try {
          const res = await fetch(API_BASE + '/api/grammar-examples', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
              concept:        card.title,
              stage:          card.stageId,
              currentExample: card.example,
            }),
          });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          const data = await res.json();
          if (!data.examples || !data.examples.length) throw new Error('empty response');

          saveExamplesCache(cardId, data.examples);
          if (container) {
            container.innerHTML = renderExtraExamples(data.examples);
            container.hidden    = false;
          }
          btn.textContent = 'Refresh examples →';
        } catch (err) {
          console.warn('Grammar examples failed:', err.message);
          btn.textContent = 'See more examples →';
        } finally {
          btn.disabled = false;
        }
      });
    });
  }

  function exitStageDetail() {
    if (viewObserver) { viewObserver.disconnect(); viewObserver = null; }
    stageDetail.hidden    = true;
    stageTilesWrap.hidden = false;
    renderStageTiles();
    openStageId = null;
  }

  stageBackBtn && stageBackBtn.addEventListener('click', exitStageDetail);

  // ── Example cache helpers ─────────────────────────────────────────────────
  function loadExamplesCache(cardId) {
    try { return JSON.parse(localStorage.getItem('ponte_gramex_' + cardId) || 'null'); }
    catch { return null; }
  }
  function saveExamplesCache(cardId, examples) {
    localStorage.setItem('ponte_gramex_' + cardId, JSON.stringify(examples));
  }
  function renderExtraExamples(examples) {
    return examples.map(ex => `
      <div class="gr-extra-example">
        <div class="gr-extra-it">${esc(ex.italian)}</div>
        <div class="gr-extra-en">${esc(ex.english)}</div>
      </div>`).join('');
  }

  // ── Card renderer ─────────────────────────────────────────────────────────
  function renderCard(card, stageColor) {
    const hasDrill = grammarDrills.some(d => d.grammarCardId === card.id);
    const cached   = loadExamplesCache(card.id);
    return `
      <div class="gr-new-card" data-id="${card.id}">
        <div class="gr-new-card-badges">
          <span class="gr-cat-badge gr-cat-${esc(card.category)}">${catLabel(card.category)}</span>
          <span class="gr-stage-badge" style="color:${stageColor};border-color:${stageColor}">Stage ${card.stageId}</span>
        </div>
        <div class="gr-new-card-title">${esc(card.title)}</div>
        <div class="gr-new-rows">
          <div class="gr-new-row gr-row-en">
            <span class="gr-row-lang">EN</span>
            <span class="gr-row-text">${esc(card.english)}</span>
          </div>
          <div class="gr-new-row gr-row-it">
            <span class="gr-row-lang">IT</span>
            <span class="gr-row-text gr-it-text">${esc(card.italian)}</span>
          </div>
        </div>
        <div class="gr-new-example">
          <div class="gr-new-ex-it">${esc(card.example)}</div>
          <div class="gr-new-ex-en">${esc(card.exampleEN)}</div>
        </div>
        <div class="gr-new-trap">
          <span class="gr-trap-icon">⚠️</span>
          <span>${esc(card.trap)}</span>
        </div>
        ${card.spanishShortcut ? `
        <div class="gr-new-spanish">
          <span class="gr-es-flag">🇪🇸</span>
          <span>${esc(card.spanishShortcut)}</span>
        </div>` : ''}
        ${hasDrill ? `
        <button class="gr-practice-btn" data-cardid="${card.id}">Practice this →</button>
        ` : ''}
        <button class="gr-more-examples-btn" data-cardid="${card.id}">${cached ? 'Refresh examples →' : 'See more examples →'}</button>
        <div class="gr-extra-examples" id="gr-extra-${card.id}" ${cached ? '' : 'hidden'}>
          ${cached ? renderExtraExamples(cached) : ''}
        </div>
      </div>`;
  }

  // ── Intersection observer: mark cards viewed when scrolled past ───────────
  function setupViewObserver() {
    if (viewObserver) viewObserver.disconnect();
    viewObserver = new IntersectionObserver((entries) => {
      let changed = false;
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = parseInt(entry.target.dataset.id, 10);
          if (!viewedCards.has(id)) { viewedCards.add(id); changed = true; }
        }
      });
      if (changed) saveViewed(viewedCards);
    }, { threshold: 0.3 });
    stageCardsEl.querySelectorAll('.gr-new-card').forEach(el => viewObserver.observe(el));
  }

  // ── Pattern Drills (unchanged logic) ─────────────────────────────────────
  drillCatBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      drillCatFilter = btn.dataset.cat;
      drillCardId    = null; // clear card-specific filter when using category buttons
      drillCatBtns.forEach(b => b.classList.toggle('active', b.dataset.cat === drillCatFilter));
      startDrills();
    });
  });

  function getFilteredDrills() {
    if (drillCardId !== null) {
      return grammarDrills.filter(d => d.grammarCardId === drillCardId);
    }
    if (drillCatFilter === 'all') return grammarDrills.slice();
    const catCardIds = new Set(
      grammarCards.filter(c => c.category === drillCatFilter).map(c => c.id)
    );
    return grammarDrills.filter(d => catCardIds.has(d.grammarCardId));
  }

  function startDrills() {
    const filtered = getFilteredDrills();
    drillCount.textContent = filtered.length + ' drill' + (filtered.length !== 1 ? 's' : '');

    const noMsg = document.getElementById('gr-no-drills');
    if (!filtered.length) {
      drillCard.hidden = true;
      drillDone.hidden = true;
      if (noMsg) noMsg.hidden = false;
      return;
    }
    if (noMsg) noMsg.hidden = true;

    drillQueue  = shuffle(filtered);
    drillIndex  = 0;
    drillScore  = 0;
    drillDone.hidden = true;
    drillCard.hidden = false;
    showDrill();
  }

  function showDrill() {
    if (drillIndex >= drillQueue.length) { showDrillComplete(); return; }

    drillAnswered = false;
    const drill = drillQueue[drillIndex];
    const total = drillQueue.length;

    drillProgress.textContent = `${drillIndex + 1} / ${total}`;
    drillProgressBar.style.width = Math.round((drillIndex / total) * 100) + '%';

    drillSentence.innerHTML = drill.sentence.replace(/___/g, '<span class="gr-blank">___</span>');
    if (drillSentenceEN) {
      drillSentenceEN.innerHTML = drill.sentenceEN
        ? drill.sentenceEN.replace(/___/g, '<span class="gr-blank-en">___</span>')
        : '';
      drillSentenceEN.hidden = !drill.sentenceEN;
    }

    const options = shuffle([drill.answer, ...drill.distractors]);
    drillOptions.innerHTML = options.map(opt =>
      `<button class="gr-option" data-val="${esc(opt)}">${esc(opt)}</button>`
    ).join('');

    drillFeedback.hidden = true;
    drillNextBtn.hidden  = true;

    drillOptions.querySelectorAll('.gr-option').forEach(btn => {
      btn.addEventListener('click', () => handleAnswer(btn, drill));
    });
  }

  function handleAnswer(btn, drill) {
    if (drillAnswered) return;
    drillAnswered = true;
    const correct = btn.dataset.val === drill.answer;
    if (correct) drillScore++;
    drillOptions.querySelectorAll('.gr-option').forEach(b => {
      b.disabled = true;
      if (b.dataset.val === drill.answer) b.classList.add('correct');
      else if (b === btn && !correct) b.classList.add('wrong');
    });
    drillFeedback.textContent = drill.explanation;
    drillFeedback.className   = 'gr-drill-feedback ' + (correct ? 'correct' : 'wrong');
    drillFeedback.hidden      = false;
    drillNextBtn.hidden       = false;
  }

  drillNextBtn && drillNextBtn.addEventListener('click', () => { drillIndex++; showDrill(); });

  function showDrillComplete() {
    drillCard.hidden = true;
    drillDone.hidden = false;
    drillScoreEl.textContent = `${drillScore} / ${drillQueue.length} correct on first try`;
    drillProgressBar.style.width = '100%';
    drillProgress.textContent = `${drillQueue.length} / ${drillQueue.length}`;
  }

  drillRestartBtn && drillRestartBtn.addEventListener('click', startDrills);

  // ── Init ──────────────────────────────────────────────────────────────────
  if (typeof grammarCards === 'undefined' || typeof grammarDrills === 'undefined') {
    console.error('grammar.js: grammarCards or grammarDrills not found');
    return;
  }

  renderStageTiles();
  switchPanel('stages');
  startDrills();

})();
