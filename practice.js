// practice.js — Practice tab: cloze fill-in-the-blank from generated articles

(function () {
  'use strict';

  const API_BASE = (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  ) ? 'http://localhost:3000' : '';

  const CACHE_PREFIX      = 'ponte_article_';
  const DISTRACTOR_PREFIX = 'ponte_dist_';
  const FC_KEY            = 'ponte_flashcards';

  const CATEGORY_COLORS = {
    'cognate':      '#2E6B3E',
    'false-friend': '#B83232',
    'divergence':   '#B85C00',
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
  const pracMissedList    = $('prac-missed-list');
  const pracSaveMissed    = $('prac-save-missed-btn');

  // ── State ─────────────────────────────────────────────────────────────────
  let currentArticle = null;
  let drillItems     = [];
  let drillIndex     = 0;
  let drillScore     = 0;
  let drillMode      = 'choice';
  let drillAnswered  = false;
  let missedItems    = [];

  // SR-specific state
  let srDifficulty = 'wordbank';
  let srBank       = []; // [{id, word}] tiles in bank
  let srBuilt      = []; // [{id, word}] tiles in construction area
  let srAnswered   = false;

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
    return articles;
  }

  function populateSelector() {
    const articles = getStoredArticles();
    const prev = pracArticleSelect.value;
    pracArticleSelect.innerHTML = '<option value="">Choose an article to practice…</option>';
    articles.forEach((a) => {
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
  const pracSRDiffRow  = $('prac-sr-diff-row');
  const pracSRDiffBtns = document.querySelectorAll('.prac-sr-diff-btn');

  pracModeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      pracModeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      drillMode = btn.dataset.mode;
      if (pracSRDiffRow) pracSRDiffRow.hidden = (drillMode !== 'rebuild');
    });
  });

  pracSRDiffBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      pracSRDiffBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      srDifficulty = btn.dataset.diff;
    });
  });

  // ── Distractor fetching ───────────────────────────────────────────────────
  async function fetchDistractors(word, sentence, category) {
    const cacheKey = DISTRACTOR_PREFIX + word.toLowerCase().trim();
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try { return JSON.parse(cached); } catch (e) {}
    }
    try {
      const resp = await fetch(API_BASE + '/api/distractors', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ word, sentence, category }),
      });
      const data = await resp.json();
      if (Array.isArray(data.distractors) && data.distractors.length >= 3) {
        localStorage.setItem(cacheKey, JSON.stringify(data.distractors));
        return data.distractors;
      }
    } catch (e) {}
    // Fallback: other article words
    return buildFallbackDistractors(word, currentArticle ? currentArticle.words : []);
  }

  function buildFallbackDistractors(word, allWords) {
    const others = shuffle(
      (allWords || []).filter(w => w.w.toLowerCase() !== word.toLowerCase()).map(w => w.w)
    ).slice(0, 3);
    const fillers = ['è', 'ha', 'sono', 'era', 'può', 'deve', 'fa', 'viene', 'sa', 'dice'];
    for (const f of fillers) {
      if (others.length >= 3) break;
      if (!others.includes(f) && f.toLowerCase() !== word.toLowerCase()) others.push(f);
    }
    return others;
  }

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

  async function buildDrillItems(article) {
    const words = article.words || [];
    const PRIO  = { 'false-friend': 0, 'divergence': 1, 'new': 2, 'cognate': 3 };
    const sorted = words.slice().sort((a, b) => (PRIO[a.c] ?? 3) - (PRIO[b.c] ?? 3));

    let candidates = sorted.filter(w => w.c !== 'cognate');
    if (candidates.length < 5) candidates = sorted;
    const selected = candidates.slice(0, 10);

    const items = [];
    for (const word of selected) {
      const { italian, english } = findItemSentences(article.italian, article.english, word.w);
      if (!italian) continue;

      const itHtml = italian.replace(
        new RegExp('(' + escapeRegex(word.w) + ')', 'i'),
        '<span class="prac-blank">___</span>'
      );

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
        sentence:    italian,
        itHtml,
        enHtml,
        distractors: [],
      });
    }

    // Fetch all distractors in parallel (cached after first time)
    await Promise.all(items.map(async (item) => {
      item.distractors = await fetchDistractors(item.word, item.sentence, item.category);
    }));

    return shuffle(items);
  }

  // ── Drill flow ────────────────────────────────────────────────────────────
  pracStartBtn.addEventListener('click', async () => {
    if (!currentArticle) return;

    if (drillMode === 'rebuild') {
      drillItems  = buildSRItems(currentArticle);
      if (!drillItems.length) return;
      drillIndex  = 0;
      drillScore  = 0;
      missedItems = [];
      srAnswered  = false;
      pracSetup.hidden = true;
      pracDone.hidden  = true;
      const pracSRDrill = $('prac-sr-drill');
      if (pracSRDrill) pracSRDrill.hidden = false;
      showSRItem();
      return;
    }

    pracStartBtn.disabled    = true;
    pracStartBtn.textContent = 'Loading…';
    try {
      drillItems = await buildDrillItems(currentArticle);
    } finally {
      pracStartBtn.disabled    = false;
      pracStartBtn.textContent = 'Start Practice →';
    }
    if (!drillItems.length) return;
    drillIndex    = 0;
    drillScore    = 0;
    missedItems   = [];
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

    const pct = Math.round((drillIndex / drillItems.length) * 100);
    pracProgressBar.style.width   = pct + '%';
    pracProgressLabel.textContent = (drillIndex + 1) + ' / ' + drillItems.length;

    pracSentenceIT.innerHTML = item.itHtml;
    if (item.enHtml) {
      pracSentenceEN.innerHTML = item.enHtml;
      pracSentenceEN.hidden = false;
    } else {
      pracSentenceEN.hidden = true;
    }

    pracFeedback.hidden   = true;
    pracFeedback.innerHTML = '';
    pracNextBtn.hidden    = true;
    pracNextBtn.textContent = drillIndex + 1 >= drillItems.length ? 'See Results →' : 'Next →';

    if (drillMode === 'choice') {
      showChoiceMode(item);
    } else {
      showTypeMode(item);
    }
  }

  function showChoiceMode(item) {
    pracTypeArea.hidden = true;
    pracChoices.hidden  = false;

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
    const isType = drillMode === 'type';
    const correct = isType
      ? (ans === target || levenshtein(ans, target) <= 1)
      : ans === target;

    if (correct) {
      drillScore++;
    } else {
      missedItems.push(item);
    }

    if (drillMode === 'choice') {
      pracChoices.querySelectorAll('.prac-choice').forEach(btn => {
        btn.disabled = true;
        const v = btn.dataset.val.toLowerCase();
        if (v === target)               btn.classList.add('correct');
        else if (v === ans && !correct) btn.classList.add('wrong');
      });
    } else {
      pracTypeInput.disabled = true;
      if (correct && ans !== target) pracTypeInput.value = item.word; // show exact spelling
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

  // ── End screen ────────────────────────────────────────────────────────────
  function endDrill() {
    pracDrill.hidden = true;
    const pracSRDrill = $('prac-sr-drill');
    if (pracSRDrill) pracSRDrill.hidden = true;
    pracDone.hidden  = false;
    pracProgressBar.style.width   = '100%';
    pracProgressLabel.textContent = drillItems.length + ' / ' + drillItems.length;

    const pct = drillItems.length > 0 ? Math.round((drillScore / drillItems.length) * 100) : 0;
    pracDoneScore.textContent = `${drillScore} / ${drillItems.length} correct (${pct}%)`;

    if (pracMissedList) {
      if (missedItems.length === 0) {
        pracMissedList.innerHTML = '<p class="prac-missed-perfect">Perfect score — nothing to review!</p>';
        if (pracSaveMissed) pracSaveMissed.hidden = true;
      } else {
        pracMissedList.innerHTML =
          `<p class="prac-missed-label">Words to review (${missedItems.length}):</p>` +
          '<div class="prac-missed-words">' +
          missedItems.map(item => {
            const color = CATEGORY_COLORS[item.category] || '#888';
            const label = CATEGORY_LABELS[item.category] || item.category;
            return `<div class="prac-missed-word">
              <strong>${escapeHTML(item.word)}</strong>
              ${item.wordEN ? `<span class="prac-missed-en">${escapeHTML(item.wordEN)}</span>` : ''}
              <span class="prac-cat-badge" style="border-color:${color};color:${color}">${label}</span>
            </div>`;
          }).join('') +
          '</div>';
        if (pracSaveMissed) {
          pracSaveMissed.hidden   = false;
          pracSaveMissed.disabled = false;
          pracSaveMissed.textContent =
            `Save ${missedItems.length} missed word${missedItems.length !== 1 ? 's' : ''} to Flashcards ★`;
        }
      }
    }
  }

  // ── Save missed to flashcards ─────────────────────────────────────────────
  function saveMissedToFlashcards() {
    let cards = [];
    try { cards = JSON.parse(localStorage.getItem(FC_KEY) || '[]'); } catch(e) {}

    let added = 0;
    const now = new Date().toISOString();
    for (const item of missedItems) {
      const exists = cards.some(c => c.italian.toLowerCase() === item.word.toLowerCase());
      if (!exists) {
        cards.push({
          id:            Date.now() + added,
          italian:       item.word,
          english:       item.wordEN,
          spanish:       '',
          category:      item.category,
          note:          item.note,
          savedAt:       now,
          sourceArticle: currentArticle ? currentArticle.title : 'Practice',
          wordType:      'other',
          timesCorrect:  0,
          timesWrong:    0,
          lastSeen:      null,
          lastDrilled:   null,
        });
        added++;
      }
    }
    localStorage.setItem(FC_KEY, JSON.stringify(cards));
    fetch(API_BASE + '/api/flashcards', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(cards),
    }).catch(() => {});
    window.dispatchEvent(new CustomEvent('ponte:flashcard-saved'));
    return added;
  }

  pracSaveMissed && pracSaveMissed.addEventListener('click', () => {
    const added = saveMissedToFlashcards();
    if (pracSaveMissed) {
      pracSaveMissed.textContent = added > 0
        ? `✓ ${added} word${added !== 1 ? 's' : ''} saved to Flashcards`
        : '✓ Already in your deck';
      pracSaveMissed.disabled = true;
    }
  });

  pracRetryBtn.addEventListener('click', async () => {
    const pracSRDrill = $('prac-sr-drill');
    if (drillMode === 'rebuild') {
      drillItems  = buildSRItems(currentArticle);
      drillIndex  = 0;
      drillScore  = 0;
      missedItems = [];
      srAnswered  = false;
      pracDone.hidden = true;
      if (pracSRDrill) pracSRDrill.hidden = false;
      showSRItem();
      return;
    }
    pracDone.hidden  = true;
    pracDrill.hidden = false;
    pracRetryBtn.disabled    = true;
    pracRetryBtn.textContent = 'Loading…';
    try {
      drillItems = await buildDrillItems(currentArticle);
    } finally {
      pracRetryBtn.disabled    = false;
      pracRetryBtn.textContent = 'Try again';
    }
    drillIndex    = 0;
    drillScore    = 0;
    missedItems   = [];
    drillAnswered = false;
    showDrillItem();
  });

  pracBackBtn.addEventListener('click', () => {
    const pracSRDrill = $('prac-sr-drill');
    pracDone.hidden  = true;
    pracDrill.hidden = true;
    if (pracSRDrill) pracSRDrill.hidden = true;
    pracSetup.hidden = false;
    populateSelector();
  });

  // ── Sentence Rebuild ─────────────────────────────────────────────────────

  function normalizeIT(s) {
    return (s || '').toLowerCase()
      .replace(/[.,!?;:'"«»""''()\u2014\u2013\-]/g, '').trim();
  }

  function tokenizeIT(sentence) {
    return sentence.split(/\s+/).filter(Boolean);
  }

  function buildWordBankTiles(correctTokens, article) {
    const corrSet   = new Set(correctTokens.map(normalizeIT));
    const otherWords = (article.italian || '').split(/\s+/)
      .filter(w => w.length > 2 && !corrSet.has(normalizeIT(w)));
    const distractors = shuffle(otherWords).slice(0, correctTokens.length);
    const fillers = ['della', 'dello', 'nella', 'questo', 'quella', 'anche',
                     'molto', 'però', 'così', 'sempre', 'quando', 'ancora', 'aveva', 'fare'];
    for (const f of fillers) {
      if (distractors.length >= correctTokens.length) break;
      if (!corrSet.has(f) && !distractors.includes(f)) distractors.push(f);
    }
    const all = [...correctTokens, ...distractors.slice(0, correctTokens.length)];
    return shuffle(all).map((word, i) => ({ id: i, word }));
  }

  function buildSRItems(article) {
    const itSents = splitSentences(article.italian || '');
    const enSents = splitSentences(article.english || '');
    const words   = article.words || [];
    const items   = [];

    for (let i = 0; i < itSents.length && items.length < 8; i++) {
      const itSent = itSents[i];
      const enSent = enSents[i] || '';
      if (!enSent) continue;
      const itLower     = itSent.toLowerCase();
      const matchedWord = words.find(w => itLower.includes(w.w.toLowerCase()));
      if (!matchedWord) continue;
      const tokens = tokenizeIT(itSent);
      if (tokens.length < 3) continue;
      items.push({
        word:      matchedWord.w,
        wordEN:    matchedWord.en || '',
        category:  matchedWord.c,
        note:      matchedWord.n || '',
        sentence:  itSent,
        english:   enSent,
        tokens,
        bankTiles: buildWordBankTiles(tokens, article),
      });
    }
    return shuffle(items);
  }

  // SR DOM refs (resolved lazily inside functions since HTML may not exist on early runs)
  function srEl(id) { return $(id); }

  function renderSRBank() {
    const bank = srEl('prac-sr-bank');
    if (!bank) return;
    bank.innerHTML = srBank.map(tile =>
      `<button class="prac-sr-tile" data-id="${tile.id}">${escapeHTML(tile.word)}</button>`
    ).join('');
    bank.querySelectorAll('.prac-sr-tile').forEach(btn => {
      btn.addEventListener('click', () => {
        if (srAnswered) return;
        const id   = Number(btn.dataset.id);
        const tile = srBank.find(t => t.id === id);
        if (!tile) return;
        srBank  = srBank.filter(t => t.id !== id);
        srBuilt = [...srBuilt, tile];
        renderSRBuilt();
        renderSRBank();
        updateSRSubmit();
      });
    });
  }

  function renderSRBuilt() {
    const built = srEl('prac-sr-built');
    if (!built) return;
    if (srBuilt.length === 0) {
      built.innerHTML = '<span class="prac-sr-built-hint">Tap words below to build the sentence</span>';
      return;
    }
    built.innerHTML = srBuilt.map(tile =>
      `<button class="prac-sr-tile prac-sr-tile--built" data-id="${tile.id}">${escapeHTML(tile.word)}</button>`
    ).join('');
    built.querySelectorAll('.prac-sr-tile--built').forEach(btn => {
      btn.addEventListener('click', () => {
        if (srAnswered) return;
        const id   = Number(btn.dataset.id);
        const tile = srBuilt.find(t => t.id === id);
        if (!tile) return;
        srBuilt = srBuilt.filter(t => t.id !== id);
        srBank  = [...srBank, tile];
        renderSRBuilt();
        renderSRBank();
        updateSRSubmit();
      });
    });
  }

  function updateSRSubmit() {
    const btn = srEl('prac-sr-submit-btn');
    if (!btn) return;
    if (srDifficulty === 'wordbank') {
      btn.disabled = srBuilt.length === 0;
    } else {
      const inp = srEl('prac-sr-recall-input');
      btn.disabled = !(inp && inp.value.trim());
    }
  }

  function showSRItem() {
    if (drillIndex >= drillItems.length) {
      const srBar = srEl('prac-sr-progress-bar');
      if (srBar) srBar.style.width = '100%';
      endDrill();
      return;
    }

    const item = drillItems[drillIndex];
    srAnswered  = false;
    srBank      = [...item.bankTiles];
    srBuilt     = [];

    const pct = Math.round((drillIndex / drillItems.length) * 100);
    const srBar = srEl('prac-sr-progress-bar');
    const srLbl = srEl('prac-sr-progress-label');
    if (srBar) srBar.style.width = pct + '%';
    if (srLbl) srLbl.textContent = (drillIndex + 1) + ' / ' + drillItems.length;

    const engEl = srEl('prac-sr-english');
    if (engEl) engEl.textContent = item.english;

    const fbEl   = srEl('prac-sr-feedback');
    const nextEl = srEl('prac-sr-next-btn');
    const subEl  = srEl('prac-sr-submit-btn');
    if (fbEl)   { fbEl.hidden = true; fbEl.innerHTML = ''; }
    if (nextEl) { nextEl.hidden = true; nextEl.textContent = drillIndex + 1 >= drillItems.length ? 'See Results →' : 'Next →'; }
    if (subEl)  { subEl.hidden = false; subEl.textContent = 'Check →'; }

    const wbUi  = srEl('prac-sr-wb-ui');
    const rcUi  = srEl('prac-sr-recall-ui');
    if (srDifficulty === 'wordbank') {
      if (wbUi) wbUi.hidden = false;
      if (rcUi) rcUi.hidden = true;
      renderSRBuilt();
      renderSRBank();
    } else {
      if (wbUi) wbUi.hidden = true;
      if (rcUi) rcUi.hidden = false;
      const inp = srEl('prac-sr-recall-input');
      if (inp) { inp.value = ''; inp.disabled = false; setTimeout(() => inp.focus(), 100); }
    }
    updateSRSubmit();
  }

  // Submit handler
  const pracSRSubmitBtn = $('prac-sr-submit-btn');
  pracSRSubmitBtn && pracSRSubmitBtn.addEventListener('click', async () => {
    if (srAnswered) return;
    const item = drillItems[drillIndex];
    if (!item) return;
    if (srDifficulty === 'wordbank') submitWordBank(item);
    else await submitRecall(item);
  });

  // Ctrl+Enter in recall textarea
  const pracSRRecallInput = $('prac-sr-recall-input');
  pracSRRecallInput && pracSRRecallInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !srAnswered) {
      const item = drillItems[drillIndex];
      if (item) await submitRecall(item);
    }
  });
  pracSRRecallInput && pracSRRecallInput.addEventListener('input', updateSRSubmit);

  function submitWordBank(item) {
    srAnswered = true;
    const builtNorm   = srBuilt.map(t => normalizeIT(t.word)).join(' ');
    const correctNorm = item.tokens.map(normalizeIT).join(' ');
    const correct     = builtNorm === correctNorm;

    if (correct) drillScore++;
    else         missedItems.push(item);

    // Highlight tiles
    const builtEl = srEl('prac-sr-built');
    if (builtEl) {
      builtEl.querySelectorAll('.prac-sr-tile--built').forEach((btn, i) => {
        const got  = normalizeIT(srBuilt[i] ? srBuilt[i].word : '');
        const want = normalizeIT(item.tokens[i] || '');
        btn.classList.add(got === want ? 'prac-sr-tile--correct' : 'prac-sr-tile--wrong');
        btn.disabled = true;
      });
    }
    const bankEl = srEl('prac-sr-bank');
    if (bankEl) bankEl.querySelectorAll('.prac-sr-tile').forEach(b => { b.disabled = true; });

    showSRFeedback(correct, item, null);
  }

  async function submitRecall(item) {
    srAnswered = true;
    const inp  = srEl('prac-sr-recall-input');
    const btn  = srEl('prac-sr-submit-btn');
    const userItalian = inp ? inp.value.trim() : '';
    if (!userItalian) { srAnswered = false; return; }

    if (inp) inp.disabled = true;
    if (btn) { btn.disabled = true; btn.textContent = 'Checking…'; }

    let result = null;
    try {
      const resp = await fetch(API_BASE + '/api/check-sentence', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ english: item.english, userItalian, articleItalian: item.sentence }),
      });
      result = await resp.json();
    } catch (e) {
      result = { correct: false, score: 0, idealItalian: item.sentence, errors: [], encouragement: 'Keep practising!' };
    }

    const isCorrect = result.correct || (result.score >= 75);
    if (isCorrect) drillScore++;
    else           missedItems.push(item);

    showSRFeedback(isCorrect, item, result);
  }

  const TYPE_COLORS = {
    'grammar': '#B83232', 'spanish-transfer': '#B85C00',
    'word-choice': '#0055AA', 'spelling': '#888',
  };

  function showSRFeedback(correct, item, apiResult) {
    const fbEl  = srEl('prac-sr-feedback');
    const subEl = srEl('prac-sr-submit-btn');
    const nxtEl = srEl('prac-sr-next-btn');
    if (!fbEl) return;

    let html = `<div class="prac-feedback-result ${correct ? 'correct' : 'wrong'}">${correct ? '✓ Correct!' : '✗ Not quite'}</div>`;

    const ideal = (apiResult && apiResult.idealItalian) ? apiResult.idealItalian : item.sentence;
    html += `<div class="prac-sr-ideal">
      <span class="prac-sr-ideal-label">Ideal:</span>
      <em class="prac-sr-ideal-text">${escapeHTML(ideal)}</em>
    </div>`;

    if (apiResult && apiResult.errors && apiResult.errors.length > 0) {
      html += '<div class="prac-sr-errors">' +
        apiResult.errors.map(err => {
          const col = TYPE_COLORS[err.type] || '#888';
          return `<div class="prac-sr-error-card">
            <div class="prac-sr-error-correction">
              <span class="prac-sr-error-wrong">${escapeHTML(err.userText)}</span>
              <span class="prac-sr-error-arrow">→</span>
              <span class="prac-sr-error-fix">${escapeHTML(err.correction)}</span>
              <span class="prac-sr-error-badge" style="color:${col};border-color:${col}">${err.type || 'error'}</span>
            </div>
            <p class="prac-sr-error-exp">${escapeHTML(err.explanation)}</p>
          </div>`;
        }).join('') +
        '</div>';
    }

    if (apiResult && apiResult.score !== undefined) {
      html += `<div class="prac-sr-score">Score: ${apiResult.score}/100</div>`;
    }
    if (apiResult && apiResult.encouragement) {
      html += `<p class="prac-sr-encouragement">${escapeHTML(apiResult.encouragement)}</p>`;
    }

    fbEl.innerHTML = html;
    fbEl.hidden    = false;
    if (subEl) subEl.hidden = true;
    if (nxtEl) { nxtEl.hidden = false; nxtEl.focus(); }
  }

  const pracSRNextBtn = $('prac-sr-next-btn');
  pracSRNextBtn && pracSRNextBtn.addEventListener('click', () => {
    drillIndex++;
    showSRItem();
  });

  // ── Init ─────────────────────────────────────────────────────────────────
  populateSelector();

})();
