(function () {
  'use strict';

  const FC_KEY        = 'ponte_flashcards';
  const EP_KEY        = 'ponte_error_patterns';
  const PENDING_KEY   = 'ponte_pending_sync';
  const DRILL_POS_KEY = 'ponte_drill_position';
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

  const IRREGULAR_VERBS = new Set([
    'essere','avere','andare','fare','dire','venire','uscire','tenere','sapere',
    'volere','potere','dovere','stare','dare','bere','produrre','tradurre',
    'condurre','porre','trarre','rimanere','salire','scegliere','togliere',
    'cogliere','sciogliere','volare','morire','udire','vedere','prendere',
    'mettere','scrivere','leggere','aprire','chiedere','rispondere','vincere',
    'perdere','correre','vivere','nascere','crescere','conoscere','piacere',
    'nuocere','giacere','tacere','cuocere',
  ]);

  function irregularBadge(card) {
    if (card.wordType !== 'verb') return '';
    const check = (s) => s && IRREGULAR_VERBS.has(s.toLowerCase().trim());
    if (!check(card.italian) && !check(card.baseForm)) return '';
    return '<span class="fc-irreg-badge">IRREGULAR</span>';
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);

  function authHeaders() {
    const token = localStorage.getItem('ponte_auth_token') || '';
    return token ? { 'Authorization': 'Bearer ' + token } : {};
  }

  function loadCards() {
    try { return JSON.parse(localStorage.getItem(FC_KEY) || '[]'); }
    catch { return []; }
  }

  function saveCards(cards) {
    if (!cards || cards.length === 0) {
      console.error('BLOCKED: attempted to persist empty cards array - skipping');
      return;
    }
    localStorage.setItem(FC_KEY, JSON.stringify(cards));
    fetch(API_BASE + '/api/flashcards', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body:    JSON.stringify(cards),
    }).then(() => {
      localStorage.removeItem(PENDING_KEY);
    }).catch(function(err) {
      console.warn('Flashcard sync failed — will retry on next load:', err.message);
      localStorage.setItem(PENDING_KEY, 'true');
    });
  }

  const escapeHTML = window.ponteEsc;

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
    console.log('[Ponte] Error patterns recorded for "' + card.italian + '":', patterns, JSON.parse(localStorage.getItem(EP_KEY) || '{}'));
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
  // silent=true: only write localStorage, skip server POST (safe before initial sync)
  function backfillDueDates(silent) {
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
    if (changed) {
      localStorage.setItem(FC_KEY, JSON.stringify(cards));
      if (!silent) saveCards(cards); // POST to server only after sync is complete
    }
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
  const fcNoWeak      = $('fc-no-weak');
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
  const fcFlipFrontMeta   = $('fc-flip-front-meta');

  function buildFrontMeta(card) {
    if (card.wordType === 'noun') {
      return card.nounNumber ? `(${card.nounNumber})` : '';
    }
    if (card.wordType !== 'verb') return '';
    const parts = [];
    const italian  = (card.italian  || '').trim().toLowerCase();
    const baseForm = (card.baseForm || '').trim();
    if (baseForm && baseForm.toLowerCase() !== italian) parts.push(baseForm);
    if (card.tense && card.tense !== 'null') parts.push(card.tense);
    return parts.join(' · ');
  }

  function renderFrontMeta(card) {
    if (!fcFlipFrontMeta) return;
    const meta = buildFrontMeta(card);
    fcFlipFrontMeta.textContent = meta;
    fcFlipFrontMeta.hidden = !meta;
  }

  if (!fcGrid) return; // tab not present in DOM

  // ── Fullscreen helpers ────────────────────────────────────────────────────
  const drillFsHeader  = $('drill-fullscreen-header');
  const drillFsStatus  = $('drill-fs-status');
  const drillFsSession = $('drill-fs-session');
  const drillFsExit    = $('drill-fs-exit');

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
  let activeCats          = new Set(['cognate', 'false-friend', 'divergence', 'new']);
  let activeWordTypes     = new Set(['noun', 'verb', 'adjective', 'adverb', 'phrase']);
  let activeStatuses      = new Set(['due', 'new-card', 'upcoming', 'mastered']);
  let openDropdownId      = null;
  let searchQuery         = '';
  let drillQueue           = [];
  let drillTotal           = 0;
  let drillCorrect         = 0;
  let trickyCards          = [];
  let currentDrillWordType = 'all';
  let currentDrillAll      = true;
  let sessionCorrect      = 0;
  let sessionAgain        = 0;
  let sessionDrilledCards = new Map(); // id → { italian, interval }
  let drillReverse        = localStorage.getItem('ponte_drill_reverse') === 'true';

  // ── Drill position persistence ────────────────────────────────────────────
  function saveDrillPosition() {
    if (!drillQueue.length) return;
    const done = drillTotal - drillQueue.length;
    localStorage.setItem(DRILL_POS_KEY, JSON.stringify({
      current:      done + 1,
      total:        drillTotal,
      wordType:     currentDrillWordType,
      drillAll:     currentDrillAll,
      remainingIds: drillQueue.map((c) => c.id),
    }));
  }

  function clearDrillPosition() {
    localStorage.removeItem(DRILL_POS_KEY);
    updateResumeIndicator();
  }

  function loadDrillPosition() {
    try { return JSON.parse(localStorage.getItem(DRILL_POS_KEY)); }
    catch { return null; }
  }

  function updateResumeIndicator() {
    const banner = $('fc-resume-banner');
    if (!banner) return;
    const pos = loadDrillPosition();
    if (!pos || !pos.remainingIds || !pos.remainingIds.length) {
      banner.hidden = true;
      return;
    }
    const textEl = $('fc-resume-text');
    if (textEl) textEl.textContent = `Resume drill: ${pos.current} / ${pos.total} cards`;
    banner.hidden = false;
  }

  function resumeDrill() {
    const pos = loadDrillPosition();
    if (!pos || !pos.remainingIds || !pos.remainingIds.length) return;
    const cardMap = new Map(loadCards().map((c) => [c.id, c]));
    const queue   = pos.remainingIds.map((id) => cardMap.get(id)).filter(Boolean);
    if (!queue.length) { clearDrillPosition(); return; }

    drillQueue           = queue;
    drillTotal           = pos.total;
    drillCorrect         = 0;
    trickyCards          = [];
    sessionCorrect       = 0;
    sessionAgain         = 0;
    sessionDrilledCards  = new Map();
    currentDrillWordType = pos.wordType  || 'all';
    currentDrillAll      = pos.drillAll !== undefined ? pos.drillAll : true;
    updateSessionStats();

    const fcDrillSetup = $('fc-drill-setup');
    if (fcDrillSetup) fcDrillSetup.hidden = true;
    const banner = $('fc-resume-banner');
    if (banner) banner.hidden = true;
    if (fcNoDue)  fcNoDue.hidden  = true;
    if (fcNoWeak) fcNoWeak.hidden = true;
    fcBrowse.hidden    = true;
    fcToolbar.hidden   = true;
    fcDrillDone.hidden = true;
    if (fcFlipCard) fcFlipCard.style.visibility = 'hidden';
    fcDrill.hidden = false;
    showDrillCard();
    if (fcFlipCard) fcFlipCard.style.visibility = '';
    enterDrillFullscreen();
  }

  // ── Filter helpers ────────────────────────────────────────────────────────
  const ALL_CATS     = ['cognate', 'false-friend', 'divergence', 'new'];
  const ALL_WORD_TYPES = ['noun', 'verb', 'adjective', 'adverb', 'phrase'];
  const ALL_STATUSES = ['due', 'new-card', 'upcoming', 'mastered'];

  const CAT_NAMES = {
    'cognate':      'Same in Spanish',
    'false-friend': 'False Friend',
    'divergence':   'Used differently',
    'new':          'New word',
  };
  const WORD_TYPE_NAMES = {
    'noun': 'Noun',
    'verb': 'Verb',
    'adjective': 'Adjective',
    'adverb': 'Adverb',
    'phrase': 'Phrase',
  };
  const STATUS_NAMES = {
    'due':      'Due today',
    'new-card': 'New',
    'upcoming': 'Upcoming',
    'mastered': 'Mastered',
  };

  function getCardStatus(card) {
    if (!card.reviewCount) return 'new-card';
    if (isDue(card))       return 'due';
    if ((card.easeFactor || 2.5) > 3.5 && (card.interval || 0) > 30) return 'mastered';
    return 'upcoming';
  }

  function getFiltered() {
    const cards       = loadCards();
    const allCatsOn   = ALL_CATS.every(c => activeCats.has(c));
    const allWordTypesOn = ALL_WORD_TYPES.every(wt => activeWordTypes.has(wt));
    const allStatusOn = ALL_STATUSES.every(s => activeStatuses.has(s));
    return cards.filter((c) => {
      if (!allCatsOn && !activeCats.has(c.category || 'new')) return false;
      if (!allWordTypesOn && !activeWordTypes.has((c.wordType || 'other'))) return false;
      if (!allStatusOn && !activeStatuses.has(getCardStatus(c))) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          c.italian.toLowerCase().includes(q) ||
          c.english.toLowerCase().includes(q) ||
          (c.spanish || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }

  // ── Dropdown helpers ──────────────────────────────────────────────────────
  function updateCatBtn() {
    const btn = $('fc-cat-btn');
    if (!btn) return;
    const allCatsOn = ALL_CATS.every(c => activeCats.has(c));
    const allWordTypesOn = ALL_WORD_TYPES.every(wt => activeWordTypes.has(wt));
    if (allCatsOn && allWordTypesOn) {
      btn.textContent = 'Type: All ▾';
      btn.classList.remove('fc-dropdown-btn--active');
    } else {
      const catLabels = allCatsOn
        ? []
        : ALL_CATS.filter(c => activeCats.has(c)).map(c => CAT_NAMES[c]);
      const wordTypeLabels = allWordTypesOn
        ? []
        : ALL_WORD_TYPES.filter(wt => activeWordTypes.has(wt)).map(wt => WORD_TYPE_NAMES[wt]);
      const labels = [...catLabels, ...wordTypeLabels];
      btn.textContent = labels.length ? `Type: ${labels.join(', ')} ▾` : 'Type: All ▾';
      btn.classList.toggle('fc-dropdown-btn--active', labels.length > 0);
    }
  }

  function updateStatusBtn() {
    const btn = $('fc-status-btn');
    if (!btn) return;
    const allOn = ALL_STATUSES.every(s => activeStatuses.has(s));
    if (allOn) {
      btn.textContent = 'Status: All ▾';
      btn.classList.remove('fc-dropdown-btn--active');
    } else {
      const labels = ALL_STATUSES.filter(s => activeStatuses.has(s)).map(s => STATUS_NAMES[s]);
      btn.textContent = labels.length ? `Status: ${labels.join(', ')} ▾` : 'Status: None ▾';
      btn.classList.toggle('fc-dropdown-btn--active', labels.length > 0);
    }
  }

  function closeDropdowns() {
    const cp = $('fc-cat-panel'), sp = $('fc-status-panel');
    if (cp) cp.hidden = true;
    if (sp) sp.hidden = true;
    openDropdownId = null;
  }

  function toggleDropdown(which) {
    const targetPanel = which === 'cat' ? $('fc-cat-panel') : $('fc-status-panel');
    const otherPanel  = which === 'cat' ? $('fc-status-panel') : $('fc-cat-panel');
    if (!targetPanel) return;
    if (openDropdownId === which) {
      targetPanel.hidden = true;
      openDropdownId = null;
    } else {
      if (otherPanel) otherPanel.hidden = true;
      targetPanel.hidden = false;
      openDropdownId = which;
    }
  }

  // ── Library render ────────────────────────────────────────────────────────
  function renderLibrary() {
    const total    = loadCards().length;
    const filtered = getFiltered();

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
        <details class="fc-card" data-id="${card.id}" style="--fc-cat:${color}">
          <summary class="fc-card-body">
            <div class="fc-card-it-row">
              <span class="fc-card-italian">${escapeHTML(card.italian)}</span>${card.nounNumber ? `<span class="fc-noun-number">(${card.nounNumber})</span>` : ''}
              <div class="fc-card-head-actions">
                <button class="speak-btn fc-card-speak-btn" data-word="${escapeHTML(card.italian)}" aria-label="Pronounce" title="Pronounce">🔊</button>
                <button class="fc-delete-btn" data-id="${card.id}" aria-label="Delete card">✕</button>
              </div>
            </div>
            <div class="fc-card-en">${escapeHTML(card.english)}</div>
            <div class="fc-card-foot">
              <span class="fc-cat-badge" style="border-color:${color};color:${color}">${label}</span>
              ${irregularBadge(card)}
              ${dueLabel}
              ${accuracyBadge}
            </div>
          </summary>
          <div class="fc-card-details">
            ${card.baseForm ? `<div class="fc-card-base">Base: ${escapeHTML(card.baseForm)} · ${escapeHTML(card.baseFormEN)}</div>` : ''}
            ${card.nounOtherForm ? `<div class="fc-card-other-form">Other form: ${escapeHTML(card.nounOtherForm)}</div>` : ''}
            ${card.example ? `<div class="fc-card-example"><span class="fc-card-example-it">${escapeHTML(card.example)}</span><span class="fc-card-example-en">${escapeHTML(card.exampleEN || '')}</span></div>` : ''}
            ${card.note ? `<p class="fc-card-note">${escapeHTML(card.note)}</p>` : ''}
            <span class="fc-card-source">${escapeHTML(source)}</span>
          </div>
        </details>`;
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

  // ── Dropdown filter wiring ────────────────────────────────────────────────
  const catBtn    = $('fc-cat-btn');
  const statusBtn = $('fc-status-btn');

  catBtn && catBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleDropdown('cat'); });
  statusBtn && statusBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleDropdown('status'); });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.fc-dropdown-wrap')) closeDropdowns();
  });

  // Category checkboxes
  document.querySelectorAll('.fc-cat-check').forEach((cb) => {
    cb.addEventListener('change', () => {
      if (cb.checked) activeCats.add(cb.dataset.cat);
      else            activeCats.delete(cb.dataset.cat);
      // If nothing selected, reset to all
      if (activeCats.size === 0) {
        ALL_CATS.forEach(c => activeCats.add(c));
        document.querySelectorAll('.fc-cat-check').forEach(c => { c.checked = true; });
      }
      updateCatBtn();
      renderLibrary();
    });
  });

  // Word type checkboxes
  document.querySelectorAll('.fc-wordtype-check').forEach((cb) => {
    cb.addEventListener('change', () => {
      if (cb.checked) activeWordTypes.add(cb.dataset.wordtype);
      else            activeWordTypes.delete(cb.dataset.wordtype);
      // If nothing selected, reset to all
      if (activeWordTypes.size === 0) {
        ALL_WORD_TYPES.forEach(wt => activeWordTypes.add(wt));
        document.querySelectorAll('.fc-wordtype-check').forEach(c => { c.checked = true; });
      }
      updateCatBtn();
      renderLibrary();
    });
  });

  // Status checkboxes
  document.querySelectorAll('.fc-status-check').forEach((cb) => {
    cb.addEventListener('change', () => {
      if (cb.checked) activeStatuses.add(cb.dataset.status);
      else            activeStatuses.delete(cb.dataset.status);
      // If nothing selected, reset to all
      if (activeStatuses.size === 0) {
        ALL_STATUSES.forEach(s => activeStatuses.add(s));
        document.querySelectorAll('.fc-status-check').forEach(c => { c.checked = true; });
      }
      updateStatusBtn();
      renderLibrary();
    });
  });

  fcSearch.addEventListener('input', () => {
    searchQuery = fcSearch.value.trim();
    renderLibrary();
  });

  // ── Badge update ──────────────────────────────────────────────────────────
  function updateBadge() {
    const cards    = loadCards();
    const count    = cards.length;
    const dueCount = countDue(cards);

    // Sidebar: text label "N due today"
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
    fcDrillReverseBtn.textContent = drillReverse ? 'Standard' : 'Reverse';
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
    const total = sessionCorrect + sessionAgain;
    const text  = total === 0 ? '' : `This session: ${sessionCorrect}/${total} correct`;
    if (fcSessionStats)  fcSessionStats.textContent  = text;
    if (drillFsSession)  drillFsSession.textContent  = text;
  }

  function showNoDueScreen(notDue) {
    if (!fcNoDue) return;
    const soonest = [...notDue].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0];
    if (fcNoDueMsg && soonest) {
      fcNoDueMsg.textContent = `Next card due: ${formatAbsDate(soonest.dueDate)}`;
    }
    const fcDrillSetup = $('fc-drill-setup');
    if (fcDrillSetup) fcDrillSetup.hidden = true;
    fcBrowse.hidden  = true;
    fcToolbar.hidden = false;
    fcNoDue.hidden   = false;
  }

  function showNoWeakScreen() {
    if (!fcNoWeak) return;
    const fcDrillSetup = $('fc-drill-setup');
    if (fcDrillSetup) fcDrillSetup.hidden = true;
    fcBrowse.hidden  = true;
    fcToolbar.hidden = false;
    if (fcNoDue) fcNoDue.hidden = true;
    fcNoWeak.hidden  = false;
  }

  function startDrill(drillAll) {
    // Read selected word type from radio button (if drill setup was shown)
    const typeRadio   = document.querySelector('.fc-drill-type-radio:checked');
    const wordType    = typeRadio ? typeRadio.value : 'all';
    const fcDrillSetup = $('fc-drill-setup');
    if (fcDrillSetup) fcDrillSetup.hidden = true;

    let filtered = getFiltered();
    if (wordType === 'weak') {
      filtered = filtered.filter((c) => {
        if (!(c.reviewCount > 0)) return false;
        const total = (c.timesCorrect || 0) + (c.timesWrong || 0);
        return total > 0 && (c.timesCorrect || 0) / total <= 0.5;
      });
      if (!filtered.length) {
        showNoWeakScreen();
        return;
      }
    } else if (wordType !== 'all') {
      filtered = filtered.filter((c) => (c.wordType || 'other') === wordType);
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

    currentDrillWordType = wordType;
    currentDrillAll      = drillAll;
    drillQueue          = queue;
    drillTotal          = drillQueue.length;
    drillCorrect        = 0;
    trickyCards         = [];
    sessionCorrect      = 0;
    sessionAgain        = 0;
    sessionDrilledCards = new Map();
    localStorage.removeItem(DRILL_POS_KEY); // fresh session — clear any old position
    updateSessionStats();

    if (fcNoDue)  fcNoDue.hidden  = true;
    if (fcNoWeak) fcNoWeak.hidden = true;
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
    if (fcNoDue)  fcNoDue.hidden  = true;
    if (fcNoWeak) fcNoWeak.hidden = true;
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

    fcDrillStatus.textContent = `${done + 1} / ${drillTotal}`;
    syncFsStatus(`${done + 1} / ${drillTotal}`);
    saveDrillPosition();

    if (drillReverse) {
      fcFlipWord.textContent     = card.english;
      fcFlipSource.textContent   = '';
      if (fcFlipPrompt) fcFlipPrompt.textContent = 'What is this in Italian?';
      if (fcFrontSpeakBtn) fcFrontSpeakBtn.hidden = true;
      renderFrontMeta(card);

      fcFlipWordBack.textContent = card.italian;
      if (fcFlipBase) {
        fcFlipBase.textContent = card.baseForm ? `Base: ${card.baseForm} · ${card.baseFormEN}` : '';
        fcFlipBase.hidden = !card.baseForm;
      }
      fcFlipAnswer.innerHTML =
        `<span class="fc-cat-badge" style="border-color:${color};color:${color}">${label}</span>${irregularBadge(card)}`
        + (card.nounOtherForm ? `<div class="fc-flip-other-form">Other form: ${escapeHTML(card.nounOtherForm)}</div>` : '');
      fcFlipNote.textContent = card.note || '';
      fcFlipNote.hidden = !card.note;
    } else {
      fcFlipWord.textContent     = card.italian;
      fcFlipSource.textContent   = card.sourceArticle ? `From: ${card.sourceArticle}` : '';
      if (fcFlipPrompt) fcFlipPrompt.textContent = 'What does this mean?';
      if (fcFrontSpeakBtn) fcFrontSpeakBtn.hidden = false;
      renderFrontMeta(card);

      fcFlipWordBack.textContent = card.italian;
      if (fcFlipBase) {
        fcFlipBase.textContent = card.baseForm ? `Base: ${card.baseForm} · ${card.baseFormEN}` : '';
        fcFlipBase.hidden = !card.baseForm;
      }
      fcFlipAnswer.innerHTML = `
        <div class="fc-flip-en">${escapeHTML(card.english)}</div>
        ${card.spanish ? `<div class="fc-flip-es">${escapeHTML(card.spanish)}</div>` : ''}
        <span class="fc-cat-badge" style="border-color:${color};color:${color}">${label}</span>${irregularBadge(card)}`
        + (card.nounOtherForm ? `<div class="fc-flip-other-form">Other form: ${escapeHTML(card.nounOtherForm)}</div>` : '');
      fcFlipNote.textContent = card.note || '';
      fcFlipNote.hidden = !card.note;
    }

    fcFlipInner.classList.remove('flipped');
    fcFlipBtn.disabled = false;
  }

  function endDrill() {
    clearDrillPosition(); // session complete — remove resume indicator
    fcDrill.hidden     = true;
    fcDrillDone.hidden = false;

    const pct = drillTotal > 0 ? Math.round((drillCorrect / drillTotal) * 100) : 0;
    fcDrillScore.textContent = `${drillCorrect} / ${drillTotal} correct (${pct}%)`;
    window.dispatchEvent(new CustomEvent('ponte:drill-session-ended', {
      detail: { count: drillTotal, correct: drillCorrect, accuracy: pct, isWeak: currentDrillWordType === 'weak' },
    }));

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
    if (fcNoDue)  fcNoDue.hidden  = true;
    if (fcNoWeak) fcNoWeak.hidden = true;
    const fcDrillSetup = $('fc-drill-setup');
    if (fcDrillSetup) fcDrillSetup.hidden = true;
    fcToolbar.hidden   = false;
    fcBrowse.hidden    = false;
    leaveDrillFullscreen();
    updateResumeIndicator();
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

  // Show drill setup screen before entering drill
  fcDrillToggle.addEventListener('click', () => {
    closeDropdowns();
    const fcDrillSetup = $('fc-drill-setup');
    if (!fcDrillSetup) { startDrill(false); return; }
    // Reset radio to "all"
    const allRadio = document.querySelector('.fc-drill-type-radio[value="all"]');
    if (allRadio) allRadio.checked = true;
    fcBrowse.hidden    = true;
    fcToolbar.hidden   = true;
    fcDrillSetup.hidden = false;
  });

  const fcDrillStartBtn    = $('fc-drill-start-btn');
  const fcDrillSetupCancel = $('fc-drill-setup-cancel');

  fcDrillStartBtn && fcDrillStartBtn.addEventListener('click', () => startDrill(false));

  fcDrillSetupCancel && fcDrillSetupCancel.addEventListener('click', () => {
    const fcDrillSetup = $('fc-drill-setup');
    if (fcDrillSetup) fcDrillSetup.hidden = true;
    fcBrowse.hidden  = false;
    fcToolbar.hidden = false;
  });

  fcExitDrill.addEventListener('click', exitDrill);
  fcDrillRestart.addEventListener('click', () => startDrill(false));

  // ── Listen for saves from app.js ──────────────────────────────────────────
  window.addEventListener('ponte:flashcard-saved', () => {
    backfillDueDates();
    renderLibrary();
    updateBadge();
  });

  // ── Word lookup modal (+ Add word) ───────────────────────────────────────
  const wlBackdrop  = $('wl-backdrop');
  const wlModal     = $('wl-modal');
  const wlClose     = $('wl-close');
  const wlInput     = $('wl-input');
  const wlSearchBtn = $('wl-search-btn');
  const wlStatus    = $('wl-status');
  const wlResult    = $('wl-result');
  const wlResultWord  = $('wl-result-word');
  const wlResultBadge = $('wl-result-badge');
  const wlResultEn    = $('wl-result-en');
  const wlResultEs    = $('wl-result-es');
  const wlResultNote  = $('wl-result-note');
  const wlSaveBtn     = $('wl-save-btn');
  const fcAddWordBtn  = $('fc-add-word-btn');
  const wlLangIt      = $('wl-lang-it');
  const wlLangEn      = $('wl-lang-en');
  const wlHint        = $('wl-hint');

  let wlDirection = 'it'; // 'it' | 'en'

  function setWlDirection(dir) {
    wlDirection = dir;
    wlLangIt && wlLangIt.classList.toggle('active', dir === 'it');
    wlLangEn && wlLangEn.classList.toggle('active', dir === 'en');
    if (wlInput) {
      wlInput.placeholder = dir === 'en' ? 'Enter an English word…' : 'Italian word or phrase…';
    }
    if (wlHint) {
      wlHint.textContent = dir === 'en'
        ? 'Enter an English word to find the Italian translation'
        : 'Enter an Italian word to look up and save';
    }
    if (wlResult) wlResult.hidden = true;
    if (wlStatus) wlStatus.hidden = true;
    wlCurrentEntry = null;
  }

  const BADGE_COLORS = {
    'cognate':      '#2E6B3E',
    'false-friend': '#B83232',
    'divergence':   '#B85C00',
    'new':          '#888888',
  };
  const BADGE_LABELS = {
    'cognate':      'Same in Spanish',
    'false-friend': 'False Friend',
    'divergence':   'Used differently',
    'new':          'New word',
  };

  let wlCurrentEntry = null; // last successful translate result

  function openWordLookup() {
    if (!wlModal) return;
    wlInput.value = '';
    wlCurrentEntry = null;
    setWlDirection('it');
    wlBackdrop.hidden = false;
    wlModal.hidden = false;
    setTimeout(() => wlInput.focus(), 50);
  }

  function closeWordLookup() {
    if (!wlModal) return;
    wlModal.hidden = true;
    wlBackdrop.hidden = true;
  }

  async function runWordLookup() {
    const word = wlInput.value.trim();
    if (!word) return;

    wlSearchBtn.disabled = true;
    wlResult.hidden = true;
    wlStatus.hidden = false;
    wlStatus.textContent = 'Translating…';
    wlCurrentEntry = null;

    const endpoint = wlDirection === 'en' ? '/api/translate-to-italian' : '/api/translate';
    const body = wlDirection === 'en'
      ? JSON.stringify({ text: word })
      : JSON.stringify({ text: word, context: '' });

    const NO_RESULT_MSG = wlDirection === 'en'
      ? 'No Italian translation found. Try a different English word.'
      : "No Italian word found. Try entering an Italian word (e.g. 'mangiare', 'bello', 'subito')";

    try {
      const resp = await fetch(API_BASE + endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      if (!resp.ok) throw new Error('Server error');
      const entry = await resp.json();

      if (!entry.italian || entry.english === '(translation failed)') {
        wlStatus.textContent = NO_RESULT_MSG;
        return;
      }

      wlCurrentEntry = entry;
      wlStatus.hidden = true;

      const cat   = entry.category || 'new';
      const color = BADGE_COLORS[cat] || BADGE_COLORS['new'];
      const label = BADGE_LABELS[cat] || cat;

      wlResultWord.textContent  = entry.italian || word;
      wlResultBadge.textContent = label;
      wlResultBadge.style.setProperty('--tooltip-accent', color);
      wlResultBadge.style.borderColor = color;
      wlResultBadge.style.color       = color;
      wlResultEn.textContent   = entry.english  || '';
      wlResultEs.textContent   = entry.spanish  || '';
      wlResultNote.textContent = entry.note     || '';

      // Check if already saved
      const existing = loadCards().find(
        (c) => c.italian.toLowerCase() === (entry.italian || word).toLowerCase()
      );
      wlSaveBtn.textContent = existing ? 'Already saved ✓' : 'Save to Cards ★';
      wlSaveBtn.classList.toggle('saved', !!existing);

      wlResult.hidden = false;
    } catch (err) {
      wlStatus.textContent = NO_RESULT_MSG;
    } finally {
      wlSearchBtn.disabled = false;
    }
  }

  // ── Sync button ──────────────────────────────────────────────────────────
  const fcSyncBtn = $('fc-sync-btn');
  if (fcSyncBtn) {
    fcSyncBtn.addEventListener('click', async () => {
      if (!window.manualSyncFlashcards) return;
      fcSyncBtn.textContent = 'Syncing…';
      fcSyncBtn.disabled = true;
      try {
        await window.manualSyncFlashcards();
        fcSyncBtn.textContent = 'Synced ✓';
      } catch (_) {
        fcSyncBtn.textContent = 'Failed';
      }
      setTimeout(() => {
        fcSyncBtn.textContent = 'Sync';
        fcSyncBtn.disabled = false;
      }, 2000);
    });
  }

  if (fcAddWordBtn) {
    fcAddWordBtn.addEventListener('click', openWordLookup);
  }
  if (wlClose)    wlClose.addEventListener('click', closeWordLookup);
  if (wlBackdrop) wlBackdrop.addEventListener('click', closeWordLookup);
  if (wlLangIt)   wlLangIt.addEventListener('click', () => setWlDirection('it'));
  if (wlLangEn)   wlLangEn.addEventListener('click', () => setWlDirection('en'));

  if (wlSearchBtn) {
    wlSearchBtn.addEventListener('click', runWordLookup);
  }
  if (wlInput) {
    wlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') runWordLookup();
      if (e.key === 'Escape') closeWordLookup();
    });
  }

  if (wlSaveBtn) {
    wlSaveBtn.addEventListener('click', () => {
      if (!wlCurrentEntry || wlSaveBtn.classList.contains('saved')) return;
      const entry = wlCurrentEntry;
      const cards = loadCards();
      const italian = (entry.italian || wlInput.value).trim();
      if (cards.find((c) => c.italian.toLowerCase() === italian.toLowerCase())) {
        wlSaveBtn.textContent = 'Already saved ✓';
        wlSaveBtn.classList.add('saved');
        return;
      }
      const card = {
        id:           Date.now(),
        italian:      italian,
        english:      entry.english  || '',
        spanish:      entry.spanish  || '',
        category:     entry.category || 'new',
        note:         entry.note     || '',
        wordType:      entry.wordType      || 'other',
        baseForm:      entry.baseForm      || '',
        baseFormEN:    entry.baseFormEN    || '',
        nounNumber:    entry.nounNumber    || null,
        nounOtherForm: entry.nounOtherForm || null,
        savedAt:       new Date().toISOString(),
        sourceArticle: 'Word lookup',
        timesCorrect: 0,
        timesWrong:   0,
        lastSeen:     null,
        lastDrilled:  null,
        interval:     0,
        easeFactor:   2.5,
        dueDate:      null,
        reviewCount:  0,
        lastReviewed: null,
        grammarPatterns: [],
      };
      cards.push(card);
      saveCards(cards);
      renderLibrary();
      updateBadge();
      window.dispatchEvent(new CustomEvent('ponte:flashcard-saved'));
      wlSaveBtn.textContent = 'Saved ✓';
      wlSaveBtn.classList.add('saved');
    });
  }

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && wlModal && !wlModal.hidden) closeWordLookup();
  });

  // ── Init ─────────────────────────────────────────────────────────────────
  // app.js awaits syncFlashcardsFromServer() before calling _ponteFCRender,
  // so localStorage is guaranteed to have server cards on the first render.
  // switchTab also calls _ponteFCRender on every navigation to the Cards tab.
  window._ponteFCRender = function () {
    backfillDueDates();
    renderLibrary();
    updateBadge();
    updateResumeIndicator();
  };

  // Wire up resume banner buttons
  const fcResumeBtn     = $('fc-resume-btn');
  const fcResumeDismiss = $('fc-resume-dismiss');
  if (fcResumeBtn)     fcResumeBtn.addEventListener('click', resumeDrill);
  if (fcResumeDismiss) fcResumeDismiss.addEventListener('click', clearDrillPosition);

  // Render immediately from whatever is in localStorage.
  // app.js re-renders after sync completes, so this initial pass may show
  // an empty or partial deck — that's fine; it won't be blank.
  window._ponteFCRender();
})();
