# Ponte — CLAUDE.md

## What this is
Ponte is a vanilla HTML/CSS/JS Italian reading web app for intermediate English speakers who also know Spanish. Color-coded word intelligence (cognate / false-friend / divergence / new) and tooltip cards help Spanish speakers leverage structural vocabulary overlap when learning Italian.

## Project layout
```
ponte/
├── index.html          — single-page reader UI
├── app.js              — reader logic: tokenizer, tooltips, generator UI, API calls
├── style.css           — dark-theme design system
├── data/
│   ├── articles.js     — fallback article (articles[0] = "Una mattina a Roma")
│   └── wordmap.js      — static wordmap for the fallback article
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

## Tab navigation
- Left sidebar on desktop: logo at top, collapse toggle (‹/›), 6 nav tabs (icon + label)
- Collapsed sidebar: 54px wide, icon-only; expanded: 200px; state in `localStorage` (`ponte_sidebar`)
- Bottom tab bar on mobile (≤820px): icons + short labels, fixed to bottom (58px)
- Active tab persisted in `localStorage` (`ponte_tab`); 150ms fade-in on switch
- Non-reader tabs show a coming-soon placeholder; Reader tab contains all existing reader UI
- `[data-tab]` attribute on all nav items drives both sidebar and bottom nav; `switchTab(id)` syncs both

## Tooltip system (issue #16)
- Clicking an annotated word shows a tooltip card: word + phonetic pronunciation hint, EN/ES meanings, category badge, usage note, example sentence (IT + EN)
- Tooltip border color is category-matched via `--tooltip-accent` CSS variable set inline by JS
- **Mobile (≤820px):** tooltip is a bottom sheet (slides up, backdrop overlay); tapping backdrop closes it
- Wordmap entries include `pronunciation`, `example`, `exampleEN` fields
- Claude prompt requests these fields for generated articles

## Translation column toggle
- Toggle button in header (▶/◀) collapses/shows the English column
- Default state: **collapsed** (Italian-only view)
- State persisted in `localStorage` under key `ponte_translation`
- On mobile, collapse has no effect — both columns always stack

## Key design decisions
- No frameworks, no build step — intentionally minimal
- Fallback: if backend is unreachable, `articles[0]` (hardcoded) is shown
- Wordmap is built dynamically from `article.words` for generated articles; uses `window.wordmap` (static) for the fallback article
