// Onboarding flow (#11) — first-run only. Spanish proficiency +
// Italian-exposure placement, then presets the Reader's starting point
// instead of every new user landing on the very first A1 story regardless
// of their actual level.
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const LS_DONE = 'ponte_onboarding_complete';

  const overlay = $('onboard-overlay');
  if (!overlay) return; // markup not in the DOM

  // Signals this browser has used the app before, even if it predates this
  // flag existing — never surprise a returning user with onboarding just
  // because this feature shipped after they'd already started.
  function looksLikeReturningUser() {
    try {
      if (localStorage.getItem(LS_DONE)) return true;
      const fc = JSON.parse(localStorage.getItem('ponte_flashcards') || '[]');
      if (Array.isArray(fc) && fc.length) return true;
      if (localStorage.getItem('ponte_last_story')) return true;
      if (localStorage.getItem('ponte_recent_topics')) return true;
      if (localStorage.getItem('ponte_tab')) return true;
    } catch (_) { /* corrupt localStorage — fall through to showing onboarding */ }
    return false;
  }

  if (looksLikeReturningUser()) {
    try { localStorage.setItem(LS_DONE, '1'); } catch (_) {}
    return; // never render/attach listeners for a returning user
  }

  const steps = [0, 1, 2, 3].map((i) => $('onboard-step-' + i));
  const dots  = Array.from(document.querySelectorAll('.onboard-dot'));
  let step = 0;
  const answers = { spanish: null, italian: null };

  function render() {
    steps.forEach((el, i) => { if (el) el.hidden = i !== step; });
    dots.forEach((d, i) => d.classList.toggle('active', i <= step));
  }

  function goTo(i) {
    step = Math.max(0, Math.min(steps.length - 1, i));
    render();
  }

  function selectOption(groupEl, btn, value, key) {
    Array.from(groupEl.children).forEach((c) => c.classList.remove('selected'));
    btn.classList.add('selected');
    answers[key] = value;
    // Auto-advance shortly after a choice — a placement quiz should feel
    // like a couple of taps, not a form with a separate "Next" click per step.
    setTimeout(() => goTo(step + 1), 220);
  }

  const spanishGroup = $('onboard-spanish-options');
  const italianGroup = $('onboard-italian-options');

  spanishGroup && spanishGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('.onboard-option');
    if (!btn) return;
    selectOption(spanishGroup, btn, btn.getAttribute('data-value'), 'spanish');
  });

  italianGroup && italianGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('.onboard-option');
    if (!btn) return;
    selectOption(italianGroup, btn, btn.getAttribute('data-value'), 'italian');
    computeRecommendation();
  });

  // ── Placement logic ────────────────────────────────────────────────────
  // Italian exposure drives the starting level — actual Italian reading
  // ability is what determines whether a text is readable, not Spanish
  // fluency (Spanish just makes the vocabulary transfer faster once you're
  // reading). Spanish fluency only nudges the upper end: a fluent Spanish
  // speaker who already reads simple Italian text is the one case that
  // reasonably starts at B2 instead of B1.
  function computeRecommendation() {
    const it = answers.italian;
    const es = answers.spanish;
    let level, label;
    if (it === 'lots') {
      level = (es === 'native' || es === 'advanced') ? 'B2' : 'B1';
      label = `Advanced articles, ${level} difficulty`;
    } else if (it === 'little') {
      level = 'A2';
      label = 'Beginner Stories, A2 level';
    } else {
      level = 'A1';
      label = 'Beginner Stories, A1 level';
    }
    const recText = $('onboard-rec-text');
    if (recText) {
      recText.textContent = `Based on your answers, we're starting you at ${label} — you can always switch modes or pick a different story any time from the Reader.`;
    }
    overlay.setAttribute('data-level', level);
  }

  function finish() {
    const level = overlay.getAttribute('data-level') || 'A1';
    if (window.ponteApplyStartingLevel) window.ponteApplyStartingLevel(level);
    try { localStorage.setItem(LS_DONE, '1'); } catch (_) {}
    overlay.hidden = true;
  }

  $('onboard-start-btn') && $('onboard-start-btn').addEventListener('click', () => goTo(1));
  $('onboard-done-btn')  && $('onboard-done-btn').addEventListener('click', finish);
  $('onboard-skip-btn')  && $('onboard-skip-btn').addEventListener('click', finish);

  render();
  overlay.hidden = false;
})();
