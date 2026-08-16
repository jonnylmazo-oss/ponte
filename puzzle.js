// ── "Complete the Picture" puzzle mechanic (#82) ───────────────────────────
// Drilling earns puzzle pieces; pieces reveal tiles of a named landmark
// collection (data/collections.js). Two triggers, both evaluated by a
// session-end scan (no drill-internals modified):
//   1. A word crosses the strong tier (cardAccuracy ≥ 0.8, the app's
//      existing definition) with ≥ 4 graded answers, for the FIRST time —
//      1 piece. The ≥4 guard stops two lucky "Easy" taps from minting a
//      piece (the rush-to-unlock failure mode accuracy-gating exists to
//      prevent); the awarded set is permanent, so oscillating accuracy
//      can't re-award.
//   2. Every 5 first-reviews (reviewCount 0 → 1+) across both decks —
//      1 piece, with remainder banked so no session is wasted.
// Both the main drill and Visual cards count; audio sessions write no stats
// and therefore (deliberately) grant nothing.
//
// FIRST-RUN BASELINE: on an existing deck, every already-strong word is
// seeded into the awarded set WITHOUT pieces and the learned-count watermark
// starts at the current total — pieces only flow from progress made after
// install, otherwise a mature deck would instantly complete every collection.
//
// Isolation discipline (same as the visual deck): state lives ONLY in
// ponte_puzzle (+ _bak snapshot); this module reads deck stats from
// localStorage and NEVER writes cards or calls /api/flashcards — verified by
// network monitoring in the e2e suite.
(function () {
  'use strict';

  const KEY = 'ponte_puzzle';
  const BAK = 'ponte_puzzle_bak';
  const COLS = 4, ROWS = 3, PIECES = COLS * ROWS;   // 4×3 tile grid on 3:2 art
  const NEW_WORDS_PER_PIECE = 5;

  const $ = (id) => document.getElementById(id);
  const esc = window.ponteEsc || ((s) => String(s));
  const collections = () => (Array.isArray(window.PONTE_COLLECTIONS) ? window.PONTE_COLLECTIONS : []);

  // ── State ────────────────────────────────────────────────────────────────
  function loadState() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      return s && typeof s === 'object' && !Array.isArray(s) ? s : null;
    } catch (_) { return null; }
  }

  let backedUp = false;
  function saveState(state) {
    const existing = loadState();
    if (existing) {
      // Monotonic fields merge as unions so a stale in-memory copy can
      // update but never silently drop earned progress.
      state.awardedStrong = [...new Set([...(existing.awardedStrong || []), ...state.awardedStrong])];
      state.completed = [...new Set([...(existing.completed || []), ...state.completed])];
      const t = existing.tiles || {};
      Object.keys(t).forEach((cid) => {
        state.tiles[cid] = [...new Set([...(t[cid] || []), ...(state.tiles[cid] || [])])];
      });
      if (!backedUp) {
        try { localStorage.setItem(BAK, JSON.stringify(existing)); } catch (_) { /* best-effort */ }
        backedUp = true;
      }
    }
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) { /* quota */ }
    return state;
  }

  // ── Deck scanning (read-only) ────────────────────────────────────────────
  // Namespaced ids so a main-deck card and a visual entry can never collide.
  function gatherRecords() {
    const recs = [];
    try {
      const deck = JSON.parse(localStorage.getItem('ponte_flashcards')) || [];
      deck.forEach((c) => recs.push({
        id: 'fc:' + c.id,
        tc: c.timesCorrect || 0, tw: c.timesWrong || 0, rc: c.reviewCount || 0,
      }));
    } catch (_) { /* unreadable deck — scan what we can */ }
    try {
      const vs = JSON.parse(localStorage.getItem('ponte_visual_srs')) || {};
      Object.keys(vs).forEach((k) => {
        const r = vs[k] || {};
        recs.push({ id: 'vc:' + k, tc: r.timesCorrect || 0, tw: r.timesWrong || 0, rc: r.reviewCount || 0 });
      });
    } catch (_) { /* ditto */ }
    return recs;
  }

  // Same formula as flashcards.js's cardAccuracy (exposed as
  // window.ponteCardAccuracy); local fallback keeps the module standalone.
  function accuracy(rec) {
    if (window.ponteCardAccuracy) {
      return window.ponteCardAccuracy({ timesCorrect: rec.tc, timesWrong: rec.tw });
    }
    const total = rec.tc + rec.tw;
    return total === 0 ? null : rec.tc / total;
  }

  const isStrongEnough = (rec) =>
    (rec.tc + rec.tw) >= 4 && (accuracy(rec) ?? 0) >= 0.8;

  // ── Collection helpers ───────────────────────────────────────────────────
  function activeCollection(state) {
    return collections().find((c) => !state.completed.includes(c.id)) || null;
  }

  function revealTiles(state, pieces) {
    // Returns { revealed: n, completions: [collection, …] } and mutates state.
    const out = { revealed: 0, completions: [] };
    while (pieces > 0) {
      const col = activeCollection(state);
      if (!col) break;                              // every collection done — bank nothing, stop
      const have = state.tiles[col.id] || (state.tiles[col.id] = []);
      const hidden = [];
      for (let i = 0; i < PIECES; i++) if (!have.includes(i)) hidden.push(i);
      if (!hidden.length) { state.completed.push(col.id); continue; }
      have.push(hidden[Math.floor(Math.random() * hidden.length)]);
      out.revealed++; pieces--;
      if (have.length === PIECES) {
        state.completed.push(col.id);
        out.completions.push(col);
      }
    }
    return out;
  }

  // ── Evaluation (runs at every session end) ───────────────────────────────
  function evaluate() {
    const recs = gatherRecords();
    const learnedTotal = recs.filter((r) => r.rc >= 1).length;
    let state = loadState();

    if (!state) {
      // First run: baseline, award nothing (see header comment).
      state = {
        tiles: {}, completed: [],
        awardedStrong: recs.filter(isStrongEnough).map((r) => r.id),
        bank: 0, learnedWatermark: learnedTotal,
      };
      saveState(state);
      return null;
    }

    const awarded = new Set(state.awardedStrong);
    const newStrong = recs.filter((r) => isStrongEnough(r) && !awarded.has(r.id));
    newStrong.forEach((r) => state.awardedStrong.push(r.id));

    const delta = Math.max(0, learnedTotal - (state.learnedWatermark ?? learnedTotal));
    state.learnedWatermark = learnedTotal;
    state.bank = (state.bank || 0) + delta;
    const fromLearning = Math.floor(state.bank / NEW_WORDS_PER_PIECE);
    state.bank -= fromLearning * NEW_WORDS_PER_PIECE;

    const pieces = newStrong.length + fromLearning;
    const result = revealTiles(state, pieces);
    saveState(state);

    if (result.revealed || result.completions.length) {
      window.dispatchEvent(new CustomEvent('ponte:puzzle-updated'));
      const col = activeCollection(state);
      return {
        pieces: result.revealed,
        mastered: newStrong.length,
        learnedPieces: fromLearning,
        completions: result.completions,
        active: col,
        have: col ? (state.tiles[col.id] || []).length : PIECES,
      };
    }
    return null;
  }

  // ── Earn-moment slot on the drill done screens ───────────────────────────
  function fillEarnSlot(slotId, summary) {
    const el = $(slotId);
    if (!el) return;
    if (!summary) { el.innerHTML = ''; return; }
    const parts = [];
    summary.completions.forEach((c) => {
      parts.push(`<div class="puzzle-earned puzzle-earned--complete">🎉 Collection complete: <strong>${esc(c.name)}</strong></div>`);
    });
    if (summary.pieces && summary.active) {
      parts.push(`<div class="puzzle-earned">🧩 +${summary.pieces} piece${summary.pieces !== 1 ? 's' : ''} — <strong>${esc(summary.active.name)}</strong> (${summary.have}/${PIECES})</div>`);
    } else if (summary.pieces && !summary.active) {
      parts.push(`<div class="puzzle-earned">🧩 +${summary.pieces} piece${summary.pieces !== 1 ? 's' : ''}</div>`);
    }
    el.innerHTML = parts.join('');
  }

  window.addEventListener('ponte:drill-session-ended', () => {
    fillEarnSlot('fc-puzzle-earned', evaluate());
  });
  window.addEventListener('ponte:vc-session-ended', () => {
    fillEarnSlot('vc-puzzle-earned', evaluate());
  });

  // ── Progress-tab card ────────────────────────────────────────────────────
  function tileHTML(col, revealedSet, i) {
    const r = Math.floor(i / COLS), c = i % COLS;
    if (!revealedSet.has(i)) return `<div class="puzzle-tile puzzle-tile--hidden"></div>`;
    // 4×3 grid over one image: oversize the background and offset per tile.
    const px = COLS > 1 ? (c * 100) / (COLS - 1) : 0;
    const py = ROWS > 1 ? (r * 100) / (ROWS - 1) : 0;
    return `<div class="puzzle-tile" style="background-image:url('${esc(col.img)}');` +
      `background-size:${COLS * 100}% ${ROWS * 100}%;background-position:${px}% ${py}%"></div>`;
  }

  window._pontePuzzleCardHTML = function () {
    const state = loadState();
    const cols = collections();
    if (!cols.length) return '';
    if (!state) { evaluate(); }                     // ensure baseline exists
    const s = loadState();
    if (!s) return '';
    const active = activeCollection(s);

    const doneShelf = s.completed
      .map((id) => cols.find((c) => c.id === id))
      .filter(Boolean)
      .map((c) => `<img class="puzzle-shelf-img" src="${esc(c.img)}" alt="${esc(c.nameEN)}" title="${esc(c.name)}">`)
      .join('');

    let body;
    if (active) {
      const revealed = new Set(s.tiles[active.id] || []);
      const tiles = Array.from({ length: PIECES }, (_, i) => tileHTML(active, revealed, i)).join('');
      const toNext = NEW_WORDS_PER_PIECE - (s.bank || 0);
      body = `
        <div class="puzzle-title">${esc(active.name)} <span class="puzzle-title-en">${esc(active.nameEN)}</span></div>
        <div class="puzzle-grid">${tiles}</div>
        <div class="puzzle-meta">${revealed.size} / ${PIECES} pieces · next piece: master a word, or ${toNext} more new word${toNext !== 1 ? 's' : ''}</div>`;
    } else {
      body = `<div class="puzzle-meta">All collections complete — more are on the way. 🎉</div>`;
    }
    return `
      <section class="puzzle-card">
        <div class="puzzle-label">Collezione</div>
        ${body}
        ${doneShelf ? `<div class="puzzle-shelf"><span class="puzzle-shelf-label">Completed:</span>${doneShelf}</div>` : ''}
      </section>`;
  };

  // Baseline on load so the first drill of a fresh install doesn't award
  // retroactive credit for the whole pre-existing deck.
  if (!loadState()) evaluate();
})();
