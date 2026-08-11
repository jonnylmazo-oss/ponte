// Audio session player — standalone panel, opened from the Cards toolbar.
//
// Plays through window.ponteBuildAudioQueue() hands-free. Per card:
//   italian → english gloss → example sentence → each chunk (it, then en)
//   → example sentence again → next card
//
// All speech goes through window.ponteSpeech (app.js). No SpeechSynthesis
// calls live here: this module only chains utterances via onend and reads the
// module's generation counter to tell "we finished" apart from "something else
// took the channel".
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const IT = 'it-IT';
  const EN = 'en-US';

  // Pauses between utterances. A longer beat when the language switches gives
  // the ear a moment to reset; longer still between cards.
  const GAP_MS      = 260;
  const GAP_LANG_MS = 420;
  const GAP_CARD_MS = 700;

  const panel = $('ap-panel');
  if (!panel) return; // panel not in the DOM

  const backdrop   = $('ap-backdrop');
  const stageIdle  = $('ap-stage-idle');
  const stagePlay  = $('ap-stage-play');
  const stageDone  = $('ap-stage-done');
  const apStatus   = $('ap-status');
  const apPlayBtn  = $('ap-play-btn');
  const apProgress = $('ap-progress');
  const apWord     = $('ap-word');
  const apGloss    = $('ap-gloss');
  const apNow      = $('ap-now');
  const apSegLabel = $('ap-seg-label');
  const apNote     = $('ap-note');
  const apPauseBtn = $('ap-pause-btn');
  const apDoneSub  = $('ap-done-sub');

  // ── State ────────────────────────────────────────────────────────────────
  let queue    = [];    // [{ card, audioScript }]
  let qIndex   = 0;
  let segments = [];    // segments for the current card
  let sIndex   = 0;
  let running  = false;
  let paused   = false;
  let gapTimer = null;

  // Bumped whenever we deliberately move on (stop, skip, pause, new session).
  // Every scheduled callback captures it and bails if it has changed, so a
  // late onend from a cancelled utterance can't resurrect a dead sequence.
  let runToken = 0;

  // The speech generation this player last claimed. Compared against the live
  // counter to detect that another module took the channel — checked both when
  // an utterance settles AND before starting the next one, because the gap
  // between phrases (260-700ms) is easily wide enough for a flip-card tap to
  // land in, and there is no in-flight utterance to notice it there.
  let ownedGen = -1;

  function speechAPI() { return window.ponteSpeech || null; }

  function claimChannel() {
    const api = speechAPI();
    ownedGen = api && api.generation ? api.generation() : 0;
  }

  // ── Segments ─────────────────────────────────────────────────────────────
  function segmentsFor(entry) {
    const c = entry.card || {};
    const out = [
      { text: c.italian, lang: IT, label: 'Word' },
      { text: c.english, lang: EN, label: 'Meaning' },
      { text: c.example, lang: IT, label: 'Sentence' },
    ];
    (entry.audioScript || []).forEach((chunk, i) => {
      out.push({ text: chunk.it, lang: IT, label: 'Phrase ' + (i + 1) });
      out.push({ text: chunk.en, lang: EN, label: 'Phrase ' + (i + 1) });
    });
    out.push({ text: c.example, lang: IT, label: 'Sentence again' });
    return out.filter((s) => s.text && String(s.text).trim());
  }

  // ── Rendering ────────────────────────────────────────────────────────────
  function showStage(name) {
    if (stageIdle) stageIdle.hidden = name !== 'idle';
    if (stagePlay) stagePlay.hidden = name !== 'play';
    if (stageDone) stageDone.hidden = name !== 'done';
  }

  function setStatus(msg) {
    if (!apStatus) return;
    apStatus.textContent = msg || '';
    apStatus.hidden = !msg;
  }

  function setNote(msg) {
    if (!apNote) return;
    apNote.textContent = msg || '';
    apNote.hidden = !msg;
  }

  function renderCard() {
    const entry = queue[qIndex];
    if (!entry) return;
    const c = entry.card || {};
    if (apProgress) apProgress.textContent = `Card ${qIndex + 1} of ${queue.length}`;
    if (apWord)  apWord.textContent  = c.italian || '';
    if (apGloss) apGloss.textContent = c.english || '';
  }

  function renderSegment(seg) {
    if (apNow) {
      apNow.textContent = seg.text;
      apNow.className = 'ap-now' + (seg.lang === EN ? ' ap-now-en' : '');
    }
    if (apSegLabel) apSegLabel.textContent = seg.label;
  }

  function renderControls() {
    if (apPauseBtn) apPauseBtn.textContent = paused ? '▶ Resume' : '⏸ Pause';
  }

  // ── Playback ─────────────────────────────────────────────────────────────
  function clearGap() {
    if (gapTimer) { clearTimeout(gapTimer); gapTimer = null; }
  }

  // Cancel in-flight audio and invalidate pending callbacks, without changing
  // whether a session is considered active.
  function halt() {
    clearGap();
    runToken++;
    const api = speechAPI();
    if (api && api.cancel) api.cancel();
  }

  function loadCard() {
    segments = segmentsFor(queue[qIndex]);
    sIndex = 0;
    renderCard();
  }

  function playSegment() {
    if (!running || paused) return;
    if (sIndex >= segments.length) { nextCard(); return; }

    const api = speechAPI();
    if (!api || !api.supported) { advance(); return; }

    // Someone else spoke while we were between phrases.
    if (ownedGen >= 0 && api.generation() !== ownedGen) { preempted(); return; }

    const seg = segments[sIndex];
    renderSegment(seg);

    const myRun = runToken;
    const utt   = api.speak(seg.text, { lang: seg.lang });
    if (!utt) { advance(); return; }

    // Captured AFTER speak(), which increments it.
    ownedGen = api.generation();
    const myGen = ownedGen;

    function settle() {
      if (myRun !== runToken) return;        // we already moved on ourselves
      if (api.generation() !== myGen) {      // someone else spoke — yield
        preempted();
        return;
      }
      advance();
    }

    // A cancelled utterance reports 'end' on some browsers and 'error' on
    // others, so both routes run the same ownership check.
    utt.onend   = settle;
    utt.onerror = settle;
  }

  function advance() {
    const prev = segments[sIndex];
    sIndex++;
    const next = segments[sIndex];
    const gap = !next ? GAP_CARD_MS
              : (prev && prev.lang !== next.lang ? GAP_LANG_MS : GAP_MS);

    const myRun = runToken;
    clearGap();
    gapTimer = setTimeout(() => {
      gapTimer = null;
      if (myRun !== runToken) return;
      playSegment();
    }, gap);
  }

  function nextCard() {
    qIndex++;
    if (qIndex >= queue.length) { complete(); return; }
    loadCard();
    playSegment();
  }

  // Another module called ponteSpeak (a flip-card, a tooltip, the reader).
  // Stop our chain but do NOT cancel — that would cut off their audio.
  function preempted() {
    clearGap();
    paused = true;
    renderControls();
    setNote('Paused — audio was played elsewhere. Press Resume to pick up from this phrase.');
  }

  function complete() {
    halt();
    running = false;
    paused  = false;
    const n = queue.length;
    if (apDoneSub) apDoneSub.textContent = `${n} card${n === 1 ? '' : 's'} played.`;
    showStage('done');
  }

  // ── Public controls ──────────────────────────────────────────────────────
  window.ponteAudioOpen = function () {
    if (backdrop) backdrop.hidden = false;
    panel.hidden = false;
    if (!running) { showStage('idle'); setStatus(''); }
    return false;
  };

  window.ponteAudioClose = function () {
    halt();
    running = false;
    paused  = false;
    panel.hidden = true;
    if (backdrop) backdrop.hidden = true;
    return false;
  };

  window.ponteAudioStart = function () {
    if (typeof window.ponteBuildAudioQueue !== 'function') {
      setStatus('Audio queue is unavailable on this screen.');
      return false;
    }
    const api = speechAPI();
    if (!api || !api.supported) {
      setStatus('This browser does not support speech synthesis.');
      return false;
    }

    // Back to idle so the status line is visible while building — this can
    // also be triggered from the "Play another session" button on the done
    // stage, where #ap-status would otherwise be hidden.
    showStage('idle');
    setStatus('Building session…');
    if (apPlayBtn) apPlayBtn.disabled = true;

    window.ponteBuildAudioQueue()
      .then((built) => {
        if (apPlayBtn) apPlayBtn.disabled = false;
        if (!built || !built.length) {
          setStatus('No cards are ready for an audio session right now.');
          return;
        }
        queue   = built;
        qIndex  = 0;
        paused  = false;
        running = true;
        setStatus('');
        setNote('');
        halt();          // clear anything already speaking before we take over
        claimChannel();
        loadCard();
        renderControls();
        showStage('play');
        playSegment();
      })
      .catch((err) => {
        if (apPlayBtn) apPlayBtn.disabled = false;
        setStatus('Could not load audio scripts: ' + (err && err.message ? err.message : 'unknown error'));
      });

    return false;
  };

  // Pause cancels rather than using speechSynthesis.pause(), which is
  // unreliable on iOS Safari. Resume therefore replays the current phrase from
  // its start — which is what you want when listening to a language anyway.
  window.ponteAudioPause = function () {
    if (!running) return false;
    if (paused) {
      paused = false;
      setNote('');
      renderControls();
      claimChannel();   // re-take the channel, incl. after being preempted
      playSegment();
    } else {
      paused = true;
      halt();
      renderControls();
    }
    return false;
  };

  window.ponteAudioSkip = function () {
    if (!running) return false;
    halt();
    claimChannel();
    setNote('');
    paused = false;
    renderControls();
    qIndex++;
    if (qIndex >= queue.length) { complete(); return false; }
    loadCard();
    playSegment();
    return false;
  };

  window.ponteAudioStop = function () {
    halt();
    running = false;
    paused  = false;
    showStage('idle');
    setStatus('');
    return false;
  };

  // Hide the entry point entirely where speech isn't available.
  document.addEventListener('DOMContentLoaded', () => {
    const api = speechAPI();
    const btn = $('fc-audio-btn');
    if (btn && (!api || !api.supported)) btn.hidden = true;
  });
})();
