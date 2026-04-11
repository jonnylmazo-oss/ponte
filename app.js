(function () {
  'use strict';

  const API_BASE    = 'http://localhost:3000';
  const CACHE_PREFIX = 'ponte_article_';

  const SURPRISE_TOPICS = [
    'mercato', 'calcio', 'caffè', 'spiaggia', 'lavoro',
    'famiglia', 'treno', 'weekend', 'cucina italiana', 'aperitivo',
    'vacanze', 'musica', 'città', 'amici', 'università',
    'estate', 'inverno', 'viaggio', 'tecnologia', 'cinema',
  ];

  // ── State ──────────────────────────────────────────────────────────────
  const state = {
    article:      null,
    lang:         'en',   // 'en' | 'es'
    activeWordEl: null,
    activeWordmap: {},
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

  const tooltip      = $('tooltip');
  const tooltipWord  = $('tooltip-word');
  const tooltipBadge = $('tooltip-badge');
  const tooltipEN    = $('tooltip-english');
  const tooltipES    = $('tooltip-spanish');
  const tooltipNote  = $('tooltip-note');

  const topicInput       = $('topic-input');
  const difficultySelect = $('difficulty-select');
  const generateBtn      = $('generate-btn');
  const surpriseBtn      = $('surprise-btn');
  const generateError    = $('generate-error');

  // ── Categories ─────────────────────────────────────────────────────────
  const CATEGORY_LABELS = {
    'cognate':      'Cognate',
    'false-friend': 'False Friend',
    'divergence':   'Divergence',
    'new':          'New Word',
  };

  // ── Wordmap builder ────────────────────────────────────────────────────
  function buildWordmap(words) {
    const map = {};
    (words || []).forEach(({ word, english, spanish, category, note }) => {
      map[word.toLowerCase()] = {
        english,
        spanish,
        note:     note || null,
        category,
        label:    CATEGORY_LABELS[category] || category,
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

  // Extract the value of "italian": "..." from a partial JSON buffer.
  // Returns the raw text (with JSON escape sequences resolved), or null if not yet reached.
  function extractStreamingItalian(buffer) {
    const MARKER = '"italian":';
    const markerIdx = buffer.indexOf(MARKER);
    if (markerIdx === -1) return null;

    // Find the opening quote of the value
    let i = markerIdx + MARKER.length;
    while (i < buffer.length && buffer[i] !== '"') i++;
    if (i >= buffer.length) return null;
    i++; // skip the opening quote

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
        break; // reached closing quote
      } else {
        text += ch;
        i++;
      }
    }

    return text.length > 0 ? text : null;
  }

  // Render partial Italian text with a blinking cursor while streaming.
  // Skeleton stays visible until the "italian" field begins arriving.
  function renderStreamingText(buffer) {
    const italian = extractStreamingItalian(buffer);
    if (italian === null) return; // skeleton stays

    italianText.innerHTML =
      escapeHTML(italian) +
      '<span class="stream-cursor" aria-hidden="true"></span>';

    // Show title as soon as it's fully quoted in the buffer
    const titleMatch = buffer.match(/"title"\s*:\s*"([^"\\]*)"/);
    if (titleMatch) articleTitle.textContent = titleMatch[1];
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
        showError('Received invalid article data');
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
  function showTooltip(wordEl) {
    const key   = wordEl.dataset.word;
    const entry = state.activeWordmap[key];
    if (!entry) return;

    if (state.activeWordEl) state.activeWordEl.classList.remove('active');
    state.activeWordEl = wordEl;
    wordEl.classList.add('active');

    tooltipWord.textContent  = key;
    tooltipBadge.textContent = CATEGORY_LABELS[entry.category] || entry.category;
    tooltipBadge.className   = `tooltip-badge ${entry.category}`;
    tooltipEN.textContent    = entry.english;
    tooltipES.textContent    = entry.spanish;
    tooltipNote.textContent  = entry.note || '';

    tooltip.hidden = false;
    tooltip.removeAttribute('aria-hidden');
    tooltip.classList.remove('visible');
    // eslint-disable-next-line no-unused-expressions
    tooltip.offsetHeight; // trigger reflow so transition fires
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

    let top  = rect.bottom + GAP;
    let left = rect.left;

    if (top + tipH > vh - GAP) top = rect.top - tipH - GAP;
    if (left + tipW > vw - GAP) left = vw - tipW - GAP;
    if (left < GAP)             left = GAP;

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
    setTimeout(() => {
      if (!tooltip.classList.contains('visible')) tooltip.hidden = true;
    }, 140);
  }

  // ── Events ─────────────────────────────────────────────────────────────
  document.addEventListener('click', (e) => {
    const wordEl = e.target.closest('[data-has-entry]');
    if (wordEl) {
      if (wordEl === state.activeWordEl) hideTooltip();
      else showTooltip(wordEl);
      return;
    }
    if (e.target.closest('#tooltip')) return;
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

  // ── Init ───────────────────────────────────────────────────────────────
  renderArticle(articles[0], window.wordmap);
})();
