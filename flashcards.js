(function () {
  'use strict';

  const FC_KEY      = 'ponte_flashcards';
  const EP_KEY      = 'ponte_error_patterns';
  const PENDING_KEY = 'ponte_pending_sync';
  // Drill resume state is now direction-specific:
  //   ponte_drill_position_it-en  — Italian → English session
  //   ponte_drill_position_en-it  — English → Italian session
  // The legacy single key ponte_drill_position is migrated below.
  const DRILL_POS_PREFIX = 'ponte_drill_position_';
  const API_BASE = (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  ) ? 'http://localhost:3000' : '';

  const CATEGORY_LABELS = {
    'same':         'Same word',
    'similar':      'Same/Similar',
    'false-friend': 'False Friend',
    'new':          'No Spanish link',
  };

  const CATEGORY_COLORS = {
    'same':         '#2E6B3E',
    'similar':      '#0E7490',
    'false-friend': '#B83232',
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
    if (card.category === 'similar')                patterns.push('divergence');
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

    function matchesTop(card) {
      if (ranked.length === 0) return false;
      const cardPatterns = detectErrorPatterns(card);
      return cardPatterns.some((p) => ranked.includes(p));
    }

    // accuracyRank(), not a local accuracy() — see cardAccuracy for why.
    const priority = due.filter(matchesTop).sort((a, b) => accuracyRank(a) - accuracyRank(b));
    const rest     = due.filter((c) => !matchesTop(c)).sort((a, b) => accuracyRank(a) - accuracyRank(b));
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
      const MAX_INTERVAL = 180;
      if (rc === 0)      newInterval = 1;
      else if (rc === 1) newInterval = 6;
      else               newInterval = Math.min(MAX_INTERVAL, Math.round(iv * ef));
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
  // Shared with visual-cards.js (#88) so the visual deck schedules with the
  // exact same SM-2 curve instead of a parallel implementation. Takes any
  // object carrying the SRS fields (interval/easeFactor/dueDate/reviewCount/
  // lastReviewed) — visual cards pass their own per-entry state records, not
  // main-deck cards, so the two systems share the algorithm but never the data.
  window.ponteApplySmTwo = applySmTwo;

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

  // Stricter than isDue: excludes never-drilled cards (those are "new", not due).
  // Used by the "Due today" drill subset.
  function isDueToday(card) {
    if (!(card.reviewCount > 0)) return false;
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
  const fcFlipFrontBadges = $('fc-flip-front-badges');

  // Deep dive from the drill flip-card back → opens the Deep-dive screen (issue #62)
  const fcDeepDiveBtn = $('fc-deep-dive-btn');
  if (fcDeepDiveBtn) {
    fcDeepDiveBtn.addEventListener('click', () => {
      const card = drillQueue[0];
      if (card && card.italian && window.ponteDeepDive) window.ponteDeepDive(card.italian);
    });
  }
  const fcFlipExample     = $('fc-flip-example');
  const fcFlipExampleIt   = $('fc-flip-example-it');
  const fcFlipExampleEn   = $('fc-flip-example-en');

  const WORD_TYPE_DISPLAY = {
    noun: 'Noun', verb: 'Verb', adjective: 'Adjective',
    adverb: 'Adverb', phrase: 'Phrase', other: 'Other',
  };

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
  // New filter system: 4 single-select filters + sort + search.
  let activePerf     = 'all'; // all|new|struggling|learning|strong|mastered|due
  let activeWordType = 'all'; // all|noun|verb|adjective|adverb|phrase|verb-irregular
  let activeCategory = 'all'; // all|same|similar|false-friend|new
  let activeSource   = 'all'; // all|starter|reader|practice|scripted|conversation|manual
  let activeSort     = 'due'; // due|accuracy-asc|accuracy-desc|recent|oldest|most-drilled|alpha
  let searchQuery    = '';
  let drillQueue           = [];
  let drillTotal           = 0;
  let drillCorrect         = 0;
  let trickyCards          = [];
  let currentDrillWordType = 'all';
  let currentDrillAll      = true;
  // Set when the drill-setup screen was opened from "Drill anyway" (no cards
  // due today) rather than the normal Drill button — the Start button then
  // needs startDrill(true) so a subset with 0 due cards doesn't loop back to
  // the no-due screen and silently discard the user's choice.
  let drillSetupFromAnyway = false;
  let sessionCorrect      = 0;
  let sessionAgain        = 0;
  // The counter denominator grows when a missed card is re-inserted, which
  // reads as a bug without explanation. Shown once per session, on the first
  // re-queue, then left up for the rest of the session.
  let requeueNoticeShown  = false;
  let sessionDrilledCards = new Map(); // id → { italian, interval }
  // Drill direction is persisted as 'it-en' or 'en-it' under ponte_drill_direction.
  // Falls back to the legacy ponte_drill_reverse boolean flag if the new key is unset.
  let drillReverse = (function () {
    const dir = localStorage.getItem('ponte_drill_direction');
    if (dir === 'en-it') return true;
    if (dir === 'it-en') return false;
    return localStorage.getItem('ponte_drill_reverse') === 'true';
  })();
  function persistDrillDirection() {
    localStorage.setItem('ponte_drill_direction', drillReverse ? 'en-it' : 'it-en');
  }

  // ── Drill position persistence ────────────────────────────────────────────
  // Each direction has its own resume state so IT→EN and EN→IT progress
  // counters never overwrite each other.
  function drillPosKey(reverse) {
    const dir = (reverse === undefined ? drillReverse : reverse) ? 'en-it' : 'it-en';
    return DRILL_POS_PREFIX + dir;
  }

  // One-time migration from the legacy single key. Runs synchronously at
  // module init (see IIFE call below).
  function migrateLegacyDrillPosition() {
    const legacy = localStorage.getItem('ponte_drill_position');
    if (!legacy) return;
    const itEnKey = DRILL_POS_PREFIX + 'it-en';
    if (!localStorage.getItem(itEnKey)) {
      // Pre-direction sessions were always IT→EN — preserve as such.
      localStorage.setItem(itEnKey, legacy);
    }
    localStorage.removeItem('ponte_drill_position');
  }
  migrateLegacyDrillPosition();

  function saveDrillPosition() {
    if (!drillQueue.length) return;
    const done = drillTotal - drillQueue.length;
    localStorage.setItem(drillPosKey(), JSON.stringify({
      current:      done + 1,
      total:        drillTotal,
      wordType:     currentDrillWordType,
      drillAll:     currentDrillAll,
      remainingIds: drillQueue.map((c) => c.id),
      correct:      drillCorrect,
    }));
  }

  function clearDrillPosition() {
    localStorage.removeItem(drillPosKey());
    updateResumeIndicator();
  }

  function loadDrillPosition() {
    try { return JSON.parse(localStorage.getItem(drillPosKey())); }
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

    // #53: cards deleted since the session was saved are silently dropped by the
    // filter above. Reduce the session total by the number dropped so the X/Y
    // progress counter (and the final score) stay accurate for the rest of the
    // session instead of counting phantom, no-longer-existent cards.
    const dropped = pos.remainingIds.length - queue.length;

    drillQueue           = queue;
    drillTotal           = pos.total - dropped;
    drillCorrect         = pos.correct || 0;
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

  // ── Accuracy: one source of truth ────────────────────────────────────────
  // Accuracy as a 0–1 fraction; null when the card has never been answered.
  // This is the ONLY accuracy function. There used to be two more — a local
  // accuracy() in sortDueByPatterns and audioAccuracy() in the audio weighting
  // — both of which returned a literal 0.5 for zero-answer cards. That made
  // them indistinguishable from genuine 50% performers, which is #81: with a
  // due pool of nothing but zero-answer cards every key tied, and the stable
  // worst-first sort silently returned deck order.
  function cardAccuracy(card) {
    const total = (card.timesCorrect || 0) + (card.timesWrong || 0);
    if (total === 0) return null;
    return (card.timesCorrect || 0) / total;
  }

  // Rank for worst-first ordering. Cards with no answers yet are not known
  // failures, but they are the ones we most need data on, so they sort
  // immediately after "struggling" (< 0.5) and ahead of everything else.
  // Never substitute a bare 0.5 here — see cardAccuracy above.
  const ACCURACY_UNKNOWN_RANK = 0.5 - Number.EPSILON;

  function accuracyRank(card) {
    const a = cardAccuracy(card);
    return a === null ? ACCURACY_UNKNOWN_RANK : a;
  }

  // Weak = answered at least once, and getting it wrong at least half the time.
  // The answered-at-least-once guard is what keeps zero-answer cards out.
  function isWeakCard(card) {
    const a = cardAccuracy(card);
    return a !== null && a <= 0.5;
  }

  function isIrregularVerb(card) {
    if (card.wordType !== 'verb') return false;
    const check = (s) => s && IRREGULAR_VERBS.has(s.toLowerCase().trim());
    return check(card.italian) || check(card.baseForm);
  }

  function isMasteredCard(card) {
    return (card.interval || 0) > 21;
  }

  function isDueOrOverdue(card) {
    if (card.dueDate == null) return (card.reviewCount || 0) > 0;
    return new Date(card.dueDate).getTime() <= Date.now();
  }

  function getCardSource(card) {
    const src = card.sourceArticle;
    if (src == null || src === '')         return 'manual';
    if (src === 'Starter deck')            return 'starter';
    if (src === 'Word lookup' ||
        src === 'Translate lookup')        return 'manual';
    if (src.startsWith('Practice'))        return 'practice';
    if (src.startsWith('Scripted:'))       return 'scripted';
    if (src.startsWith('Conversation:'))   return 'conversation';
    return 'reader'; // any non-empty, non-prefixed source = reader article title
  }

  function matchesPerformance(card) {
    if (activePerf === 'all') return true;
    const acc = cardAccuracy(card);
    switch (activePerf) {
      // "New (never drilled)" means never *answered*. Testing reviewCount
      // instead left any card with a review but no answers matching no filter
      // at all — invisible in the library (#81).
      case 'new':        return acc === null;
      case 'struggling': return acc !== null && acc < 0.5;
      case 'learning':   return acc !== null && acc >= 0.5 && acc < 0.8;
      case 'strong':     return acc !== null && acc >= 0.8;
      case 'mastered':   return isMasteredCard(card);
      case 'due':        return isDueOrOverdue(card);
      default:           return true;
    }
  }

  function matchesWordType(card) {
    if (activeWordType === 'all') return true;
    if (activeWordType === 'verb-irregular') return isIrregularVerb(card);
    return (card.wordType || 'other') === activeWordType;
  }

  function matchesCategory(card) {
    if (activeCategory === 'all') return true;
    return (card.category || 'new') === activeCategory;
  }

  function matchesSource(card) {
    if (activeSource === 'all') return true;
    return getCardSource(card) === activeSource;
  }

  function matchesSearch(card) {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (card.italian || '').toLowerCase().includes(q) ||
      (card.english || '').toLowerCase().includes(q) ||
      (card.spanish || '').toLowerCase().includes(q)
    );
  }

  function getFiltered() {
    return loadCards().filter(c =>
      matchesPerformance(c) &&
      matchesWordType(c) &&
      matchesCategory(c) &&
      matchesSource(c) &&
      matchesSearch(c)
    );
  }

  function applySort(cards) {
    const out = cards.slice();
    switch (activeSort) {
      case 'due':
        // Most overdue first; never-drilled-and-no-due last
        out.sort((a, b) => {
          const ta = a.dueDate ? new Date(a.dueDate).getTime()
                                : ((a.reviewCount || 0) > 0 ? -1 : Infinity);
          const tb = b.dueDate ? new Date(b.dueDate).getTime()
                                : ((b.reviewCount || 0) > 0 ? -1 : Infinity);
          return ta - tb;
        });
        break;
      case 'accuracy-asc':
        out.sort((a, b) => {
          const aa = cardAccuracy(a), ab = cardAccuracy(b);
          if (aa === null && ab === null) return 0;
          if (aa === null) return 1;
          if (ab === null) return -1;
          return aa - ab;
        });
        break;
      case 'accuracy-desc':
        out.sort((a, b) => {
          const aa = cardAccuracy(a), ab = cardAccuracy(b);
          if (aa === null && ab === null) return 0;
          if (aa === null) return 1;
          if (ab === null) return -1;
          return ab - aa;
        });
        break;
      case 'recent':
        out.sort((a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0));
        break;
      case 'oldest':
        out.sort((a, b) => new Date(a.savedAt || 0) - new Date(b.savedAt || 0));
        break;
      case 'most-drilled':
        out.sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0));
        break;
      case 'alpha':
        out.sort((a, b) => (a.italian || '').localeCompare(b.italian || '', 'it'));
        break;
    }
    return out;
  }

  function activeFilterCount() {
    let n = 0;
    if (activePerf     !== 'all') n++;
    if (activeWordType !== 'all') n++;
    if (activeCategory !== 'all') n++;
    if (activeSource   !== 'all') n++;
    return n;
  }

  // ── Dropdown UI helpers ───────────────────────────────────────────────────

  // #13: was 5 separate buttons, each with its own "Prefix: value ▾" label.
  // Consolidated into one Filters button — its current-selection text lives
  // per-section inside the panel now (the checked radio itself), so this
  // only needs to update the badge count and the button's active styling.
  // Only updates the badge <span> and the button's class, never
  // btn.textContent — that would wipe out the badge element itself.
  function updateFilterButtons() {
    const btn   = $('fc-filters-btn');
    const badge = $('fc-filter-badge');
    const count = activeFilterCount();
    if (badge) {
      badge.textContent = String(count);
      badge.hidden = count === 0;
    }
    if (btn) btn.classList.toggle('fc-dropdown-btn--active', count > 0);

    const clearBtn = $('fc-clear-filters');
    if (clearBtn) clearBtn.hidden = count === 0;
  }

  function clearAllFilters() {
    activePerf = activeWordType = activeCategory = activeSource = 'all';
    document.querySelectorAll('input[name="fc-perf"], input[name="fc-type"], input[name="fc-cat"], input[name="fc-src"]')
      .forEach(r => { r.checked = (r.value === 'all'); });
    updateFilterButtons();
    renderLibrary();
  }

  function closeDropdowns() {
    document.querySelectorAll('#fc-toolbar .fc-dropdown-panel').forEach(p => { p.hidden = true; });
  }

  // ── Library render ────────────────────────────────────────────────────────
  function renderLibrary() {
    const total      = loadCards().length;
    const filtered   = applySort(getFiltered());
    const filterN    = activeFilterCount();

    let countText;
    if (filterN === 0 && !searchQuery) {
      countText = `${total} card${total !== 1 ? 's' : ''}`;
    } else {
      const pre = filterN > 0
        ? `${filterN} filter${filterN !== 1 ? 's' : ''} active · `
        : '';
      countText = `${pre}${filtered.length} of ${total}`;
    }
    fcCount.textContent = countText;

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
              <span class="fc-card-italian">${escapeHTML(card.italian)}</span>${card.nounNumber ? `<span class="fc-noun-number">(${escapeHTML(card.nounNumber)})</span>` : ''}
              <div class="fc-card-head-actions">
                <button class="speak-btn fc-card-speak-btn" data-word="${escapeHTML(card.italian)}" aria-label="Pronounce" title="Pronounce">🔊</button>
                <button class="fc-delete-btn" data-id="${card.id}" aria-label="Delete card">✕</button>
              </div>
            </div>
            <div class="fc-card-en">${escapeHTML(card.english)}</div>
            <div class="fc-card-foot">
              <span class="fc-cat-badge" style="border-color:${color};color:${color}">${escapeHTML(label)}</span>
              ${card.wordType && WORD_TYPE_DISPLAY[card.wordType] ? `<span class="fc-wordtype-badge">${escapeHTML(WORD_TYPE_DISPLAY[card.wordType])}</span>` : ''}
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
      window.ponteSpeakCard(speakBtn.dataset.word);
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
  // One delegated click handler opens/closes any of the 5 dropdowns; a click
  // outside any of them closes everything.
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#fc-toolbar .fc-dropdown-btn');
    if (btn) {
      e.stopPropagation();
      const panel = btn.parentElement && btn.parentElement.querySelector('.fc-dropdown-panel');
      if (!panel) return;
      const wasOpen = !panel.hidden;
      closeDropdowns();
      if (!wasOpen) panel.hidden = false;
      return;
    }
    if (!e.target.closest('#fc-toolbar .fc-dropdown-wrap')) closeDropdowns();
  });

  // Single delegated 'change' handler maps each radio name → state slot.
  // Map-driven so adding a new filter is one entry plus an HTML block.
  const RADIO_HANDLERS = {
    'fc-perf': (v) => { activePerf     = v; },
    'fc-type': (v) => { activeWordType = v; },
    'fc-cat':  (v) => { activeCategory = v; },
    'fc-src':  (v) => { activeSource   = v; },
    'fc-sort': (v) => { activeSort     = v; },
  };
  document.addEventListener('change', (e) => {
    const r = e.target;
    if (!r || r.type !== 'radio' || !RADIO_HANDLERS[r.name]) return;
    RADIO_HANDLERS[r.name](r.value);
    updateFilterButtons();
    // #13: used to closeDropdowns() here — correct when each filter had its
    // own single-purpose dropdown, but now all 5 live in one Filters panel,
    // so closing on the first selection would force reopening it 5 times to
    // set every dimension. Panel now only closes via the button toggle or a
    // click outside it.
    renderLibrary();
  });

  const fcClearFilters = $('fc-clear-filters');
  fcClearFilters && fcClearFilters.addEventListener('click', clearAllFilters);

  fcSearch.addEventListener('input', () => {
    searchQuery = fcSearch.value.trim();
    renderLibrary();
  });

  // Initial filter button state
  updateFilterButtons();

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
    if (!confirm(
      'Reset all drill scores?\n\n' +
      'This clears every card\'s correct/wrong counts AND its review schedule. ' +
      'All cards return to the new-card pool and become due immediately.\n\n' +
      'This cannot be undone.'
    )) return;
    // Full revert to the new-card shape. Clearing only the score fields left
    // reviewCount/interval/dueDate behind, so cards stayed "due" with no
    // performance history and a flat accuracy (#81).
    const cards = loadCards().map((c) => ({
      ...c,
      timesCorrect: 0,
      timesWrong:   0,
      lastSeen:     null,
      lastDrilled:  null,
      interval:     0,
      easeFactor:   2.5,
      dueDate:      null,
      reviewCount:  0,
      lastReviewed: null,
    }));
    saveCards(cards);
    renderLibrary();
  });

  // ── Drill direction (IT→EN / EN→IT) ───────────────────────────────────────
  // The setup screen buttons select direction before a session starts; the
  // topbar pill mirrors current direction and toggles mid-session. Both share
  // the drillReverse flag and persist via persistDrillDirection().
  function updateDirectionUI() {
    // Setup screen buttons
    document.querySelectorAll('#fc-drill-dir-btns .fc-drill-dir-btn').forEach(b => {
      const isActive = (b.dataset.dir === 'en-it') === drillReverse;
      b.classList.toggle('active', isActive);
    });
    // Topbar indicator (also acts as a click-to-toggle)
    if (fcDrillReverseBtn) {
      fcDrillReverseBtn.textContent = drillReverse
        ? '🇬🇧 English → Italian'
        : '🇮🇹 Italian → English';
      fcDrillReverseBtn.title = 'Click to switch drill direction';
      fcDrillReverseBtn.classList.toggle('active', drillReverse);
    }
  }

  function setDrillDirection(reverse) {
    if (drillReverse === reverse) return;
    drillReverse = reverse;
    persistDrillDirection();
    updateDirectionUI();
    // Each direction has its own resume state — refresh the banner so it
    // reflects the new direction when the library next becomes visible.
    updateResumeIndicator();
    if (!fcDrill.hidden && drillQueue.length) showDrillCard();
  }

  // Setup-screen buttons
  document.querySelectorAll('#fc-drill-dir-btns .fc-drill-dir-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setDrillDirection(btn.dataset.dir === 'en-it');
    });
  });

  // Topbar pill — toggles current direction mid-session
  fcDrillReverseBtn && fcDrillReverseBtn.addEventListener('click', () => {
    setDrillDirection(!drillReverse);
  });

  updateDirectionUI();

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

  function showRequeueNotice() {
    if (requeueNoticeShown) return;
    requeueNoticeShown = true;
    const inline = $('fc-requeue-note');
    const fs     = $('drill-fs-note');
    if (inline) inline.hidden = false;
    if (fs)     fs.hidden     = false;
  }

  function hideRequeueNotice() {
    requeueNoticeShown = false;
    const inline = $('fc-requeue-note');
    const fs     = $('drill-fs-note');
    if (inline) inline.hidden = true;
    if (fs)     fs.hidden     = true;
  }

  function showNoDueScreen(notDue) {
    if (!fcNoDue) return;
    const titleEl = fcNoDue.querySelector('.fc-no-due-title');
    if (titleEl) titleEl.textContent = 'No cards due for review today';
    const soonest = [...notDue].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0];
    if (fcNoDueMsg && soonest) {
      fcNoDueMsg.textContent = `Next card due: ${formatAbsDate(soonest.dueDate)}`;
    }
    const drillAnyway = $('fc-drill-anyway');
    if (drillAnyway) drillAnyway.hidden = false;
    const fcDrillSetup = $('fc-drill-setup');
    if (fcDrillSetup) fcDrillSetup.hidden = true;
    fcBrowse.hidden  = true;
    fcToolbar.hidden = false;
    fcNoDue.hidden   = false;
  }

  function showNoDueTodayScreen() {
    if (!fcNoDue) return;
    const titleEl = fcNoDue.querySelector('.fc-no-due-title');
    if (titleEl) titleEl.textContent = 'No cards due today — great work!';
    if (fcNoDueMsg) {
      fcNoDueMsg.textContent = 'Try Weak words or drill by category.';
    }
    const drillAnyway = $('fc-drill-anyway');
    if (drillAnyway) drillAnyway.hidden = true;
    const fcDrillSetup = $('fc-drill-setup');
    if (fcDrillSetup) fcDrillSetup.hidden = true;
    fcBrowse.hidden  = true;
    fcToolbar.hidden = false;
    fcNoDue.hidden   = false;
  }

  // Refresh the (N) count next to each subset radio. Counts respect the
  // active library filters from getFiltered().
  function updateDrillSubsetCounts() {
    const base = getFiltered();
    const counts = {
      due:       base.filter(isDueToday).length,
      all:       base.length,
      noun:      base.filter((c) => (c.wordType || 'other') === 'noun').length,
      verb:      base.filter((c) => (c.wordType || 'other') === 'verb').length,
      adjective: base.filter((c) => (c.wordType || 'other') === 'adjective').length,
      adverb:    base.filter((c) => (c.wordType || 'other') === 'adverb').length,
      phrase:    base.filter((c) => (c.wordType || 'other') === 'phrase').length,
      weak:      base.filter(isWeakCard).length,
    };
    document.querySelectorAll('.fc-drill-type-count').forEach((el) => {
      const key = el.dataset.countFor;
      const n   = counts[key];
      el.textContent = (n === undefined) ? '' : `(${n})`;
    });
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
    const wordType    = typeRadio ? typeRadio.value : 'due';
    const fcDrillSetup = $('fc-drill-setup');
    if (fcDrillSetup) fcDrillSetup.hidden = true;

    let filtered = getFiltered();
    let dueOnly  = false;
    if (wordType === 'due') {
      filtered = filtered.filter(isDueToday);
      if (!filtered.length) {
        showNoDueTodayScreen();
        return;
      }
      dueOnly = true;
    } else if (wordType === 'weak') {
      filtered = filtered.filter(isWeakCard);
      if (!filtered.length) {
        showNoWeakScreen();
        return;
      }
    } else if (wordType !== 'all') {
      filtered = filtered.filter((c) => (c.wordType || 'other') === wordType);
    }
    if (!filtered.length) return;

    let queue;
    if (dueOnly) {
      queue = sortDueByPatterns(filtered);
    } else if (drillAll) {
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

    // Optional "Card count" field on the setup screen — caps an otherwise
    // all-or-nothing category down to a chosen number. Cards later in the
    // queue are already either lower-priority (due-sorted) or shuffled, so
    // a plain slice keeps the most relevant/random subset either way.
    const countInput = $('fc-drill-count-input');
    const limitN = countInput && countInput.value ? parseInt(countInput.value, 10) : 0;
    if (Number.isFinite(limitN) && limitN > 0 && limitN < queue.length) {
      queue = queue.slice(0, limitN);
    }
    if (countInput) countInput.value = ''; // don't leak into the next session

    currentDrillWordType = wordType;
    currentDrillAll      = drillAll;
    drillQueue          = queue;
    drillTotal          = drillQueue.length;
    drillCorrect        = 0;
    trickyCards         = [];
    sessionCorrect      = 0;
    sessionAgain        = 0;
    sessionDrilledCards = new Map();
    hideRequeueNotice();
    localStorage.removeItem(drillPosKey()); // fresh session — clear current direction's saved state
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

  // ── Audio playback queue ──────────────────────────────────────────────────
  // Sibling to startDrill()'s queue construction above: same source pool, same
  // priority primitives (getFiltered → isDueToday → sortDueByPatterns), but it
  // returns a playback list instead of driving the flip-card UI.
  //
  // Audio scripts live in a separate Redis key (flashcard_audio) and are
  // fetched lazily on first use — the deck sync and the 60s background poll in
  // app.js must not carry ~85KB of chunk data on every request.

  const AUDIO_SESSION_CAP  = 25; // cards per session (5 cycles of 4 + 1)
  const AUDIO_DUE_PER_REST = 4;  // 4 due/struggling cards per 1 resting card

  let audioScriptCache = null;

  async function fetchAudioScripts(refresh) {
    if (audioScriptCache && !refresh) return audioScriptCache;
    const resp = await fetch(API_BASE + '/api/flashcards?key=audio', {
      headers: authHeaders(),
    });
    if (!resp.ok) throw new Error('Audio scripts unavailable (' + resp.status + ')');
    const data = await resp.json();
    // Defensive: the legacy local Express backend (server.js) ignores ?key=
    // and returns the deck array, so anything that is not a plain object is
    // treated as "no audio available" rather than crashing the queue build.
    audioScriptCache = (data && typeof data === 'object' && !Array.isArray(data)) ? data : {};
    return audioScriptCache;
  }

  // Word-level audio bank (new-card save flow, this session) — a derived
  // view of flashcard_audio's per-card Word segments, keyed by lowercase
  // word instead of by card, so ponteSpeakCard below can resolve a brand
  // new card's headword instantly if ANY other card has ever had that exact
  // word rendered, without waiting for this specific card's own
  // flashcard_audio entry (audio backfill runs periodically, not per-save).
  let wordAudioCache = null;

  async function fetchWordAudio(refresh) {
    if (wordAudioCache && !refresh) return wordAudioCache;
    const resp = await fetch(API_BASE + '/api/flashcards?key=word_audio', {
      headers: authHeaders(),
    });
    if (!resp.ok) throw new Error('Word audio unavailable (' + resp.status + ')');
    const data = await resp.json();
    wordAudioCache = (data && typeof data === 'object' && !Array.isArray(data)) ? data : {};
    return wordAudioCache;
  }

  // Cards to interleave for variety: reviewed at least once and not currently
  // due — words answered well enough to have been pushed to a future date.
  //
  // isMasteredCard() (interval > 21) is a preference ordering here, NOT a
  // filter. No card in the deck currently exceeds interval 21 (the maximum is
  // 6), so filtering on it would leave this pool empty and silently reduce the
  // session to a due-only loop. Ordering by it instead means genuinely
  // mastered cards float to the front on their own as intervals grow.
  function restingAudioPool(cards) {
    const eligible = cards.filter((c) => (c.reviewCount || 0) > 0 && !isDue(c));
    const mastered = shuffle(eligible.filter(isMasteredCard));
    const settling = shuffle(eligible.filter((c) => !isMasteredCard(c)));
    return [...mastered, ...settling];
  }

  // ── Weighted, non-deterministic due selection (audio only) ────────────────
  // startDrill() keeps using sortDueByPatterns(): a strict worst-first sort is
  // right there, because drilling writes accuracy back and the order shifts as
  // you go. Audio never writes card stats, so the same sort produced a
  // byte-identical queue every single session.
  //
  // It is worse than that today: every due card sits at accuracy 0.50, because
  // Reset Scores clears timesCorrect/timesWrong but leaves reviewCount, and
  // isDueToday gates on reviewCount. With all keys equal a stable sort returns
  // its input, so the "worst-first" ordering is a literal no-op and the queue
  // is just deck order.
  //
  // So: selection is weighted random without replacement, and the selected
  // cards are then ordered by accuracy tier with a shuffle inside each tier.
  // Randomness lives in *which* cards get picked and their order within a
  // tier; worst-first survives as the tier ordering.

  const AUDIO_WEIGHT_FLOOR  = 0.25; // caps worst:best selection odds at ~5:1
  const AUDIO_PATTERN_BOOST = 1.6;
  const AUDIO_OVERDUE_DAYS  = 14;   // days overdue at which the boost maxes out
  const AUDIO_OVERDUE_MAX   = 0.5;  // +50% weight when fully overdue

  function daysOverdue(card) {
    if (!card.dueDate) return 0;
    const ms = Date.now() - new Date(card.dueDate).getTime();
    return ms <= 0 ? 0 : ms / 86400000;
  }

  function topErrorPatterns() {
    return Object.keys(loadErrorPatterns())
      .map((key) => [key, loadErrorPatterns()[key]])
      .sort((a, b) => (b[1].count || 0) - (a[1].count || 0))
      .slice(0, 3)
      .map((entry) => entry[0]);
  }

  function audioWeight(card, ranked) {
    // accuracyRank() puts unknown-accuracy cards just below 0.5, so they draw a
    // mid weight — we have no evidence either way. The tier ordering below is
    // what keeps them distinct from genuine 50% performers.
    const base = (1 - accuracyRank(card)) + AUDIO_WEIGHT_FLOOR;
    const pattern = (ranked.length &&
      detectErrorPatterns(card).some((p) => ranked.indexOf(p) !== -1))
      ? AUDIO_PATTERN_BOOST : 1;
    // Accuracy is flat across the due pool right now, so how overdue a card is
    // is the only signal that differentiates at all — without this the
    // selection degenerates to a uniform shuffle.
    const overdue = 1 + Math.min(1, daysOverdue(card) / AUDIO_OVERDUE_DAYS) * AUDIO_OVERDUE_MAX;
    return base * pattern * overdue;
  }

  function weightedSample(pool, n, ranked) {
    const items   = pool.slice();
    const weights = items.map((c) => audioWeight(c, ranked));
    const out = [];
    while (out.length < n && items.length) {
      let total = 0;
      for (let i = 0; i < weights.length; i++) total += weights[i];
      let x = Math.random() * total;
      let idx = items.length - 1;
      for (let i = 0; i < items.length; i++) {
        x -= weights[i];
        if (x <= 0) { idx = i; break; }
      }
      out.push(items[idx]);
      items.splice(idx, 1);
      weights.splice(idx, 1);
    }
    return out;
  }

  // 0 struggling → 1 unknown → 2 learning → 3 strong. Unknown gets its own tier
  // rather than collapsing into learning, so a card we have no data on is never
  // sequenced as though it were a known 50% performer.
  function audioTier(card) {
    const a = cardAccuracy(card);
    if (a === null) return 1;
    if (a < 0.5)    return 0;
    return a < 0.8 ? 2 : 3;
  }

  // How many due cards interleaveAudio will actually consume for a given cap,
  // so the weighted draw is sized to the session rather than the whole pool.
  // Tiering must run on the *selected* cards, not the full pool — tiering the
  // pool first and slicing would make every session pure worst-tier.
  function dueQuotaFor(cap, duePerRest) {
    const cycle  = duePerRest + 1;
    const cycles = Math.floor(cap / cycle);
    const rem    = cap % cycle;
    return cycles * duePerRest + Math.min(rem, duePerRest);
  }

  function selectDueForAudio(due, quota) {
    const picked = weightedSample(due, quota, topErrorPatterns());
    // Four buckets, matching audioTier: struggling, unknown, learning, strong.
    const tiers  = [[], [], [], []];
    picked.forEach((c) => tiers[audioTier(c)].push(c));
    return shuffle(tiers[0]).concat(shuffle(tiers[1]), shuffle(tiers[2]), shuffle(tiers[3]));
  }

  // Emit duePerRest due cards, then one resting card, until the cap is hit.
  // When either pool runs dry the other fills the remainder, so a session is
  // always cap-length if enough cards exist in total.
  function interleaveAudio(due, rest, duePerRest, cap) {
    const out = [];
    let d = 0, r = 0;
    while (out.length < cap && (d < due.length || r < rest.length)) {
      let placed = 0;
      while (placed < duePerRest && d < due.length && out.length < cap) {
        out.push(due[d++]);
        placed++;
      }
      if (out.length >= cap) break;
      if (r < rest.length)        out.push(rest[r++]);
      else if (d >= due.length)   break; // both pools exhausted
    }
    return out;
  }

  // SHA-1 of the UTF-8 text, first 16 hex chars — must match exactly what
  // backfill-audio-elevenlabs.js used as the blob key, or no URL resolves.
  // SubtleCrypto needs a secure context; localhost and https both qualify.
  async function sha1Hex16(text) {
    if (!(window.crypto && window.crypto.subtle)) return null;
    const bytes  = new TextEncoder().encode(text);
    const digest = await window.crypto.subtle.digest('SHA-1', bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
  }

  // Resolve every text a card might speak to its pre-rendered audio, so the
  // player can look up by text and never needs to hash anything mid-playback.
  async function audioUrlsForCard(card, entry) {
    const map = {};
    const byHash = (entry && entry.audio) || null;
    if (!byHash) return map;
    const texts = [card.italian, card.english, card.example];
    (entry.chunks || []).forEach((ch) => { texts.push(ch.it, ch.en); });
    for (const raw of texts) {
      const text = raw && String(raw).trim();
      if (!text || map[text]) continue;
      const h = await sha1Hex16(text);
      if (h && byHash[h]) map[text] = byHash[h];
    }
    return map;
  }

  // ── One-off card speech (flip-card, Deep-dive, Translate, tooltip) ───────
  // Everything outside the session player used to go straight to Web Speech,
  // so a card with a pre-rendered ElevenLabs render still spoke in the robotic
  // voice. This resolves the same SHA-1 -> blob mapping and falls back only
  // when no render exists.

  let audioIndex = null;   // hash -> { url, ms }, flattened across every card

  async function getAudioIndex() {
    if (audioIndex) return audioIndex;
    const scripts = await fetchAudioScripts();
    const idx = {};
    Object.keys(scripts).forEach((id) => {
      const a = scripts[id] && scripts[id].audio;
      if (a) Object.keys(a).forEach((h) => { idx[h] = a[h]; });
    });
    audioIndex = idx;
    return idx;
  }

  // Its own element, separate from the session player's: a one-off tap and a
  // running session are different lifecycles, and sharing would have each
  // stomping the other's src.
  let oneOffEl = null;

  // onEnd(status) fires once playback ends, whether normally ('ended') or via
  // a runtime error ('error') — a dead/unreachable URL must still resolve the
  // caller's UI state (e.g. a speak button stuck showing "playing"), not just
  // silently stop. Optional: ponteSpeakCard's existing callers don't pass it
  // and are unaffected.
  //
  // onTimeUpdate(currentTime) is optional too (#70 karaoke sync) — fires on
  // the element's native timeupdate event, letting a caller (the Reader) map
  // elapsed time to a word position without reaching into this module's
  // private element. Unused by callers that don't pass it (ponteSpeakCard).
  function playOneOff(url, onEnd, onTimeUpdate) {
    if (!oneOffEl) {
      try { oneOffEl = new Audio(); oneOffEl.preload = 'auto'; }
      catch (_) { return false; }
    }
    try {
      // Announce before playing so a running audio session yields, exactly as
      // it does for Web Speech. Any source other than 'audio-player' counts.
      const api = window.ponteSpeech;
      if (api && api.cancel) api.cancel();          // silence Web Speech too
      else if (api && api.announceClaim) api.announceClaim('card');
      oneOffEl.pause();
      oneOffEl.src = url;
      oneOffEl.playbackRate = loadRate();
      oneOffEl.onended = onEnd ? () => onEnd('ended') : null;
      oneOffEl.onerror = onEnd ? () => onEnd('error') : null;
      oneOffEl.ontimeupdate = onTimeUpdate ? () => onTimeUpdate(oneOffEl.currentTime) : null;
      const p = oneOffEl.play();
      if (p && typeof p.catch === 'function') p.catch(() => { if (onEnd) onEnd('error'); });
      return true;
    } catch (_) { return false; }
  }

  // Public: stop whatever the shared one-off element is currently playing —
  // a flashcard word or (#83 follow-up) a Beginner Story. Generic on purpose:
  // only one thing plays through this element at a time regardless of source.
  window.ponteStopOneOff = function () {
    if (oneOffEl) {
      oneOffEl.onended = null; oneOffEl.onerror = null; oneOffEl.ontimeupdate = null;
      oneOffEl.pause();
    }
  };

  // Public: live-update the currently-playing one-off element's rate. Unlike
  // a Web Speech utterance (whose .rate is fixed once speaking starts, no way
  // to change it mid-utterance), a real <audio> element's playbackRate can be
  // reassigned at any time and takes effect immediately, no restart needed —
  // this is what lets the Reader's speed slider change a Beginner Story's
  // speed while it's actually playing. No-ops (returns false) if nothing is
  // currently loaded into the shared element.
  window.ponteSetOneOffRate = function (rate) {
    const v = parseFloat(rate);
    if (!Number.isFinite(v) || !oneOffEl) return false;
    oneOffEl.playbackRate = v;
    return true;
  };

  // Speed setting is shared with the session player so one slider governs both.
  function loadRate() {
    const v = parseFloat(localStorage.getItem('ponte_audio_rate'));
    return Number.isFinite(v) ? Math.min(1.25, Math.max(0.55, v)) : 0.95;
  }

  // Public: speak a card's Italian, preferring the pre-rendered render.
  // Async, but callers can fire and forget — fallback is handled internally.
  // Two-tier lookup before Web Speech: this card's OWN flashcard_audio entry
  // first (unchanged — carries this exact card's chunk-aligned Word render),
  // then the word-level bank keyed by lowercase text. The second tier is
  // what makes a just-saved card (word-lookup, reader-tap, any save path —
  // they all end up here whenever the word is played) sound right away
  // instead of Web Speech, as long as SOME other card has ever had that
  // exact word rendered — no need to wait for this card's own audio backfill.
  window.ponteSpeakCard = async function (text) {
    const t = text == null ? '' : String(text).trim();
    if (!t) return;
    try {
      const idx = await getAudioIndex();
      const h   = await sha1Hex16(t);
      const hit = h && idx[h];
      if (hit && hit.url && playOneOff(hit.url)) return;
    } catch (_) { /* fall through */ }
    try {
      const words = await fetchWordAudio();
      const hit = words[t.toLowerCase()];
      if (hit && hit.url && playOneOff(hit.url)) return;
    } catch (_) { /* fall through to Web Speech */ }
    if (window.ponteSpeak) window.ponteSpeak(t);
  };

  // ── Story audio (#83 follow-up) ───────────────────────────────────────────
  // Same shape as the card index above (fetch once, flatten hash -> {url,ms}),
  // pointed at story_audio instead of flashcard_audio. Kept separate rather
  // than merged into getAudioIndex(): different Redis key, different content
  // (one clip per whole story, not per word/example/chunk), and callers must
  // stay able to tell "no pre-rendered story audio" apart from "no
  // pre-rendered card audio" for their own fallback decisions.
  let storyAudioIndex = null;

  async function getStoryAudioIndex() {
    if (storyAudioIndex) return storyAudioIndex;
    const resp = await fetch(API_BASE + '/api/flashcards?key=story_audio', { headers: authHeaders() });
    if (!resp.ok) throw new Error('Story audio unavailable (' + resp.status + ')');
    const data = await resp.json();
    const scripts = (data && typeof data === 'object' && !Array.isArray(data)) ? data : {};
    const idx = {};
    Object.keys(scripts).forEach((id) => {
      const a = scripts[id] && scripts[id].audio;
      if (a) Object.keys(a).forEach((h) => { idx[h] = a[h]; });
    });
    storyAudioIndex = idx;
    return idx;
  }

  // Public: speak arbitrary text (a Beginner Story's full italian field) via
  // its pre-rendered clip, if one exists. Unlike ponteSpeakCard this does NOT
  // fall back to Web Speech itself — the Reader's article-speak button already
  // has its own single-utterance Web Speech path for dynamically-generated
  // (Advanced mode) articles, which have no pre-rendered audio at all; the
  // caller decides what "no pre-rendered clip" means for it. Returns true if
  // playback started (onEnd will fire), false if there's nothing to play.
  window.ponteSpeakStory = async function (text, onEnd, onTimeUpdate) {
    const t = text == null ? '' : String(text).trim();
    if (!t) return false;
    try {
      const idx = await getStoryAudioIndex();
      const h   = await sha1Hex16(t);
      const hit = h && idx[h];
      if (hit && hit.url) return playOneOff(hit.url, onEnd, onTimeUpdate);
    } catch (_) { /* caller falls back */ }
    return false;
  };

  // Returns [{ card, audioScript, audioUrls }], audioScript being the chunks
  // array and audioUrls a text -> { url, ms } map for pre-rendered speech.
  // Options: { cap, duePerRest, allCards, refresh }.
  // cap accepts a number, or the string 'all-due' to play every due card.
  async function buildAudioQueue(options) {
    const opts       = options || {};
    const cap        = opts.cap        || AUDIO_SESSION_CAP;
    const duePerRest = opts.duePerRest || AUDIO_DUE_PER_REST;

    const scripts = await fetchAudioScripts(opts.refresh);

    // Respect the active library filters by default, exactly as startDrill()
    // does; pass allCards:true to ignore them.
    const source = opts.allCards ? loadCards() : getFiltered();

    // Join by String(id) — the deck mixes numeric ids (Date.now()) with string
    // ids from the generated starter deck ("1785339714808-0"). Only cards with
    // a script survive, which drops the cards that have no example sentence
    // without this function needing to know anything about them.
    const withAudio = source.filter((c) => {
      const entry = scripts[String(c.id)];
      return !!entry && Array.isArray(entry.chunks) && entry.chunks.length > 0;
    });

    // isDueToday excludes never-reviewed cards, matching the drill's "Due
    // today" subset.
    const duePool = withAudio.filter(isDueToday);
    const rest    = restingAudioPool(withAudio);

    // 'all-due' means every due card, still interleaved at the normal ratio —
    // NOT an uncapped queue, which would also drain the whole resting pool.
    const effectiveCap = cap === 'all-due'
      ? duePool.length + Math.ceil(duePool.length / duePerRest)
      : cap;

    const due = selectDueForAudio(duePool, dueQuotaFor(effectiveCap, duePerRest));

    const ordered = interleaveAudio(due, rest, duePerRest, effectiveCap);

    // Hash resolution is async; do it once per session rather than per segment.
    // Failure here is non-fatal — the player falls back to Web Speech.
    return Promise.all(ordered.map(async (card) => {
      const entry = scripts[String(card.id)];
      let audioUrls = {};
      try { audioUrls = await audioUrlsForCard(card, entry); }
      catch (_) { audioUrls = {}; }
      return { card, audioScript: entry.chunks, audioUrls };
    }));
  }

  window.ponteBuildAudioQueue = buildAudioQueue;

  // "Drill anyway" used to jump straight into drilling every filtered card —
  // all-or-nothing, no way to pick a category or limit how many. Opens the
  // same setup screen the normal Drill button uses instead, so a category +
  // optional card count can be chosen. drillSetupFromAnyway=true tells the
  // Start button to call startDrill(true): we already know 0 cards are due,
  // so the due/notDue split in startDrill(false) would just loop back here.
  fcDrillAnyway && fcDrillAnyway.addEventListener('click', () => {
    const fcDrillSetup = $('fc-drill-setup');
    if (!fcDrillSetup) { startDrill(true); return; }
    if (fcNoDue)  fcNoDue.hidden  = true;
    if (fcNoWeak) fcNoWeak.hidden = true;
    drillSetupFromAnyway = true;
    const allRadio = document.querySelector('.fc-drill-type-radio[value="all"]');
    if (allRadio) allRadio.checked = true; // "Due today" would show 0 — default to All instead
    updateDrillSubsetCounts();
    fcBrowse.hidden     = true;
    fcToolbar.hidden    = true;
    fcDrillSetup.hidden = false;
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

    // Shared back-side example block (rendered once for both directions)
    const renderExampleBlock = () => {
      if (!fcFlipExample) return;
      if (card.example) {
        fcFlipExampleIt.textContent = card.example;
        if (card.exampleEN) {
          fcFlipExampleEn.textContent = card.exampleEN;
          fcFlipExampleEn.hidden = false;
        } else {
          fcFlipExampleEn.hidden = true;
        }
        fcFlipExample.hidden = false;
      } else {
        fcFlipExample.hidden = true;
      }
    };

    if (drillReverse) {
      // ── Front: English ──────────────────────────────────────────────────
      fcFlipWord.textContent   = card.english;
      fcFlipSource.textContent = '';
      if (fcFlipPrompt)    fcFlipPrompt.textContent = 'What is this in Italian?';
      if (fcFrontSpeakBtn) fcFrontSpeakBtn.hidden  = true;

      // Word-type badge (Noun / Verb / etc.)
      if (fcFlipFrontBadges) {
        const wt = card.wordType && WORD_TYPE_DISPLAY[card.wordType];
        if (wt) {
          fcFlipFrontBadges.innerHTML =
            `<span class="fc-wordtype-badge">${escapeHTML(wt)}</span>`;
          fcFlipFrontBadges.hidden = false;
        } else {
          fcFlipFrontBadges.innerHTML = '';
          fcFlipFrontBadges.hidden    = true;
        }
      }

      // Front meta: (singular)/(plural) for nouns; English base form otherwise
      const metaParts = [];
      if (card.wordType === 'noun' && card.nounNumber) {
        metaParts.push(`(${card.nounNumber})`);
      } else if (card.baseFormEN && card.baseFormEN.trim().toLowerCase() !== (card.english || '').trim().toLowerCase()) {
        metaParts.push(`Base: ${card.baseFormEN}`);
      }
      if (fcFlipFrontMeta) {
        fcFlipFrontMeta.textContent = metaParts.join(' · ');
        fcFlipFrontMeta.hidden      = metaParts.length === 0;
      }

      // ── Back: Italian ───────────────────────────────────────────────────
      fcFlipWordBack.textContent = card.italian;
      if (fcFlipBase) {
        fcFlipBase.textContent = card.baseForm ? `Base: ${card.baseForm}` : '';
        fcFlipBase.hidden      = !card.baseForm;
      }
      fcFlipAnswer.innerHTML =
        `<span class="fc-cat-badge" style="border-color:${color};color:${color}">${escapeHTML(label)}</span>${irregularBadge(card)}`
        + (card.nounOtherForm ? `<div class="fc-flip-other-form">Other form: ${escapeHTML(card.nounOtherForm)}</div>` : '');
      fcFlipNote.textContent = card.note || '';
      fcFlipNote.hidden      = !card.note;
      renderExampleBlock();
    } else {
      // ── Front: Italian ──────────────────────────────────────────────────
      fcFlipWord.textContent     = card.italian;
      fcFlipSource.textContent   = card.sourceArticle ? `From: ${card.sourceArticle}` : '';
      if (fcFlipPrompt)    fcFlipPrompt.textContent = 'What does this mean?';
      if (fcFrontSpeakBtn) fcFrontSpeakBtn.hidden  = false;
      if (fcFlipFrontBadges) {
        fcFlipFrontBadges.innerHTML = '';
        fcFlipFrontBadges.hidden    = true;
      }
      renderFrontMeta(card);

      // ── Back: English ───────────────────────────────────────────────────
      fcFlipWordBack.textContent = card.italian;
      if (fcFlipBase) {
        fcFlipBase.textContent = card.baseForm ? `Base: ${card.baseForm} · ${card.baseFormEN}` : '';
        fcFlipBase.hidden      = !card.baseForm;
      }
      fcFlipAnswer.innerHTML = `
        <div class="fc-flip-en">${escapeHTML(card.english)}</div>
        ${card.spanish ? `<div class="fc-flip-es">${escapeHTML(card.spanish)}</div>` : ''}
        <span class="fc-cat-badge" style="border-color:${color};color:${color}">${label}</span>${irregularBadge(card)}`
        + (card.nounOtherForm ? `<div class="fc-flip-other-form">Other form: ${escapeHTML(card.nounOtherForm)}</div>` : '');
      fcFlipNote.textContent = card.note || '';
      fcFlipNote.hidden      = !card.note;
      renderExampleBlock();
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
      setTimeout(() => window.ponteSpeakCard(drillQueue[0].italian), 350);
    }
  });

  fcFrontSpeakBtn && fcFrontSpeakBtn.addEventListener('click', () => {
    if (drillQueue.length && window.ponteSpeak) {
      window.ponteSpeakCard(drillQueue[0].italian);
    }
  });

  fcSpeakBtn && fcSpeakBtn.addEventListener('click', () => {
    if (drillQueue.length && window.ponteSpeak) {
      window.ponteSpeakCard(drillQueue[0].italian);
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
    showRequeueNotice();
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
    drillSetupFromAnyway = false; // normal entry point — Start uses the due/notDue split
    // Default to "Due today" — correct SRS practice instead of drilling everything
    const dueRadio = document.querySelector('.fc-drill-type-radio[value="due"]');
    if (dueRadio) dueRadio.checked = true;
    updateDrillSubsetCounts();
    fcBrowse.hidden    = true;
    fcToolbar.hidden   = true;
    fcDrillSetup.hidden = false;
  });

  const fcDrillStartBtn    = $('fc-drill-start-btn');
  const fcDrillSetupCancel = $('fc-drill-setup-cancel');

  fcDrillStartBtn && fcDrillStartBtn.addEventListener('click', () => startDrill(drillSetupFromAnyway));

  fcDrillSetupCancel && fcDrillSetupCancel.addEventListener('click', () => {
    const fcDrillSetup = $('fc-drill-setup');
    if (fcDrillSetup) fcDrillSetup.hidden = true;
    const countInput = $('fc-drill-count-input');
    if (countInput) countInput.value = '';
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
    'same':         '#2E6B3E',
    'similar':      '#0E7490',
    'false-friend': '#B83232',
    'new':          '#888888',
  };
  const BADGE_LABELS = {
    'same':         'Same word',
    'similar':      'Same/Similar',
    'false-friend': 'False Friend',
    'new':          'No Spanish link',
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

    const endpoint = wlDirection === 'en' ? '/api/translate-combined?action=translate-to-italian' : '/api/translate';
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
  // #87: label lives in a child span (icon is a sibling span) so these state
  // swaps don't clobber the 🔄 icon.
  const fcSyncBtnLabel = $('fc-sync-btn-label');
  if (fcSyncBtn) {
    fcSyncBtn.addEventListener('click', async () => {
      if (!window.manualSyncFlashcards) return;
      fcSyncBtnLabel.textContent = 'Syncing…';
      fcSyncBtn.disabled = true;
      try {
        await window.manualSyncFlashcards();
        fcSyncBtnLabel.textContent = 'Synced ✓';
      } catch (_) {
        fcSyncBtnLabel.textContent = 'Failed';
      }
      setTimeout(() => {
        fcSyncBtnLabel.textContent = 'Sync';
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
        italian:      window.ponteNormalizeItalian(italian, {
          wordType: entry.wordType, example: entry.example, isProperNoun: entry.isProperNoun,
        }),
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

  // ── Deck sharing (#38) ────────────────────────────────────────────────────
  // Export: POST the current deck (server strips it down to word content only
  // — see api/flashcards.js's stripForSharing — the recipient starts learning
  // fresh, not inheriting the sharer's own review history/schedule). Import:
  // fetch a shared deck by id and merge it into this browser's own deck,
  // skipping any word already present rather than overwriting it.
  const shareBackdrop = $('share-backdrop');
  const shareModal    = $('share-modal');
  const shareScreens  = {
    choose: $('share-screen-choose'),
    export: $('share-screen-export'),
    import: $('share-screen-import'),
  };

  function shareShow(name) {
    Object.keys(shareScreens).forEach((k) => { if (shareScreens[k]) shareScreens[k].hidden = k !== name; });
  }

  window.ponteShareOpen = function () {
    if (!shareModal) return false;
    if (shareBackdrop) shareBackdrop.hidden = false;
    shareModal.hidden = false;
    shareShow('choose');
    return false;
  };

  window.ponteShareClose = function () {
    if (!shareModal) return false;
    shareModal.hidden = true;
    if (shareBackdrop) shareBackdrop.hidden = true;
    return false;
  };

  window.ponteShareBack = function () {
    shareShow('choose');
    return false;
  };

  // Accepts a bare 12-hex share id, or a full URL containing ?import=<id> or
  // ?share=<id> — whichever someone actually pastes.
  function parseShareId(raw) {
    const s = String(raw || '').trim();
    if (/^[a-f0-9]{12}$/i.test(s)) return s.toLowerCase();
    try {
      const u = new URL(s, window.location.origin);
      const id = u.searchParams.get('import') || u.searchParams.get('share');
      return id && /^[a-f0-9]{12}$/i.test(id) ? id.toLowerCase() : null;
    } catch (_) { return null; }
  }

  window.ponteShareStartExport = async function () {
    shareShow('export');
    const statusEl = $('share-export-status');
    const resultEl = $('share-export-result');
    if (statusEl) { statusEl.hidden = false; statusEl.textContent = 'Creating your share link…'; }
    if (resultEl) resultEl.hidden = true;

    const cards = loadCards();
    if (!cards.length) {
      if (statusEl) statusEl.textContent = 'Your deck is empty — nothing to share yet.';
      return false;
    }
    try {
      const resp = await fetch(API_BASE + '/api/flashcards?action=share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ cards }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data && data.error ? data.error : 'Failed to create share link');

      const link = window.location.origin + window.location.pathname + '?import=' + data.id;
      const linkInput = $('share-link-input');
      if (linkInput) linkInput.value = link;
      const countEl = $('share-export-count');
      if (countEl) countEl.textContent = `${data.count} card${data.count === 1 ? '' : 's'} ready to share.`;
      if (statusEl) statusEl.hidden = true;
      if (resultEl) resultEl.hidden = false;
    } catch (e) {
      if (statusEl) statusEl.textContent = 'Could not create a share link: ' + (e && e.message ? e.message : 'unknown error');
    }
    return false;
  };

  window.ponteShareCopyLink = function () {
    const linkInput = $('share-link-input');
    if (!linkInput || !linkInput.value) return false;
    linkInput.select();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(linkInput.value).catch(() => {});
    } else {
      try { document.execCommand('copy'); } catch (_) {}
    }
    const btn = $('share-copy-btn');
    if (btn) { const orig = btn.textContent; btn.textContent = 'Copied ✓'; setTimeout(() => { btn.textContent = orig; }, 1500); }
    return false;
  };

  let shareImportCards = null; // the previewed (not-yet-merged) shared cards

  window.ponteShareStartImport = function (prefillId) {
    shareShow('import');
    shareImportCards = null;
    const input = $('share-import-input');
    if (input) input.value = prefillId || '';
    const statusEl = $('share-import-status');
    if (statusEl) statusEl.hidden = true;
    const preview = $('share-import-preview');
    if (preview) preview.hidden = true;
    if (prefillId) window.ponteShareLoadPreview();
    return false;
  };

  window.ponteShareLoadPreview = async function () {
    const input = $('share-import-input');
    const statusEl = $('share-import-status');
    const preview = $('share-import-preview');
    const id = parseShareId(input && input.value);
    if (!id) {
      if (statusEl) { statusEl.hidden = false; statusEl.textContent = 'That doesn\'t look like a valid share link or code.'; }
      if (preview) preview.hidden = true;
      return false;
    }
    if (statusEl) { statusEl.hidden = false; statusEl.textContent = 'Loading…'; }
    if (preview) preview.hidden = true;
    try {
      const resp = await fetch(API_BASE + '/api/flashcards?action=share&id=' + encodeURIComponent(id), { headers: authHeaders() });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data && data.error ? data.error : 'Could not load this share link');
      shareImportCards = Array.isArray(data.cards) ? data.cards : [];
      if (!shareImportCards.length) throw new Error('This share link has no cards');

      const existing = loadCards();
      const existingKeys = new Set(existing.map((c) => (c.italian || '').toLowerCase()));
      const newCount = shareImportCards.filter((c) => !existingKeys.has((c.italian || '').toLowerCase())).length;
      const dupCount = shareImportCards.length - newCount;

      const countEl = $('share-import-count');
      if (countEl) {
        countEl.textContent = `${shareImportCards.length} card${shareImportCards.length === 1 ? '' : 's'} in this share` +
          (dupCount ? ` — ${newCount} new, ${dupCount} you already have (skipped)` : ' — all new to you');
      }
      if (statusEl) statusEl.hidden = true;
      if (preview) preview.hidden = false;
      const confirmBtn = $('share-import-confirm-btn');
      if (confirmBtn) confirmBtn.disabled = newCount === 0;
      if (confirmBtn) confirmBtn.textContent = newCount === 0 ? 'Nothing new to add' : 'Add to my deck';
    } catch (e) {
      shareImportCards = null;
      if (statusEl) { statusEl.hidden = false; statusEl.textContent = e && e.message ? e.message : 'Could not load this share link'; }
      if (preview) preview.hidden = true;
    }
    return false;
  };

  window.ponteShareConfirmImport = function () {
    if (!shareImportCards || !shareImportCards.length) return false;
    const existing = loadCards();
    const existingKeys = new Set(existing.map((c) => (c.italian || '').toLowerCase()));
    const now = Date.now();
    let added = 0;
    const merged = existing.slice();
    shareImportCards.forEach((c, i) => {
      const key = (c.italian || '').toLowerCase();
      if (!key || existingKeys.has(key)) return; // never overwrite a card the user already has
      existingKeys.add(key);
      merged.push({
        id:            now + i, // batch import — Date.now() alone would collide across cards
        italian:       window.ponteNormalizeItalian(c.italian, { wordType: c.wordType, example: c.example }),
        english:       c.english    || '',
        spanish:       c.spanish    || '',
        category:      c.category   || 'new',
        note:          c.note       || '',
        wordType:      c.wordType      || 'other',
        baseForm:      c.baseForm      || '',
        baseFormEN:    c.baseFormEN    || '',
        example:       c.example       || '',
        exampleEN:     c.exampleEN     || '',
        nounNumber:    c.nounNumber    || null,
        nounOtherForm: c.nounOtherForm || null,
        savedAt:       new Date().toISOString(),
        sourceArticle: 'Shared deck',
        timesCorrect: 0, timesWrong: 0, lastSeen: null, lastDrilled: null,
        interval: 0, easeFactor: 2.5, dueDate: null, reviewCount: 0, lastReviewed: null,
        grammarPatterns: [],
      });
      added++;
    });

    if (!added) { window.ponteShareClose(); return false; }

    saveCards(merged);
    renderLibrary();
    updateBadge();
    window.dispatchEvent(new CustomEvent('ponte:flashcard-saved'));

    const countEl = $('share-import-count');
    if (countEl) countEl.textContent = `Added ${added} new card${added === 1 ? '' : 's'} to your deck.`;
    const confirmBtn = $('share-import-confirm-btn');
    if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = 'Added ✓'; }
    shareImportCards = null;
    return false;
  };

  // A shared link (?import=<id>) opens straight to the import preview,
  // pre-filled — no need to find the More menu and paste a code by hand.
  (function checkImportLink() {
    try {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('import');
      if (id && /^[a-f0-9]{12}$/i.test(id) && window.ponteShareOpen) {
        window.ponteShareOpen();
        window.ponteShareStartImport(id);
      }
    } catch (_) { /* malformed URL — ignore */ }
  })();

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
