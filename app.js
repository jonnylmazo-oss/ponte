(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────────
  const state = {
    article:      null,
    lang:         'en',   // 'en' | 'es'
    activeWordEl: null,
  };

  // ── DOM refs ───────────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);

  const articleTitle      = $('article-title');
  const articleDifficulty = $('article-difficulty');
  const articleTopic      = $('article-topic');
  const translationLabel  = $('translation-label');
  const translationText   = $('translation-text');
  const italianText       = $('italian-text');
  const toggleBtns        = document.querySelectorAll('.toggle-btn');

  const tooltip       = $('tooltip');
  const tooltipWord   = $('tooltip-word');
  const tooltipBadge  = $('tooltip-badge');
  const tooltipEN     = $('tooltip-english');
  const tooltipES     = $('tooltip-spanish');
  const tooltipNote   = $('tooltip-note');

  // ── Tokenizer ──────────────────────────────────────────────────────────
  // Matches runs of letters including all Italian-accented chars.
  // Apostrophes (elision like "c'era") act as natural separators.
  const WORD_RE = /([A-Za-z\u00C0-\u024F]+)/g;

  function tokenizeItalian(text) {
    return text.replace(WORD_RE, (word) => {
      const key   = word.toLowerCase();
      const entry = wordmap[key];
      if (entry) {
        return `<span class="word word-${entry.category}" data-word="${key}" data-has-entry="true">${word}</span>`;
      }
      return `<span class="word" data-word="${key}">${word}</span>`;
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────
  function renderArticle(article) {
    state.article = article;
    articleTitle.textContent      = article.title;
    articleDifficulty.textContent = article.difficulty;
    articleTopic.textContent      = article.topic;
    italianText.innerHTML         = tokenizeItalian(article.italian);
    updateTranslation();
  }

  function updateTranslation() {
    if (!state.article) return;
    const isEN = state.lang === 'en';
    translationLabel.textContent = isEN ? 'English' : 'Español';
    translationText.textContent  = isEN ? state.article.english : state.article.spanish;
  }

  // ── Tooltip ────────────────────────────────────────────────────────────
  const CATEGORY_LABELS = {
    'cognate':      'Cognate',
    'false-friend': 'False Friend',
    'divergence':   'Divergence',
    'new':          'New Word',
  };

  function showTooltip(wordEl) {
    const key   = wordEl.dataset.word;
    const entry = wordmap[key];
    if (!entry) return;

    // Swap active word
    if (state.activeWordEl) state.activeWordEl.classList.remove('active');
    state.activeWordEl = wordEl;
    wordEl.classList.add('active');

    // Populate content
    tooltipWord.textContent  = key;
    tooltipBadge.textContent = CATEGORY_LABELS[entry.category] || entry.category;
    tooltipBadge.className   = `tooltip-badge ${entry.category}`;
    tooltipEN.textContent    = entry.english;
    tooltipES.textContent    = entry.spanish;
    tooltipNote.textContent  = entry.note || '';

    // Make visible (needs to be in DOM to measure)
    tooltip.hidden = false;
    tooltip.removeAttribute('aria-hidden');
    // Force reflow so the transition fires correctly
    tooltip.classList.remove('visible');
    // eslint-disable-next-line no-unused-expressions
    tooltip.offsetHeight; // trigger reflow
    tooltip.classList.add('visible');

    positionTooltip(wordEl);
  }

  function positionTooltip(wordEl) {
    const GAP  = 10;
    const rect = wordEl.getBoundingClientRect();
    const tipW = tooltip.offsetWidth;
    const tipH = tooltip.offsetHeight;
    const vw   = window.innerWidth;
    const vh   = window.innerHeight;

    // Default: below the word
    let top  = rect.bottom + GAP;
    let left = rect.left;

    // Flip above if it would overflow the bottom of the viewport
    if (top + tipH > vh - GAP) {
      top = rect.top - tipH - GAP;
    }
    // Clamp horizontal to viewport
    if (left + tipW > vw - GAP) left = vw - tipW - GAP;
    if (left < GAP)              left = GAP;

    tooltip.style.top  = `${top}px`;
    tooltip.style.left = `${left}px`;
  }

  function hideTooltip() {
    if (state.activeWordEl) {
      state.activeWordEl.classList.remove('active');
      state.activeWordEl = null;
    }
    tooltip.classList.remove('visible');
    tooltip.setAttribute('aria-hidden', 'true');
    // Wait for fade-out before hiding from layout
    setTimeout(() => {
      if (!tooltip.classList.contains('visible')) {
        tooltip.hidden = true;
      }
    }, 140);
  }

  // ── Events ─────────────────────────────────────────────────────────────
  document.addEventListener('click', (e) => {
    const wordEl = e.target.closest('[data-has-entry]');
    if (wordEl) {
      // Toggle: clicking the same word closes the tooltip
      if (wordEl === state.activeWordEl) {
        hideTooltip();
      } else {
        showTooltip(wordEl);
      }
      return;
    }
    // Clicking inside the open tooltip does nothing
    if (e.target.closest('#tooltip')) return;
    // Anything else: close
    hideTooltip();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideTooltip();
  });

  // EN / ES toggle
  toggleBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang;
      if (lang === state.lang) return;
      state.lang = lang;
      toggleBtns.forEach((b) => b.classList.toggle('active', b.dataset.lang === lang));
      updateTranslation();
    });
  });

  // ── Init ───────────────────────────────────────────────────────────────
  renderArticle(articles[0]);
})();
