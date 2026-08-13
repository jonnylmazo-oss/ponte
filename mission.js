/* ── Weekly Mission ────────────────────────────────────────────────────────
   IIFE — manages weekly learning missions.
   Exposed: window._ponteMissionCardHTML(), window._ponteMissionRender()
   Resets every Monday, persisted in localStorage as ponte_weekly_mission.
*/
(function () {
  'use strict';

  const MISSION_KEY = 'ponte_weekly_mission';
  const FC_KEY      = 'ponte_flashcards';

  const MISSIONS = [
    { id: 1, description: 'Drill 50 flashcards this week',                 target: 50, unit: 'drilled' },
    { id: 2, description: 'Read 5 articles this week',                      target: 5,  unit: 'read' },
    { id: 3, description: 'Complete 3 scripted dialogues this week',        target: 3,  unit: 'completed' },
    { id: 4, description: 'Save 10 new words this week',                    target: 10, unit: 'saved' },
    { id: 5, description: 'Drill your weak words 3 times this week',        target: 3,  unit: 'weak drills' },
    { id: 6, description: 'Achieve 80%+ accuracy in a drill session',       target: 1,  unit: 'session' },
    { id: 7, description: 'Practice 5 sentences in the Practice tab',       target: 5,  unit: 'practiced' },
  ];

  // ── Time helpers ──────────────────────────────────────────────────────────

  function getISOWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const year = d.getUTCFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return year + '-W' + String(week).padStart(2, '0');
  }

  function getMondayISO() {
    const now = new Date();
    const daysBack = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const mon = new Date(now);
    mon.setDate(now.getDate() - daysBack);
    mon.setHours(0, 0, 0, 0);
    return mon.toISOString();
  }

  function daysLeft() {
    const day = new Date().getDay();
    return day === 0 ? 1 : 8 - day;
  }

  // ── State ─────────────────────────────────────────────────────────────────

  function loadState() {
    try { return JSON.parse(localStorage.getItem(MISSION_KEY) || 'null'); }
    catch (e) { return null; }
  }

  function saveState(state) {
    localStorage.setItem(MISSION_KEY, JSON.stringify(state));
  }

  function getOrInit() {
    const week = getISOWeek(new Date());
    let state = loadState();
    if (!state || state.week !== week) {
      const lastId = state && state.mission ? state.mission.id : null;
      const pool = MISSIONS.filter(m => m.id !== lastId);
      const mission = pool[Math.floor(Math.random() * pool.length)];
      state = { week, mission, progress: 0, completed: false };
      saveState(state);
    }
    return state;
  }

  function increment(amount) {
    const state = getOrInit();
    if (state.completed) return state;
    state.progress = Math.min(state.progress + (amount || 1), state.mission.target);
    state.completed = state.progress >= state.mission.target;
    saveState(state);
    return state;
  }

  function setProgress(value) {
    const state = getOrInit();
    if (state.completed) return state;
    const next = Math.min(value, state.mission.target);
    if (next === state.progress) return state; // no change
    state.progress  = next;
    state.completed = state.progress >= state.mission.target;
    saveState(state);
    return state;
  }

  // ── Mission 4: count words saved this week from deck ─────────────────────
  // Dedupe by italian.toLowerCase() (#58): a delete-then-resave of the same
  // word, or saving the same word via two different flows (tooltip + word-
  // lookup modal), each gets a fresh savedAt — without this, one effective
  // word could count twice toward "save 10 new words this week".
  function wordsThisWeek() {
    try {
      const cards = JSON.parse(localStorage.getItem(FC_KEY) || '[]');
      const since = getMondayISO();
      const seen = new Set();
      return cards.filter((c) => {
        if (!c.savedAt || c.savedAt < since) return false;
        const key = (c.italian || '').toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).length;
    } catch (e) { return 0; }
  }

  // ── Mission card HTML ─────────────────────────────────────────────────────
  function missionCardHTML() {
    const { mission, progress, completed } = getOrInit();
    const pct = Math.min(Math.round((progress / mission.target) * 100), 100);
    const left = daysLeft();
    const borderColor = completed ? '#2E6B3E' : '#B85C00';

    const statusHTML = completed
      ? `<span class="mission-status mission-done">✓ Completed</span>`
      : `<span class="mission-status mission-active">${left} day${left !== 1 ? 's' : ''} left</span>`;

    return `
      <section class="mission-card" style="border-left-color:${borderColor}">
        <div class="mission-label">This week's mission</div>
        <div class="mission-desc">${window.ponteEsc(mission.description)}</div>
        <div class="mission-progress-row">
          <div class="mission-track">
            <div class="mission-fill${completed ? ' mission-fill--done' : ''}" style="width:${pct}%"></div>
          </div>
          <span class="mission-count">${progress} / ${mission.target}</span>
        </div>
        ${statusHTML}
      </section>`;
  }

  // ── Trigger progress re-render ────────────────────────────────────────────
  function notifyProgress() {
    window.dispatchEvent(new CustomEvent('ponte:mission-updated'));
  }

  // ── Event listeners ───────────────────────────────────────────────────────

  window.addEventListener('ponte:drill-session-ended', (e) => {
    const state = getOrInit();
    const id = state.mission.id;
    const d  = (e && e.detail) || {};
    let changed = false;
    if      (id === 1 && d.count > 0)           { increment(d.count); changed = true; }
    else if (id === 5 && d.isWeak)              { increment(1);       changed = true; }
    else if (id === 6 && (d.accuracy || 0) >= 80) { setProgress(1);    changed = true; }
    if (changed) notifyProgress();
  });

  window.addEventListener('ponte:article-read', () => {
    if (getOrInit().mission.id === 2) { increment(1); notifyProgress(); }
  });

  window.addEventListener('ponte:dialogue-completed', () => {
    if (getOrInit().mission.id === 3) { increment(1); notifyProgress(); }
  });

  window.addEventListener('ponte:flashcard-saved', () => {
    if (getOrInit().mission.id === 4) setProgress(wordsThisWeek());
    // progress.js also listens to ponte:flashcard-saved and will re-render
  });

  window.addEventListener('ponte:practice-answered', () => {
    if (getOrInit().mission.id === 7) { increment(1); notifyProgress(); }
  });

  // ── Expose ────────────────────────────────────────────────────────────────
  window._ponteMissionCardHTML = missionCardHTML;

  // Initialize on load
  getOrInit();

})();
