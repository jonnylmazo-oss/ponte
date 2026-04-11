# Ponte — CLAUDE.md

## What this is
Ponte is a vanilla HTML/CSS/JS Italian reading web app for intermediate English speakers who also know Spanish. Color-coded word intelligence (cognate / false-friend / divergence / new) and tooltip cards help Spanish speakers leverage structural vocabulary overlap when learning Italian.

## Project layout
```
ponte/
├── index.html          — single-page reader UI
├── app.js              — reader logic: tokenizer, tooltips, generator UI, API calls
├── false-friends.js    — False Friends tab UI IIFE
├── grammar.js          — Grammar tab UI IIFE
├── style.css           — dark-theme design system
├── data/
│   ├── articles.js     — fallback article (articles[0] = "Una mattina a Roma")
│   ├── wordmap.js      — static wordmap for the fallback article
│   ├── false-friends.js — 100 false friend entries
│   └── grammar.js      — 40 delta cards + 30 pattern drills
├── server.js           — Express backend calling Claude API
├── package.json        — Node.js dependencies
└── .env                — API key (never commit — in .gitignore)
```

## Running the backend
```bash
npm install
# Edit .env and set ANTHROPIC_API_KEY=sk-ant-...
npm start              # server on http://localhost:3000
```

Frontend calls `POST http://localhost:3000/api/generate-article` with `{ topic, difficulty }`.

## Running the frontend
No build step. Serve statically:
```bash
python3 -m http.server 8080
# open http://localhost:8080
```

## API
- **Model:** `claude-sonnet-4-20250514`
- **Streaming endpoint:** `GET /api/generate-article-stream?topic=...&difficulty=...`
  - SSE stream: `data: {"token":"..."}` events as Claude generates, then `event: done` with full article JSON
  - Frontend uses `EventSource`; `extractStreamingField(buffer, field)` extracts any JSON string field progressively from the partial buffer
  - Both Italian and translation columns render simultaneously as tokens arrive; title/difficulty/topic badges also update live
  - `max_tokens: 800`, `temperature: 0.8`
- **Fallback endpoint:** `POST /api/generate-article-full` — returns complete JSON in one shot

## Frontend caching
Generated articles are cached in `localStorage` with key `ponte_article_{topic}_{difficulty}`. Clear localStorage to force re-generation.

## False Friends tab (issue #5)
- `data/false-friends.js`: 100 entries with fields: `id`, `italian`, `italianMeaning`, `spanishLookalike`, `spanishMeaning`, `englishMeaning`, `category`, `danger` (high/medium/low), `example`, `exampleEN`, `tip`
- `false-friends.js`: vanilla JS IIFE — search, danger filter, card grid with expand/collapse (grid-template-rows animation), drill mode
- Drill mode: CSS 3D flip, Got it / Tricky queue management, first-try score at end; respects active filter/search
- Script load order: `data/false-friends.js` → `app.js` → `false-friends.js`

## Grammar tab (issue #4)
- `data/grammar.js`: 40 delta cards with fields: `{id, title, category, difficulty, spanish: {label, example, note}, italian: {label, example, note}, trap, tip}`; 30 pattern drills with fields: `{id, grammarCardId, sentence (contains ___), answer, distractors[3], explanation}`
- Categories: tense(10), pronoun(8), subjunctive(6), reflexive(4), preposition(5), geminate(3), modal(4)
- `grammar.js`: vanilla JS IIFE — sub-tab switching (Verb Deltas / Pattern Drills / From Your Reading), category+difficulty filters, expand/collapse card grid (grid-template-rows animation), drill engine with shuffled queue + 4-option MCQ + immediate feedback + progress bar + first-try score
- Script load order: `data/grammar.js` → `app.js` → `grammar.js` (grammar.js loads after app.js)

## Tab navigation
- Left sidebar on desktop: logo at top, collapse toggle (‹/›), 6 nav tabs (icon + label)
- Collapsed sidebar: 54px wide, icon-only; expanded: 200px; state in `localStorage` (`ponte_sidebar`)
- Bottom tab bar on mobile (≤820px): icons + short labels, fixed to bottom (58px)
- Active tab persisted in `localStorage` (`ponte_tab`); 150ms fade-in on switch
- Non-reader tabs show a coming-soon placeholder; Reader tab contains all existing reader UI
- `[data-tab]` attribute on all nav items drives both sidebar and bottom nav; `switchTab(id)` syncs both

## Tooltip system (issue #16)
- **Desktop:** hover on annotated word → tooltip after 200ms; mouse path word→tooltip keeps it open; click pins tooltip (second click unpins); `state.pinnedByClick` flag
- **Mobile:** tap to open, tap backdrop to close (unchanged)
- Tooltip card: word + phonetic pronunciation hint, EN/ES meanings, category badge, usage note, example sentence (IT + EN)
- Tooltip border color is category-matched via `--tooltip-accent` CSS variable set inline by JS
- `populateTooltip(word, entry)` + `revealTooltip()` shared by annotated-word and dynamic-translate paths
- `showTooltipFromEntry(entry, anchorRect)` used by dynamic translation result
- Wordmap entries include `pronunciation`, `example`, `exampleEN` fields
- Claude prompt requests these fields for generated articles

## Dynamic translation
- Selecting any text in the Italian column immediately triggers translation — no button click required
- `selectionchange` event (debounced 300ms) detects stable selections; fires `doTranslate` automatically
- `showTooltipLoading(word, anchorRect)`: tooltip appears instantly with "Translating…", positioned at the selection rect
- When API responds: `showTooltipFromEntry(entry, anchorRect)` updates in place
- `AbortController` cancels in-flight requests when the user changes selection mid-flight
- Selection cleared → tooltip dismisses after 200ms grace period; mousing onto tooltip cancels that timer
- `state.translationMode = true` while translation tooltip is showing — prevents hover-leave from dismissing it
- `activeXlatText` guards against stale results from superseded requests
- Results cached in `localStorage` under key `ponte_xlat_{text}`
- `server.js`: `POST /api/translate` endpoint, `max_tokens: 300`, `temperature: 0.2`

## Translation column toggle
- Toggle button in header (▶/◀) collapses/shows the English column
- Default state: **collapsed** (Italian-only view)
- State persisted in `localStorage` under key `ponte_translation`
- On mobile, collapse has no effect — both columns always stack

## Key design decisions
- No frameworks, no build step — intentionally minimal
- Fallback: if backend is unreachable, `articles[0]` (hardcoded) is shown
- Wordmap is built dynamically from `article.words` for generated articles; uses `window.wordmap` (static) for the fallback article
