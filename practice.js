// practice.js — Practice tab: topic-driven sentence generation

(function () {
  'use strict';

  const API_BASE = (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  ) ? 'http://localhost:3000' : '';

  const FC_KEY = 'ponte_flashcards';
  const EP_KEY = 'ponte_error_patterns';

  const PRACTICE_SURPRISE_TOPICS = [
    // Grammar-focused
    'past tense actions', 'essere vs avere verbs', 'reflexive verbs',
    'clitic pronouns', 'subjunctive mood', 'double pronouns',
    // Daily life
    'ordering at a bar', 'buying food at the market', 'asking for directions',
    'making plans with friends', 'describing your day',
    // Emotional
    'expressing opinions', 'agreeing and disagreeing', 'giving advice',
    'making complaints politely', 'expressing surprise',
    // Storytelling
    'describing a past event', 'telling a funny story',
    'describing a person', 'talking about childhood',
    // Cultural
    'talking about food preferences', 'discussing football',
    'weekend plans', 'Italian family life',
    // Travel
    'at the hotel', 'on public transport', 'at the restaurant', 'sightseeing',
  ];

  // Maps error pattern keys → user-friendly practice topics
  const PATTERN_TOPICS = {
    'false-friend':     'false friends and confusing Italian-Spanish pairs',
    'divergence':       'words used differently in Italian vs Spanish',
    'verb-essere':      'verbs that require essere as auxiliary',
    'passato-prossimo': 'past tense actions using passato prossimo',
    'clitic-placement': 'object pronouns and clitic placement',
    'subjunctive':      'subjunctive mood in everyday sentences',
    'geminates':        'words with double consonants',
    'verb-general':     'Italian verb conjugations and forms',
  };

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

  const TYPE_COLORS = {
    'grammar': '#B83232', 'spanish-transfer': '#B85C00',
    'word-choice': '#0055AA', 'spelling': '#888',
  };

  function $(id) { return document.getElementById(id); }

  function escapeHTML(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function normalizeIT(s) {
    return (s || '').toLowerCase()
      .replace(/[.,!?;:'"«»""''()\u2014\u2013\-]/g, '').trim();
  }

  function tokenizeIT(sentence) {
    return (sentence || '').split(/\s+/).filter(Boolean);
  }

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

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const pracSetup         = $('prac-setup');
  if (!pracSetup) return;

  const pracDrill         = $('prac-drill');
  const pracDone          = $('prac-done');
  const pracStartBtn      = $('prac-start-btn');
  const pracTopicInput    = $('prac-topic-input');
  const pracWeakBtn       = $('prac-weak-btn');
  const pracSurpriseBtn   = $('prac-surprise-btn');
  const pracModeBtns      = document.querySelectorAll('.prac-mode-btn');
  const pracDiffBtns      = document.querySelectorAll('.prac-diff-btn');
  const pracProgressBar   = $('prac-progress-bar');
  const pracProgressLabel = $('prac-progress-label');
  const pracSentenceIT    = $('prac-sentence-it');
  const pracSentenceEN    = $('prac-sentence-en');
  const pracChoices       = $('prac-choices');
  const pracFeedback      = $('prac-feedback');
  const pracNextBtn       = $('prac-next-btn');
  const pracDoneScore     = $('prac-done-score');
  const pracRetryBtn      = $('prac-retry-btn');
  const pracBackBtn       = $('prac-back-btn');
  const pracMissedList    = $('prac-missed-list');
  const pracSaveMissed    = $('prac-save-missed-btn');

  // ── State ─────────────────────────────────────────────────────────────────
  let currentTopic      = '';
  let currentDifficulty = 'B1';
  let drillItems        = [];
  let drillIndex        = 0;
  let drillScore        = 0;
  let drillMode         = 'choice';
  let drillAnswered     = false;
  let missedItems       = [];

  // SR-specific state
  let srDifficulty = 'wordbank';
  let srBank       = [];
  let srBuilt      = [];
  let srAnswered   = false;

  // ── Setup screen ──────────────────────────────────────────────────────────
  function updateGenerateBtn() {
    pracStartBtn.disabled = !pracTopicInput.value.trim();
  }

  pracTopicInput && pracTopicInput.addEventListener('input', updateGenerateBtn);

  pracTopicInput && pracTopicInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !pracStartBtn.disabled) pracStartBtn.click();
  });

  pracWeakBtn && pracWeakBtn.addEventListener('click', () => {
    let patterns = {};
    try { patterns = JSON.parse(localStorage.getItem(EP_KEY) || '{}'); } catch (e) {}
    const entries = Object.entries(patterns).filter(([, v]) => v && v.count > 0);
    if (!entries.length) {
      pracWeakBtn.textContent = 'No weak areas yet — drill some flashcards first';
      setTimeout(() => { pracWeakBtn.textContent = 'Practice my weak areas'; }, 3000);
      return;
    }
    entries.sort((a, b) => b[1].count - a[1].count);
    const topKey   = entries[0][0];
    const topTopic = PATTERN_TOPICS[topKey] || topKey.replace(/-/g, ' ');
    pracTopicInput.value = topTopic;
    currentTopic = topTopic;
    updateGenerateBtn();
    pracTopicInput.focus();
  });

  pracSurpriseBtn && pracSurpriseBtn.addEventListener('click', () => {
    const topic = PRACTICE_SURPRISE_TOPICS[Math.floor(Math.random() * PRACTICE_SURPRISE_TOPICS.length)];
    if (pracTopicInput) { pracTopicInput.value = topic; }
    currentTopic = topic;
    updateGenerateBtn();
  });

  pracDiffBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      pracDiffBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentDifficulty = btn.dataset.diff;
    });
  });

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

  // ── Generate practice from API ────────────────────────────────────────────
  async function generatePractice(topic, difficulty) {
    const resp = await fetch(API_BASE + '/api/generate-practice', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ topic, difficulty }),
    });
    if (!resp.ok) throw new Error('API error ' + resp.status);
    const data = await resp.json();
    const sentences = Array.isArray(data.sentences) ? data.sentences : [];

    return sentences.map(s => {
      const words       = Array.isArray(s.words) ? s.words : [];
      const distractors = Array.isArray(s.distractors) ? s.distractors : [];
      const targetWord  = words[0] || '';

      // Build Italian HTML with blank for MC mode
      let itHtml = escapeHTML(s.italian);
      if (targetWord) {
        const replaced = s.italian.replace(
          new RegExp('\\b' + escapeRegex(targetWord) + '\\b', 'i'),
          '<span class="prac-blank">___</span>'
        );
        // fallback: match anywhere if word boundary didn't match (e.g. Italian accent chars)
        itHtml = (replaced !== s.italian)
          ? replaced
          : s.italian.replace(
              new RegExp('(' + escapeRegex(targetWord) + ')', 'i'),
              '<span class="prac-blank">___</span>'
            );
      }

      // Build word bank tiles: key words + distractors (equal counts), shuffled
      const bankWords = shuffle([
        ...words,
        ...distractors.slice(0, words.length),
      ]);
      const bankTiles = bankWords.map((word, i) => ({ id: i, word }));
      const tokens    = tokenizeIT(s.italian);

      return {
        english:     s.english  || '',
        italian:     s.italian  || '',
        sentence:    s.italian  || '',
        word:        targetWord,
        wordEN:      '',
        category:    'new',
        note:        '',
        itHtml,
        enHtml:      escapeHTML(s.english || ''),
        distractors: distractors.slice(0, 3),
        tokens,
        bankTiles,
      };
    });
  }

  // ── Start button ──────────────────────────────────────────────────────────
  pracStartBtn.addEventListener('click', async () => {
    currentTopic = pracTopicInput ? pracTopicInput.value.trim() : '';
    if (!currentTopic) return;

    pracStartBtn.disabled    = true;
    pracStartBtn.textContent = 'Generating…';

    try {
      drillItems = await generatePractice(currentTopic, currentDifficulty);
    } catch (e) {
      pracStartBtn.disabled    = false;
      pracStartBtn.textContent = 'Generate Practice →';
      return;
    }

    pracStartBtn.disabled    = false;
    pracStartBtn.textContent = 'Generate Practice →';

    if (!drillItems.length) return;

    drillIndex    = 0;
    drillScore    = 0;
    missedItems   = [];
    drillAnswered = false;
    srAnswered    = false;
    pracSetup.hidden = true;
    pracDone.hidden  = true;

    if (drillMode === 'choice') {
      pracDrill.hidden = false;
      showDrillItem();
    } else {
      const srDrill = $('prac-sr-drill');
      if (srDrill) srDrill.hidden = false;
      showSRItem();
    }
  });

  // ── Multiple Choice drill ─────────────────────────────────────────────────
  function showDrillItem() {
    if (drillIndex >= drillItems.length) { endDrill(); return; }

    const item = drillItems[drillIndex];
    drillAnswered = false;

    const pct = Math.round((drillIndex / drillItems.length) * 100);
    pracProgressBar.style.width   = pct + '%';
    pracProgressLabel.textContent = (drillIndex + 1) + ' / ' + drillItems.length;

    // English sentence above, Italian with blank below
    if (item.english) {
      pracSentenceEN.textContent = item.english;
      pracSentenceEN.hidden = false;
    } else {
      pracSentenceEN.hidden = true;
    }
    pracSentenceIT.innerHTML = item.itHtml;

    pracFeedback.hidden   = true;
    pracFeedback.innerHTML = '';
    pracNextBtn.hidden    = true;
    pracNextBtn.textContent = drillIndex + 1 >= drillItems.length ? 'See Results →' : 'Next →';

    showChoiceMode(item);
  }

  function showChoiceMode(item) {
    pracChoices.hidden = false;
    const options = shuffle([item.word, ...item.distractors]);
    pracChoices.innerHTML = options.map(opt =>
      `<button class="prac-choice" data-val="${escapeHTML(opt)}">${escapeHTML(opt)}</button>`
    ).join('');

    pracChoices.querySelectorAll('.prac-choice').forEach(btn => {
      btn.addEventListener('click', () => handleAnswer(btn.dataset.val, item));
    });
  }

  function handleAnswer(answer, item) {
    if (drillAnswered) return;
    drillAnswered = true;

    const ans    = answer.toLowerCase().trim();
    const target = item.word.toLowerCase().trim();
    const correct = ans === target;

    if (correct) drillScore++;
    else         missedItems.push(item);

    pracChoices.querySelectorAll('.prac-choice').forEach(btn => {
      btn.disabled = true;
      const v = btn.dataset.val.toLowerCase();
      if (v === target)               btn.classList.add('correct');
      else if (v === ans && !correct) btn.classList.add('wrong');
    });

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

    // Auto-advance on correct after 1.5s
    if (correct) {
      setTimeout(() => {
        if (drillAnswered) { drillIndex++; showDrillItem(); }
      }, 1500);
    }
  }

  pracNextBtn.addEventListener('click', () => { drillIndex++; showDrillItem(); });

  // ── End screen ────────────────────────────────────────────────────────────
  function endDrill() {
    pracDrill.hidden = true;
    const pracSRDrill = $('prac-sr-drill');
    if (pracSRDrill) pracSRDrill.hidden = true;
    pracDone.hidden  = false;

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
              <strong>${escapeHTML(item.word || item.italian)}</strong>
              ${item.english ? `<span class="prac-missed-en">${escapeHTML(item.english)}</span>` : ''}
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
    const now    = new Date().toISOString();
    const source = 'Practice: ' + currentTopic;

    for (const item of missedItems) {
      const word   = item.word || item.italian || '';
      const wordEN = item.wordEN || item.english || '';
      if (!word) continue;
      const exists = cards.some(c => c.italian.toLowerCase() === word.toLowerCase());
      if (!exists) {
        cards.push({
          id:            Date.now() + added,
          italian:       word,
          english:       wordEN,
          spanish:       '',
          category:      item.category || 'new',
          note:          item.note || '',
          savedAt:       now,
          sourceArticle: source,
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

  pracRetryBtn && pracRetryBtn.addEventListener('click', async () => {
    const pracSRDrill = $('prac-sr-drill');
    pracDone.hidden = true;
    drillIndex  = 0;
    drillScore  = 0;
    missedItems = [];
    srAnswered  = false;
    drillAnswered = false;

    // Re-generate with same topic/difficulty
    pracRetryBtn.disabled    = true;
    pracRetryBtn.textContent = 'Generating…';
    try {
      drillItems = await generatePractice(currentTopic, currentDifficulty);
    } finally {
      pracRetryBtn.disabled    = false;
      pracRetryBtn.textContent = 'Try again';
    }
    if (!drillItems.length) { pracDone.hidden = false; return; }

    if (drillMode === 'choice') {
      pracDrill.hidden = false;
      showDrillItem();
    } else {
      if (pracSRDrill) pracSRDrill.hidden = false;
      showSRItem();
    }
  });

  pracBackBtn && pracBackBtn.addEventListener('click', () => {
    const pracSRDrill = $('prac-sr-drill');
    pracDone.hidden  = true;
    pracDrill.hidden = true;
    if (pracSRDrill) pracSRDrill.hidden = true;
    pracSetup.hidden = false;
  });

  // ── Sentence Rebuild + Type It (shared prac-sr-drill panel) ──────────────

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
    if (drillMode === 'rebuild' && srDifficulty === 'wordbank') {
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
    srBank      = [...(item.bankTiles || [])];
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
    if (subEl)  { subEl.hidden = false; subEl.textContent = 'Check →'; subEl.disabled = true; }

    const wbUi = srEl('prac-sr-wb-ui');
    const rcUi = srEl('prac-sr-recall-ui');

    const useWordBank = (drillMode === 'rebuild' && srDifficulty === 'wordbank');
    const useRecall   = (drillMode === 'rebuild' && srDifficulty === 'recall') || (drillMode === 'type');

    if (wbUi) wbUi.hidden = !useWordBank;
    if (rcUi) rcUi.hidden = !useRecall;

    if (useWordBank) {
      renderSRBuilt();
      renderSRBank();
    } else {
      const inp = srEl('prac-sr-recall-input');
      if (inp) { inp.value = ''; inp.disabled = false; setTimeout(() => inp.focus(), 100); }
    }
    updateSRSubmit();
  }

  const pracSRSubmitBtn = $('prac-sr-submit-btn');
  pracSRSubmitBtn && pracSRSubmitBtn.addEventListener('click', async () => {
    if (srAnswered) return;
    const item = drillItems[drillIndex];
    if (!item) return;
    if (drillMode === 'rebuild' && srDifficulty === 'wordbank') submitWordBank(item);
    else await submitRecall(item);
  });

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

    let result   = null;
    let isCorrect = false;

    if (drillMode === 'type') {
      // Local check: normalized string similarity
      const userNorm  = normalizeIT(userItalian);
      const idealNorm = normalizeIT(item.italian);
      const dist = levenshtein(userNorm, idealNorm);
      isCorrect = userNorm === idealNorm || dist <= Math.max(2, Math.floor(idealNorm.length * 0.12));
      result = {
        correct:      isCorrect,
        score:        isCorrect ? 100 : Math.max(0, 100 - Math.round((dist / Math.max(idealNorm.length, 1)) * 100)),
        idealItalian: item.italian,
        errors:       [],
        encouragement: isCorrect ? '' : 'Keep practising!',
      };
    } else {
      // Free Recall: API check
      try {
        const resp = await fetch(API_BASE + '/api/check-sentence', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ english: item.english, userItalian, articleItalian: item.italian }),
        });
        result = await resp.json();
      } catch (e) {
        result = { correct: false, score: 0, idealItalian: item.italian, errors: [], encouragement: 'Keep practising!' };
      }
      isCorrect = result.correct || (result.score >= 75);
    }

    if (isCorrect) drillScore++;
    else           missedItems.push(item);

    showSRFeedback(isCorrect, item, result);
  }

  function showSRFeedback(correct, item, apiResult) {
    const fbEl  = srEl('prac-sr-feedback');
    const subEl = srEl('prac-sr-submit-btn');
    const nxtEl = srEl('prac-sr-next-btn');
    if (!fbEl) return;

    let html = `<div class="prac-feedback-result ${correct ? 'correct' : 'wrong'}">${correct ? '✓ Correct!' : '✗ Not quite'}</div>`;

    const ideal = (apiResult && apiResult.idealItalian) ? apiResult.idealItalian : item.italian;
    html += `<div class="prac-sr-ideal">
      <span class="prac-sr-ideal-label">Ideal:</span>
      <em class="prac-sr-ideal-text">${escapeHTML(ideal)}</em>
    </div>`;

    if (apiResult && Array.isArray(apiResult.errors) && apiResult.errors.length > 0) {
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

    if (apiResult && apiResult.score !== undefined && drillMode !== 'type') {
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

})();
