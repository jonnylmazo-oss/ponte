# Ponte — CLAUDE.md

## Overview
Ponte is a vanilla HTML/CSS/JS Italian reading app for English speakers who know Spanish. Color-coded word intelligence (cognate / false-friend / divergence / new) and tooltip cards help Spanish speakers leverage vocabulary overlap. No frameworks, no build step.

## Architecture

| Layer | Detail |
|-------|--------|
| Backend | Node.js/Express, `server.js`, port 3001, PM2 `ponte-api` |
| Frontend | Static files served by nginx from `/home/ponte/` |
| Data | `/home/ponte/data/flashcards.json` |
| Config | `/root/ponte.env` — `ANTHROPIC_API_KEY`, `PORT=3001`, `PONTE_PASSWORD`, `PONTE_SESSION_SECRET`, `FLASHCARDS_PATH` |
| Model | `claude-sonnet-4-20250514` |
| Prod | `198.199.88.229` (DigitalOcean Ubuntu 24.04) |
| nginx config | `/etc/nginx/sites-available/ponte` → symlinked to `sites-enabled/default` |

**Deploy:** `git add . && git commit -m "..." && git push && ssh root@198.199.88.229 "cd /home/ponte && bash deploy.sh"`
(deploy.sh: `git pull && npm install --production && pm2 restart ponte-api`)

**Local dev:** `npm start` (backend :3001) + `python3 -m http.server 8080` (frontend :8080)

## File map

```
index.html         single-page UI
utils.js           window.ponteEsc HTML escaping (loaded first)
app.js             reader, tooltips, article generator, flashcard save, auth
false-friends.js   False Friends + Safe Cognates tab IIFE
grammar.js         Grammar tab IIFE (4-stage + drills + weak areas)
flashcards.js      Cards tab IIFE (library + SM-2 drill)
practice.js        Practice tab IIFE
dictionary.js      Translate tab IIFE
conversation.js    Conversation tab IIFE
progress.js        Progress Dashboard IIFE
style.css          Kindle sepia design system
server.js          Express API
data/
  articles.js      fallback article ("Una mattina a Roma")
  wordmap.js       static wordmap for fallback article
  false-friends.js 100 false friend entries
  safe-cognates.js 200 safe cognate entries
  grammar.js       45 grammar cards + 30 pattern drills
```

Script load order: `utils.js` → `data/*.js` → `app.js` → `false-friends.js` → `grammar.js` → `flashcards.js` → `practice.js` → `dictionary.js` → `conversation.js`

## Features

- **Reader** — SSE article generation, color-coded words, hover/tap tooltip, dynamic text-select translation, EN column toggle, post-reading quiz, Recent ▾ history
- **False Friends** — 100 false friend cards + 200 safe cognates; search/filter/drill per sub-tab
- **Grammar** — 4-stage learning path (45 cards), 30 pattern drills, weak areas panel fed by error tracking
- **Practice** — fill-in-the-blank (Multiple Choice / Type It / Sentence Rebuild); saves missed words to flashcards
- **Conversation** — Scripted Dialogue (MC or Type-it against native speaker) + Free Conversation chat with error feedback
- **Cards** — SM-2 spaced repetition; standard + reverse drill; fullscreen mode; word lookup modal (IT↔EN); cross-device sync
- **Translate** — bidirectional IT↔EN lookup + Usage Checker (AI grammar feedback)
- **Progress** — stats overview, card breakdown by category/status, weak areas, 7-day activity chart, quiz trend

## API endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/generate-article-stream` | SSE article generation |
| POST | `/api/generate-article-full` | Full article JSON (fallback) |
| POST | `/api/translate` | IT→EN word + metadata |
| POST | `/api/translate-to-italian` | EN→IT translation |
| POST | `/api/grammar-examples` | 3 extra grammar card examples |
| POST | `/api/generate-practice` | 8 practice sentences |
| POST | `/api/check-sentence` | Score free-recall sentence |
| POST | `/api/generate-dialogue` | Scripted dialogue JSON |
| POST | `/api/conversation` | Free conversation reply + feedback |
| POST | `/api/reading-quiz` | 5 comprehension questions |
| POST | `/api/detect-patterns` | Grammar error pattern detection |
| POST | `/api/check-usage` | Italian sentence usage check |
| GET | `/api/flashcards` | Load deck (auth required) |
| POST | `/api/flashcards` | Save deck (auth required) |
| POST | `/api/login` | Password → Bearer token |

