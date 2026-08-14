// Shadowing practice (#7) — Reader → 🎙️ button, Beginner Stories only.
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

  const backdrop = $('shadow-backdrop');
  const panel    = $('shadow-panel');
  if (!panel) return; // panel not in the DOM

  const statusEl   = $('shadow-status');
  const bodyEl     = $('shadow-body');
  const progressEl = $('shadow-progress');
  const itEl       = $('shadow-sentence-it');
  const enEl       = $('shadow-sentence-en');
  const playNativeBtn = $('shadow-play-native-btn');
  const recordBtn      = $('shadow-record-btn');
  const playMineBtn    = $('shadow-play-mine-btn');
  const hintEl     = $('shadow-hint');
  const prevBtn    = $('shadow-prev-btn');
  const nextBtn    = $('shadow-next-btn');

  // ── State ────────────────────────────────────────────────────────────────
  let sentences = [];   // [{it, en}], for the currently-open story
  let idx       = 0;
  let storyAudioCache = null; // whole story_audio blob, fetched once per open

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

  // ── Open / close ─────────────────────────────────────────────────────────
  window.ponteShadowOpen = async function (storyId, storyTitle) {
    if (backdrop) backdrop.hidden = false;
    panel.hidden = false;
    bodyEl && (bodyEl.hidden = true);
    resetRecordingState();
    setStatus('Loading “' + (storyTitle || 'story') + '”…');

    try {
      sentences = await fetchStorySentences(storyId);
    } catch (e) {
      setStatus('Could not load shadowing sentences: ' + (e && e.message ? e.message : 'unknown error'));
      return false;
    }
    if (!sentences.length) {
      setStatus('No sentence data available for this story yet.');
      return false;
    }
    idx = 0;
    setStatus('');
    bodyEl && (bodyEl.hidden = false);
    render();
    return false;
  };

  window.ponteShadowClose = function () {
    if (recording && recorder && recorder.state !== 'inactive') recorder.stop();
    if (mediaStream) { mediaStream.getTracks().forEach((t) => t.stop()); mediaStream = null; }
    const api = speechAPI();
    if (api && api.cancel) api.cancel();
    resetRecordingState();
    panel.hidden = true;
    if (backdrop) backdrop.hidden = true;
    return false;
  };

  if (!mediaSupported() && recordBtn) {
    recordBtn.disabled = true;
    recordBtn.title = 'Recording is not supported in this browser';
  }
})();
