(function () {
  'use strict';

  const API_BASE    = 'http://localhost:3000';
  const CACHE_PREFIX = 'ponte_article_';
  const LS_TRANSL   = 'ponte_translation';
  const LS_TAB      = 'ponte_tab';
  const LS_SIDEBAR  = 'ponte_sidebar';

  const SURPRISE_TOPICS = [
    'mercato', 'calcio', 'caffè', 'spiaggia', 'lavoro',
    'famiglia', 'treno', 'weekend', 'cucina italiana', 'aperitivo',
    'vacanze', 'musica', 'città', 'amici', 'università',
    'estate', 'inverno', 'viaggio', 'tecnologia', 'cinema',
  ];

  // ── State ──────────────────────────────────────────────────────────────
  const state = {
    article:         null,
    lang:            'en',   // 'en' | 'es'
    activeWordEl:    null,
    activeWordmap:   {},
    translationOpen: false,  // default: collapsed
    pinnedByClick:   false,  // tooltip locked open by a click (not just hover)
    hoverTimer:      null,   // setTimeout for hover-show delay
    hoverHideTimer:  null,   // setTimeout for hover-leave hide delay
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
  const readerEl          = $('reader');
  const translToggleBtn   = $('transl-toggle');

  const tooltip          = $('tooltip');
  const tooltipWord      = $('tooltip-word');
  const tooltipPron      = $('tooltip-pron');
  const tooltipBadge     = $('tooltip-badge');
  const tooltipEN        = $('tooltip-english');
  const tooltipES        = $('tooltip-spanish');
  const tooltipNote      = $('tooltip-note');
  const tooltipExample   = $('tooltip-example');
  const tooltipExampleIt = $('tooltip-example-it');
  const tooltipExampleEn = $('tooltip-example-en');
  const backdrop         = $('tooltip-backdrop');

  const topicInput       = $('topic-input');
  const difficultySelect = $('difficulty-select');
  const generateBtn      = $('generate-btn');
  const surpriseBtn      = $('surprise-btn');
  const generateError    = $('generate-error');

  const appWrapper      = $('app-wrapper');
  const sidebarToggleBtn = $('sidebar-toggle');

  // ── Categories ─────────────────────────────────────────────────────────
  const CATEGORY_LABELS = {
    'cognate':      'Same in Spanish',
    'false-friend': 'False Friend',
    'divergence':   'Used differently',
    'new':          'New word',
  };

  const CATEGORY_COLORS = {
    'cognate':      'rgba(74, 144, 217, 0.45)',
    'false-friend': 'rgba(245, 200, 66, 0.45)',
    'divergence':   'rgba(245, 137, 74, 0.45)',
    'new':          'rgba(136, 136, 136, 0.25)',
  };

  // ── Wordmap builder ────────────────────────────────────────────────────
  function buildWordmap(words) {
    const map = {};
    (words || []).forEach(({ word, english, spanish, category, note, pronunciation, example, exampleEN }) => {
      map[word.toLowerCase()] = {
        english,
        spanish,
        note:          note || null,
        category,
        label:         CATEGORY_LABELS[category] || category,
        pronunciation: pronunciation || null,
        example:       example || null,
        exampleEN:     exampleEN || null,
      };
    });
    return map;
  }

  // ── Tokenizer ──────────────────────────────────────────────────────────
  const WORD_RE = /([A-Za-z\u00C0-\u024F]+)/g;

  function tokenizeItalian(text) {
    return text.replace(WORD_RE, (word) => {
      const key   = word.toLowerCase();
      const entry = state.activeWordmap[key];
      if (entry) {
        return `<span class="word word-${entry.category}" data-word="${key}" data-has-entry="true">${word}</span>`;
      }
      return `<span class="word" data-word="${key}">${word}</span>`;
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────
  function renderArticle(article, wordmapOverride) {
    state.article      = article;
    state.activeWordmap = wordmapOverride || buildWordmap(article.words);

    articleTitle.textContent      = article.title;
    articleDifficulty.textContent = article.difficulty;
    articleTopic.textContent      = article.topic;
    italianText.innerHTML         = tokenizeItalian(article.italian);
    updateTranslation();
    hideTooltip();
  }

  function updateTranslation() {
    if (!state.article) return;
    const isEN = state.lang === 'en';
    translationLabel.textContent = isEN ? 'English' : 'Español';
    translationText.textContent  = isEN ? state.article.english : state.article.spanish;
  }

  // ── Loading UI ─────────────────────────────────────────────────────────
  function setLoading(on) {
    generateBtn.disabled = on;
    surpriseBtn.disabled = on;
    generateBtn.textContent = on ? 'Generating…' : 'Generate';
    if (on) {
      italianText.innerHTML = [90, 85, 93, 78, 88, 82]
        .map((w) => `<div class="skeleton-line" style="width:${w}%"></div>`)
        .join('');
      translationText.textContent   = '';
      articleTitle.textContent      = '';
      articleDifficulty.textContent = '';
      articleTopic.textContent      = '';
    }
  }

  function showError(msg) {
    generateError.textContent = msg;
    generateError.hidden = false;
  }

  function clearError() {
    generateError.textContent = '';
    generateError.hidden = true;
  }

  // ── Streaming helpers ──────────────────────────────────────────────────
  function escapeHTML(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // Extract the (possibly partial) value of a JSON string field from a streaming buffer.
  // Returns whatever text has arrived so far, or null if the field hasn't started yet.
  function extractStreamingField(buffer, fieldName) {
    const marker = `"${fieldName}":`;
    const markerIdx = buffer.indexOf(marker);
    if (markerIdx === -1) return null;

    let i = markerIdx + marker.length;
    while (i < buffer.length && buffer[i] !== '"') i++;
    if (i >= buffer.length) return null;
    i++; // skip opening quote

    let text = '';
    while (i < buffer.length) {
      const ch = buffer[i];
      if (ch === '\\' && i + 1 < buffer.length) {
        const next = buffer[i + 1];
        if      (next === 'n')  { text += '\n'; }
        else if (next === '"')  { text += '"';  }
        else if (next === '\\') { text += '\\'; }
        else if (next === 't')  { text += '\t'; }
        else                    { text += next; }
        i += 2;
      } else if (ch === '"') {
        break; // closing quote — field complete
      } else {
        text += ch;
        i++;
      }
    }

    return text.length > 0 ? text : null;
  }

  function renderStreamingText(buffer) {
    // Italian — main reading column
    const italian = extractStreamingField(buffer, 'italian');
    if (italian !== null) {
      italianText.innerHTML =
        escapeHTML(italian) +
        '<span class="stream-cursor" aria-hidden="true"></span>';
    }

    // Translation — whichever language is selected
    const translField = state.lang === 'en' ? 'english' : 'spanish';
    const translation = extractStreamingField(buffer, translField);
    if (translation !== null) {
      translationText.textContent = translation;
    }

    // Meta fields — arrive early in the JSON, appear as soon as streamed
    const title      = extractStreamingField(buffer, 'title');
    const difficulty = extractStreamingField(buffer, 'difficulty');
    const topic      = extractStreamingField(buffer, 'topic');
    if (title)      articleTitle.textContent      = title;
    if (difficulty) articleDifficulty.textContent = difficulty;
    if (topic)      articleTopic.textContent      = topic;
  }

  // ── Generate — SSE streaming with localStorage cache ──────────────────
  function generateArticle(topic, difficulty) {
    const cacheKey = CACHE_PREFIX + topic.toLowerCase().trim() + '_' + difficulty;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        renderArticle(JSON.parse(cached));
        return;
      } catch { /* corrupt entry — re-fetch */ }
    }

    setLoading(true);
    clearError();

    // Show known meta immediately — no need to wait for stream
    articleDifficulty.textContent = difficulty;
    articleTopic.textContent      = topic;

    const params = new URLSearchParams({ topic, difficulty });
    const es = new EventSource(`${API_BASE}/api/generate-article-stream?${params}`);
    let tokenBuffer = '';
    let streamDone  = false;

    es.onmessage = (e) => {
      const { token } = JSON.parse(e.data);
      tokenBuffer += token;
      renderStreamingText(tokenBuffer);
    };

    es.addEventListener('done', (e) => {
      streamDone = true;
      es.close();
      try {
        const article = JSON.parse(e.data);
        localStorage.setItem(cacheKey, JSON.stringify(article));
        renderArticle(article);
      } catch (err) {
        console.error('Failed to parse article from done event:', err.message);
        showError('Article generation failed — please try again.');
        if (!state.article) renderArticle(articles[0], window.wordmap);
        else italianText.innerHTML = tokenizeItalian(state.article.italian);
      }
      setLoading(false);
    });

    es.addEventListener('generation-error', (e) => {
      streamDone = true;
      es.close();
      const { error } = JSON.parse(e.data);
      showError('Generation failed — ' + error);
      if (!state.article) renderArticle(articles[0], window.wordmap);
      else italianText.innerHTML = tokenizeItalian(state.article.italian);
      setLoading(false);
    });

    es.onerror = () => {
      if (streamDone || es.readyState === EventSource.CLOSED) return;
      es.close();
      showError('Connection error — is the server running on :3000?');
      if (!state.article) renderArticle(articles[0], window.wordmap);
      else italianText.innerHTML = tokenizeItalian(state.article.italian);
      setLoading(false);
    };
  }

  // ── Tooltip ────────────────────────────────────────────────────────────
  function isMobile() {
    return window.innerWidth <= 820;
  }

  function populateTooltip(word, entry) {
    tooltipWord.textContent  = word;
    tooltipPron.textContent  = entry.pronunciation || '';
    tooltipPron.hidden       = !entry.pronunciation;
    tooltipBadge.textContent = CATEGORY_LABELS[entry.category] || entry.category;
    tooltipBadge.className   = `tooltip-badge ${entry.category || 'new'}`;
    tooltipEN.textContent    = entry.english  || '';
    tooltipES.textContent    = entry.spanish  || '';
    tooltipNote.textContent  = entry.note     || '';

    if (entry.example) {
      tooltipExampleIt.textContent = entry.example;
      tooltipExampleEn.textContent = entry.exampleEN || '';
      tooltipExample.hidden = false;
    } else {
      tooltipExample.hidden = true;
    }

    const accent = CATEGORY_COLORS[entry.category] || CATEGORY_COLORS['new'];
    tooltip.style.setProperty('--tooltip-accent', accent);
  }

  function revealTooltip() {
    tooltip.hidden = false;
    tooltip.removeAttribute('aria-hidden');
    tooltip.classList.remove('visible');
    // eslint-disable-next-line no-unused-expressions
    tooltip.offsetHeight; // trigger reflow so transition fires
    tooltip.classList.add('visible');
  }

  function showTooltip(wordEl) {
    const key   = wordEl.dataset.word;
    const entry = state.activeWordmap[key];
    if (!entry) return;

    if (state.activeWordEl) state.activeWordEl.classList.remove('active');
    state.activeWordEl = wordEl;
    wordEl.classList.add('active');

    populateTooltip(key, entry);
    revealTooltip();

    if (isMobile()) {
      backdrop.classList.add('visible');
    } else {
      positionTooltipAt(wordEl.getBoundingClientRect());
    }
  }

  // Show tooltip for a dynamically translated entry, anchored to a selection rect.
  function showTooltipFromEntry(entry, anchorRect) {
    if (state.activeWordEl) {
      state.activeWordEl.classList.remove('active');
      state.activeWordEl = null;
    }

    populateTooltip(entry.italian || '', entry);
    revealTooltip();
    state.pinnedByClick = true;

    if (isMobile()) {
      backdrop.classList.add('visible');
    } else if (anchorRect) {
      positionTooltipAt(anchorRect);
    }
  }

  function positionTooltipAt(anchorRect) {
    const GAP  = 10;
    const tipW = tooltip.offsetWidth;
    const tipH = tooltip.offsetHeight;
    const vw   = window.innerWidth;
    const vh   = window.innerHeight;

    let top  = anchorRect.bottom + GAP;
    let left = anchorRect.left;

    if (top + tipH > vh - GAP) top = anchorRect.top - tipH - GAP;
    if (left + tipW > vw - GAP) left = vw - tipW - GAP;
    if (left < GAP)             left = GAP;

    tooltip.style.top  = `${top}px`;
    tooltip.style.left = `${left}px`;
  }

  function hideTooltip() {
    clearTimeout(state.hoverTimer);
    clearTimeout(state.hoverHideTimer);
    if (state.activeWordEl) {
      state.activeWordEl.classList.remove('active');
      state.activeWordEl = null;
    }
    tooltip.classList.remove('visible');
    tooltip.setAttribute('aria-hidden', 'true');
    backdrop.classList.remove('visible');
    setTimeout(() => {
      if (!tooltip.classList.contains('visible')) tooltip.hidden = true;
    }, 280);
  }

  // ── Translation column toggle ──────────────────────────────────────────
  function applyTranslationState(open, save) {
    state.translationOpen = open;
    readerEl.classList.toggle('translation-collapsed', !open);
    const icon = translToggleBtn.querySelector('.transl-toggle-icon');
    if (icon) icon.textContent = open ? '◀' : '▶';
    translToggleBtn.setAttribute('aria-pressed', String(open));
    if (save) localStorage.setItem(LS_TRANSL, open ? '1' : '0');
  }

  function initTranslationToggle() {
    const saved = localStorage.getItem(LS_TRANSL);
    // Default: collapsed (false). Only open if explicitly saved as '1'.
    const open = saved === '1';
    applyTranslationState(open, false);

    translToggleBtn.addEventListener('click', () => {
      applyTranslationState(!state.translationOpen, true);
    });
  }

  // ── Events ─────────────────────────────────────────────────────────────

  // Click: pins tooltip open; second click on same word unpins and closes
  document.addEventListener('click', (e) => {
    const wordEl = e.target.closest('[data-has-entry]');
    if (wordEl) {
      clearTimeout(state.hoverTimer);
      clearTimeout(state.hoverHideTimer);
      hideTranslateBtn();
      if (wordEl === state.activeWordEl && state.pinnedByClick) {
        state.pinnedByClick = false;
        hideTooltip();
      } else {
        state.pinnedByClick = true;
        showTooltip(wordEl);
      }
      return;
    }
    if (e.target.closest('#tooltip') || e.target.id === 'translate-btn') return;
    state.pinnedByClick = false;
    hideTooltip();
    hideTranslateBtn();
  });

  // Hover: show after 200ms delay, hide 100ms after leaving word/tooltip
  italianText.addEventListener('mouseover', (e) => {
    if (isMobile()) return;
    const wordEl = e.target.closest('[data-has-entry]');
    if (!wordEl) return;
    if (e.relatedTarget && wordEl.contains(e.relatedTarget)) return;
    clearTimeout(state.hoverHideTimer);
    if (state.pinnedByClick) return;
    clearTimeout(state.hoverTimer);
    state.hoverTimer = setTimeout(() => {
      if (!state.pinnedByClick) showTooltip(wordEl);
    }, 200);
  });

  italianText.addEventListener('mouseout', (e) => {
    if (isMobile()) return;
    const wordEl = e.target.closest('[data-has-entry]');
    if (!wordEl) return;
    if (wordEl.contains(e.relatedTarget)) return;
    clearTimeout(state.hoverTimer);
    if (!state.pinnedByClick) {
      state.hoverHideTimer = setTimeout(hideTooltip, 100);
    }
  });

  // Keep tooltip open when mouse moves from word onto tooltip card
  tooltip.addEventListener('mouseenter', () => {
    clearTimeout(state.hoverHideTimer);
  });
  tooltip.addEventListener('mouseleave', () => {
    if (!state.pinnedByClick) {
      state.hoverHideTimer = setTimeout(hideTooltip, 80);
    }
  });

  backdrop.addEventListener('click', () => {
    state.pinnedByClick = false;
    hideTooltip();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      state.pinnedByClick = false;
      hideTooltip();
      hideTranslateBtn();
    }
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

  // Generator
  generateBtn.addEventListener('click', () => {
    const topic = topicInput.value.trim();
    if (!topic) { topicInput.focus(); return; }
    generateArticle(topic, difficultySelect.value);
  });

  surpriseBtn.addEventListener('click', () => {
    const topic = SURPRISE_TOPICS[Math.floor(Math.random() * SURPRISE_TOPICS.length)];
    topicInput.value = topic;
    generateArticle(topic, difficultySelect.value);
  });

  topicInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') generateBtn.click();
  });

  // ── Tab navigation ─────────────────────────────────────────────────────
  let currentTab = 'reader';

  function switchTab(tabId) {
    if (tabId === currentTab) return;

    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    const panel = $(`tab-${tabId}`);
    if (panel) panel.classList.add('active');

    document.querySelectorAll('[data-tab]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    currentTab = tabId;
    localStorage.setItem(LS_TAB, tabId);
  }

  function initTabs() {
    const saved = localStorage.getItem(LS_TAB) || 'reader';

    // Set initial state (no animation on load)
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    const panel = $(`tab-${saved}`);
    if (panel) panel.classList.add('active');
    document.querySelectorAll('[data-tab]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === saved);
    });
    currentTab = saved;

    document.querySelectorAll('[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
  }

  // ── Sidebar collapse ───────────────────────────────────────────────────
  function initSidebar() {
    const collapsed = localStorage.getItem(LS_SIDEBAR) === '1';
    if (collapsed) appWrapper.classList.add('sidebar-collapsed');
    sidebarToggleBtn.textContent = collapsed ? '›' : '‹';

    sidebarToggleBtn.addEventListener('click', () => {
      const isCollapsed = appWrapper.classList.toggle('sidebar-collapsed');
      sidebarToggleBtn.textContent = isCollapsed ? '›' : '‹';
      localStorage.setItem(LS_SIDEBAR, isCollapsed ? '1' : '0');
    });
  }

  // ── Dynamic translation (any selected text in Italian column) ──────────
  const translateBtn  = $('translate-btn');
  let pendingSelection = null;  // { text, context, rect }

  const XLAT_CACHE_PREFIX = 'ponte_xlat_';

  function showTranslateBtn(rect) {
    const GAP  = 8;
    const btnW = translateBtn.offsetWidth || 110;
    let left   = rect.left + rect.width / 2 - btnW / 2;
    let top    = rect.top - translateBtn.offsetHeight - GAP - 4;

    if (left < 8)                          left = 8;
    if (left + btnW > window.innerWidth - 8) left = window.innerWidth - btnW - 8;
    if (top < 8)                           top  = rect.bottom + GAP;

    translateBtn.style.left = `${left}px`;
    translateBtn.style.top  = `${top}px`;
    translateBtn.textContent = 'Translate ↗';
    translateBtn.disabled    = false;
    translateBtn.hidden      = false;
  }

  function hideTranslateBtn() {
    translateBtn.hidden  = true;
    translateBtn.textContent = 'Translate ↗';
    translateBtn.disabled    = false;
    pendingSelection         = null;
  }

  function handleSelectionChange() {
    // Small delay so selection is finalised after mouseup/touchend
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) {
        hideTranslateBtn();
        return;
      }

      const range = sel.getRangeAt(0);
      if (!italianText.contains(range.commonAncestorContainer)) {
        hideTranslateBtn();
        return;
      }

      const text = sel.toString().trim();
      if (!text || text.length < 2) { hideTranslateBtn(); return; }

      const rect = range.getBoundingClientRect();
      pendingSelection = { text, context: italianText.innerText, rect };
      showTranslateBtn(rect);
    }, 30);
  }

  italianText.addEventListener('mouseup',  handleSelectionChange);
  italianText.addEventListener('touchend', handleSelectionChange);

  translateBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!pendingSelection) return;
    doTranslate(pendingSelection.text, pendingSelection.context, pendingSelection.rect);
  });

  async function doTranslate(text, context, anchorRect) {
    const cacheKey = XLAT_CACHE_PREFIX + text.toLowerCase().trim();
    const cached   = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const entry = JSON.parse(cached);
        showTooltipFromEntry(entry, anchorRect);
        hideTranslateBtn();
        return;
      } catch { /* stale */ }
    }

    translateBtn.textContent = '…';
    translateBtn.disabled    = true;

    try {
      const resp = await fetch(`${API_BASE}/api/translate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text, context }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const entry = await resp.json();
      localStorage.setItem(cacheKey, JSON.stringify(entry));
      showTooltipFromEntry(entry, anchorRect);
      hideTranslateBtn();
    } catch (err) {
      console.error('Translation failed:', err.message);
      translateBtn.textContent = 'Translate ↗';
      translateBtn.disabled    = false;
    }
  }

  // ── Init ───────────────────────────────────────────────────────────────
  initTabs();
  initSidebar();
  initTranslationToggle();
  renderArticle(articles[0], window.wordmap);
})();
