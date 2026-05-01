/* ── Progress Dashboard ────────────────────────────────────────────────────
   IIFE — reads localStorage data and renders the progress dashboard.
   Exposed: window._ponteProgressRender()
   Called on: tab switch to 'progress', ponte:flashcard-saved event
*/
(function () {
  'use strict';

  const escapeHTML = window.ponteEsc;

  const FC_KEY           = 'ponte_flashcards';
  const EP_KEY           = 'ponte_error_patterns';
  const QUIZ_KEY         = 'ponte_quiz_scores';
  const ARTICLE_PREFIX   = 'ponte_article_';

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

  const PATTERN_STAGE = {
    'false-friend':     2,
    'divergence':       1,
    'verb-essere':      1,
    'passato-prossimo': 1,
    'clitic-placement': 3,
    'subjunctive':      3,
    'geminates':        4,
    'verb-general':     1,
  };

  // ── Data loading ─────────────────────────────────────────────────────────

  function loadCards() {
    try { return JSON.parse(localStorage.getItem(FC_KEY) || '[]'); }
    catch (e) { return []; }
  }

  function loadErrorPatterns() {
    try { return JSON.parse(localStorage.getItem(EP_KEY) || '{}'); }
    catch (e) { return {}; }
  }

  function loadQuizScores() {
    try { return JSON.parse(localStorage.getItem(QUIZ_KEY) || '[]'); }
    catch (e) { return []; }
  }

  function countArticles() {
    let count = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(ARTICLE_PREFIX)) count++;
    }
    return count;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function isMastered(card) {
    return (card.interval || 0) > 21;
  }

  function isNew(card) {
    return !(card.reviewCount > 0);
  }

  function isLearning(card) {
    return (card.reviewCount > 0) && !isMastered(card);
  }

  // Returns YYYY-MM-DD for a date
  function dateKey(d) {
    const dt = new Date(d);
    return dt.getFullYear() + '-' +
      String(dt.getMonth() + 1).padStart(2, '0') + '-' +
      String(dt.getDate()).padStart(2, '0');
  }

  // Last N days as YYYY-MM-DD strings, oldest first
  function lastNDays(n) {
    const days = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(dateKey(d));
    }
    return days;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  function render() {
    const panel = document.getElementById('tab-progress');
    if (!panel) return;

    const cards        = loadCards();
    const errors       = loadErrorPatterns();
    const quizScores   = loadQuizScores();
    const articleCount = countArticles();

    // ── Overview metrics ─────────────────────────────────────────────────
    const total      = cards.length;
    const mastered   = cards.filter(isMastered).length;
    const totalRight = cards.reduce((s, c) => s + (c.timesCorrect || 0), 0);
    const totalAll   = cards.reduce((s, c) => s + (c.timesCorrect || 0) + (c.timesWrong || 0), 0);
    const accuracy   = totalAll > 0 ? Math.round((totalRight / totalAll) * 100) : null;

    // ── Category breakdown ────────────────────────────────────────────────
    const catCounts = { cognate: 0, 'false-friend': 0, divergence: 0, new: 0 };
    cards.forEach((c) => {
      const cat = c.category || 'new';
      if (catCounts[cat] !== undefined) catCounts[cat]++;
      else catCounts['new']++;
    });

    // ── Status breakdown ─────────────────────────────────────────────────
    const newCards      = cards.filter(isNew).length;
    const learningCards = cards.filter(isLearning).length;
    const masteredCards = mastered;

    // ── Weekly activity ───────────────────────────────────────────────────
    const days7 = lastNDays(7);
    const activityMap = {};
    days7.forEach((d) => { activityMap[d] = 0; });
    cards.forEach((card) => {
      if (card.lastReviewed) {
        const k = dateKey(card.lastReviewed);
        if (activityMap[k] !== undefined) activityMap[k]++;
      }
    });
    const activityMax = Math.max(...Object.values(activityMap), 1);

    // ── Accuracy trend ────────────────────────────────────────────────────
    const now = new Date();
    const weekAgo  = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
    const twoWkAgo = new Date(now); twoWkAgo.setDate(twoWkAgo.getDate() - 14);

    let thisWkRight = 0, thisWkAll = 0, lastWkRight = 0, lastWkAll = 0;
    quizScores.forEach((q) => {
      const d = new Date(q.date);
      if (d >= weekAgo) {
        thisWkRight += q.score;
        thisWkAll   += q.total;
      } else if (d >= twoWkAgo) {
        lastWkRight += q.score;
        lastWkAll   += q.total;
      }
    });
    const thisWkPct = thisWkAll > 0 ? Math.round((thisWkRight / thisWkAll) * 100) : null;
    const lastWkPct = lastWkAll > 0 ? Math.round((lastWkRight / lastWkAll) * 100) : null;

    // ── Weak areas ────────────────────────────────────────────────────────
    const weakAreas = Object.entries(errors)
      .map(([key, val]) => ({ key, count: val.count || 0, label: PATTERN_LABELS[key] || key, stage: PATTERN_STAGE[key] || 1 }))
      .filter((e) => e.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // ── Build HTML ────────────────────────────────────────────────────────

    const catColors = {
      'cognate':      '#2E6B3E',
      'false-friend': '#B83232',
      'divergence':   '#B85C00',
      'new':          '#888888',
    };
    const catLabels = {
      'cognate':      'Same in Spanish',
      'false-friend': 'False Friend',
      'divergence':   'Used differently',
      'new':          'New word',
    };

    function pct(n, of) { return of === 0 ? 0 : Math.round((n / of) * 100); }

    // Overview section
    const overviewHTML = `
      <section class="prog-section">
        <h2 class="prog-section-title">Overview</h2>
        <div class="prog-metrics">
          <div class="prog-metric">
            <span class="prog-metric-value">${total}</span>
            <span class="prog-metric-label">Cards saved</span>
          </div>
          <div class="prog-metric">
            <span class="prog-metric-value">${mastered}</span>
            <span class="prog-metric-label">Mastered</span>
          </div>
          <div class="prog-metric">
            <span class="prog-metric-value">${articleCount}</span>
            <span class="prog-metric-label">Articles read</span>
          </div>
          <div class="prog-metric">
            <span class="prog-metric-value">${accuracy !== null ? accuracy + '%' : '—'}</span>
            <span class="prog-metric-label">Drill accuracy</span>
          </div>
        </div>
      </section>`;

    // Card breakdown section
    const catBarsHTML = ['cognate', 'false-friend', 'divergence', 'new'].map((cat) => {
      const n   = catCounts[cat];
      const pctW = pct(n, total);
      return `
        <div class="prog-bar-row">
          <span class="prog-bar-label" style="color:${catColors[cat]}">${escapeHTML(catLabels[cat])}</span>
          <div class="prog-bar-track">
            <div class="prog-bar-fill" style="width:${pctW}%;background:${catColors[cat]}"></div>
          </div>
          <span class="prog-bar-count">${n}</span>
        </div>`;
    }).join('');

    const statusTotal = newCards + learningCards + masteredCards || 1;
    const statusBarsHTML = [
      { label: 'New', count: newCards, color: '#9B8470' },
      { label: 'Learning', count: learningCards, color: '#0055AA' },
      { label: 'Mastered', count: masteredCards, color: '#2E6B3E' },
    ].map(({ label, count, color }) => {
      const pctW = pct(count, statusTotal);
      return `
        <div class="prog-bar-row">
          <span class="prog-bar-label">${label}</span>
          <div class="prog-bar-track">
            <div class="prog-bar-fill" style="width:${pctW}%;background:${color}"></div>
          </div>
          <span class="prog-bar-count">${count}</span>
        </div>`;
    }).join('');

    const breakdownHTML = `
      <section class="prog-section">
        <h2 class="prog-section-title">Card breakdown</h2>
        <div class="prog-breakdown-cols">
          <div class="prog-breakdown-col">
            <div class="prog-breakdown-subtitle">By category</div>
            ${catBarsHTML}
          </div>
          <div class="prog-breakdown-col">
            <div class="prog-breakdown-subtitle">By status</div>
            ${statusBarsHTML}
          </div>
        </div>
      </section>`;

    // Weak areas
    const weakHTML = weakAreas.length === 0
      ? `<section class="prog-section">
           <h2 class="prog-section-title">Weak areas</h2>
           <p class="prog-empty">Complete some flashcard drills to see your weak areas.</p>
         </section>`
      : `<section class="prog-section">
           <h2 class="prog-section-title">Weak areas</h2>
           <div class="prog-weak-list">
             ${weakAreas.map((e, i) => `
               <div class="prog-weak-row">
                 <span class="prog-weak-rank">${i + 1}</span>
                 <span class="prog-weak-label">${escapeHTML(e.label)}</span>
                 <span class="prog-weak-count">${e.count} error${e.count !== 1 ? 's' : ''}</span>
                 <button class="prog-weak-study" onclick="window.switchTab('grammar')" title="Study in Grammar tab">Study →</button>
               </div>`).join('')}
           </div>
         </section>`;

    // Recent activity (last 7 days)
    const activityHTML = `
      <section class="prog-section">
        <h2 class="prog-section-title">Recent activity</h2>
        <div class="prog-activity-chart">
          ${days7.map((day) => {
            const count = activityMap[day];
            const heightPct = Math.round((count / activityMax) * 100);
            const label = new Date(day + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' });
            return `
              <div class="prog-act-col">
                <div class="prog-act-bar-wrap">
                  <div class="prog-act-bar" style="height:${heightPct}%" title="${count} cards reviewed"></div>
                </div>
                <span class="prog-act-label">${label}</span>
                <span class="prog-act-count">${count > 0 ? count : ''}</span>
              </div>`;
          }).join('')}
        </div>
      </section>`;

    // Accuracy trend
    let trendHTML;
    if (thisWkPct === null && lastWkPct === null) {
      trendHTML = `<section class="prog-section">
        <h2 class="prog-section-title">Quiz trend</h2>
        <p class="prog-empty">Take a few reading quizzes to see your trend.</p>
      </section>`;
    } else {
      const diff = (thisWkPct !== null && lastWkPct !== null) ? thisWkPct - lastWkPct : null;
      const arrow = diff === null ? '' : diff > 0 ? '<span class="prog-trend-up">▲ ' + diff + '%</span>' : diff < 0 ? '<span class="prog-trend-down">▼ ' + Math.abs(diff) + '%</span>' : '<span class="prog-trend-flat">→ no change</span>';
      trendHTML = `<section class="prog-section">
        <h2 class="prog-section-title">Quiz trend</h2>
        <div class="prog-trend-row">
          <div class="prog-trend-block">
            <span class="prog-trend-val">${thisWkPct !== null ? thisWkPct + '%' : '—'}</span>
            <span class="prog-trend-period">This week</span>
          </div>
          ${arrow ? `<div class="prog-trend-arrow">${arrow}</div>` : ''}
          <div class="prog-trend-block">
            <span class="prog-trend-val prog-trend-dim">${lastWkPct !== null ? lastWkPct + '%' : '—'}</span>
            <span class="prog-trend-period">Last week</span>
          </div>
        </div>
      </section>`;
    }

    // Assemble content (topbar + sections)
    const missionHTML = (typeof window._ponteMissionCardHTML === 'function')
      ? window._ponteMissionCardHTML()
      : '';
    const topbar = `<div class="tab-topbar"><div class="logo">Pon<span>te</span></div></div>`;
    const container = `<div class="prog-container">${missionHTML}${overviewHTML}${breakdownHTML}${weakHTML}${activityHTML}${trendHTML}</div>`;

    panel.innerHTML = topbar + container;
  }

  // Expose for tab-switch hook and event listeners
  window._ponteProgressRender = render;

  // Re-render whenever flashcard or error-pattern data changes.
  // Always re-render unconditionally — the panel may be active, and the render
  // is cheap (pure localStorage read + innerHTML). switchTab also calls render
  // on every navigation to this tab, so stale data is never visible on arrival.
  window.addEventListener('ponte:flashcard-saved',         render);
  window.addEventListener('ponte:flashcards-synced',       render);
  window.addEventListener('ponte:error-patterns-updated',  render);
  window.addEventListener('ponte:mission-updated',         render);

  // Initial render
  render();

})();
