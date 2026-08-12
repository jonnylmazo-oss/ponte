# Ponte — CLAUDE.md

## Overview
Ponte is a vanilla HTML/CSS/JS Italian reading app for English speakers who know Spanish. Color-coded word intelligence (cognate / false-friend / divergence / new) and tooltip cards help Spanish speakers leverage vocabulary overlap. No frameworks, no build step.

## Architecture

| Layer | Detail |
|-------|--------|
| Hosting | **Vercel** (static frontend + serverless functions, same domain) |
| Backend (prod) | Vercel serverless functions in `/api/*.js`; shared helpers in `lib/ponte.js` |
| Backend (local dev) | Legacy `server.js` (Express, port 3000) — kept for reference, not deployed |
| Frontend | Static files served from repo root by Vercel |
| Data | **Upstash Redis** (`@upstash/redis`) — key `flashcards` (deck), `flashcards_bak` (backup) |
| Config | env vars (Vercel dashboard / local `.env`) — see `.env.example` |
| Model | `claude-sonnet-4-6` |

**Deploy:** `git push` (Vercel auto-deploys the connected `jonnylmazo-oss/ponte` repo), or `vercel --prod` from the CLI. Node version pinned to 20.x via `package.json` `engines`. Env vars set manually in the Vercel dashboard: `ANTHROPIC_API_KEY`, `PONTE_PASSWORD`, `PONTE_SESSION_SECRET`. The Upstash/KV vars (`KV_REST_API_URL`, `KV_REST_API_TOKEN`) are auto-provisioned by the Vercel↔Upstash integration — the code reads those exact names. `server.js` + `backfill.js` are excluded from the deployment via `.vercelignore` (source-only, not imported by any function); `lib/ponte.js` is NOT excluded — functions import it, so Node File Trace must be able to bundle it.

**Local dev:** `npm start` (legacy Express backend :3000) + `python3 -m http.server 8080` (frontend :8080). Note: local flashcard persistence uses the legacy file-based `server.js`; the Upstash Redis path only runs in the deployed functions (or via `vercel dev` with the `KV_REST_API_URL` / `KV_REST_API_TOKEN` env vars set).

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
mission.js         Weekly Mission IIFE (must load before progress.js)
progress.js        Progress Dashboard IIFE
style.css          Kindle sepia design system
server.js          Legacy Express API (local dev reference only — prod uses /api)
api/               9 Vercel serverless functions (Hobby 12-fn cap): 5 standalone
                   (translate, flashcards [Upstash Redis], generate-article-stream,
                   conversation, generate-dialogue) + 4 *-combined dispatch-by-?action=
                   (translate-, practice-, feedback-, auth-combined)
lib/
  ponte.js         Shared helpers for /api (Anthropic client, auth guards,
                   buildPrompt, sanitizeUserText, parseArticleJSON, …)
vercel.json        Vercel config (function maxDuration; static + /api auto-routed)
.env.example       Placeholder env vars for local dev / Vercel dashboard
data/
  articles.js      fallback article ("Una mattina a Roma")
  wordmap.js       static wordmap for fallback article
  false-friends.js 100 false friend entries
  safe-cognates.js 200 safe cognate entries
  grammar.js       45 grammar cards + 30 pattern drills
