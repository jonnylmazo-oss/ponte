// practice.js — Practice tab: cloze fill-in-the-blank from generated articles

(function () {
  'use strict';

  const API_BASE = (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  ) ? 'http://localhost:3000' : '';

  const CACHE_PREFIX = 'ponte_article_';

  const CATEGORY_COLORS = {
    'cognate':      '#4A90D9',
    'false-friend': '#F5C842',
    'divergence':   '#F5894A',
    'new':          '#888888',
  };

  const CATEGORY_LABELS = {
    'cognate':      'Same in Spanish',
    'false-friend': 'False Friend',
    'divergence':   'Used differently',
    'new':          'New word',
  };

  function $(id) { return document.getElementById(id); }

  function escapeHTML(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const pracSetup         = $('prac-setup');
  if (!pracSetup) return;

  const pracDrill         = $('prac-drill');
  const pracDone          = $('prac-done');
  const pracArticleSelect = $('prac-article-select');
  const pracGenerateBtn   = $('prac-generate-btn');
  const pracStartBtn      = $('prac-start-btn');
  const pracModeBtns      = document.querySelectorAll('.prac-mode-btn');
  const pracProgressBar   = $('prac-progress-bar');
  const pracProgressLabel = $('prac-progress-label');
  const pracSentenceIT    = $('prac-sentence-it');
  const pracSentenceEN    = $('prac-sentence-en');
  const pracChoices       = $('prac-choices');
  const pracTypeArea      = $('prac-type-area');
  const pracTypeInput     = $('prac-type-input');
  const pracTypeSubmit    = $('prac-type-submit');
  const pracFeedback      = $('prac-feedback');
  const pracNextBtn       = $('prac-next-btn');
  const pracDoneScore     = $('prac-done-score');
  const pracRetryBtn      = $('prac-retry-btn');
  const pracBackBtn       = $('prac-back-btn');

  // ── State ─────────────────────────────────────────────────────────────────
  let currentArticle = null;
  let drillItems     = [];
  let drillIndex     = 0;
  let drillScore     = 0;
  let drillMode      = 'choice';
  let drillAnswered  = false;

  // ── Article selector ──────────────────────────────────────────────────────
  function getStoredArticles() {
    const articles = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        try {
          const a = JSON.parse(localStorage.getItem(key));
          if (a && a.title && Array.isArray(a.words) && a.words.length >= 3) {
            a._cacheKey = key;
            articles.push(a);
          }
        } catch (e) {}
      }
    }
    // Most recent first (by id, which is usually 0 but articles from cache may vary)
    return articles;
  }

  function populateSelector() {
    const articles = getStoredArticles();
    const prev = pracArticleSelect.value;
    pracArticleSelect.innerHTML = '<option value="">Choose an article to practice…</option>';
    articles.forEach((a, i) => {
      const opt = document.createElement('option');
      opt.value = a._cacheKey;
      opt.textContent = a.title + ' (' + a.difficulty + ')';
      pracArticleSelect.appendChild(opt);
    });
    if (prev && pracArticleSelect.querySelector(`[value="${CSS.escape(prev)}"]`)) {
      pracArticleSelect.value = prev;
    }
    updateStartBtn();
  }

  function updateStartBtn() {
    pracStartBtn.disabled = !pracArticleSelect.value;
  }

  pracArticleSelect.addEventListener('change', () => {
    const key = pracArticleSelect.value;
    if (!key) { currentArticle = null; updateStartBtn(); return; }
    try {
      currentArticle = JSON.parse(localStorage.getItem(key));
    } catch (e) { currentArticle = null; }
    updateStartBtn();
  });

  pracGenerateBtn.addEventListener('click', () => {
    const readerBtn = document.querySelector('[data-tab="reader"]');
    if (readerBtn) readerBtn.click();
  });

  // Refresh selector whenever Practice tab nav is clicked
  document.querySelectorAll('[data-tab="practice"]').forEach(btn => {
    btn.addEventListener('click', populateSelector);
  });

  // ── Mode toggle ───────────────────────────────────────────────────────────
  pracModeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      pracModeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      drillMode = btn.dataset.mode;
    });
  });

  // ── Drill building ────────────────────────────────────────────────────────
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function splitSentences(text) {
    if (!text) return [];
    return text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
  }

  function findItemSentences(italianText, englishText, word) {
    const itSents = splitSentences(italianText);
    const enSents = splitSentences(englishText);
    const lower   = word.toLowerCase();
    for (let i = 0; i < itSents.length; i++) {
      if (itSents[i].toLowerCase().includes(lower)) {
        return { italian: itSents[i], english: enSents[i] || null };
      }
    }
    return { italian: italianText, english: englishText || null };
  }

  function buildDistractors(word, allWords) {
    const others = shuffle(
      allWords.filter(w => w.w.toLowerCase() !== word.w.toLowerCase()).map(w => w.w)
    ).slice(0, 3);
    // Pad with common Italian filler words if needed
    const fillers = ['è', 'ha', 'sono', 'era', 'può', 'deve', 'fa', 'viene', 'sa', 'dice'];
    for (const f of fillers) {
      if (others.length >= 3) break;
      if (!others.includes(f) && f.toLowerCase() !== word.w.toLowerCase()) others.push(f);
    }
    return others;
  }

  function buildDrillItems(article) {
    const words = article.words || [];
    // Priority order: false-friend > divergence > new > cognate
    const PRIO = { 'false-friend': 0, 'divergence': 1, 'new': 2, 'cognate': 3 };
    const sorted = words.slice().sort((a, b) => (PRIO[a.c] ?? 3) - (PRIO[b.c] ?? 3));

    let candidates = sorted.filter(w => w.c !== 'cognate');
    if (candidates.length < 5) candidates = sorted; // include cognates to reach minimum
    const selected = candidates.slice(0, 10);

    const items = [];
    for (const word of selected) {
      const { italian, english } = findItemSentences(article.italian, article.english, word.w);
      if (!italian) continue;

      // Build Italian sentence HTML with blank
      const itHtml = italian.replace(
        new RegExp('(' + escapeRegex(word.w) + ')', 'i'),
        '<span class="prac-blank">___</span>'
      );

      // Build English sentence HTML — try to blank the EN word, fall back to plain text
      let enHtml = null;
      if (english) {
        const enWord = (word.en || '').split(/[\s/,]+/)[0].trim();
        if (enWord) {
          const replaced = english.replace(
            new RegExp('\\b(' + escapeRegex(enWord) + ')\\b', 'i'),
            '<span class="prac-blank-en">___</span>'
          );
          enHtml = replaced !== english ? replaced : english;
        } else {
          enHtml = english;
        }
      }

      items.push({
        word:        word.w,
        wordEN:      word.en || '',
        category:    word.c,
        note:        word.n || '',
        itHtml,
        enHtml,
        distractors: buildDistractors(word, words),
      });
    }
    return shuffle(items);
  }

  // ── Drill flow ────────────────────────────────────────────────────────────
  pracStartBtn.addEventListener('click', () => {
    if (!currentArticle) return;
    drillItems = buildDrillItems(currentArticle);
    if (!drillItems.length) return;
    drillIndex    = 0;
    drillScore    = 0;
    drillAnswered = false;

    pracSetup.hidden = true;
    pracDone.hidden  = true;
    pracDrill.hidden = false;
    showDrillItem();
  });

  function showDrillItem() {
    if (drillIndex >= drillItems.length) { endDrill(); return; }

    const item = drillItems[drillIndex];
    drillAnswered = false;

    // Progress bar
    const pct = Math.round((drillIndex / drillItems.length) * 100);
    pracProgressBar.style.width = pct + '%';
    pracProgressLabel.textContent = (drillIndex + 1) + ' / ' + drillItems.length;

    // Sentences
    pracSentenceIT.innerHTML = item.itHtml;
    if (item.enHtml) {
      pracSentenceEN.innerHTML = item.enHtml;
      pracSentenceEN.hidden = false;
    } else {
      pracSentenceEN.hidden = true;
    }

    pracFeedback.hidden = true;
    pracNextBtn.hidden  = true;

    if (drillMode === 'choice') {
      showChoiceMode(item);
    } else {
      showTypeMode(item);
    }
  }

  function showChoiceMode(item) {
    pracTypeArea.hidden  = true;
    pracChoices.hidden   = false;

    const options = shuffle([item.word, ...item.distractors]);
    pracChoices.innerHTML = options.map(opt =>
      `<button class="prac-choice" data-val="${escapeHTML(opt)}">${escapeHTML(opt)}</button>`
    ).join('');

    pracChoices.querySelectorAll('.prac-choice').forEach(btn => {
      btn.addEventListener('click', () => handleAnswer(btn.dataset.val, item));
    });
  }

  function showTypeMode(item) {
    pracChoices.hidden  = true;
    pracTypeArea.hidden = false;
    pracTypeInput.value = '';
    pracTypeInput.disabled = false;
    pracTypeInput.classList.remove('correct', 'wrong');
    pracTypeInput.focus();
  }

  pracTypeSubmit.addEventListener('click', () => {
    if (drillAnswered) return;
    const item = drillItems[drillIndex];
    if (item) handleAnswer(pracTypeInput.value.trim(), item);
  });

  pracTypeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !drillAnswered) {
      const item = drillItems[drillIndex];
      if (item) handleAnswer(pracTypeInput.value.trim(), item);
    }
  });

  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const curr = [i];
      for (let j = 1; j <= n; j++) {
        curr[j] = a[i-1] === b[j-1]
          ? prev[j-1]
          : 1 + Math.min(prev[j], curr[j-1], prev[j-1]);
      }
      prev.splice(0, prev.length, ...curr);
    }
    return prev[n];
  }

  function handleAnswer(answer, item) {
    if (drillAnswered) return;
    drillAnswered = true;

    const ans    = answer.toLowerCase().trim();
    const target = item.word.toLowerCase().trim();
    const correct = drillMode === 'type'
      ? (ans === target || levenshtein(ans, target) <= 1)
      : ans === target;

    if (correct) drillScore++;

    if (drillMode === 'choice') {
      pracChoices.querySelectorAll('.prac-choice').forEach(btn => {
        btn.disabled = true;
        const v = btn.dataset.val.toLowerCase();
        if (v === target)         btn.classList.add('correct');
        else if (v === ans && !correct) btn.classList.add('wrong');
      });
    } else {
      pracTypeInput.disabled = true;
      pracTypeInput.classList.add(correct ? 'correct' : 'wrong');
    }

    const color    = CATEGORY_COLORS[item.category] || '#888';
    const catLabel = CATEGORY_LABELS[item.category]  || item.category;

    pracFeedback.innerHTML = `
      <div class="prac-feedback-result ${correct ? 'correct' : 'wrong'}">
        ${correct ? '✓ Correct!' : `✗ The answer is <strong>${escapeHTML(item.word)}</strong>`}
      </div>
      ${item.note ? `<div class="prac-feedback-note">${escapeHTML(item.note)}</div>` : ''}
      <span class="prac-cat-badge" style="border-color:${color};color:${color}">${catLabel}</span>
    `;
    pracFeedback.hidden = false;
    pracNextBtn.hidden  = false;
    pracNextBtn.focus();
  }

  pracNextBtn.addEventListener('click', () => { drillIndex++; showDrillItem(); });

  function endDrill() {
    pracDrill.hidden = true;
    pracDone.hidden  = false;
    pracProgressBar.style.width    = '100%';
    pracProgressLabel.textContent  = drillItems.length + ' / ' + drillItems.length;
    const pct = drillItems.length > 0 ? Math.round((drillScore / drillItems.length) * 100) : 0;
    pracDoneScore.textContent = `${drillScore} / ${drillItems.length} correct (${pct}%)`;
  }

  pracRetryBtn.addEventListener('click', () => {
    pracDone.hidden  = true;
    pracDrill.hidden = false;
    drillItems    = buildDrillItems(currentArticle);
    drillIndex    = 0;
    drillScore    = 0;
    drillAnswered = false;
    showDrillItem();
  });

  pracBackBtn.addEventListener('click', () => {
    pracDone.hidden  = true;
    pracDrill.hidden = true;
    pracSetup.hidden = false;
    populateSelector();
  });

  // ── Init ─────────────────────────────────────────────────────────────────
  populateSelector();

})();
