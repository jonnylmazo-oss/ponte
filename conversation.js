// conversation.js — Conversation Simulator tab

(function () {
  'use strict';

  const API_BASE = (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  ) ? 'http://localhost:3000' : '';

  const FC_KEY      = 'ponte_flashcards';
  const SESSION_KEY = 'ponte_conversation_session';
  const MAX_HISTORY = 40; // cap at 20 exchanges (40 messages)

  function $(id) { return document.getElementById(id); }

  function escapeHTML(s) {
    return (s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const convSetup         = $('conv-setup');
  if (!convSetup) return;

  const convChat          = $('conv-chat');
  const convSummary       = $('conv-summary');
  const scenarioSelect    = $('conv-scenario-select');
  const startBtn          = $('conv-start-btn');
  const convScenarioLabel = $('conv-scenario-label');
  const exitBtn           = $('conv-exit-btn');
  const messagesEl        = $('conv-messages');
  const inputEl           = $('conv-input');
  const sendBtn           = $('conv-send-btn');
  const summaryStats      = $('conv-summary-stats');
  const errorsSection     = $('conv-errors-section');
  const errorsList        = $('conv-errors-list');
  const saveErrorsBtn     = $('conv-save-errors-btn');
  const newConvBtn        = $('conv-new-btn');

  // ── State ─────────────────────────────────────────────────────────────────
  let history         = [];  // { role, content } — clean Italian only for assistant
  let allErrors       = [];  // feedback strings flagged during session
  let currentScenario = '';
  let exchangeCount   = 0;
  let isLoading       = false;

  // ── Screen management ─────────────────────────────────────────────────────
  function showScreen(name) {
    convSetup.hidden   = name !== 'setup';
    convChat.hidden    = name !== 'chat';
    convSummary.hidden = name !== 'summary';
  }

  // ── Reply parsing ─────────────────────────────────────────────────────────
  function parseReply(text) {
    // Find --- separator (preceded by newline, or at start of line)
    const match = text.match(/\n---\n?/);
    if (match) {
      return {
        italian:  text.slice(0, match.index).trim(),
        feedback: text.slice(match.index + match[0].length).trim() || null,
      };
    }
    // Bare --- with no surrounding newlines
    const bare = text.indexOf('---');
    if (bare !== -1) {
      return {
        italian:  text.slice(0, bare).trim(),
        feedback: text.slice(bare + 3).trim() || null,
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
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return wrap;
  }

  function addLoadingBubble() {
    const wrap = document.createElement('div');
    wrap.className = 'conv-bubble-wrap conv-bubble-assistant';
    wrap.innerHTML = '<div class="conv-bubble conv-bubble-loading"><span></span><span></span><span></span></div>';
    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return wrap;
  }

  // ── API call ──────────────────────────────────────────────────────────────
  async function callAPI(userMessage) {
    const res = await fetch(API_BASE + '/api/conversation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scenario: currentScenario,
        history,
        userMessage,
      }),
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

      // Store only the Italian in history — no feedback noise for Claude
      history.push({ role: 'assistant', content: italian });
      if (userText !== null) exchangeCount++;

      // Cap history at MAX_HISTORY messages
      if (history.length > MAX_HISTORY) {
        history = history.slice(history.length - MAX_HISTORY);
      }

      // Persist session
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
    currentScenario      = scenarioSelect.value;
    history              = [];
    allErrors            = [];
    exchangeCount        = 0;
    messagesEl.innerHTML = '';
    convScenarioLabel.textContent = currentScenario;

    showScreen('chat');
    inputEl.focus();

    // Get Claude's opening message (userText = null → server injects "Ciao!")
    await fetchReply(null);
  }

  function handleSend() {
    const text = inputEl.value.trim();
    if (text) fetchReply(text);
  }

  // ── Session summary ───────────────────────────────────────────────────────
  function endSession() {
    showScreen('summary');

    summaryStats.textContent = exchangeCount === 1
      ? '1 exchange'
      : `${exchangeCount} exchanges`;

    // Clean up any leftover no-errors message from previous session
    const prev = convSummary.querySelector('.conv-no-errors');
    if (prev) prev.remove();

    if (allErrors.length > 0) {
      errorsSection.hidden = false;
      saveErrorsBtn.hidden = false;
      saveErrorsBtn.textContent = 'Save flagged words to Flashcards ★';
      saveErrorsBtn.disabled = false;
      errorsList.innerHTML = '';
      allErrors.forEach((err, i) => {
        const card = document.createElement('div');
        card.className = 'conv-error-card';
        card.innerHTML = `<span class="conv-error-num">${i + 1}</span><p class="conv-error-text">${escapeHTML(err)}</p>`;
        errorsList.appendChild(card);
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
    // use "X"
    const use = note.match(/\buse\s+["""«]([^"""»\n]+)["""»]/i);
    if (use) return use[1].trim();
    // First quoted phrase after ⚠️
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
        c => c.italian === italian &&
             c.sourceArticle && c.sourceArticle.startsWith('Conversation')
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

})();
