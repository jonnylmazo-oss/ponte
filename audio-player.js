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
  // Marks the structural shift from the whole sentence to the phrase-by-phrase
  // breakdown. ~2.6x the language-switch gap, so it reads as a section break
  // rather than a breath, without needing a second cue tone there.
  const GAP_SECTION_MS = 1100;

  // ── Card-boundary tone ────────────────────────────────────────────────────
  // Synthesized per play via Web Audio — no audio asset to ship or cache.
  const TONE_HZ       = 250;    // low "boop"; bright enough to hear, not a ding
  const TONE_PEAK     = 0.08;   // ~-22dB — clearly under the speech
  const TONE_ATTACK_S = 0.012;  // fade-in
  const TONE_HOLD_S   = 0.060;  // full-level hold
  const TONE_END_S    = 0.100;  // total duration; 40ms fade-out
  const TONE_LEAD_MS  = 150;    // silence between the tone and the first word

  // At 250Hz one wave cycle is 4ms, so a 2-3ms fade would cut the waveform
  // mid-cycle and click — the exact artefact a fade is meant to avoid. 12ms in
  // / 40ms out is still imperceptible as a fade but spans several full cycles,
  // and the longer release is what makes it read as soft rather than blippy.

  // ── Settings (persisted locally; deliberately not synced) ─────────────────
  const LS_RATE    = 'ponte_audio_rate';
  const LS_SESSION = 'ponte_audio_session';

  const RATE_MIN = 0.55;
  const RATE_MAX = 1.25;
  const RATE_STEP = 0.05;
  // Retuned for the ElevenLabs voice. 0.78 was chosen to make the robotic Web
  // Speech voice intelligible; a natural voice at that rate sounds sluggish and
  // drunk. 0.95 is just under native pace — still deliberate enough for a
  // learner, without the artefacts.
  const RATE_DEFAULT = 0.95;
  // The slider is one number but the two engines interpret it differently:
  // playbackRate 1.0 is "as recorded", Web Speech 1.0 is that engine's own
  // normal. This factor keeps the fallback path sounding like the 0.78 it was
  // tuned at when the slider sits at the new 0.95 default.
  const WEB_SPEECH_RATE_FACTOR = 0.82;

  const SESSION_LENGTHS = ['15', '25', '40', 'all'];
  const SESSION_DEFAULT = '25';

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

  // True once the current card's boundary tone has played. Reset per card in
  // loadCard(), which runs on start / next / skip but never on resume — so
  // resuming mid-card does not re-chime.
  let toneDone = false;

  function speechAPI() { return window.ponteSpeech || null; }

  // ── Pre-rendered audio ────────────────────────────────────────────────────
  // ONE element for the whole session, created lazily inside the Play gesture
  // and reused by swapping .src. iOS blocks play() on an element that was not
  // created during a user gesture, so a per-segment element would work on
  // desktop and silently fail on the phone.
  let audioEl = null;

  function getAudioEl() {
    if (audioEl) return audioEl;
    try { audioEl = new Audio(); audioEl.preload = 'auto'; }
    catch (_) { audioEl = null; }
    return audioEl;
  }

  function stopAudioEl() {
    if (!audioEl) return;
    audioEl.onended = null;
    audioEl.onerror = null;
    try { audioEl.pause(); } catch (_) {}
  }

  // Set while we are the ones claiming the channel, so our own announcement
  // does not read as someone else preempting us.
  let claimingSelf = false;

  // Anything we do that emits a claim must run inside this, or our own
  // announcement bounces back through the listener and preempts us.
  function selfClaimed(fn) {
    claimingSelf = true;
    try { return fn(); } finally { claimingSelf = false; }
  }

  function claim() {
    selfClaimed(() => {
      try {
        const api = speechAPI();
        if (api && api.announceClaim) api.announceClaim('audio-player');
        else window.dispatchEvent(new CustomEvent('ponte:speech-claimed', { detail: { source: 'audio-player' } }));
      } catch (_) {}
    });
  }

  // A flip-card, tooltip or the reader started speaking — yield rather than
  // talk over them. Works across both engines, unlike the generation counter.
  window.addEventListener('ponte:speech-claimed', (e) => {
    if (claimingSelf) return;
    const src = e && e.detail && e.detail.source;
    if (src === 'audio-player') return;
    if (!running || paused) return;
    preempted();
  });

  // ── Settings ─────────────────────────────────────────────────────────────
  function clampRate(v) {
    return Math.min(RATE_MAX, Math.max(RATE_MIN, Math.round(v / RATE_STEP) * RATE_STEP));
  }

  function loadRate() {
    const v = parseFloat(localStorage.getItem(LS_RATE));
    return Number.isFinite(v) ? clampRate(v) : RATE_DEFAULT;
  }

  function loadSessionLength() {
    const v = localStorage.getItem(LS_SESSION);
    return SESSION_LENGTHS.indexOf(v) !== -1 ? v : SESSION_DEFAULT;
  }

  let rate          = loadRate();
  let sessionLength = loadSessionLength();

  // One user-facing speed. Italian takes it directly — it is the language
  // being learned. English is the gloss, so it tracks a little faster and
  // never drops below 0.75, keeping it close to its original 0.95.
  // English is the gloss, so it runs slightly faster — but +0.15 on top of a
  // natural voice was too brisk, so the offset is trimmed to +0.10.
  function rateFor(lang) {
    if (lang === EN) return Math.min(1.15, Math.max(0.75, rate + 0.10));
    return rate;
  }

  // Web Speech needs the value rescaled; blob audio uses it as playbackRate.
  function webSpeechRateFor(lang) {
    return Math.max(0.1, rateFor(lang) * WEB_SPEECH_RATE_FACTOR);
  }

  // ── Tone ─────────────────────────────────────────────────────────────────
  let audioCtx = null;

  function getAudioCtx() {
    if (audioCtx) return audioCtx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    try { audioCtx = new Ctx(); } catch (_) { audioCtx = null; }
    return audioCtx;
  }

  // iOS creates the context suspended and only lets a user gesture resume it,
  // so this is called from the Play handler.
  function primeAudio() {
    const ctx = getAudioCtx();
    if (ctx && ctx.state === 'suspended' && ctx.resume) ctx.resume().catch(() => {});
  }

  function playCardTone() {
    const ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended' && ctx.resume) ctx.resume().catch(() => {});
    try {
      const t    = ctx.currentTime;
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(TONE_HZ, t);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(TONE_PEAK, t + TONE_ATTACK_S);
      gain.gain.setValueAtTime(TONE_PEAK, t + TONE_HOLD_S);
      gain.gain.linearRampToValueAtTime(0, t + TONE_END_S);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + TONE_END_S + 0.02);
    } catch (_) {
      // The tone is decorative — never let it break playback.
    }
  }

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
      // gapAfter rides on the segment rather than an index, so it stays
      // correct when an empty field is filtered out below.
      { text: c.example, lang: IT, label: 'Sentence', gapAfter: GAP_SECTION_MS },
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
    // Disabled rather than wrapping to the end: on the first card there is no
    // previous, and a disabled control says so more clearly than a tap that
    // silently does nothing.
    const prevBtn = $('ap-prev-btn');
    if (prevBtn) prevBtn.disabled = qIndex <= 0;
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

  function renderSettings() {
    const label = rate.toFixed(2) + '×';
    const slider  = $('ap-rate');
    const idleVal = $('ap-rate-val');
    const playVal = $('ap-speed-val');
    if (slider && String(slider.value) !== String(rate)) slider.value = rate;
    if (idleVal) idleVal.textContent = label;
    if (playVal) playVal.textContent = label;

    const presets = document.querySelectorAll('.ap-preset');
    for (let i = 0; i < presets.length; i++) {
      const on = presets[i].getAttribute('data-len') === sessionLength;
      presets[i].classList.toggle('active', on);
      presets[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
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
    stopAudioEl();
    selfClaimed(() => {
      const api = speechAPI();
      if (api && api.cancel) api.cancel();
    });
  }

  function loadCard() {
    segments = segmentsFor(queue[qIndex]);
    sIndex   = 0;
    toneDone = false;
    renderCard();
  }

  function playSegment() {
    if (!running || paused) return;
    if (sIndex >= segments.length) { nextCard(); return; }

    const api = speechAPI();

    // Someone else spoke while we were between phrases. Only meaningful for
    // the Web Speech path; the claim event covers the pre-rendered one.
    if (api && api.supported && ownedGen >= 0 && api.generation() !== ownedGen) { preempted(); return; }

    // Card-boundary cue, once per card, ahead of the first phrase. Scheduling
    // the first utterance through gapTimer means the pending tone inherits the
    // runToken guard, so stop/skip/pause cancel it correctly.
    if (sIndex === 0 && !toneDone) {
      toneDone = true;
      playCardTone();
      const toneRun = runToken;
      clearGap();
      gapTimer = setTimeout(() => {
        gapTimer = null;
        if (toneRun !== runToken) return;
        playSegment();
      }, TONE_LEAD_MS);
      return;
    }

    const seg = segments[sIndex];
    renderSegment(seg);

    // Prefer the pre-rendered ElevenLabs render; fall back to Web Speech for
    // any text that has no blob yet (cards saved since the last backfill).
    const entry = queue[qIndex] || {};
    const pre   = entry.audioUrls && entry.audioUrls[seg.text];
    if (pre && pre.url) { playPreRendered(seg, pre.url); return; }
    playSynthesized(seg, api);
  }

  function playPreRendered(seg, url) {
    const el = getAudioEl();
    if (!el) { playSynthesized(seg, speechAPI()); return; }

    const myRun = runToken;
    claim();
    stopAudioEl();
    el.src = url;
    // Assign after .src — some browsers reset playbackRate when the source
    // changes. This is the slider value used directly: 1.0 is as-recorded.
    el.playbackRate = rateFor(seg.lang);

    const bail = () => {
      if (myRun !== runToken) return;
      // A dead or unreachable URL must degrade, not end the session.
      playSynthesized(seg, speechAPI());
    };
    el.onended = () => { if (myRun === runToken) advance(); };
    el.onerror = bail;

    const p = el.play();
    if (p && typeof p.catch === 'function') p.catch(bail);
  }

  function playSynthesized(seg, api) {
    if (!api || !api.supported) { advance(); return; }

    const myRun = runToken;
    // Rescaled: the slider is calibrated for playbackRate, not Web Speech.
    const utt = selfClaimed(() =>
      api.speak(seg.text, { lang: seg.lang, rate: webSpeechRateFor(seg.lang) }));
    if (!utt) { advance(); return; }

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
    let gap;
    if (!next)                                gap = GAP_CARD_MS;
    else if (prev && prev.gapAfter)           gap = prev.gapAfter;
    else if (prev && prev.lang !== next.lang) gap = GAP_LANG_MS;
    else                                      gap = GAP_MS;

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
    stopAudioEl();
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
  // Speed changes apply from the next phrase — an utterance's rate is fixed
  // once it starts speaking, and restarting the current phrase mid-word is
  // more disruptive than waiting a couple of seconds.
  window.ponteAudioSetRate = function (value) {
    const v = parseFloat(value);
    if (!Number.isFinite(v)) return false;
    rate = clampRate(v);
    localStorage.setItem(LS_RATE, String(rate));
    renderSettings();
    return false;
  };

  window.ponteAudioNudgeRate = function (direction) {
    return window.ponteAudioSetRate(rate + (direction < 0 ? -RATE_STEP : RATE_STEP));
  };

  window.ponteAudioSetLength = function (value) {
    if (SESSION_LENGTHS.indexOf(String(value)) === -1) return false;
    sessionLength = String(value);
    localStorage.setItem(LS_SESSION, sessionLength);
    renderSettings();
    return false;
  };

  window.ponteAudioOpen = function () {
    if (backdrop) backdrop.hidden = false;
    panel.hidden = false;
    renderSettings();
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

    // Must happen inside the user gesture — iOS will not resume an
    // AudioContext outside one, and the tone would silently never sound.
    primeAudio();

    const cap = sessionLength === 'all' ? 'all-due' : parseInt(sessionLength, 10);

    window.ponteBuildAudioQueue({ cap })
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
        renderSettings();
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

  // Replay the current card's whole script from the top — tone included,
  // because loadCard() resets toneDone. Queue position is unchanged.
  window.ponteAudioRestartCard = function () {
    if (!running) return false;
    halt();
    claimChannel();
    setNote('');
    paused = false;
    renderControls();
    loadCard();
    playSegment();
    return false;
  };

  window.ponteAudioPrevCard = function () {
    if (!running || qIndex <= 0) return false;
    halt();
    claimChannel();
    setNote('');
    paused = false;
    renderControls();
    qIndex--;
    loadCard();
    playSegment();
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
