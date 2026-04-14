// conversation.js — Conversation Simulator tab

(function () {
  'use strict';

  const API_BASE = (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  ) ? 'http://localhost:3000' : '';

  const FC_KEY      = 'ponte_flashcards';
  const SESSION_KEY = 'ponte_conversation_session';
  const MAX_EXCHANGES = 20;
  const MAX_HISTORY   = MAX_EXCHANGES * 2;

  const SCENARIOS = [
    { emoji: '☕', italian: 'Al bar',                  english: 'Ordering coffee, chatting with the barista' },
    { emoji: '🍎', italian: 'Dal fruttivendolo',        english: 'Buying fruit at the market' },
    { emoji: '👋', italian: 'Con un amico',             english: 'Catching up with a friend you haven\'t seen' },
    { emoji: '🗺️', italian: 'Chiedere indicazioni',    english: 'Asking for directions in an unfamiliar city' },
    { emoji: '🍽️', italian: 'Al ristorante',           english: 'Ordering food, asking about dishes' },
    { emoji: '⚽',  italian: 'Una discussione',         english: 'Friendly argument about football or food' },
    { emoji: '📖', italian: 'Raccontare un aneddoto',   english: 'Telling a funny story that happened to you' },
    { emoji: '🤝', italian: 'Conoscere qualcuno',       english: 'Meeting someone new at a party' },
    { emoji: '🏥', italian: 'Dal medico',               english: 'Describing symptoms at the doctor\'s office' },
    { emoji: '😤', italian: 'Fare un reclamo',          english: 'Complaining politely about a problem' },
  ];

  function $(id) { return document.getElementById(id); }

  function escapeHTML(s) {
    return (s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const convSetup          = $('conv-setup');
  if (!convSetup) return;

  const convChat           = $('conv-chat');
  const convSummary        = $('conv-summary');
  const scenarioGrid       = $('conv-scenario-grid');
  const startBtn           = $('conv-start-btn');
  const convScenarioLabel  = $('conv-scenario-label');
  const convExchangeCounter= $('conv-exchange-counter');
  const exitBtn            = $('conv-exit-btn');
  const messagesEl         = $('conv-messages');
  const inputEl            = $('conv-input');
  const sendBtn            = $('conv-send-btn');
  const summaryStats       = $('conv-summary-stats');
  const errorsSection      = $('conv-errors-section');
  const errorsList         = $('conv-errors-list');
  const saveErrorsBtn      = $('conv-save-errors-btn');
  const newConvBtn         = $('conv-new-btn');
  const backBtn            = $('conv-back-btn');

  // ── State ─────────────────────────────────────────────────────────────────
  let selectedScenario = null;   // { emoji, italian, english }
  let history          = [];     // { role, content } — clean Italian for assistant
  let allErrors        = [];     // feedback strings flagged during session
  let currentScenario  = '';
  let exchangeCount    = 0;
  let isLoading        = false;

  // ── Scenario grid ─────────────────────────────────────────────────────────
  function renderScenarios() {
    scenarioGrid.innerHTML = '';
    SCENARIOS.forEach((s) => {
      const card = document.createElement('button');
      card.className = 'conv-scenario-card';
      card.type = 'button';
      card.dataset.italian = s.italian;
      card.innerHTML = `
        <span class="conv-scenario-emoji">${s.emoji}</span>
        <span class="conv-scenario-name">${escapeHTML(s.italian)}</span>
        <span class="conv-scenario-desc">${escapeHTML(s.english)}</span>`;
      card.addEventListener('click', () => selectScenario(s, card));
      scenarioGrid.appendChild(card);
    });
  }

  function selectScenario(scenario, cardEl) {
    // Deselect all, select clicked
    scenarioGrid.querySelectorAll('.conv-scenario-card').forEach(c => c.classList.remove('selected'));
    cardEl.classList.add('selected');
    selectedScenario = scenario;
    startBtn.disabled = false;
  }

  // ── Screen management ─────────────────────────────────────────────────────
  function showScreen(name) {
    convSetup.hidden   = name !== 'setup';
    convChat.hidden    = name !== 'chat';
    convSummary.hidden = name !== 'summary';
  }

  // ── Counter ───────────────────────────────────────────────────────────────
  function updateCounter() {
    convExchangeCounter.textContent = `${exchangeCount} / ${MAX_EXCHANGES}`;
  }

  // ── Reply parsing ─────────────────────────────────────────────────────────
  function parseReply(text) {
    const match = text.match(/\n---\n?/);
    if (match) {
      return {
        italian:  text.slice(0, match.index).trim(),
        feedback: text.slice(match.index + match[0].length).trim() || null,
      };
    }
    const bare = text.indexOf('\n---');
    if (bare !== -1) {
      return {
        italian:  text.slice(0, bare).trim(),
        feedback: text.slice(bare + 4).trim() || null,
      };
    }
    // Fallback: bare --- anywhere
    const idx = text.indexOf('---');
    if (idx !== -1 && idx > 0) {
      return {
        italian:  text.slice(0, idx).trim(),
        feedback: text.slice(idx + 3).trim() || null,
      };
    }
    return { italian: text.trim(), feedback: null };
  }

  function isFeedbackOk(feedback) {
    if (!feedback) return true;
    const clean = feedback.replace(/^-+\s*/, '').trim();
    return clean.startsWith('✓') || /^ottimo/i.test(clean);
  }

  // ── Bubble rendering ──────────────────────────────────────────────────────
  function addBubble(role, italian, feedback) {
    const wrap = document.createElement('div');
    wrap.className = `conv-bubble-wrap conv-bubble-${role}`;

    const bubble = document.createElement('div');
    bubble.className = 'conv-bubble';
    bubble.textContent = italian;

    if (role === 'assistant') {
      const speakBtn = document.createElement('button');
      speakBtn.className = 'conv-speak-btn';
      speakBtn.setAttribute('aria-label', 'Pronuncia');
      speakBtn.title = 'Pronuncia';
      speakBtn.textContent = '🔊';
      const spoken = italian;
      speakBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.ponteSpeak) window.ponteSpeak(spoken);
      });
      bubble.appendChild(speakBtn);
    }

    wrap.appendChild(bubble);

    if (feedback) {
      const ok = isFeedbackOk(feedback);
      if (!ok) allErrors.push(feedback);

      const note = document.createElement('div');
      note.className = 'conv-feedback-note' + (ok ? ' conv-feedback-ok' : '');
      note.textContent = feedback;
      wrap.appendChild(note);
    }

    messagesEl.appendChild(wrap);
    // Smooth scroll to bottom
    messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: 'smooth' });
    return wrap;
  }

  function addLoadingBubble() {
    const wrap = document.createElement('div');
    wrap.className = 'conv-bubble-wrap conv-bubble-assistant';
    wrap.innerHTML = '<div class="conv-bubble conv-bubble-loading"><span></span><span></span><span></span></div>';
    messagesEl.appendChild(wrap);
    messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: 'smooth' });
    return wrap;
  }

  // ── API call ──────────────────────────────────────────────────────────────
  async function callAPI(userMessage) {
    const res = await fetch(API_BASE + '/api/conversation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: currentScenario, history, userMessage }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  // ── Core message flow ─────────────────────────────────────────────────────
  async function fetchReply(userText) {
    if (isLoading) return;
    isLoading        = true;
    sendBtn.disabled = true;
    inputEl.disabled = true;

    if (userText !== null) {
      addBubble('user', userText, null);
      history.push({ role: 'user', content: userText });
      inputEl.value = '';
    }

    const loadingEl = addLoadingBubble();

    try {
      const data = await callAPI(userText);
      const { italian, feedback } = parseReply(data.reply || '');

      loadingEl.remove();
      addBubble('assistant', italian, feedback);

      history.push({ role: 'assistant', content: italian });
      if (userText !== null) {
        exchangeCount++;
        updateCounter();
      }

      if (history.length > MAX_HISTORY) {
        history = history.slice(history.length - MAX_HISTORY);
      }

      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify({
          scenario: currentScenario,
          history,
          allErrors,
          exchangeCount,
        }));
      } catch (_) {}

    } catch (err) {
      loadingEl.remove();
      const errEl = document.createElement('div');
      errEl.className = 'conv-error-msg';
      errEl.textContent = 'Connection error — please try again.';
      messagesEl.appendChild(errEl);
    } finally {
      isLoading        = false;
      sendBtn.disabled = false;
      inputEl.disabled = false;
      if (!convChat.hidden) inputEl.focus();
    }
  }

  async function startConversation() {
    if (!selectedScenario) return;

    currentScenario      = selectedScenario.italian;
    history              = [];
    allErrors            = [];
    exchangeCount        = 0;
    messagesEl.innerHTML = '';

    convScenarioLabel.textContent = `${selectedScenario.emoji} ${selectedScenario.italian}`;
    updateCounter();
    showScreen('chat');
    inputEl.focus();

    await fetchReply(null);
  }

  function handleSend() {
    const text = inputEl.value.trim();
    if (text) fetchReply(text);
  }

  // ── Session summary ───────────────────────────────────────────────────────
  function endSession() {
    showScreen('summary');

    // Remove leftover no-errors message from prior session
    const prev = convSummary.querySelector('.conv-no-errors');
    if (prev) prev.remove();

    const errorCount = allErrors.length;
    summaryStats.textContent =
      `${exchangeCount} exchange${exchangeCount !== 1 ? 's' : ''} · ${errorCount} error${errorCount !== 1 ? 's' : ''} flagged`;

    if (errorCount > 0) {
      errorsSection.hidden = false;
      saveErrorsBtn.hidden = false;
      saveErrorsBtn.textContent = 'Save flagged words to Flashcards ★';
      saveErrorsBtn.disabled = false;
      errorsList.innerHTML = '';
      allErrors.forEach((err) => {
        const row = document.createElement('div');
        row.className = 'conv-error-row';
        row.textContent = err;
        errorsList.appendChild(row);
      });
    } else {
      errorsSection.hidden = true;
      saveErrorsBtn.hidden = true;
      const msg = document.createElement('p');
      msg.className = 'conv-no-errors';
      msg.textContent = exchangeCount > 0 ? '✓ No errors flagged — ottimo!' : '';
      summaryStats.after(msg);
    }
  }

  // ── Save errors to flashcards ─────────────────────────────────────────────
  function extractItalianFromError(note) {
    // "X" → "Y"  or  "X" should be "Y"
    const arrow = note.match(/["""«]([^"""»\n]+)["""»]\s*(?:→|should be)\s*["""«]([^"""»\n]+)["""»]/i);
    if (arrow) return arrow[2].trim();
    const use = note.match(/\buse\s+["""«]([^"""»\n]+)["""»]/i);
    if (use) return use[1].trim();
    const q = note.match(/["""«]([^"""»\n]{2,30})["""»]/);
    if (q) return q[1].trim();
    return null;
  }

  saveErrorsBtn.addEventListener('click', () => {
    let cards = [];
    try { cards = JSON.parse(localStorage.getItem(FC_KEY) || '[]'); } catch { cards = []; }

    let saved = 0;
    allErrors.forEach((err, i) => {
      const italian = extractItalianFromError(err) || `Nota ${i + 1}`;
      const dup = cards.some(
        c => c.italian === italian && c.sourceArticle && c.sourceArticle.startsWith('Conversation')
      );
      if (!dup) {
        cards.push({
          id:            Date.now() + i,
          italian,
          english:       err,
          spanish:       '',
          category:      'new',
          note:          err,
          savedAt:       new Date().toISOString(),
          sourceArticle: `Conversation: ${currentScenario}`,
          wordType:      'phrase',
          timesCorrect:  0,
          timesWrong:    0,
          lastSeen:      null,
          lastDrilled:   null,
        });
        saved++;
      }
    });

    if (saved > 0) {
      localStorage.setItem(FC_KEY, JSON.stringify(cards));
      fetch(API_BASE + '/api/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cards),
      }).catch(() => {});
      window.dispatchEvent(new CustomEvent('ponte:flashcard-saved'));
    }

    saveErrorsBtn.textContent = saved > 0
      ? `Saved ${saved} card${saved !== 1 ? 's' : ''} ✓`
      : 'Already saved';
    saveErrorsBtn.disabled = true;
  });

  // ── Event listeners ───────────────────────────────────────────────────────
  startBtn.addEventListener('click', startConversation);
  exitBtn.addEventListener('click', endSession);
  sendBtn.addEventListener('click', handleSend);

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  newConvBtn.addEventListener('click', () => {
    localStorage.removeItem(SESSION_KEY);
    showScreen('setup');
  });

  backBtn.addEventListener('click', () => {
    localStorage.removeItem(SESSION_KEY);
    showScreen('setup');
  });

  // ── Init ──────────────────────────────────────────────────────────────────
  renderScenarios();

})();