```

Script load order: `utils.js` → `data/*.js` → `app.js` → `false-friends.js` → `grammar.js` → `flashcards.js` → `practice.js` → `dictionary.js` → `conversation.js` → `mission.js` → `progress.js` → `deep-dive.js`

## Features

- **Reader** — SSE article generation, color-coded words, hover/tap tooltip, dynamic text-select translation, EN column toggle, post-reading quiz, Recent ▾ history
- **False Friends** — 100 false friend cards + 200 safe cognates; search/filter/drill per sub-tab
- **Grammar** — 4-stage learning path (45 cards), 30 pattern drills, weak areas panel fed by error tracking
- **Practice** — fill-in-the-blank (Multiple Choice / Type It / Sentence Rebuild); saves missed words to flashcards
- **Conversation** — Scripted Dialogue (MC or Type-it against native speaker) + Free Conversation chat with error feedback
- **Cards** — SM-2 spaced repetition; bidirectional drill (IT→EN / EN→IT, picked in setup screen, mid-session toggle in topbar); drill subset picker (Due today default + All / word types / Weak words, with live (N) counts respecting active library filters); fullscreen mode; word lookup modal (IT↔EN); cross-device sync; library filter+sort bar (Performance / Word Type / Category / Source / Sort + Clear all)
- **Translate** — bidirectional IT↔EN lookup + Usage Checker (AI grammar feedback)
- **Progress** — stats overview, card breakdown by category/status, weak areas, 7-day activity chart, quiz trend, weekly learning mission
- **Deep dive** (`deep-dive.js`) — explore any Italian word: all senses first, then per-sense example sentences, then optional etymology; opened standalone (More → Deep dive) or from a flashcard's drill flip-card back (`window.ponteDeepDive(word)`); "Save to Cards" saves the primary sense only (keeps the card lean)

## API endpoints

Deployed as **9 Vercel serverless functions** (Hobby plan caps at 12). Five endpoints keep their own file; the rest are merged into four `*-combined` functions that dispatch on a `?action=` query param. Frontend calls the combined path+action directly (`API_BASE` is `''` in prod).

| Function file | Method | Path (as called) | Purpose |
|---------------|--------|------------------|---------|
| `generate-article-stream.js` | GET | `/api/generate-article-stream` | SSE article generation |
| `translate.js` | POST | `/api/translate` | IT→EN word + metadata |
| `conversation.js` | POST | `/api/conversation` | Free conversation reply + feedback |
| `generate-dialogue.js` | POST | `/api/generate-dialogue` | Scripted dialogue JSON |
| `flashcards.js` | GET/POST | `/api/flashcards` | Load/save deck (auth required) |
| `translate-combined.js` | POST | `/api/translate-combined?action=translate-to-italian` | EN→IT translation |
| " | POST | `/api/translate-combined?action=grammar-examples` | 3 extra grammar card examples |
| `practice-combined.js` | POST | `/api/practice-combined?action=generate-practice` | 8 practice sentences (auth) |
| " | POST | `/api/practice-combined?action=check-sentence` | Score free-recall sentence |
| " | POST | `/api/practice-combined?action=distractors` | Cloze distractor options |
| `feedback-combined.js` | POST | `/api/feedback-combined?action=check-usage` | Italian sentence usage check |
| " | POST | `/api/feedback-combined?action=detect-patterns` | Grammar error pattern detection |
| " | POST | `/api/feedback-combined?action=reading-quiz` | 5 comprehension questions |
| " | POST | `/api/feedback-combined?action=deep-dive` | Word deep-dive: all senses → per-sense examples → etymology |
| `auth-combined.js` | POST | `/api/auth-combined?action=login` | Password → Bearer token |
| " | POST | `/api/auth-combined?action=backfill-flashcards` | Backfill baseForm (auth) |

Note: the old non-streaming `/api/generate-article-full` fallback was removed (no frontend caller; the reader uses the SSE stream). Shared logic lives in `lib/ponte.js`.

## Security

- `.env` holds secrets — keep it outside any future web root and never serve it (host TBD; when a reverse proxy is added, block dotfile requests, e.g. nginx `location ~ /\. { deny all; }`)
- Server fails-fast at startup if `PONTE_SESSION_SECRET` is unset or equals `dev-secret-change-me`
- User free-text is passed through `sanitizeUserText()` before entering any Claude prompt template (strips control chars/newlines, neutralizes code fences, caps length) — mitigates prompt injection
- `Authorization: Bearer <token>` (HMAC-SHA256 of password + secret) required on:
  - flashcard GET/POST
  - generation endpoints: `/api/generate-article-full`, `/api/generate-practice`, `/api/generate-dialogue`, `/api/conversation`
- SSE endpoint `/api/generate-article-stream` accepts the same token via `?token=` query param (EventSource cannot send headers)
- Unauthenticated endpoints (kept open for now): `/api/translate`, `/api/translate-to-italian`, `/api/check-usage`, `/api/check-sentence`, `/api/distractors`, `/api/grammar-examples`, `/api/reading-quiz`, `/api/detect-patterns`
- Flashcard POST: in-memory write lock returns 409 on concurrent attempts; rejects shrinks > 10% unless `{ override: true }`
- Auth disabled if `PONTE_PASSWORD` env var not set
- Change password: edit `.env` → restart the server (`npm start`)

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
| `ponte_drill_position_it-en` | Mid-session resume state — IT→EN drills (independent of EN→IT) |
| `ponte_drill_position_en-it` | Mid-session resume state — EN→IT drills (independent of IT→EN) |
| `ponte_auth_token` | Bearer token for flashcard API |
| `ponte_recent_topics` | Last 10 article topics (surprise dedup) |
| `ponte_drill_direction` | Drill direction (`'it-en'` or `'en-it'`); legacy `ponte_drill_reverse` boolean read as fallback |
| `ponte_pending_sync` | Flag to retry failed server sync |
| `ponte_weekly_mission` | Weekly mission state `{ week, mission, progress, completed }` |
| `ponte_sidebar` | Desktop sidebar collapsed/expanded state (`'1'`/`'0'`) |
| `ponte_conversation_session` | Free Conversation session state (scenario + message history) |
| `ponte_dict_history` | Translate tab recent lookup history |
| `ponte_ff_drill` | False Friends drill progress/position |
| `ponte_sc_drill` | Safe Cognates drill progress/position |
| `ponte_last_learn` | Last active sub-tab within the Learn nav group |
| `ponte_last_more` | Last active sub-tab within the More nav group |
| `ponte_last_practice` | Last active sub-tab within the Practice nav group |
| `ponte_translation` | Reader translation column open/closed toggle (`'1'`/`'0'`) |
| `ponte_audio_rate` | Audio session Italian speech rate (0.55–1.05, default 0.78); English derives as +0.15 |
| `ponte_audio_session` | Audio session length (`'15'`/`'25'`/`'40'`/`'all'`, default `'25'`) |

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

Category values (taxonomy): `same` | `similar` | `false-friend` | `new`
UI labels: same → "Same word", similar → "Same/Similar", false-friend → "False Friend", new → "No Spanish link". Never use the word "cognate" in taxonomy UI (the separate "Safe Cognates" curated tab is unrelated and keeps its name). The grammar-error-pattern keys (`divergence`, `false-friend`, …) are a **separate** namespace — not renamed.

## Theme (Kindle sepia)

CSS variables: `--bg: #F8F1E3`, `--bg-card: #FBF5E9`, `--bg-italian: #F0E6D0`, `--border: #D9C9A8`, `--text: #3B2D1F`, `--text-mid: #6B5744`, `--text-dim: #9B8470`, accent `#0055AA`
Category colors: same `#2E6B3E` (green), similar `#0E7490` (teal), false-friend `#B83232` (red), new `#888888` (grey). CSS vars `--same`, `--similar`, `--false-friend`.

## Design rules

- **No frameworks, no build step** — vanilla HTML/CSS/JS only
- **iOS Safari nav:** use inline `onclick`/`ontouchend` on nav/modal buttons — `addEventListener` unreliable on fixed-position elements; `ontouchend` returns `false` to suppress the subsequent click event
- **Service worker:** bump `CACHE_NAME` in `sw.js` after every frontend change (current: `ponte-v82`)
- **Cards library filters:** all single-select (5 dropdowns), AND-combined; `cardAccuracy()` returns `null` for never-drilled cards (sorted last); `getCardSource()` maps `sourceArticle` strings → `starter`/`reader`/`practice`/`scripted`/`conversation`/`manual`; "Mastered" filter uses `interval > 21`
- **Flashcard save guard:** never POST empty array — triple-guarded (app.js + flashcards.js + server.js returns 409)
- **HTML escaping:** use `window.ponteEsc` everywhere — no local duplicates
- **IIFE globals:** expose needed functions on `window` (e.g. `window.switchTab`, `window.ponteSpeak`, `window._ponteFCRender`, `window._ponteProgressRender`, `window.toggleNavGroup`)
- **Translation column:** always collapsed on page load and on each new article — state never restored from localStorage
- **Fallback article:** `articles[0]` loads only on generation error, not on init

## Open issues

| # | Title | Priority |
|---|-------|----------|
| #3 | Article difficulty filter | P2 |
| #7 | Shadowing mode (blocked by #36) | P2 |
| #8 | Weak word tracker (reader-tap) | P2 |
| #11 | Onboarding flow | P3 |
| #13 | Mobile layout polish | P3 |
| #14 | Public false friend SEO page | P3 |
| #17 | HTTPS + domain for full PWA installability | P2 |
| #18 | Flashcard images via Unsplash | P2 |
| #26 | Classic literature content category | P1 |
| #34 | Cultural context layer in Reader | P2 |
| #36 | Native audio per article | P2 |
| #37 | Pronunciation lab (blocked by #36) | P3 |
| #38 | Collaborative deck sharing | P3 |
| #55 | Mobile touch targets below 44px | P2 |
| #56 | 100vh → 100dvh for fullscreen drill | P2 |
| #57 | Wire up PATTERN_TO_GRAMMAR map | P3 |
| #58 | Mission 4 double-counts re-saves | P3 |
