// dictionary.js — Translate tab: bidirectional word lookup + usage checker

(function () {
  'use strict';

  const API_BASE = (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  ) ? 'http://localhost:3000' : '';

  const DICT_HISTORY_KEY = 'ponte_dict_history';
  const HISTORY_MAX = 20;

  const FC_KEY = 'ponte_flashcards';

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

  const ERROR_TYPE_LABELS = {
    'grammar':     'Grammar',
    'transfer':    'Spanish Transfer',
    'word-choice': 'Word Choice',
  };

  const ERROR_TYPE_COLORS = {
    'grammar':     '#F5894A',
    'transfer':    '#F5C842',
    'word-choice': '#4A90D9',
  };

  function $(id) { return document.getElementById(id); }

  const escapeHTML = window.ponteEsc;

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const dictItInput      = $('dict-it-input');
  if (!dictItInput) return;

  const dictEnInput      = $('dict-en-input');
  const dictSwapBtn      = $('dict-swap-btn');
  const dictRandomBtn    = $('dict-random-btn');
  const dictSearchBtn    = $('dict-search-btn');
  const dictHistory      = $('dict-history');
  const dictHistoryChips = $('dict-history-chips');
  const dictClearHistory = $('dict-clear-history');
  const dictLoading      = $('dict-loading');
  const dictResult       = $('dict-result');
  const dictResultWord   = $('dict-result-word');
  const dictResultPron   = $('dict-result-pron');
  const dictResultBadge  = $('dict-result-badge');
  const dictResultEn     = $('dict-result-en');
  const dictResultEs     = $('dict-result-es');
  const dictTenseRow     = $('dict-tense-row');
  const dictResultTense  = $('dict-result-tense');
  const dictRootRow      = $('dict-root-row');
  const dictResultRoot   = $('dict-result-root');
  const dictResultNote   = $('dict-result-note');
  const dictSpeakBtn     = $('dict-speak-btn');
  const dictSaveBtn      = $('dict-save-btn');
  const dictUsageInput   = $('dict-usage-input');
  const dictCheckBtn     = $('dict-check-btn');
  const dictUsageLoading = $('dict-usage-loading');
  const dictUsageResult  = $('dict-usage-result');

  let currentEntry = null;
  let direction = 'it'; // 'it' = Italian→English, 'en' = English→Italian

  // ── Direction tracking ────────────────────────────────────────────────────
  dictItInput.addEventListener('input', () => { direction = 'it'; });
  dictEnInput.addEventListener('input', () => { direction = 'en'; });

  // ── Swap ──────────────────────────────────────────────────────────────────
  dictSwapBtn.addEventListener('click', () => {
    const itVal = dictItInput.value;
    dictItInput.value = dictEnInput.value;
    dictEnInput.value = itVal;
    direction = direction === 'it' ? 'en' : 'it';
  });

  // ── Random word ───────────────────────────────────────────────────────────
  dictRandomBtn.addEventListener('click', () => {
    if (typeof falseFriends !== 'undefined' && falseFriends.length) {
      const pick = falseFriends[Math.floor(Math.random() * falseFriends.length)];
      dictItInput.value = pick.italian;
      dictEnInput.value = '';
      direction = 'it';
      doLookup();
    }
  });

  // ── History ────────────────────────────────────────────────────────────────
  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(DICT_HISTORY_KEY) || '[]'); }
    catch { return []; }
  }

  function saveToHistory(text) {
    let history = loadHistory();
    history = history.filter(h => h.toLowerCase() !== text.toLowerCase());
    history.unshift(text);
    if (history.length > HISTORY_MAX) history = history.slice(0, HISTORY_MAX);
    localStorage.setItem(DICT_HISTORY_KEY, JSON.stringify(history));
  }

  function renderHistory() {
    const history = loadHistory();
    if (!history.length) { dictHistory.hidden = true; return; }
    dictHistory.hidden = false;
    dictHistoryChips.innerHTML = history.map(h =>
      `<button class="dict-chip" data-word="${escapeHTML(h)}">${escapeHTML(h)}</button>`
    ).join('');
  }

  dictClearHistory.addEventListener('click', () => {
    localStorage.removeItem(DICT_HISTORY_KEY);
    renderHistory();
  });

  dictHistoryChips.addEventListener('click', (e) => {
    const chip = e.target.closest('.dict-chip');
    if (!chip) return;
    dictItInput.value = chip.dataset.word;
    dictEnInput.value = '';
    direction = 'it';
    doLookup();
  });

  // ── Lookup ─────────────────────────────────────────────────────────────────
  async function doLookup() {
    const isIT = direction === 'it';
    const text = (isIT ? dictItInput.value : dictEnInput.value).trim();
    if (!text) return;

    dictLoading.hidden = false;
    dictResult.hidden  = true;

    try {
      const endpoint = isIT ? '/api/translate' : '/api/translate-to-italian';
      const res   = await fetch(API_BASE + endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text }),
      });
      const entry = await res.json();
      currentEntry = entry;
      saveToHistory(entry.italian || text);
      renderHistory();
      renderResult(entry);
    } catch (err) {
      console.error('Translate lookup failed:', err);
    } finally {
      dictLoading.hidden = true;
    }
  }

  function renderResult(entry) {
    const color = CATEGORY_COLORS[entry.category] || CATEGORY_COLORS['new'];
    const label = CATEGORY_LABELS[entry.category]  || entry.category;

    // Populate both inputs with result values
    dictItInput.value = entry.italian || '';
    dictEnInput.value = entry.english || '';

    dictResultWord.textContent        = entry.italian || '';
    dictResultWord.style.color        = color;
    dictResultPron.textContent        = entry.pronunciation || '';
    dictResultBadge.textContent       = label;
    dictResultBadge.style.borderColor = color;
    dictResultBadge.style.color       = color;
    dictResultEn.textContent          = entry.english || '';
    dictResultEs.textContent          = entry.spanish || '';

    if (entry.tense) {
      dictResultTense.textContent = entry.tense;
      dictTenseRow.hidden = false;
    } else {
      dictTenseRow.hidden = true;
    }

    if (entry.root) {
      dictResultRoot.textContent = entry.root;
      dictRootRow.hidden = false;
    } else {
      dictRootRow.hidden = true;
    }

    if (entry.note) {
      dictResultNote.textContent = entry.note;
      dictResultNote.hidden = false;
    } else {
      dictResultNote.hidden = true;
    }

    updateSaveBtn();
    dictResult.hidden = false;
  }

  // ── Save to Flashcards ──────────────────────────────────────────────────────
  function loadCards() {
    try { return JSON.parse(localStorage.getItem(FC_KEY) || '[]'); }
    catch { return []; }
  }

  function isAlreadySaved(italian) {
    return loadCards().some(c => (c.italian || '').toLowerCase() === italian.toLowerCase());
  }

  function updateSaveBtn() {
    if (!currentEntry) return;
    const saved = isAlreadySaved(currentEntry.italian || '');
    dictSaveBtn.textContent = saved ? 'Saved ✓' : 'Save ★';
    dictSaveBtn.classList.toggle('saved', saved);
  }

  dictSaveBtn.addEventListener('click', () => {
    if (!currentEntry) return;
    const cards   = loadCards();
    const italian = currentEntry.italian || '';
    const idx     = cards.findIndex(c => (c.italian || '').toLowerCase() === italian.toLowerCase());

    if (idx !== -1) {
      cards.splice(idx, 1);
    } else {
      cards.push({
        id:            Date.now(),
        italian,
        english:       currentEntry.english       || '',
        spanish:       currentEntry.spanish       || '',
        category:      currentEntry.category      || 'new',
        note:          currentEntry.note          || '',
        pronunciation: currentEntry.pronunciation || '',
        savedAt:       new Date().toISOString(),
        sourceArticle: 'Translate lookup',
        wordType:      currentEntry.wordType      || 'other',
        nounNumber:    currentEntry.nounNumber    || null,
        nounOtherForm: currentEntry.nounOtherForm || null,
        timesCorrect:  0,
        timesWrong:    0,
        lastSeen:      null,
        lastDrilled:   null,
      });
      dictSaveBtn.classList.add('flash');
      setTimeout(() => dictSaveBtn.classList.remove('flash'), 600);
    }

    localStorage.setItem(FC_KEY, JSON.stringify(cards));
    fetch(API_BASE + '/api/flashcards', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(cards),
    }).catch(err => console.warn('Flashcard sync failed:', err.message));

    updateSaveBtn();
    window.dispatchEvent(new CustomEvent('ponte:flashcard-saved'));
  });

  // ── Audio ──────────────────────────────────────────────────────────────────
  dictSpeakBtn.addEventListener('click', () => {
    if (currentEntry && window.ponteSpeak) window.ponteSpeak(currentEntry.italian);
  });

  // ── Search triggers ────────────────────────────────────────────────────────
  dictSearchBtn.addEventListener('click', doLookup);
  dictItInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { direction = 'it'; doLookup(); }
  });
  dictEnInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { direction = 'en'; doLookup(); }
  });

  // ── Usage Checker ──────────────────────────────────────────────────────────
  dictCheckBtn.addEventListener('click', doUsageCheck);
  dictUsageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) doUsageCheck();
  });

  async function doUsageCheck() {
    const sentence = (dictUsageInput.value || '').trim();
    if (!sentence) return;

    dictUsageLoading.hidden = false;
    dictUsageResult.hidden  = true;
    dictCheckBtn.disabled   = true;

    try {
      const res  = await fetch(API_BASE + '/api/check-usage', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ sentence }),
      });
      const data = await res.json();
      renderUsageResult(data);
    } catch (err) {
      console.error('Usage check failed:', err);
      dictUsageResult.innerHTML = '<p class="dict-usage-error">Check failed. Please try again.</p>';
      dictUsageResult.hidden = false;
    } finally {
      dictUsageLoading.hidden = true;
      dictCheckBtn.disabled   = false;
    }
  }

  function renderUsageResult(data) {
    if (!data || data.error) {
      dictUsageResult.innerHTML = '<p class="dict-usage-error">Check failed. Please try again.</p>';
      dictUsageResult.hidden = false;
      return;
    }

    let html = '';

    if (data.isCorrect) {
      html += `<div class="dict-usage-correct">
        <span class="dict-usage-check">✓</span>
        <span>Looks good!</span>
      </div>`;
    } else {
      html += `<div class="dict-usage-corrected">
        <span class="dict-usage-corrected-label">Corrected</span>
        <span class="dict-usage-corrected-text">${escapeHTML(data.corrected)}</span>
      </div>`;

      if (data.errors && data.errors.length) {
        html += '<div class="dict-usage-errors">';
        for (const err of data.errors) {
          const color     = ERROR_TYPE_COLORS[err.type] || '#888';
          const typeLabel = ERROR_TYPE_LABELS[err.type]  || err.type;
          html += `<div class="dict-usage-error-card">
            <div class="dict-usage-error-words">
              <span class="dict-usage-wrong">${escapeHTML(err.original)}</span>
              <span class="dict-usage-arrow">→</span>
              <span class="dict-usage-fix">${escapeHTML(err.correction)}</span>
            </div>
            <p class="dict-usage-explanation">${escapeHTML(err.explanation)}</p>
            <span class="dict-usage-type-badge" style="border-color:${color};color:${color}">${escapeHTML(typeLabel)}</span>
          </div>`;
        }
        html += '</div>';
      }
    }

    if (data.encouragement) {
      html += `<p class="dict-usage-encouragement">${escapeHTML(data.encouragement)}</p>`;
    }

    dictUsageResult.innerHTML = html;
    dictUsageResult.hidden = false;
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  renderHistory();
  window.addEventListener('ponte:flashcard-saved', updateSaveBtn);

})();
