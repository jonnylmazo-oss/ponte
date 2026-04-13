(function () {
  'use strict';

  const FC_KEY  = 'ponte_flashcards';
  const API_BASE = (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  ) ? 'http://localhost:3000' : '';

  const CATEGORY_LABELS = {
    'cognate':      'Same in Spanish',
    'false-friend': 'False Friend',
    'divergence':   'Used differently',
    'new':          'New word',
  };

  const CATEGORY_COLORS = {
    'cognate':      '#4A90D9',
    'false-friend': '#F5C842',
    'divergence':   '#F5894A',
    'new':          '#888888',
  };

  // ── Helpers ─────────────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);

  function loadCards() {
    try { return JSON.parse(localStorage.getItem(FC_KEY) || '[]'); }
    catch { return []; }
  }

  function saveCards(cards) {
    localStorage.setItem(FC_KEY, JSON.stringify(cards));
    fetch(API_BASE + '/api/flashcards', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(cards),
    }).catch(function(err) { console.warn('Flashcard sync failed:', err.message); });
  }

  // ── DOM refs ─────────────────────────────────────────────────────────────
  const fcSearch      = $('fc-search');
  const fcCount       = $('fc-count');
  const fcGrid        = $('fc-grid');
  const fcEmpty       = $('fc-empty');
  const fcBrowse      = $('fc-browse');
  const fcDrill       = $('fc-drill');
  const fcDrillDone   = $('fc-drill-done');
  const fcDrillToggle = $('fc-drill-toggle');
  const fcExitDrill   = $('fc-exit-drill');
  const fcDrillStatus = $('fc-drill-status');
  const fcFlipInner   = $('fc-flip-inner');
  const fcFlipWord    = $('fc-flip-word');
  const fcFlipSource  = $('fc-flip-source');
  const fcFlipBtn     = $('fc-flip-btn');
  const fcFlipWordBack = $('fc-flip-word-back');
  const fcFlipAnswer  = $('fc-flip-answer');
  const fcFlipNote    = $('fc-flip-note');
  const fcGotBtn      = $('fc-got-btn');
  const fcTrickyBtn   = $('fc-tricky-btn');
  const fcDrillScore  = $('fc-drill-score');
  const fcTrickyList  = $('fc-tricky-list');
  const fcDrillRestart = $('fc-drill-restart');
  const fcSpeakBtn      = $('fc-speak-btn');
  const fcFrontSpeakBtn = $('fc-front-speak-btn');
  const fcToolbar         = $('fc-toolbar');
  const fcSessionStats    = $('fc-session-stats');
  const fcResetScores     = $('fc-reset-scores-btn');
  const fcDrillReverseBtn = $('fc-drill-reverse-btn');
  const fcFlipPrompt      = $('fc-flip-prompt');
  const fcFlipCard        = $('fc-flip-card');

  if (!fcGrid) return; // tab not present in DOM

  // ── State ────────────────────────────────────────────────────────────────
  let activeFilter   = 'all';
  let searchQuery    = '';
  let drillQueue     = [];
  let drillTotal     = 0;
  let drillCorrect   = 0;
  let trickyCards    = [];
  let drillWordType  = 'all';
  let sessionCorrect = 0;
  let sessionTricky  = 0;
  let drillReverse   = localStorage.getItem('ponte_drill_reverse') === 'true';

  // ── Filter helpers ────────────────────────────────────────────────────────
  function getFiltered() {
    const cards = loadCards();
    return cards.filter((c) => {
      if (activeFilter !== 'all' && c.category !== activeFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          c.italian.toLowerCase().includes(q) ||
          c.english.toLowerCase().includes(q) ||
          c.spanish.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }

  // ── Library render ────────────────────────────────────────────────────────
  function renderLibrary() {
    const filtered = getFiltered();
    const total    = loadCards().length;

    fcCount.textContent = filtered.length === total
      ? `${total} card${total !== 1 ? 's' : ''}`
      : `${filtered.length} of ${total}`;

    if (total === 0) {
      fcEmpty.hidden = false;
      fcGrid.innerHTML = '';
      fcDrillToggle.disabled = true;
      return;
    }
    fcEmpty.hidden = true;
    fcDrillToggle.disabled = filtered.length === 0;

    fcGrid.innerHTML = filtered.map((card) => {
      const color  = CATEGORY_COLORS[card.category] || CATEGORY_COLORS['new'];
      const label  = CATEGORY_LABELS[card.category]  || card.category;
      const source = card.sourceArticle ? `From: ${card.sourceArticle}` : '';

      // Accuracy badge — only if card has been drilled at least once
      let accuracyBadge = '';
      const drillAttempts = (card.timesCorrect || 0) + (card.timesWrong || 0);
      if (drillAttempts > 0) {
        const pct = Math.round((card.timesCorrect / drillAttempts) * 100);
        const tier = pct >= 80 ? 'green' : pct >= 50 ? 'yellow' : 'red';
        const dot  = pct >= 80 ? '🟢' : pct >= 50 ? '🟡' : '🔴';
        accuracyBadge = `<span class="fc-accuracy-badge fc-accuracy-${tier}" title="${card.timesCorrect}/${drillAttempts} correct">${dot} ${pct}%</span>`;
      }

      return `
        <div class="fc-card" data-id="${card.id}">
          <div class="fc-card-body">
            <div class="fc-card-it-row">
              <span class="fc-card-italian">${escapeHTML(card.italian)}</span>
              <button class="speak-btn fc-card-speak-btn" data-word="${escapeHTML(card.italian)}" aria-label="Pronounce" title="Pronounce">🔊</button>
            </div>
            <div class="fc-card-en">${escapeHTML(card.english)}</div>
            ${card.spanish ? `<div class="fc-card-es">${escapeHTML(card.spanish)}</div>` : ''}
            ${card.note ? `<p class="fc-card-note">${escapeHTML(card.note)}</p>` : ''}
            <div class="fc-card-foot">
              <span class="fc-cat-badge" style="border-color:${color};color:${color}">${label}</span>
              ${accuracyBadge}
              <span class="fc-card-source">${escapeHTML(source)}</span>
              <button class="fc-delete-btn" data-id="${card.id}" aria-label="Delete card">✕</button>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  function escapeHTML(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ── Delete / Library speak ────────────────────────────────────────────────
  fcGrid.addEventListener('click', (e) => {
    // Speak button in library card
    const speakBtn = e.target.closest('.fc-card-speak-btn');
    if (speakBtn) {
      if (window.ponteSpeak) window.ponteSpeak(speakBtn.dataset.word);
      return;
    }
    const btn = e.target.closest('.fc-delete-btn');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const cards = loadCards().filter((c) => c.id !== id);
    saveCards(cards);
    renderLibrary();
    updateBadge();
    window.dispatchEvent(new CustomEvent('ponte:flashcard-saved'));
  });

  // ── Filters ───────────────────────────────────────────────────────────────
  document.querySelectorAll('.fc-filter').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.fc-filter').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.cat;
      renderLibrary();
    });
  });

  fcSearch.addEventListener('input', () => {
    searchQuery = fcSearch.value.trim();
    renderLibrary();
  });

  // ── Word type filter ──────────────────────────────────────────────────────
  document.querySelectorAll('.fc-type-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.fc-type-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      drillWordType = btn.dataset.type;
    });
  });

  // ── Badge update ──────────────────────────────────────────────────────────
  function updateBadge() {
    const count = loadCards().length;
    ['fc-badge-sidebar', 'fc-badge-bottom'].forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.textContent = count;
      el.hidden = count === 0;
    });
  }

  // ── Reset Scores ──────────────────────────────────────────────────────────
  fcResetScores && fcResetScores.addEventListener('click', () => {
    if (!confirm('Reset all drill scores? This will clear timesCorrect, timesWrong, and lastDrilled for every card.')) return;
    const cards = loadCards().map((c) => ({
      ...c,
      timesCorrect: 0,
      timesWrong:   0,
      lastDrilled:  null,
    }));
    saveCards(cards);
    renderLibrary();
  });

  // ── Reverse drill mode ────────────────────────────────────────────────────
  function updateReverseBtn() {
    if (!fcDrillReverseBtn) return;
    fcDrillReverseBtn.textContent = drillReverse ? 'Standard 🔄' : 'Reverse 🔄';
    fcDrillReverseBtn.classList.toggle('active', drillReverse);
  }

  fcDrillReverseBtn && fcDrillReverseBtn.addEventListener('click', () => {
    drillReverse = !drillReverse;
    localStorage.setItem('ponte_drill_reverse', drillReverse);
    updateReverseBtn();
    if (!fcDrill.hidden && drillQueue.length) showDrillCard();
  });

  updateReverseBtn();

  // ── Drill mode ────────────────────────────────────────────────────────────
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function updateSessionStats() {
    if (!fcSessionStats) return;
    const total = sessionCorrect + sessionTricky;
    const pct   = total > 0 ? Math.round((sessionCorrect / total) * 100) : 0;
    if (total === 0) {
      fcSessionStats.textContent = '';
      return;
    }
    fcSessionStats.textContent = `${sessionCorrect} correct · ${sessionTricky} tricky · ${pct}% this session`;
  }

  function startDrill() {
    let filtered = getFiltered();
    // Apply word type filter
    if (drillWordType !== 'all') {
      filtered = filtered.filter((c) => (c.wordType || 'other') === drillWordType);
    }
    if (!filtered.length) return;
    drillQueue    = shuffle([...filtered]);
    drillTotal    = drillQueue.length;
    drillCorrect  = 0;
    trickyCards   = [];
    sessionCorrect = 0;
    sessionTricky  = 0;
    updateSessionStats();

    fcBrowse.hidden   = true;
    fcToolbar.hidden  = true;
    fcDrillDone.hidden = true;
    if (fcFlipCard) fcFlipCard.style.visibility = 'hidden';
    fcDrill.hidden    = false;
    showDrillCard();
    if (fcFlipCard) fcFlipCard.style.visibility = '';
  }

  function showDrillCard() {
    if (!drillQueue.length) {
      endDrill();
      return;
    }
    const card = drillQueue[0];
    const done = drillTotal - drillQueue.length;
    const color = CATEGORY_COLORS[card.category] || CATEGORY_COLORS['new'];
    const label = CATEGORY_LABELS[card.category]  || card.category;

    fcDrillStatus.textContent = `${done} / ${drillTotal}`;

    if (drillReverse) {
      // Front: English word; Back: Italian + category badge + note
      fcFlipWord.textContent     = card.english;
      fcFlipSource.textContent   = '';
      if (fcFlipPrompt) fcFlipPrompt.textContent = 'What is this in Italian?';
      if (fcFrontSpeakBtn) fcFrontSpeakBtn.hidden = true;

      fcFlipWordBack.textContent = card.italian;
      fcFlipAnswer.innerHTML =
        `<span class="fc-cat-badge" style="border-color:${color};color:${color}">${label}</span>`;
      fcFlipNote.textContent = card.note || '';
      fcFlipNote.hidden = !card.note;
    } else {
      // Front: Italian word; Back: English + Spanish + category badge + note
      fcFlipWord.textContent     = card.italian;
      fcFlipSource.textContent   = card.sourceArticle ? `From: ${card.sourceArticle}` : '';
      if (fcFlipPrompt) fcFlipPrompt.textContent = 'What does this mean?';
      if (fcFrontSpeakBtn) fcFrontSpeakBtn.hidden = false;

      fcFlipWordBack.textContent = card.italian;
      fcFlipAnswer.innerHTML = `
        <div class="fc-flip-en">${escapeHTML(card.english)}</div>
        ${card.spanish ? `<div class="fc-flip-es">${escapeHTML(card.spanish)}</div>` : ''}
        <span class="fc-cat-badge" style="border-color:${color};color:${color}">${label}</span>`;
      fcFlipNote.textContent = card.note || '';
      fcFlipNote.hidden = !card.note;
    }

    // Reset flip
    fcFlipInner.classList.remove('flipped');
    fcFlipBtn.disabled = false;
  }

  function endDrill() {
    fcDrill.hidden    = true;
    fcDrillDone.hidden = false;

    const pct = drillTotal > 0 ? Math.round((drillCorrect / drillTotal) * 100) : 0;
    fcDrillScore.textContent = `${drillCorrect} / ${drillTotal} correct (${pct}%)`;

    if (trickyCards.length) {
      fcTrickyList.innerHTML =
        `<p class="fc-tricky-label">Review again:</p>` +
        trickyCards.map((c) =>
          `<span class="fc-tricky-item">${escapeHTML(c.italian)}</span>`
        ).join('');
      fcTrickyList.hidden = false;
    } else {
      fcTrickyList.hidden = true;
    }
  }

  function exitDrill() {
    fcDrill.hidden     = true;
    fcDrillDone.hidden = true;
    fcToolbar.hidden   = false;
    fcBrowse.hidden    = false;
    renderLibrary();
  }

  // Flip
  fcFlipBtn.addEventListener('click', () => {
    fcFlipInner.classList.add('flipped');
    fcFlipBtn.disabled = true;
    // Auto-pronounce after card turns (CSS flip ~350ms)
    if (drillQueue.length && window.ponteSpeak) {
      setTimeout(() => window.ponteSpeak(drillQueue[0].italian), 350);
    }
  });

  // Front face: pronounce before flipping
  fcFrontSpeakBtn && fcFrontSpeakBtn.addEventListener('click', () => {
    if (drillQueue.length && window.ponteSpeak) {
      window.ponteSpeak(drillQueue[0].italian);
    }
  });

  // Back face: replay pronunciation
  fcSpeakBtn && fcSpeakBtn.addEventListener('click', () => {
    if (drillQueue.length && window.ponteSpeak) {
      window.ponteSpeak(drillQueue[0].italian);
    }
  });

  // Got it
  fcGotBtn.addEventListener('click', () => {
    if (!fcFlipInner.classList.contains('flipped')) return;
    const card = drillQueue.shift();
    const now  = new Date().toISOString();
    const cards = loadCards();
    const idx   = cards.findIndex((c) => c.id === card.id);
    if (idx !== -1) {
      cards[idx].timesCorrect++;
      cards[idx].lastSeen    = now;
      cards[idx].lastDrilled = now;
      saveCards(cards);
    }
    drillCorrect++;
    sessionCorrect++;
    updateSessionStats();
    showDrillCard();
  });

  // Tricky — put back in random later position
  fcTrickyBtn.addEventListener('click', () => {
    if (!fcFlipInner.classList.contains('flipped')) return;
    const card = drillQueue.shift();
    const now  = new Date().toISOString();
    const cards = loadCards();
    const idx   = cards.findIndex((c) => c.id === card.id);
    if (idx !== -1) {
      cards[idx].timesWrong++;
      cards[idx].lastSeen    = now;
      cards[idx].lastDrilled = now;
      saveCards(cards);
    }
    sessionTricky++;
    updateSessionStats();
    if (!trickyCards.find((c) => c.id === card.id)) trickyCards.push(card);
    // Re-insert at a random position ≥ 2 places ahead (or at end if short queue)
    const pos = drillQueue.length <= 2
      ? drillQueue.length
      : 2 + Math.floor(Math.random() * (drillQueue.length - 1));
    drillQueue.splice(pos, 0, card);
    drillTotal++; // count this attempt separately
    showDrillCard();
  });

  fcDrillToggle.addEventListener('click', startDrill);
  fcExitDrill.addEventListener('click', exitDrill);
  fcDrillRestart.addEventListener('click', startDrill);

  // ── Listen for saves from app.js ──────────────────────────────────────────
  window.addEventListener('ponte:flashcard-saved', () => {
    renderLibrary();
    updateBadge();
  });

  // ── Init ─────────────────────────────────────────────────────────────────
  renderLibrary();
  updateBadge();
})();
