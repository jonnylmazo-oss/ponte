(function () {
  'use strict';

  const API_BASE    = 'http://localhost:3000';
  const CACHE_PREFIX = 'ponte_article_';
  const LS_TRANSL   = 'ponte_translation';
  const LS_TAB      = 'ponte_tab';
  const LS_SIDEBAR  = 'ponte_sidebar';
  const FC_KEY      = 'ponte_flashcards';

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
    translationMode: false,  // tooltip is showing a dynamic translation (not a pre-annotated word)
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
  const tooltipSaveBtn   = $('tooltip-save-btn');
  const backdrop         = $('tooltip-backdrop');

  const topicInput       = $('topic-input');
  const difficultySelect = $('difficulty-select');
  const generateBtn      = $('generate-btn');
  const surpriseBtn      = $('surprise-btn');
  const generateError    = $('generate-error');

  const appWrapper      = $('app-wrapper');
  const sidebarToggleBtn = $('sidebar-toggle');

  // Track the word/entry currently shown in the tooltip so save button can access it
  let currentTooltipWord  = '';
  let currentTooltipEntry = null;

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
  // Accepts both the legacy long-key format (static wordmap.js fallback article)
  // and the new short-key format { w, en, es, c, n, p } from generated articles.
  function buildWordmap(words) {
    const map = {};
    (words || []).forEach((entry) => {
      const word         = entry.w        || entry.word        || '';
      const english      = entry.en       || entry.english     || '';
      const spanish      = entry.es       || entry.spanish     || '';
      const category     = entry.c        || entry.category    || 'new';
      const note         = entry.n        || entry.note        || null;
      const pronunciation = entry.p       || entry.pronunciation || null;
      const example      = entry.example  || null;
      const exampleEN    = entry.exampleEN || null;
      if (!word) return;
      map[word.toLowerCase()] = {
        english,
        spanish,
        note,
        category,
        label:         CATEGORY_LABELS[category] || category,
        pronunciation,
        example,
        exampleEN,
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
    currentTooltipWord  = word;
    currentTooltipEntry = entry;

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

    // Update save button state
    updateSaveBtn(word);
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

    state.translationMode = false;
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
    state.translationMode = true;  // hover-leave won't dismiss; selection-clear will

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
    state.translationMode = false;
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
      activeXlatText = null;
      if (wordEl === state.activeWordEl && state.pinnedByClick) {
        state.pinnedByClick = false;
        hideTooltip();
      } else {
        state.pinnedByClick = true;
        showTooltip(wordEl);
      }
      return;
    }
    if (e.target.closest('#tooltip')) return;
    state.pinnedByClick = false;
    activeXlatText = null;
    hideTooltip();
  });

  // Hover: show after 200ms delay, hide 100ms after leaving word/tooltip
  italianText.addEventListener('mouseover', (e) => {
    if (isMobile()) return;
    if (state.translationMode) return; // selection tooltip is active — don't override with hover
    const wordEl = e.target.closest('[data-has-entry]');
    if (!wordEl) return;
    if (e.relatedTarget && wordEl.contains(e.relatedTarget)) return;
    clearTimeout(state.hoverHideTimer);
    if (state.pinnedByClick) return;
    clearTimeout(state.hoverTimer);
    state.hoverTimer = setTimeout(() => {
      if (!state.pinnedByClick && !state.translationMode) showTooltip(wordEl);
    }, 200);
  });

  italianText.addEventListener('mouseout', (e) => {
    if (isMobile()) return;
    if (state.translationMode) return; // selection tooltip persists until selection clears
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
    clearTimeout(selectionDebounceTimer); // prevent selection-clear from hiding while user reads
  });
  tooltip.addEventListener('mouseleave', () => {
    // Translation tooltips persist until selection clears — don't dismiss on hover-leave
    if (!state.pinnedByClick && !state.translationMode) {
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
      activeXlatText = null;
      hideTooltip();
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
  const XLAT_CACHE_PREFIX  = 'ponte_xlat_';
  let selectionDebounceTimer = null;
  let xlatAbortCtrl        = null;  // AbortController for in-flight translate request
  let activeXlatText       = null;  // text currently showing/loading in translation mode

  // selectionchange fires on every cursor/drag change — use it both to trigger
  // translation (debounced) and to dismiss when selection is cleared.
  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();

    if (!sel || !sel.toString().trim()) {
      // Selection is genuinely empty — dismiss translation tooltip after a grace period
      // (allows clicking on the tooltip card without it immediately vanishing)
      if (activeXlatText !== null && !state.pinnedByClick) {
        clearTimeout(selectionDebounceTimer);
        selectionDebounceTimer = setTimeout(() => {
          // Re-confirm selection is still empty before dismissing
          if (!window.getSelection()?.toString().trim() &&
              activeXlatText !== null && !state.pinnedByClick) {
            hideTooltip();
            activeXlatText = null;
          }
        }, 200);
      }
      return;
    }

    const range = sel.getRangeAt(0);
    if (!italianText.contains(range.commonAncestorContainer)) return;

    const text = sel.toString().trim();
    if (!text || text.length < 2) return;
    if (text === activeXlatText) return; // result for this exact text already showing

    // Debounce: wait for selection to stabilise before firing the API call
    clearTimeout(selectionDebounceTimer);
    selectionDebounceTimer = setTimeout(() => {
      const sel2 = window.getSelection();
      if (!sel2 || sel2.isCollapsed || !sel2.rangeCount) return;
      const range2 = sel2.getRangeAt(0);
      if (!italianText.contains(range2.commonAncestorContainer)) return;
      const text2 = sel2.toString().trim();
      if (!text2 || text2.length < 2) return;
      doTranslate(text2, italianText.innerText, range2.getBoundingClientRect());
    }, 300);
  });

  function showTooltipLoading(word, anchorRect) {
    if (state.activeWordEl) {
      state.activeWordEl.classList.remove('active');
      state.activeWordEl = null;
    }
    tooltipWord.textContent  = word;
    tooltipPron.hidden       = true;
    tooltipBadge.textContent = '';
    tooltipBadge.className   = 'tooltip-badge';
    tooltipEN.textContent    = 'Translating…';
    tooltipES.textContent    = '';
    tooltipNote.textContent  = '';
    tooltipExample.hidden    = true;
    tooltip.style.setProperty('--tooltip-accent', 'rgba(0, 194, 184, 0.3)');

    revealTooltip();
    state.translationMode = true;

    if (isMobile()) {
      backdrop.classList.add('visible');
    } else if (anchorRect) {
      positionTooltipAt(anchorRect);
    }
  }

  async function doTranslate(text, context, anchorRect) {
    // Cancel any previous in-flight request
    if (xlatAbortCtrl) xlatAbortCtrl.abort();
    xlatAbortCtrl = new AbortController();

    const cacheKey = XLAT_CACHE_PREFIX + text.toLowerCase().trim();
    const cached   = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const entry = JSON.parse(cached);
        activeXlatText = text;
        showTooltipFromEntry(entry, anchorRect);
        return;
      } catch { /* stale — re-fetch */ }
    }

    activeXlatText = text;
    showTooltipLoading(text, anchorRect);

    try {
      const resp = await fetch(`${API_BASE}/api/translate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text, context }),
        signal:  xlatAbortCtrl.signal,
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const entry = await resp.json();
      localStorage.setItem(cacheKey, JSON.stringify(entry));

      // Only update if user hasn't moved to a different selection
      if (activeXlatText === text) {
        showTooltipFromEntry(entry, anchorRect);
      }
    } catch (err) {
      if (err.name === 'AbortError') return; // superseded by a newer selection
      console.error('Translation failed:', err.message);
      if (activeXlatText === text) {
        tooltipEN.textContent = 'Translation failed — try again';
      }
    }
  }

  // ── Flashcards ─────────────────────────────────────────────────────────
  function loadFlashcards() {
    try { return JSON.parse(localStorage.getItem(FC_KEY) || '[]'); }
    catch { return []; }
  }

  function isFlashcardSaved(word) {
    return loadFlashcards().some((c) => c.italian.toLowerCase() === word.toLowerCase());
  }

  function updateSaveBtn(word) {
    if (!tooltipSaveBtn) return;
    const saved = word && isFlashcardSaved(word);
    tooltipSaveBtn.textContent = saved ? 'Saved ✓' : 'Save ★';
    tooltipSaveBtn.classList.toggle('saved', !!saved);
  }

  function updateFlashcardBadge() {
    const count = loadFlashcards().length;
    ['fc-badge-sidebar', 'fc-badge-bottom'].forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.textContent = count;
      el.hidden = count === 0;
    });
  }

  tooltipSaveBtn && tooltipSaveBtn.addEventListener('click', () => {
    if (!currentTooltipEntry || !currentTooltipWord) return;
    const cards = loadFlashcards();
    const key   = currentTooltipWord.toLowerCase();

    // Toggle: if already saved, remove it
    const existingIdx = cards.findIndex((c) => c.italian.toLowerCase() === key);
    if (existingIdx !== -1) {
      cards.splice(existingIdx, 1);
      localStorage.setItem(FC_KEY, JSON.stringify(cards));
      updateSaveBtn(currentTooltipWord);
      updateFlashcardBadge();
      window.dispatchEvent(new CustomEvent('ponte:flashcard-saved'));
      return;
    }

    const card = {
      id:            Date.now(),
      italian:       currentTooltipWord,
      english:       currentTooltipEntry.english  || '',
      spanish:       currentTooltipEntry.spanish  || '',
      category:      currentTooltipEntry.category || 'new',
      note:          currentTooltipEntry.note     || '',
      savedAt:       new Date().toISOString(),
      sourceArticle: state.article ? state.article.title : '',
      timesCorrect:  0,
      timesWrong:    0,
      lastSeen:      null,
    };
    cards.push(card);
    localStorage.setItem(FC_KEY, JSON.stringify(cards));

    // Brief flash animation
    tooltipSaveBtn.textContent = 'Saved!';
    tooltipSaveBtn.classList.add('flash');
    setTimeout(() => {
      tooltipSaveBtn.classList.remove('flash');
      updateSaveBtn(currentTooltipWord);
    }, 800);

    updateFlashcardBadge();
    window.dispatchEvent(new CustomEvent('ponte:flashcard-saved'));
  });

  // ── Init ───────────────────────────────────────────────────────────────
  initTabs();
  initSidebar();
  initTranslationToggle();
  updateFlashcardBadge();
  renderArticle(articles[0], window.wordmap);
})();