## Security

- `.env` at `/root/ponte.env` — outside web root, never served by nginx
- nginx blocks dotfiles: `location ~ /\. { deny all; }`
- Flashcard endpoints require `Authorization: Bearer <token>` (HMAC-SHA256 of password + secret)
- Auth disabled if `PONTE_PASSWORD` env var not set
- Change password: edit `/root/ponte.env` → `pm2 restart ponte-api --update-env`

## Key localStorage keys

| Key | Purpose |
|-----|---------|
| `ponte_flashcards` | Flashcard deck array |
| `ponte_tab` | Active tab |
| `ponte_article_{topic}_{difficulty}` | Cached generated articles |
| `ponte_xlat_{text}` | Cached dynamic translations |
| `ponte_error_patterns` | Grammar error counts for weak areas |
| `ponte_quiz_scores` | Quiz history (max 20) |
| `ponte_grammar_viewed` | Viewed grammar card IDs |
| `ponte_drill_position` | Mid-session drill resume state |
| `ponte_auth_token` | Bearer token for flashcard API |
| `ponte_recent_topics` | Last 10 article topics (surprise dedup) |
| `ponte_drill_reverse` | Drill direction toggle state |
| `ponte_pending_sync` | Flag to retry failed server sync |

## Flashcard card structure

```js
{
  id, italian, english, spanish, category, note,
  wordType,           // noun|verb|adjective|adverb|phrase|other
  baseForm,           // dictionary/infinitive form
  baseFormEN,         // English meaning of base form
  example, exampleEN, // usage sentence + translation
  nounNumber,         // singular|plural (nouns only)
  nounOtherForm,      // opposite number form (nouns only)
  savedAt, sourceArticle,
  timesCorrect, timesWrong, lastDrilled,
  interval, easeFactor, dueDate, reviewCount, lastReviewed,
  grammarPatterns,    // array of pattern keys for error tracking
}
```

Category values: `cognate` | `false-friend` | `divergence` | `new`

## Theme (Kindle sepia)

CSS variables: `--bg: #F8F1E3`, `--bg-card: #FBF5E9`, `--bg-italian: #F0E6D0`, `--border: #D9C9A8`, `--text: #3B2D1F`, `--text-mid: #6B5744`, `--text-dim: #9B8470`, accent `#0055AA`
Category colors: cognate `#2E6B3E`, false-friend `#B83232`, divergence `#B85C00`

## Design rules

- **No frameworks, no build step** — vanilla HTML/CSS/JS only
- **iOS Safari nav:** use inline `onclick`/`ontouchend` on nav/modal buttons — `addEventListener` unreliable on fixed-position elements; `ontouchend` returns `false` to suppress the subsequent click event
- **Service worker:** bump `CACHE_NAME` in `sw.js` after every frontend change (current: `ponte-v69`)
- **Flashcard save guard:** never POST empty array — triple-guarded (app.js + flashcards.js + server.js returns 409)
- **HTML escaping:** use `window.ponteEsc` everywhere — no local duplicates
- **IIFE globals:** expose needed functions on `window` (e.g. `window.switchTab`, `window.ponteSpeak`, `window._ponteFCRender`, `window._ponteProgressRender`, `window.toggleNavGroup`)
- **Translation column:** always collapsed on page load and on each new article — state never restored from localStorage
- **Fallback article:** `articles[0]` loads only on generation error, not on init

## Open issues

| # | Title | Priority |
|---|-------|----------|
| #3 | Article difficulty filter | P2 |
| #7 | Shadowing mode (blocked by #36) | P1 |
| #8 | Weak word tracker | P2 |
| #11 | Onboarding flow | P3 |
| #13 | Mobile layout polish | P3 |
| #14 | Public false friend SEO page | P3 |
| #17 | HTTPS + domain for full PWA installability | P2 |
| #18 | Flashcard images via Unsplash | P2 |
| #26 | Classic literature content category | P1 |
| #27 | Cognate categorization guardrails in prompts | P2 |
| #34 | Cultural context layer in Reader | P2 |
| #35 | Weekly learning mission | P2 |
| #36 | Native audio per article | P2 |
| #37 | Pronunciation lab (blocked by #36) | P3 |
| #38 | Collaborative deck sharing | P3 |
