(function () {
  'use strict';

  // Use relative path on production (nginx proxies /api/); explicit localhost for dev
  const API_BASE = (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  ) ? 'http://localhost:3000' : '';
  const CACHE_PREFIX = 'ponte_article_';
  const LS_TRANSL   = 'ponte_translation';
  const LS_TAB      = 'ponte_tab';
  const LS_SIDEBAR  = 'ponte_sidebar';
  const FC_KEY      = 'ponte_flashcards';

  const SURPRISE_TOPICS = [
    // Everyday life
    'mercato', 'caffè al bar', 'aperitivo', 'cucina italiana',
    'treno in ritardo', 'ufficio postale italiano', 'fare la spesa',
    // Work & city
    'lavoro', 'università', 'tecnologia', 'città di notte',
    // Travel & leisure
    'spiaggia d\'estate', 'vacanze in montagna',
    'cinema italiano', 'concerto dal vivo',
    // Sport & culture
    'calcio — la partita decisiva', 'la domenica in famiglia',
    'musica italiana anni \'90', 'il dibattito pizza napoletana vs romana',
    'identità regionale italiana — Nord vs Sud',
    // Emotional & relational
    'una lite tra amici che si risolve', 'dare un consiglio a un amico nei guai',
    'flirtare in italiano — un appuntamento imbarazzante',
    'una telefonata con la nonna', 'lamentarsi del traffico con i vicini',
    // Storytelling & anecdotes
    'un\'infanzia italiana — ricordi di estate',
    'una barzelletta italiana — l\'equivoco in ufficio',
    'aneddoto — quando ho sbagliato strada a Roma',
    'un pomeriggio pigro di domenica',
    // Humor & wordplay
    'i doppi sensi della lingua italiana',
    'l\'ironia italiana — dire una cosa e intenderne un\'altra',
    // Formal register
    'una richiesta formale all\'ufficio comunale',
    'scrivere un\'email professionale in italiano',
    // Classic literature & history
    'Ulisse e il Ciclope — una scena dall\'Odissea',
    'Ettore e Achille dall\'Iliade',
    'una scena dalla Divina Commedia',
    'una storia dal Decameron di Boccaccio',
    'Romolo e Remo — la fondazione di Roma',
    'Giulio Cesare — il dado è tratto',
    'una favola di Esopo in italiano',
  ];

  // ── Speech synthesis ───────────────────────────────────────────────────
  const speech = (() => {
    if (!('speechSynthesis' in window)) return { speak: () => null, supported: false };

    let voices = [];
    function loadVoices() { voices = speechSynthesis.getVoices(); }
    loadVoices();
    speechSynthesis.addEventListener('voiceschanged', loadVoices);

    function speak(text) {
      if (!text) return null;
      speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang  = 'it-IT';
      utt.rate  = 0.85;
      utt.pitch = 1.0;
      const voice = voices.find((v) => v.lang === 'it-IT') ||
                    voices.find((v) => v.lang.startsWith('it'));
      if (voice) utt.voice = voice;
      speechSynthesis.speak(utt);
      return utt;
    }

    return { speak, supported: true };
  })();

  // Expose for flashcards.js (same-page IIFE, loaded after app.js)
  window.ponteSpeak = speech.speak;

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
  const tooltipRows      = document.querySelector('.tooltip-rows');
  const tooltipSaveBtn   = $('tooltip-save-btn');
  const tooltipSpeakBtn  = $('tooltip-speak-btn');
  const articleSpeakBtn  = $('article-speak-btn');
  const backdrop         = $('tooltip-backdrop');

  const topicInput       = $('topic-input');
  const difficultySelect = $('difficulty-select');
  const generateBtn      = $('generate-btn');
  const surpriseBtn      = $('surprise-btn');
  const generateError    = $('generate-error');

  const appWrapper      = $('app-wrapper');
  const sidebarToggleBtn = $('sidebar-toggle');

  const quizTriggerBtn   = $('quiz-trigger-btn');
  const quizOverlay      = $('quiz-overlay');
  const quizModal        = $('quiz-modal');
  const quizClosBtn      = $('quiz-close-btn');
  const quizArticleTitle = $('quiz-article-title');
  const quizLoading      = $('quiz-loading');
  const quizQuestionScr  = $('quiz-question-screen');
  const quizProgressBar  = $('quiz-progress-bar');
  const quizProgressLbl  = $('quiz-progress-label');
  const quizQuestionText = $('quiz-question-text');
  const quizOptions      = $('quiz-options');
  const quizFeedback     = $('quiz-feedback');
  const quizNextBtn      = $('quiz-next-btn');
  const quizScoreScr     = $('quiz-score-screen');
  const quizScoreCircle  = $('quiz-score-circle');
  const quizScoreLbl     = $('quiz-score-label');
  const quizScoreHistory = $('quiz-score-history');
  const quizRetakeBtn    = $('quiz-retake-btn');
  const quizDoneBtn      = $('quiz-done-btn');

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
    stopArticleSpeech();
    state.article      = article;
    state.activeWordmap = wordmapOverride || buildWordmap(article.words);

    readerEl.classList.add('reader-has-article');
    articleTitle.textContent      = article.title;
    articleDifficulty.textContent = article.difficulty;
    articleTopic.textContent      = article.topic;
    italianText.innerHTML         = tokenizeItalian(article.italian);
    updateTranslation();
    hideTooltip();
    applyTranslationState(false, false); // always reset to Italian-only on new article
    quizTriggerBtn.hidden = false;
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
      readerEl.classList.add('reader-has-article'); // show column labels during skeleton
      quizTriggerBtn.hidden = true;                 // hide quiz button while generating
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
  const escapeHTML = window.ponteEsc;

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
  function generateArticle(topic, difficulty, forceRefresh = false) {
    const cacheKey = CACHE_PREFIX + topic.toLowerCase().trim() + '_' + difficulty;
    if (!forceRefresh) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          renderArticle(JSON.parse(cached));
          return;
        } catch { /* corrupt entry — re-fetch */ }
      }
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

    // Remove any previously injected tense/root rows
    tooltipRows.querySelectorAll('.tooltip-row-tense, .tooltip-row-root').forEach(function(el){ el.remove(); });

    // Helper: reject null, undefined, "", whitespace-only, and the string "null"
    function validVal(v) { return v && v !== 'null' && v.trim() !== '' ? v.trim() : ''; }

    const tenseVal = validVal(entry.tense);
    if (tenseVal) {
      const row = document.createElement('div');
      row.className = 'tooltip-row tooltip-row-tense';
      row.innerHTML = '<span class="lang-tag">TENSE</span><span>' + escapeHTML(tenseVal) + '</span>';
      tooltipRows.appendChild(row);
    }

    const rootVal = validVal(entry.root);
    if (rootVal) {
      const row = document.createElement('div');
      row.className = 'tooltip-row tooltip-row-root';
      row.innerHTML = '<span class="lang-tag">INFINITIVE</span><span class="tooltip-root">' + escapeHTML(rootVal) + '</span>';
      tooltipRows.appendChild(row);
    }

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
    if (open) {
      readerEl.classList.remove('translation-collapsed');
    } else {
      readerEl.classList.add('translation-collapsed');
    }
    const icon = translToggleBtn ? translToggleBtn.querySelector('.transl-toggle-icon') : null;
    if (icon) icon.textContent = open ? '◀' : '▶';
    if (translToggleBtn) translToggleBtn.setAttribute('aria-pressed', String(open));
    if (save) localStorage.setItem(LS_TRANSL, open ? '1' : '0');
  }

  function initTranslationToggle() {
    // Always start collapsed — Italian-only is the default
    applyTranslationState(false, false);

    if (translToggleBtn) {
      translToggleBtn.addEventListener('click', () => {
        applyTranslationState(!state.translationOpen, true);
      });
    }
  }

  // ── Audio ──────────────────────────────────────────────────────────────
  let articleSpeaking = false;

  // Show/hide the article speak button only when speech is supported
  if (!speech.supported && articleSpeakBtn) articleSpeakBtn.hidden = true;
  if (!speech.supported && tooltipSpeakBtn) tooltipSpeakBtn.hidden = true;

  function stopArticleSpeech() {
    if (articleSpeaking) {
      speechSynthesis.cancel();
      articleSpeaking = false;
      if (articleSpeakBtn) {
        articleSpeakBtn.textContent = '🔊';
        articleSpeakBtn.classList.remove('speaking');
      }
    }
  }

  tooltipSpeakBtn && tooltipSpeakBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // don't trigger tooltip close
    if (!currentTooltipWord) return;
    stopArticleSpeech();
    const btn = tooltipSpeakBtn;
    btn.classList.add('speaking');
    const utt = speech.speak(currentTooltipWord);
    if (utt) {
      utt.onend  = () => btn.classList.remove('speaking');
      utt.onerror = () => btn.classList.remove('speaking');
    } else {
      btn.classList.remove('speaking');
    }
  });

  articleSpeakBtn && articleSpeakBtn.addEventListener('click', () => {
    if (!speech.supported || !state.article) return;
    if (articleSpeaking) {
      stopArticleSpeech();
      return;
    }
    articleSpeaking = true;
    articleSpeakBtn.textContent = '⏹';
    articleSpeakBtn.classList.add('speaking');
    const utt = speech.speak(state.article.italian);
    if (utt) {
      utt.onend  = () => { articleSpeaking = false; articleSpeakBtn.textContent = '🔊'; articleSpeakBtn.classList.remove('speaking'); };
      utt.onerror = () => { articleSpeaking = false; articleSpeakBtn.textContent = '🔊'; articleSpeakBtn.classList.remove('speaking'); };
    } else {
      articleSpeaking = false;
      articleSpeakBtn.textContent = '🔊';
      articleSpeakBtn.classList.remove('speaking');
    }
  });

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
    const RECENT_KEY = 'ponte_recent_topics';
    const RECENT_MAX = 10;
    let recent = [];
    try { recent = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { recent = []; }

    // Exclude recently seen topics; fall back to full list if all have been seen
    let pool = SURPRISE_TOPICS.filter(t => !recent.includes(t));
    if (pool.length === 0) { pool = SURPRISE_TOPICS.slice(); recent = []; }

    // Fisher-Yates pick: shuffle pool, take first
    const idx = Math.floor(Math.random() * pool.length);
    const topic = pool[idx];

    // Update recent list (cap at RECENT_MAX)
    recent.push(topic);
    if (recent.length > RECENT_MAX) recent.shift();
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent));

    topicInput.value = topic;
    generateArticle(topic, difficultySelect.value, true); // forceRefresh — always fresh
  });

  topicInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') generateBtn.click();
  });

  // ── Tab navigation ─────────────────────────────────────────────────────

  const LEARN_TABS    = ['false-friends', 'grammar'];
  const PRACTICE_TABS = ['practice', 'conversation'];
  const MORE_TABS     = ['dictionary', 'shadowing', 'progress'];

  const LS_LAST_LEARN    = 'ponte_last_learn';
  const LS_LAST_PRACTICE = 'ponte_last_practice';
  const LS_LAST_MORE     = 'ponte_last_more';

  let currentTab = 'reader';

  function getGroupForTab(tabId) {
    if (LEARN_TABS.includes(tabId))    return 'learn';
    if (PRACTICE_TABS.includes(tabId)) return 'practice';
    if (MORE_TABS.includes(tabId))     return 'more';
    return null;
  }

  function updateNavActive(tabId) {
    const group = getGroupForTab(tabId);

    // Sidebar: nav-item active state
    document.querySelectorAll('[data-tab]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // Sidebar: group header active state (if tab is in a group)
    document.querySelectorAll('.nav-group-header').forEach((hdr) => {
      hdr.classList.remove('active');
    });
    if (group) {
      const hdr = document.querySelector(`.nav-group-header[data-nav-group="${group}"]`);
      if (hdr) hdr.classList.add('active');
    }

    // Bottom nav: direct data-tab items
    document.querySelectorAll('.bottom-nav-item[data-tab]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // Bottom nav: group buttons (Learn / Practice / More)
    document.querySelectorAll('.bottom-nav-item[data-nav-group]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.navGroup === group);
    });
  }

  // Open/close a sidebar nav group
  function setSidebarGroup(groupId, open) {
    const itemsEl = $(`nav-group-items-${groupId}`);
    const hdr     = document.querySelector(`.nav-group-header[data-nav-group="${groupId}"]`);
    if (!itemsEl) return;
    itemsEl.classList.toggle('open', open);
    if (hdr) hdr.classList.toggle('group-open', open);
  }

  function openSidebarGroupForTab(tabId) {
    ['learn', 'practice', 'more'].forEach((g) => {
      const tabs = g === 'learn' ? LEARN_TABS : g === 'practice' ? PRACTICE_TABS : MORE_TABS;
      setSidebarGroup(g, tabs.includes(tabId));
    });
  }

  function switchTab(tabId) {
    // Route shorthand IDs used by inline bottom-nav handlers
    if (tabId === 'learn') {
      tabId = localStorage.getItem(LS_LAST_LEARN) || 'grammar';
    } else if (tabId === 'practice') {
      tabId = localStorage.getItem(LS_LAST_PRACTICE) || 'practice';
    } else if (tabId === 'cards') {
      tabId = 'flashcards';
    } else if (tabId === 'more') {
      if (morePanelEl && !morePanelEl.hidden && morePanelEl.classList.contains('open')) {
        closeMorePanel();
      } else {
        openMorePanel();
      }
      return;
    }

    const panel = $(`tab-${tabId}`);
    if (!panel) { console.warn('[Ponte] switchTab: no panel for', tabId); return; }
    if (tabId === currentTab && panel.classList.contains('active')) return;

    console.log('[Ponte] switchTab →', tabId);

    // 1. Hide all tab content panels
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    // 2. Show selected panel
    panel.classList.add('active');

    // 3. Track last-visited per group
    if (LEARN_TABS.includes(tabId))    localStorage.setItem(LS_LAST_LEARN,    tabId);
    if (PRACTICE_TABS.includes(tabId)) localStorage.setItem(LS_LAST_PRACTICE, tabId);
    if (MORE_TABS.includes(tabId))     localStorage.setItem(LS_LAST_MORE,     tabId);

    // 4. Update active state on sidebar and bottom nav
    openSidebarGroupForTab(tabId);
    updateNavActive(tabId);

    currentTab = tabId;
    localStorage.setItem(LS_TAB, tabId);

    // Close More panel if open
    closeMorePanel();
  }
  // Expose globally so inline HTML onclick/ontouchend attributes can call it
  window.switchTab = switchTab;

  // ── More panel (mobile) ───────────────────────────────────────────────────
  const morePanelEl   = $('more-panel');
  const moreBackdrop  = $('more-panel-backdrop');

  function openMorePanel() {
    if (!morePanelEl) return;
    morePanelEl.hidden  = false;
    moreBackdrop.hidden = false;
    requestAnimationFrame(() => {
      morePanelEl.classList.add('open');
      moreBackdrop.classList.add('open');
    });
  }

  function closeMorePanel() {
    if (!morePanelEl) return;
    morePanelEl.classList.remove('open');
    moreBackdrop.classList.remove('open');
    // Wait for transition before hiding
    setTimeout(() => {
      if (!morePanelEl.classList.contains('open')) {
        morePanelEl.hidden  = true;
        moreBackdrop.hidden = true;
      }
    }, 250);
  }

  function initTabs() {
    const saved = localStorage.getItem(LS_TAB) || 'reader';

    // Set initial panel
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    const panel = $(`tab-${saved}`);
    if (panel) panel.classList.add('active');

    openSidebarGroupForTab(saved);
    updateNavActive(saved);
    currentTab = saved;

    // ── Sidebar sub-items (desktop) ──────────────────────────────────────
    document.querySelectorAll('.sidebar .nav-item[data-tab], .sidebar .more-panel-item[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // ── Sidebar group headers: expand inline or (collapsed) navigate ──────
    document.querySelectorAll('.nav-group-header').forEach((hdr) => {
      hdr.addEventListener('click', () => {
        const groupId = hdr.dataset.navGroup;
        const itemsEl = $(`nav-group-items-${groupId}`);
        const isOpen  = itemsEl && itemsEl.classList.contains('open');
        const isSidebarCollapsed = appWrapper.classList.contains('sidebar-collapsed');

        if (isSidebarCollapsed) {
          const fallbacks = { learn: 'grammar', practice: 'practice', more: 'dictionary' };
          const lsKeys    = { learn: LS_LAST_LEARN, practice: LS_LAST_PRACTICE, more: LS_LAST_MORE };
          switchTab(localStorage.getItem(lsKeys[groupId]) || fallbacks[groupId]);
        } else if (isOpen) {
          setSidebarGroup(groupId, false);
        } else {
          setSidebarGroup(groupId, true);
        }
      });
    });

    // ── Bottom nav: handled by inline onclick/ontouchend in HTML ─────────
    // (onTap/addEventListener approach was unreliable on iOS Safari)

    // ── More panel backdrop + items ───────────────────────────────────────
    if (moreBackdrop) {
      moreBackdrop.addEventListener('click', closeMorePanel);
    }
    if (morePanelEl) {
      morePanelEl.querySelectorAll('[data-tab]').forEach((btn) => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
      });
    }
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
    tooltipRows.querySelectorAll('.tooltip-row-tense, .tooltip-row-root').forEach(function(el){ el.remove(); });
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
    // Green total count removed — only due-count badges remain (managed by flashcards.js)
  }

  // Push full cards array to server (fire-and-forget; localStorage is the source of truth offline)
  function persistFlashcardsToServer(cards) {
    fetch(API_BASE + '/api/flashcards', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(cards),
    }).catch((err) => console.warn('Flashcard sync to server failed:', err.message));
  }

  // On load: pull server cards, merge with localStorage (server wins on id conflicts),
  // push any local-only cards back, then re-render badge.
  async function syncFlashcardsFromServer() {
    try {
      const resp = await fetch(API_BASE + '/api/flashcards');
      if (!resp.ok) return;
      const serverCards = await resp.json();
      if (!Array.isArray(serverCards)) return;

      const localCards = loadFlashcards();
      // Union: start from server list, append local cards that server doesn't have
      const merged = [...serverCards];
      localCards.forEach((lc) => {
        if (!merged.find((sc) => sc.id === lc.id)) merged.push(lc);
      });

      // If there were local-only cards, push the merged set back to server
      if (merged.length > serverCards.length) persistFlashcardsToServer(merged);

      localStorage.setItem(FC_KEY, JSON.stringify(merged));
      updateFlashcardBadge();
      window.dispatchEvent(new CustomEvent('ponte:flashcard-saved'));
    } catch (err) {
      console.warn('Flashcard initial sync failed (offline?):', err.message);
    }
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
      persistFlashcardsToServer(cards);
      updateSaveBtn(currentTooltipWord);
      updateFlashcardBadge();
      window.dispatchEvent(new CustomEvent('ponte:flashcard-saved'));
      return;
    }

    const card = {
      id:            Date.now(),
      italian:       currentTooltipWord,
      english:       currentTooltipEntry.english    || '',
      spanish:       currentTooltipEntry.spanish    || '',
      category:      currentTooltipEntry.category   || 'new',
      note:          currentTooltipEntry.note       || '',
      savedAt:       new Date().toISOString(),
      sourceArticle: state.article ? state.article.title : '',
      wordType:      currentTooltipEntry.wordType   || 'other',
      baseForm:      currentTooltipEntry.baseForm   || '',
      baseFormEN:    currentTooltipEntry.baseFormEN || '',
      timesCorrect:  0,
      timesWrong:    0,
      lastSeen:      null,
      lastDrilled:   null,
    };
    cards.push(card);
    localStorage.setItem(FC_KEY, JSON.stringify(cards));
    persistFlashcardsToServer(cards);
    detectAndSavePatterns(card.id, card.italian, card.english, card.category, card.note);

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

  // ── Detect and persist grammar patterns for a newly saved card ───────────
  function detectAndSavePatterns(cardId, italian, english, category, note) {
    fetch(API_BASE + '/api/detect-patterns', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ italian, english, category, note }),
    })
      .then((r) => r.json())
      .then(({ patterns }) => {
        if (!Array.isArray(patterns) || patterns.length === 0) return;
        const cards = loadFlashcards();
        const idx   = cards.findIndex((c) => c.id === cardId);
        if (idx === -1) return;
        cards[idx].grammarPatterns = patterns;
        localStorage.setItem(FC_KEY, JSON.stringify(cards));
        persistFlashcardsToServer(cards);
      })
      .catch(() => {}); // fire-and-forget
  }

  // ── Post-reading Quiz ──────────────────────────────────────────────────
  const QUIZ_SCORES_KEY = 'ponte_quiz_scores';

  let quizQuestions = [];
  let quizCurrent   = 0;
  let quizCorrect   = 0;
  let quizAnswered  = false;

  function openQuiz() {
    if (!state.article) return;
    quizOverlay.hidden = false;
    document.body.classList.add('quiz-open');
    quizArticleTitle.textContent = state.article.title || '';
    quizLoading.hidden = false;
    quizQuestionScr.hidden = true;
    quizScoreScr.hidden = true;
    quizQuestions = [];
    quizCurrent   = 0;
    quizCorrect   = 0;
    quizAnswered  = false;
    fetch('/api/reading-quiz', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        italian: state.article.italian,
        english: state.article.english,
        title:   state.article.title,
      }),
    })
      .then((r) => r.json())
      .then(({ questions, error }) => {
        if (error || !Array.isArray(questions) || questions.length === 0) {
          quizLoading.innerHTML = '<p style="color:#B83232">Could not generate quiz. Try again.</p>';
          return;
        }
        quizQuestions = questions;
        quizLoading.hidden = true;
        quizQuestionScr.hidden = false;
        renderQuizQuestion();
      })
      .catch(() => {
        quizLoading.innerHTML = '<p style="color:#B83232">Network error. Try again.</p>';
      });
  }

  function closeQuiz() {
    quizOverlay.hidden = true;
    document.body.classList.remove('quiz-open');
  }

  function renderQuizQuestion() {
    const q = quizQuestions[quizCurrent];
    const total = quizQuestions.length;
    quizProgressBar.style.width = `${(quizCurrent / total) * 100}%`;
    quizProgressLbl.textContent = `${quizCurrent + 1} / ${total}`;
    quizQuestionText.textContent = q.question;
    quizOptions.innerHTML = '';
    quizFeedback.hidden = true;
    quizNextBtn.hidden  = true;
    quizAnswered = false;
    q.options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'quiz-option-btn';
      btn.textContent = opt;
      btn.dataset.idx = i;
      btn.addEventListener('click', () => handleQuizAnswer(i));
      quizOptions.appendChild(btn);
    });
  }

  function handleQuizAnswer(idx) {
    if (quizAnswered) return;
    quizAnswered = true;
    const q = quizQuestions[quizCurrent];
    const correct = idx === q.correct;
    if (correct) quizCorrect++;
    // Style options
    quizOptions.querySelectorAll('.quiz-option-btn').forEach((btn) => {
      const i = parseInt(btn.dataset.idx, 10);
      btn.disabled = true;
      if (i === q.correct) btn.classList.add('quiz-opt-correct');
      else if (i === idx && !correct) btn.classList.add('quiz-opt-wrong');
    });
    // Show feedback
    quizFeedback.hidden = false;
    quizFeedback.className = 'quiz-feedback ' + (correct ? 'quiz-feedback-correct' : 'quiz-feedback-wrong');
    quizFeedback.textContent = correct ? 'Correct!' : `Not quite — the answer is: ${q.options[q.correct]}`;
    quizNextBtn.hidden = false;
    quizNextBtn.textContent = quizCurrent + 1 < quizQuestions.length ? 'Next →' : 'See results';
  }

  function showQuizScore() {
    quizQuestionScr.hidden = true;
    quizScoreScr.hidden = false;
    const total = quizQuestions.length;
    const pct   = Math.round((quizCorrect / total) * 100);
    quizScoreCircle.textContent = `${quizCorrect}/${total}`;
    quizScoreCircle.className = 'quiz-score-circle ' +
      (pct >= 80 ? 'quiz-score-great' : pct >= 60 ? 'quiz-score-ok' : 'quiz-score-low');
    const msgs = ['Keep reading!', 'Getting there!', 'Good effort!', 'Nice work!', 'Great job!', 'Perfect!'];
    quizScoreLbl.textContent = pct >= 80 ? 'Great comprehension!' : pct >= 60 ? 'Good effort!' : 'Keep practicing!';
    quizProgressBar.style.width = '100%';
    quizProgressLbl.textContent = `${quizCurrent + 1} / ${quizQuestions.length}`;
    // Save score to localStorage
    const key = QUIZ_SCORES_KEY;
    const scores = JSON.parse(localStorage.getItem(key) || '[]');
    scores.unshift({ date: new Date().toISOString(), title: state.article?.title || '', score: quizCorrect, total });
    if (scores.length > 20) scores.length = 20;
    localStorage.setItem(key, JSON.stringify(scores));
    // Show recent history (last 5)
    const recent = scores.slice(1, 6);
    if (recent.length > 0) {
      quizScoreHistory.innerHTML = '<div class="quiz-history-label">Previous quizzes</div>' +
        recent.map((s) => {
          const d = new Date(s.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          const p = Math.round((s.score / s.total) * 100);
          return `<div class="quiz-history-row"><span>${d}</span><span class="quiz-history-title">${s.title}</span><span class="quiz-history-score">${s.score}/${s.total} (${p}%)</span></div>`;
        }).join('');
    } else {
      quizScoreHistory.innerHTML = '';
    }
  }

  // Wire up quiz events
  quizTriggerBtn.addEventListener('click', openQuiz);
  quizClosBtn.addEventListener('click', closeQuiz);
  quizOverlay.addEventListener('click', (e) => { if (e.target === quizOverlay) closeQuiz(); });
  quizNextBtn.addEventListener('click', () => {
    quizCurrent++;
    if (quizCurrent < quizQuestions.length) {
      renderQuizQuestion();
    } else {
      showQuizScore();
    }
  });
  quizRetakeBtn.addEventListener('click', () => {
    quizCurrent  = 0;
    quizCorrect  = 0;
    quizAnswered = false;
    quizScoreScr.hidden    = true;
    quizQuestionScr.hidden = false;
    renderQuizQuestion();
  });
  quizDoneBtn.addEventListener('click', closeQuiz);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !quizOverlay.hidden) closeQuiz();
  });

  // ── Init ───────────────────────────────────────────────────────────────
  initTabs();
  initSidebar();
  initTranslationToggle();
  updateFlashcardBadge();
  syncFlashcardsFromServer(); // async; localStorage badge already shown above
})();
