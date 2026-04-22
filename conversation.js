// conversation.js — Conversation tab: Scripted + Free modes

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

  const escapeHTML = window.ponteEsc;
  function $(id) { return document.getElementById(id); }

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

  // ═══════════════════════════════════════════════════════════════
  // SUB-TAB SWITCHING
  // ═══════════════════════════════════════════════════════════════
  const convPanelScripted = $('conv-panel-scripted');
  const convPanelFree     = $('conv-panel-free');

  window.switchConvTab = function (which) {
    if (!convPanelScripted) return;
    convPanelScripted.hidden = (which !== 'scripted');
    if (convPanelFree) convPanelFree.hidden = (which !== 'free');
    document.querySelectorAll('#conv-subtabs .conv-subtab').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.convPanel === which);
    });
  };

  // ═══════════════════════════════════════════════════════════════
  // SCRIPTED DIALOGUE MODULE
  // ═══════════════════════════════════════════════════════════════

  const sdlgScenGrid    = $('sdlg-scenario-grid');
  const sdlgGenerateBtn = $('sdlg-generate-btn');
  const sdlgSetup       = $('sdlg-setup');
  const sdlgPlayer      = $('sdlg-player');
  const sdlgEnd         = $('sdlg-end');
  const sdlgScenLabel   = $('sdlg-scenario-label');
  const sdlgModeToggle  = $('sdlg-mode-toggle');
  const sdlgExitBtn     = $('sdlg-exit-btn');
  const sdlgProgress    = $('sdlg-progress');
  const sdlgMessages    = $('sdlg-messages');
  const sdlgActionArea  = $('sdlg-action-area');
  const sdlgEndScore    = $('sdlg-end-score');
  const sdlgEndPhrases  = $('sdlg-end-phrases');
  const sdlgSaveBtn     = $('sdlg-save-btn');
  const sdlgRetryBtn    = $('sdlg-retry-btn');
  const sdlgNewBtn      = $('sdlg-new-btn');

  // State
  let sdlgSelectedScen = null;
  let sdlgDifficulty   = 'B1';
  let sdlgDialogue     = null;
  let sdlgCurrentIdx   = 0;
  let sdlgUserResults  = []; // { idx, italian, english, correct }
  let sdlgMode         = 'mc';
  let sdlgLoading      = false;

  // ── Scripted scenario grid ──────────────────────────────────────
  function renderScriptedScenarios() {
    if (!sdlgScenGrid) return;
    sdlgScenGrid.innerHTML = '';
    SCENARIOS.forEach((s) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'conv-scenario-card';
      card.innerHTML = `
        <span class="conv-scenario-emoji">${s.emoji}</span>
        <span class="conv-scenario-name">${escapeHTML(s.italian)}</span>
        <span class="conv-scenario-desc">${escapeHTML(s.english)}</span>`;
      card.addEventListener('click', () => {
        sdlgScenGrid.querySelectorAll('.conv-scenario-card').forEach((c) => c.classList.remove('selected'));
        card.classList.add('selected');
        sdlgSelectedScen = s;
        if (sdlgGenerateBtn) sdlgGenerateBtn.disabled = false;
      });
      sdlgScenGrid.appendChild(card);
    });
  }

  // ── Difficulty selector ─────────────────────────────────────────
  document.querySelectorAll('.sdlg-diff-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sdlg-diff-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      sdlgDifficulty = btn.dataset.diff;
    });
  });

  // ── Generate dialogue ───────────────────────────────────────────
  if (sdlgGenerateBtn) {
    sdlgGenerateBtn.addEventListener('click', generateDialogue);
  }

  async function generateDialogue() {
    if (!sdlgSelectedScen || sdlgLoading) return;
    sdlgLoading = true;
    sdlgGenerateBtn.disabled = true;
    sdlgGenerateBtn.textContent = 'Generating…';

    try {
      const res = await fetch(API_BASE + '/api/generate-dialogue', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ scenario: sdlgSelectedScen.italian, difficulty: sdlgDifficulty }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.exchanges || !data.exchanges.length) throw new Error('No exchanges returned');
      sdlgDialogue = data;
      startPlayer();
    } catch (err) {
      sdlgGenerateBtn.textContent = 'Error — try again';
      setTimeout(() => {
        sdlgGenerateBtn.textContent = 'Generate dialogue →';
        sdlgGenerateBtn.disabled = !sdlgSelectedScen;
      }, 2500);
    } finally {
      sdlgLoading = false;
    }
  }

  // ── Screen helpers ──────────────────────────────────────────────
  function showSdlgScreen(name) {
    if (sdlgSetup)  sdlgSetup.hidden  = (name !== 'setup');
    if (sdlgPlayer) sdlgPlayer.hidden = (name !== 'player');
    if (sdlgEnd)    sdlgEnd.hidden    = (name !== 'end');
  }

  // ── Player entry ────────────────────────────────────────────────
  function startPlayer() {
    sdlgCurrentIdx  = 0;
    sdlgUserResults = [];
    if (sdlgMessages)   sdlgMessages.innerHTML   = '';
    if (sdlgActionArea) sdlgActionArea.innerHTML = '';
    if (sdlgScenLabel) sdlgScenLabel.textContent =
      `${sdlgSelectedScen.emoji} ${sdlgSelectedScen.italian}`;
    updateModeToggleLabel();
    buildProgressBar();
    showSdlgScreen('player');
    advanceToExchange(0);
  }

  // ── Progress bar ────────────────────────────────────────────────
  function buildProgressBar() {
    if (!sdlgProgress || !sdlgDialogue) return;
    sdlgProgress.innerHTML = sdlgDialogue.exchanges.map((ex, i) =>
      `<div class="sdlg-seg ${ex.isUserTurn ? 'sdlg-seg-user' : 'sdlg-seg-native'}" data-idx="${i}"></div>`
    ).join('');
  }

  function updateProgressBar() {
    if (!sdlgProgress || !sdlgDialogue) return;
    sdlgDialogue.exchanges.forEach((ex, i) => {
      const seg = sdlgProgress.querySelector(`[data-idx="${i}"]`);
      if (!seg) return;
      seg.className = 'sdlg-seg';
      if (i < sdlgCurrentIdx) {
        if (ex.isUserTurn) {
          const r = sdlgUserResults.find((r) => r.idx === i);
          seg.classList.add(r && r.correct ? 'sdlg-seg-correct' : 'sdlg-seg-wrong');
        } else {
          seg.classList.add('sdlg-seg-done');
        }
      } else if (i === sdlgCurrentIdx) {
        seg.classList.add('sdlg-seg-current');
      } else {
        seg.classList.add(ex.isUserTurn ? 'sdlg-seg-user' : 'sdlg-seg-native');
      }
    });
  }

  // ── Advance ─────────────────────────────────────────────────────
  function advanceToExchange(idx) {
    if (!sdlgDialogue) return;
    sdlgCurrentIdx = idx;
    updateProgressBar();

    if (idx >= sdlgDialogue.exchanges.length) {
      showEndScreen();
      return;
    }

    const exchange = sdlgDialogue.exchanges[idx];
    if (exchange.isUserTurn) {
      showUserTurn(exchange, idx);
    } else {
      showNativeTurn(exchange);
    }
  }

  // ── Native speaker name ─────────────────────────────────────────
  function nativeName() {
    const n = sdlgDialogue && sdlgDialogue.characters && sdlgDialogue.characters.native;
    if (!n) return 'Native';
    // "Marco (barista)" → "Marco"
    return n.split(/[\s(]/)[0];
  }

  // ── Append bubble ───────────────────────────────────────────────
  function appendToMessages(html) {
    if (!sdlgMessages) return;
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    while (tmp.firstChild) sdlgMessages.appendChild(tmp.firstChild);
    sdlgMessages.scrollTo({ top: sdlgMessages.scrollHeight, behavior: 'smooth' });
  }

  // ── Native turn ─────────────────────────────────────────────────
  function showNativeTurn(exchange) {
    const name    = nativeName();
    const initial = name.charAt(0).toUpperCase();
    appendToMessages(`
      <div class="sdlg-bubble sdlg-bubble-native">
        <div class="sdlg-speaker-row">
          <div class="sdlg-avatar">${escapeHTML(initial)}</div>
          <span class="sdlg-speaker-name">${escapeHTML(name)}</span>
          <button class="sdlg-speak-btn" data-text="${escapeHTML(exchange.italian)}" aria-label="Pronuncia">🔊</button>
        </div>
        <div class="sdlg-it">${escapeHTML(exchange.italian)}</div>
        <div class="sdlg-en">${escapeHTML(exchange.english)}</div>
      </div>`);

    // Auto-play
    setTimeout(() => { if (window.ponteSpeak) window.ponteSpeak(exchange.italian); }, 300);

    // Action: Next
    if (sdlgActionArea) {
      sdlgActionArea.innerHTML = '';
      const btn = document.createElement('button');
      btn.className = 'sdlg-next-btn';
      btn.textContent = 'Next →';
      btn.addEventListener('click', () => advanceToExchange(sdlgCurrentIdx + 1));
      sdlgActionArea.appendChild(btn);
    }
  }

  // ── User turn ───────────────────────────────────────────────────
  function showUserTurn(exchange, idx) {
    appendToMessages(`<div class="sdlg-your-turn-row"><span class="sdlg-your-turn-label">Your turn:</span></div>`);
    if (sdlgMode === 'mc') {
      showMCOptions(exchange, idx);
    } else {
      showTypeIt(exchange, idx);
    }
  }

  function showMCOptions(exchange, idx) {
    if (!sdlgActionArea) return;
    const correct  = exchange.italian;
    const rawOpts  = (Array.isArray(exchange.options) && exchange.options.length >= 4)
      ? exchange.options.slice(0, 4)
      : [correct, 'Non lo so.', 'Va bene.', 'Grazie.'];

    // Shuffle options (correct is rawOpts[0] from API)
    const shuffled = [...rawOpts].sort(() => Math.random() - 0.5);
    const letters  = ['A', 'B', 'C', 'D'];

    sdlgActionArea.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'sdlg-mc-wrap';

    shuffled.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'sdlg-mc-btn';
      btn.innerHTML = `<span class="sdlg-mc-letter">${letters[i]}</span><span class="sdlg-mc-text">${escapeHTML(opt)}</span>`;
      btn.addEventListener('click', () => handleMCAnswer(opt, correct, exchange, idx));
      wrap.appendChild(btn);
    });
    sdlgActionArea.appendChild(wrap);
  }

  function handleMCAnswer(chosen, correct, exchange, idx) {
    const isRight = chosen === correct;

    // Lock all buttons + mark correct/wrong
    sdlgActionArea.querySelectorAll('.sdlg-mc-btn').forEach((b) => {
      b.disabled = true;
      const text = b.querySelector('.sdlg-mc-text').textContent;
      if (text === correct)    b.classList.add('sdlg-mc-correct');
      else if (text === chosen && !isRight) b.classList.add('sdlg-mc-wrong');
    });

    sdlgUserResults.push({ idx, italian: exchange.italian, english: exchange.english, correct: isRight });
    updateProgressBar();

    // Play correct answer audio
    setTimeout(() => { if (window.ponteSpeak) window.ponteSpeak(correct); }, 200);

    // Show user's response bubble
    appendToMessages(`
      <div class="sdlg-bubble sdlg-bubble-user ${isRight ? 'sdlg-bubble-user-ok' : 'sdlg-bubble-user-err'}">
        <div class="sdlg-it">${escapeHTML(isRight ? chosen : correct)}</div>
        ${!isRight ? `<div class="sdlg-en sdlg-correction">✓ ${escapeHTML(correct)}</div>` : ''}
      </div>`);

    if (isRight) {
      setTimeout(() => advanceToExchange(sdlgCurrentIdx + 1), 1500);
    } else {
      const nextBtn = document.createElement('button');
      nextBtn.className = 'sdlg-next-btn sdlg-next-after-wrong';
      nextBtn.textContent = 'Next →';
      nextBtn.addEventListener('click', () => advanceToExchange(sdlgCurrentIdx + 1));
      sdlgActionArea.appendChild(nextBtn);
    }
  }

  function showTypeIt(exchange, idx) {
    if (!sdlgActionArea) return;
    sdlgActionArea.innerHTML = '';

    const wrap   = document.createElement('div');
    wrap.className = 'sdlg-typeit-wrap';
    const input  = document.createElement('input');
    input.type        = 'text';
    input.className   = 'sdlg-typeit-input';
    input.placeholder = 'Scrivi in italiano…';
    input.autocomplete = 'off';
    input.autocorrect  = 'off';
    input.autocapitalize = 'off';
    input.spellcheck   = false;
    const submit = document.createElement('button');
    submit.className   = 'sdlg-typeit-submit';
    submit.textContent = '→';
    wrap.appendChild(input);
    wrap.appendChild(submit);
    sdlgActionArea.appendChild(wrap);
    input.focus();

    function handleSubmit() {
      const text = input.value.trim();
      if (!text) return;
      const isRight = fuzzyMatch(text, exchange.italian);
      input.disabled  = true;
      submit.disabled = true;

      sdlgUserResults.push({ idx, italian: exchange.italian, english: exchange.english, correct: isRight });
      updateProgressBar();

      setTimeout(() => { if (window.ponteSpeak) window.ponteSpeak(exchange.italian); }, 200);

      appendToMessages(`
        <div class="sdlg-bubble sdlg-bubble-user ${isRight ? 'sdlg-bubble-user-ok' : 'sdlg-bubble-user-err'}">
          <div class="sdlg-it">${escapeHTML(text)}</div>
          ${!isRight ? `<div class="sdlg-en sdlg-correction">✓ ${escapeHTML(exchange.italian)}</div>` : ''}
        </div>`);

      if (isRight) {
        setTimeout(() => advanceToExchange(sdlgCurrentIdx + 1), 1500);
      } else {
        sdlgActionArea.innerHTML = '';
        const nextBtn = document.createElement('button');
        nextBtn.className   = 'sdlg-next-btn sdlg-next-after-wrong';
        nextBtn.textContent = 'Next →';
        nextBtn.addEventListener('click', () => advanceToExchange(sdlgCurrentIdx + 1));
        sdlgActionArea.appendChild(nextBtn);
      }
    }

    submit.addEventListener('click', handleSubmit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); } });
  }

  // ── Fuzzy match ─────────────────────────────────────────────────
  function normalize(s) {
    return s.toLowerCase().trim().replace(/[.,!?;:]/g, '').replace(/\s+/g, ' ');
  }

  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = [];
    for (let i = 0; i <= m; i++) { dp[i] = [i]; }
    for (let j = 0; j <= n; j++) { dp[0][j] = j; }
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[m][n];
  }

  function fuzzyMatch(input, correct) {
    const a = normalize(input), b = normalize(correct);
    if (a === b) return true;
    return levenshtein(a, b) <= Math.max(2, Math.floor(b.length * 0.12));
  }

  // ── Mode toggle ─────────────────────────────────────────────────
  function updateModeToggleLabel() {
    if (!sdlgModeToggle) return;
    sdlgModeToggle.textContent = sdlgMode === 'mc' ? '⌨ Type-it' : '☰ Multiple choice';
    sdlgModeToggle.classList.toggle('active', sdlgMode === 'typeit');
  }

  if (sdlgModeToggle) {
    sdlgModeToggle.addEventListener('click', () => {
      sdlgMode = sdlgMode === 'mc' ? 'typeit' : 'mc';
      updateModeToggleLabel();
    });
  }

  // ── Exit ────────────────────────────────────────────────────────
  if (sdlgExitBtn) {
    sdlgExitBtn.addEventListener('click', () => {
      showSdlgScreen('setup');
      if (sdlgGenerateBtn) {
        sdlgGenerateBtn.textContent = 'Generate dialogue →';
        sdlgGenerateBtn.disabled = !sdlgSelectedScen;
      }
    });
  }

  // ── Speak button delegation ─────────────────────────────────────
  if (sdlgMessages) {
    sdlgMessages.addEventListener('click', (e) => {
      const btn = e.target.closest('.sdlg-speak-btn');
      if (btn && window.ponteSpeak) window.ponteSpeak(btn.dataset.text);
    });
  }

  // ── End screen ──────────────────────────────────────────────────
  function showEndScreen() {
    const total   = sdlgUserResults.length;
    const correct = sdlgUserResults.filter((r) => r.correct).length;
    const pct     = total > 0 ? Math.round((correct / total) * 100) : 0;
    const color   = pct >= 80 ? '#2E6B3E' : pct >= 50 ? '#CC6600' : '#B83232';

    if (sdlgEndScore) {
      sdlgEndScore.innerHTML = `
        <div class="sdlg-score-circle" style="border-color:${color};color:${color}">
          <span class="sdlg-score-num">${correct}/${total}</span>
          <span class="sdlg-score-pct">${pct}%</span>
        </div>`;
    }

    const missed = sdlgUserResults.filter((r) => !r.correct);
    if (sdlgEndPhrases) {
      if (missed.length > 0) {
        sdlgEndPhrases.innerHTML = `
          <h3 class="sdlg-end-phrases-heading">Phrases to review</h3>
          ${missed.map((r) => `
            <div class="sdlg-end-phrase">
              <div class="sdlg-end-phrase-it">${escapeHTML(r.italian)}</div>
              <div class="sdlg-end-phrase-en">${escapeHTML(r.english)}</div>
            </div>`).join('')}`;
      } else {
        sdlgEndPhrases.innerHTML = '<p class="sdlg-end-perfect">✓ Perfetto! No phrases to review.</p>';
      }
    }

    if (sdlgSaveBtn) sdlgSaveBtn.hidden = missed.length === 0;
    showSdlgScreen('end');
  }

  // ── Save missed to flashcards ────────────────────────────────────
  if (sdlgSaveBtn) {
    sdlgSaveBtn.addEventListener('click', () => {
      let cards = [];
      try { cards = JSON.parse(localStorage.getItem(FC_KEY) || '[]'); } catch (_) { cards = []; }

      const missed  = sdlgUserResults.filter((r) => !r.correct);
      const srcTag  = `Scripted: ${sdlgSelectedScen ? sdlgSelectedScen.italian : 'Dialogue'}`;
      let saved = 0;

      missed.forEach((r, i) => {
        const dup = cards.some((c) => c.italian === r.italian && (c.sourceArticle || '').startsWith('Scripted'));
        if (!dup) {
          cards.push({
            id:            Date.now() + i,
            italian:       r.italian,
            english:       r.english,
            spanish:       '',
            category:      'new',
            note:          '',
            savedAt:       new Date().toISOString(),
            sourceArticle: srcTag,
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
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(cards),
        }).catch(() => {});
        window.dispatchEvent(new CustomEvent('ponte:flashcard-saved'));
      }

      sdlgSaveBtn.textContent = saved > 0
        ? `Saved ${saved} card${saved !== 1 ? 's' : ''} ✓`
        : 'Already saved';
      sdlgSaveBtn.disabled = true;
    });
  }

  // ── Retry / New scenario ─────────────────────────────────────────
  if (sdlgRetryBtn) {
    sdlgRetryBtn.addEventListener('click', () => {
      if (sdlgDialogue) startPlayer();
    });
  }

  if (sdlgNewBtn) {
    sdlgNewBtn.addEventListener('click', () => {
      sdlgDialogue = null;
      showSdlgScreen('setup');
      if (sdlgGenerateBtn) {
        sdlgGenerateBtn.textContent = 'Generate dialogue →';
        sdlgGenerateBtn.disabled = !sdlgSelectedScen;
      }
    });
  }

  // Init scripted
  renderScriptedScenarios();

  // ═══════════════════════════════════════════════════════════════
  // FREE CONVERSATION MODULE (existing, unchanged)
  // ═══════════════════════════════════════════════════════════════

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
  let selectedScenario = null;
  let history          = [];
  let allErrors        = [];
  let currentScenario  = '';
  let exchangeCount    = 0;
  let isLoading        = false;

  // ── Scenario grid ─────────────────────────────────────────────────────────
  function renderScenarios() {
    if (!scenarioGrid) return;
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
    scenarioGrid.querySelectorAll('.conv-scenario-card').forEach((c) => c.classList.remove('selected'));
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
      if (userText !== null) { exchangeCount++; updateCounter(); }
      if (history.length > MAX_HISTORY) {
        history = history.slice(history.length - MAX_HISTORY);
      }
      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify({
          scenario: currentScenario, history, allErrors, exchangeCount,
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
    try { cards = JSON.parse(localStorage.getItem(FC_KEY) || '[]'); } catch (_) { cards = []; }
    let saved = 0;
    allErrors.forEach((err, i) => {
      const italian = extractItalianFromError(err) || `Nota ${i + 1}`;
      const dup = cards.some(
        (c) => c.italian === italian && c.sourceArticle && c.sourceArticle.startsWith('Conversation')
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
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  });

  newConvBtn.addEventListener('click', () => {
    localStorage.removeItem(SESSION_KEY);
    showScreen('setup');
  });

  backBtn.addEventListener('click', () => {
    localStorage.removeItem(SESSION_KEY);
    showScreen('setup');
  });

  // ── Init free ─────────────────────────────────────────────────────────────
  renderScenarios();

})();
