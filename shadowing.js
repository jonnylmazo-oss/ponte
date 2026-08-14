// Shadowing practice (#7) — dedicated tab (sidebar/More → Shadowing), fully
// usable standalone via its own story picker; the Reader's 🎙️ button
// (Beginner Stories only) is a shortcut into this same tab with that story
// pre-loaded, not a separate feature.
//
// Plays a story's sentences one at a time via Web Speech (not ElevenLabs —
// this needs no pre-rendered audio, so it works for all 20 stories with zero
// extra rendering cost), and lets the learner record themselves via
// MediaRecorder to compare pronunciation/rhythm against the native reading.
// Recordings are ephemeral: kept only in-memory as an object URL for the
// current sentence, never uploaded or persisted — this needs no backend
// changes and no consent/storage story to design around.
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const API_BASE = (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  ) ? 'http://localhost:3000' : '';

  function authHeaders() {
    const token = localStorage.getItem('ponte_auth_token');
    return token ? { Authorization: 'Bearer ' + token } : {};
  }

  const bodyEl = $('shadow-body');
  if (!bodyEl) return; // tab markup not in the DOM

  const storySelect   = $('shadow-story-select');
  const storyStartBtn = $('shadow-story-start-btn');
  const statusEl   = $('shadow-status');
  const progressEl = $('shadow-progress');
  const itEl       = $('shadow-sentence-it');
  const enEl       = $('shadow-sentence-en');
  const playNativeBtn = $('shadow-play-native-btn');
  const recordBtn      = $('shadow-record-btn');
  const playMineBtn    = $('shadow-play-mine-btn');
  const prevBtn    = $('shadow-prev-btn');
  const nextBtn    = $('shadow-next-btn');

  const STORIES = (typeof beginnerStories !== 'undefined') ? beginnerStories : [];
  const LS_LAST = 'ponte_shadow_last_story';

  // ── State ────────────────────────────────────────────────────────────────
  let sentences = [];   // [{it, en}], for the currently-loaded story
  let idx       = 0;
  let storyAudioCache = null; // whole story_audio blob, fetched once per page load

  let mediaStream   = null;
  let recorder      = null;
  let recordedChunks = [];
  let recordedUrl   = null;   // object URL for the current sentence's recording
  let recording     = false;
  let playingBack   = false;  // native OR own-recording playback in progress

  function setStatus(msg) {
    if (!statusEl) return;
    statusEl.textContent = msg || '';
    statusEl.hidden = !msg;
  }

  function speechAPI() { return window.ponteSpeech || null; }
  function mediaSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  }

  // ── Story picker ─────────────────────────────────────────────────────────
  let pickerPopulated = false;
  function populateStoryPicker() {
    if (pickerPopulated || !storySelect || !STORIES.length) return;
    pickerPopulated = true;
    const groups = { A1: [], A2: [] };
    STORIES.forEach((s) => { (groups[s.difficulty] || (groups[s.difficulty] = [])).push(s); });
    storySelect.innerHTML = Object.keys(groups).map((level) => {
      const opts = groups[level].map((s) =>
        `<option value="${window.ponteEsc(s.id)}">${window.ponteEsc(s.title)}</option>`).join('');
      return `<optgroup label="${window.ponteEsc(level)}">${opts}</optgroup>`;
    }).join('');
    const last = localStorage.getItem(LS_LAST);
    if (last && STORIES.some((s) => s.id === last)) storySelect.value = last;
  }

  // Called by app.js's switchTab on every navigation to this tab — idempotent,
  // only the first call actually does anything (matches the window._ponteXxx
  // lazy-render hook pattern progress.js already uses).
  window._ponteShadowingTabInit = function () {
    populateStoryPicker();
  };

  // ── Fetch the verified per-sentence split for one story ────────────────
  async function fetchStorySentences(storyId) {
    if (!storyAudioCache) {
      const resp = await fetch(API_BASE + '/api/flashcards?key=story_audio', { headers: authHeaders() });
      if (!resp.ok) throw new Error('Could not load story data (' + resp.status + ')');
      storyAudioCache = await resp.json();
    }
    const entry = storyAudioCache && storyAudioCache[storyId];
    return (entry && entry.sentences) || [];
  }

  // ── Rendering ────────────────────────────────────────────────────────────
  function resetRecordingState() {
    if (recordedUrl) { URL.revokeObjectURL(recordedUrl); recordedUrl = null; }
    if (playMineBtn) playMineBtn.disabled = true;
    recording = false;
    if (recordBtn) { recordBtn.textContent = '🎙️ Record yourself'; recordBtn.classList.remove('shadow-recording'); }
  }

  function render() {
    const s = sentences[idx];
    if (!s) return;
    if (progressEl) progressEl.textContent = `Sentence ${idx + 1} of ${sentences.length}`;
    if (itEl) itEl.textContent = s.it || '';
    if (enEl) enEl.textContent = s.en || '';
    if (prevBtn) prevBtn.disabled = idx <= 0;
    if (nextBtn) nextBtn.textContent = idx >= sentences.length - 1 ? 'Restart from top ⏮' : 'Next ⏭';
  }

  // ── Native playback ──────────────────────────────────────────────────────
  window.ponteShadowPlayNative = function () {
    const s = sentences[idx];
    const api = speechAPI();
    if (!s || !api || !api.supported) return false;
    if (recording) return false; // don't talk over an active recording
    playingBack = true;
    if (playNativeBtn) playNativeBtn.classList.add('speaking');
    const rate = window.ponteAudioWebSpeechRate ? window.ponteAudioWebSpeechRate() : 0.78;
    const utt = api.speak(s.it, { lang: 'it-IT', rate });
    const done = () => { playingBack = false; if (playNativeBtn) playNativeBtn.classList.remove('speaking'); };
    if (utt) { utt.onend = done; utt.onerror = done; } else done();
    return false;
  };

  // ── Recording ────────────────────────────────────────────────────────────
  window.ponteShadowRecordToggle = async function () {
    if (!mediaSupported()) { setStatus('Recording is not supported in this browser.'); return false; }
    if (recording) {
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      return false;
    }
    // Stop any native playback before grabbing the mic — recording over
    // your own audio output would just capture the native voice back.
    const api = speechAPI();
    if (api && api.cancel) api.cancel();

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      setStatus('Microphone access was denied — allow it in your browser settings to record yourself.');
      return false;
    }

    if (recordedUrl) { URL.revokeObjectURL(recordedUrl); recordedUrl = null; }
    if (playMineBtn) playMineBtn.disabled = true;
    recordedChunks = [];
    try {
      recorder = new MediaRecorder(mediaStream);
    } catch (e) {
      setStatus('Could not start recording on this device.');
      mediaStream.getTracks().forEach((t) => t.stop());
      mediaStream = null;
      return false;
    }
    recorder.ondataavailable = (e) => { if (e.data && e.data.size) recordedChunks.push(e.data); };
    recorder.onstop = () => {
      mediaStream.getTracks().forEach((t) => t.stop());
      mediaStream = null;
      recording = false;
      if (recordBtn) { recordBtn.textContent = '🎙️ Record yourself'; recordBtn.classList.remove('shadow-recording'); }
      if (recordedChunks.length) {
        const blob = new Blob(recordedChunks, { type: recorder.mimeType || 'audio/webm' });
        recordedUrl = URL.createObjectURL(blob);
        if (playMineBtn) playMineBtn.disabled = false;
      }
    };
    recorder.start();
    recording = true;
    setStatus('');
    if (recordBtn) { recordBtn.textContent = '⏹ Stop recording'; recordBtn.classList.add('shadow-recording'); }
    return false;
  };

  window.ponteShadowPlayRecording = function () {
    if (!recordedUrl || playingBack) return false;
    playingBack = true;
    const el = new Audio(recordedUrl);
    const done = () => { playingBack = false; };
    el.onended = done;
    el.onerror = done;
    el.play().catch(done);
    return false;
  };

  // ── Navigation ───────────────────────────────────────────────────────────
  function goTo(newIdx) {
    if (recording && recorder && recorder.state !== 'inactive') recorder.stop();
    const api = speechAPI();
    if (api && api.cancel) api.cancel();
    resetRecordingState();
    idx = Math.max(0, Math.min(sentences.length - 1, newIdx));
    render();
  }

  window.ponteShadowNext = function () {
    goTo(idx >= sentences.length - 1 ? 0 : idx + 1);
    return false;
  };
  window.ponteShadowPrev = function () {
    goTo(idx - 1);
    return false;
  };

  // ── Loading a story into the tab ────────────────────────────────────────
  async function loadStory(storyId, storyTitle) {
    if (recording && recorder && recorder.state !== 'inactive') recorder.stop();
    const api = speechAPI();
    if (api && api.cancel) api.cancel();
    resetRecordingState();
    bodyEl.hidden = true;
    setStatus('Loading “' + (storyTitle || 'story') + '”…');

    try {
      sentences = await fetchStorySentences(storyId);
    } catch (e) {
      setStatus('Could not load shadowing sentences: ' + (e && e.message ? e.message : 'unknown error'));
      return;
    }
    if (!sentences.length) {
      setStatus('No sentence data available for this story yet.');
      return;
    }
    idx = 0;
    setStatus('');
    bodyEl.hidden = false;
    localStorage.setItem(LS_LAST, storyId);
    render();
  }

  storyStartBtn && storyStartBtn.addEventListener('click', () => {
    if (!storySelect || !storySelect.value) return;
    const story = STORIES.find((s) => s.id === storySelect.value);
    loadStory(storySelect.value, story && story.title);
  });
  storySelect && storySelect.addEventListener('change', () => {
    const story = STORIES.find((s) => s.id === storySelect.value);
    loadStory(storySelect.value, story && story.title);
  });

  // Public: called from the Reader's 🎙️ button (app.js) — switches to this
  // tab (app.js owns switchTab) and pre-loads the story currently open there,
  // rather than duplicating a second entry point outside the tab system.
  window.ponteShadowLoadStory = function (storyId, storyTitle) {
    populateStoryPicker();
    if (storySelect) storySelect.value = storyId;
    loadStory(storyId, storyTitle);
  };

  if (!mediaSupported() && recordBtn) {
    recordBtn.disabled = true;
    recordBtn.title = 'Recording is not supported in this browser';
  }
})();
