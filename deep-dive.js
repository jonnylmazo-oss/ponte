// deep-dive.js — Deep-dive word exploration tab (issue #62)
// A screen to explore any Italian word in depth: ALL common senses first,
// then per-sense example sentences, then an optional etymology note.
// Opened standalone (More → Deep dive) or pre-filled from a flashcard
// (drill flip-card back → 🔍 Deep dive) via window.ponteDeepDive(word).

(function () {
  'use strict';

  const API_BASE = (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  ) ? 'http://localhost:3000' : '';

  const FC_KEY = 'ponte_flashcards';
  const $ = (id) => document.getElementById(id);
  const escapeHTML = window.ponteEsc;

  const CATEGORY_LABELS = {
    'same':         'Same word',
    'similar':      'Same/Similar',
    'false-friend': 'False Friend',
    'new':          'No Spanish link',
  };
  const CATEGORY_COLORS = {
    'same':         '#2E6B3E',
    'similar':      '#0E7490',
    'false-friend': '#B83232',
    'new':          '#888888',
  };
  const WORD_TYPE_LABELS = {
    noun: 'Noun', verb: 'Verb', adjective: 'Adjective',
    adverb: 'Adverb', phrase: 'Phrase', other: 'Other',
  };

  const ddInput   = $('dd-search-input');
  const ddBtn     = $('dd-search-btn');
  const ddLoading = $('dd-loading');
  const ddResults = $('dd-results');
  const ddEmpty   = $('dd-empty');

  if (!ddInput || !ddBtn || !ddResults) return; // panel not present

  let currentData = null;

  // ── Lookup ────────────────────────────────────────────────────────────────
  async function doDeepDive(word) {
    const w = (word != null ? word : ddInput.value).trim();
    if (!w) return;
    ddInput.value = w;

    if (ddEmpty)   ddEmpty.hidden = true;
    ddResults.hidden = true;
    ddResults.innerHTML = '';
    if (ddLoading) ddLoading.hidden = false;

    try {
      const res = await fetch(API_BASE + '/api/feedback-combined?action=deep-dive', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ word: w }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      currentData = data;
      render(data);
    } catch (err) {
      console.error('Deep dive failed:', err.message);
      ddResults.innerHTML = '<p class="dd-error">Couldn\'t load the deep dive — please try again.</p>';
      ddResults.hidden = false;
    } finally {
      if (ddLoading) ddLoading.hidden = true;
    }
  }

  // ── Render — STRICT ORDER: all definitions, then all examples, then etymology
  function render(data) {
    const word   = data.word || '';
    const senses = Array.isArray(data.senses) ? data.senses : [];

    let html = `
      <div class="dd-head">
        <h2 class="dd-word">${escapeHTML(word)}</h2>
        <button class="speak-btn dd-speak-btn" data-word="${escapeHTML(word)}" aria-label="Pronounce" title="Pronounce">🔊</button>
      </div>`;

    if (!senses.length) {
      html += '<p class="dd-error">No definitions found for this word.</p>';
      ddResults.innerHTML = html;
      ddResults.hidden = false;
      return;
    }

    // 1. Definitions first — every sense as its own block.
    html += '<section class="dd-section"><h3 class="dd-section-title">Meanings</h3>';
    senses.forEach((s, i) => {
      const cat   = s.category || 'new';
      const color = CATEGORY_COLORS[cat] || CATEGORY_COLORS['new'];
      const catLabel = CATEGORY_LABELS[cat] || cat;
      const wtLabel  = s.wordType && WORD_TYPE_LABELS[s.wordType];
      html += `
        <div class="dd-sense">
          <div class="dd-sense-head">
            <span class="dd-sense-num">${i + 1}.</span>
            <span class="dd-sense-def">${escapeHTML(s.definition || '')}</span>
          </div>
          <div class="dd-sense-badges">
            ${wtLabel ? `<span class="fc-wordtype-badge">${escapeHTML(wtLabel)}</span>` : ''}
            <span class="fc-cat-badge" style="border-color:${color};color:${color}">${escapeHTML(catLabel)}</span>
          </div>
          ${s.spanishNote ? `<p class="dd-sense-note">${escapeHTML(s.spanishNote)}</p>` : ''}
        </div>`;
    });
    html += '</section>';

    // 2. Example sentences second — grouped per sense, AFTER all definitions.
    html += '<section class="dd-section"><h3 class="dd-section-title">Examples</h3>';
    senses.forEach((s, i) => {
      const examples = Array.isArray(s.examples) ? s.examples : [];
      if (!examples.length) return;
      html += `<div class="dd-ex-group">
        <p class="dd-ex-sense">Sense ${i + 1} — ${escapeHTML(s.definition || '')}</p>`;
      examples.forEach((ex) => {
        html += `<div class="dd-ex">
          <span class="dd-ex-it">${escapeHTML(ex.italian || '')}</span>
          <span class="dd-ex-en">${escapeHTML(ex.english || '')}</span>
        </div>`;
      });
      html += '</div>';
    });
    html += '</section>';

    // 3. Etymology last — only when the model returned something illuminating.
    if (data.etymology) {
      html += `<section class="dd-section dd-etymology">
        <h3 class="dd-section-title">Etymology</h3>
        <p class="dd-etym-note">${escapeHTML(data.etymology)}</p>
      </section>`;
    }

    // Save to Cards — primary sense only (keeps the card lean).
    html += `<div class="dd-save-row">
      <button class="dd-save-btn" id="dd-save-btn"></button>
      <span class="dd-save-hint">Saves the primary meaning as a flashcard.</span>
    </div>`;

    ddResults.innerHTML = html;
    ddResults.hidden = false;
    updateSaveBtn();
  }

  // ── Save to Cards (primary/first sense) ─────────────────────────────────────
  function loadCards() {
    try { return JSON.parse(localStorage.getItem(FC_KEY) || '[]'); }
    catch { return []; }
  }
  function isAlreadySaved(italian) {
    return loadCards().some(c => (c.italian || '').toLowerCase() === (italian || '').toLowerCase());
  }
  function updateSaveBtn() {
    const btn = $('dd-save-btn');
    if (!btn || !currentData) return;
    const saved = isAlreadySaved(currentData.word || '');
    btn.textContent = saved ? 'Saved ✓' : 'Save to Cards ★';
    btn.classList.toggle('saved', saved);
  }

  ddResults.addEventListener('click', (e) => {
    // Speak button
    const spk = e.target.closest('.dd-speak-btn');
    // Prefer the card's pre-rendered audio when this word is in the deck.
    if (spk) { (window.ponteSpeakCard || window.ponteSpeak)(spk.dataset.word); return; }

    // Save button
    if (!e.target.closest('#dd-save-btn')) return;
    if (!currentData || !currentData.word) return;
    const s0 = (currentData.senses && currentData.senses[0]) || {};
    const cards   = loadCards();
    const italian = currentData.word;
    const idx     = cards.findIndex(c => (c.italian || '').toLowerCase() === italian.toLowerCase());

    if (idx !== -1) {
      cards.splice(idx, 1); // toggle off
    } else {
      cards.push({
        id:            Date.now(),
        italian:       window.ponteNormalizeItalian(italian, {
          wordType: s0.wordType,
          example: (s0.examples && s0.examples[0] && s0.examples[0].italian) || '',
          isProperNoun: s0.isProperNoun,
        }),
        english:       s0.definition  || '',
        spanish:       '',
        category:      s0.category     || 'new',
        note:          s0.spanishNote  || '',
        pronunciation: '',
        wordType:      s0.wordType     || 'other',
        nounNumber:    null,
        nounOtherForm: null,
        example:       (s0.examples && s0.examples[0] && s0.examples[0].italian) || '',
        exampleEN:     (s0.examples && s0.examples[0] && s0.examples[0].english) || '',
        savedAt:       new Date().toISOString(),
        sourceArticle: 'Deep dive',
        timesCorrect:  0,
        timesWrong:    0,
        lastSeen:      null,
        lastDrilled:   null,
        interval:      0,
        easeFactor:    2.5,
        dueDate:       null,
        reviewCount:   0,
        lastReviewed:  null,
        grammarPatterns: [],
      });
    }

    localStorage.setItem(FC_KEY, JSON.stringify(cards));
    if (cards.length) {
      fetch(API_BASE + '/api/flashcards', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(cards),
      }).catch(err => console.warn('Flashcard sync failed:', err.message));
    }
    updateSaveBtn();
    window.dispatchEvent(new CustomEvent('ponte:flashcard-saved'));
  });

  // Keep the save-button label in sync if a card is saved/removed elsewhere.
  window.addEventListener('ponte:flashcard-saved', updateSaveBtn);

  // ── Wire search ─────────────────────────────────────────────────────────────
  ddBtn.addEventListener('click', () => doDeepDive());
  ddInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doDeepDive(); });

  // ── Public entry point (from flashcards / anywhere) ─────────────────────────
  window.ponteDeepDive = function (word) {
    if (window.switchTab) window.switchTab('deep-dive');
    if (word) { ddInput.value = word; doDeepDive(word); }
    else if (ddInput) { ddInput.focus(); }
  };
})();
