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
  - Frontend uses `EventSource`; parses `"italian"` field progressively for live rendering
- **Fallback endpoint:** `POST /api/generate-article-full` — returns complete JSON in one shot

## Frontend caching
Generated articles are cached in `localStorage` with key `ponte_article_{topic}_{difficulty}`. Clear localStorage to force re-generation.

## Key design decisions
- No frameworks, no build step — intentionally minimal
- Fallback: if backend is unreachable, `articles[0]` (hardcoded) is shown
- Wordmap is built dynamically from `article.words` for generated articles; uses `window.wordmap` (static) for the fallback article
