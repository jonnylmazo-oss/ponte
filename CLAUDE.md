# Ponte — CLAUDE.md

## What this is
Ponte is a vanilla HTML/CSS/JS Italian reading web app for intermediate English speakers who also know Spanish. Color-coded word intelligence (cognate / false-friend / divergence / new) and tooltip cards help Spanish speakers leverage structural vocabulary overlap when learning Italian.

## Project layout
```
ponte/
├── index.html          — single-page reader UI
├── app.js              — reader logic: tokenizer, tooltips, generator UI, API calls, flashcard save
├── false-friends.js    — False Friends tab UI IIFE
├── grammar.js          — Grammar tab UI IIFE
├── conversation.js     — Conversation Simulator tab UI IIFE
├── flashcards.js       — Flashcards tab UI IIFE (library + drill)
├── style.css           — Kindle sepia design system
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

## Surprise me (article generator)
- `SURPRISE_TOPICS`: 40 unique topics in `app.js` spanning 9 registers (daily life, food, culture, travel, social, storytelling, humor, formal, emotional)
- `generateArticle(topic, difficulty, forceRefresh = false)`: when `forceRefresh = true`, skips the localStorage article cache and always hits the API
- `surpriseBtn` listener: picks a random topic from pool excluding `ponte_recent_topics` (last 10 seen); resets pool when all 40 exhausted; always calls `generateArticle(..., true)` to bypass cache
- `ponte_recent_topics` localStorage key: FIFO list of up to 10 recently used topics

## False Friends tab (issue #5)
- `data/false-friends.js`: 100 entries with fields: `id`, `italian`, `italianMeaning`, `spanishLookalike`, `spanishMeaning`, `englishMeaning`, `category`, `danger` (high/medium/low), `example`, `exampleEN`, `tip`
- `false-friends.js`: vanilla JS IIFE — search, danger filter, card grid with expand/collapse (grid-template-rows animation), drill mode
- Drill mode: CSS 3D flip, Got it / Tricky queue management, first-try score at end; respects active filter/search
- Script load order: `data/false-friends.js` → `app.js` → `false-friends.js`

## Grammar tab — 4-stage learning path
- `data/grammar.js`: 45 cards (original 40 + 5 new: IDs 41-45) with fields `{ id, title, category, difficulty, stageId, english, italian, example, exampleEN, trap, spanishShortcut, tip? }`
  - Old `spanish: { label, example, note }` / `italian: { label, example, note }` format removed
  - `stageId`: 1=Foundation, 2=Traps, 3=Nuance, 4=Fluency
  - 30 pattern drills (`grammarDrills` array, `grammarCardId` → card `id`); each drill has `sentenceEN` field (English translation with `___` mirroring the Italian blank)
  - Verb drills (18 of 30) have `verbRef: { infinitive, meaning, type, typeNote }` — renders a subtle info box above the drill sentence (bg `#F0EBE3`, left border `#0066CC`); non-verb drills (pronouns, prepositions, geminate) omit this field and show no panel
- `grammar.js`: IIFE — stage tiles grid → card list view
  - Landing: 2×2 tile grid (1-col on mobile); each tile shows count + viewed progress bar (`ponte_grammar_viewed` in localStorage)
  - Click tile → shows all cards for that stage; back button returns to grid
  - One stage open at a time; `IntersectionObserver` marks cards viewed at 30% threshold
  - Cards always fully readable (no expand/collapse): EN row, IT row (cyan), example sentence, ⚠️ trap, 🇪🇸 Spanish shortcut, [Practice this →] button
  - "Practice this →" switches to Pattern Drills sub-tab filtered to that card's `grammarCardId` specifically (not the whole category); clicking a category button resets the card-specific filter; "No drills yet for this concept" shown when 0 results
  - "See more examples →" button on each card: POST `/api/grammar-examples` → 3 new sentences from Claude, cached in `localStorage` per `cardId` (`ponte_gramex_{id}`); button becomes "Refresh examples →" after first load
  - Stage colors: Stage 1 `#00C2B8`, Stage 2 `#F5C842`, Stage 3 `#F5894A`, Stage 4 `#A855F7`
  - Pattern Drills and From Your Reading sub-tabs unchanged
- Sub-tab label changed: "Verb Deltas" → "Learn" (`data-panel="stages"`)
- HTML panel replaced: `grammar-panel-delta` → `grammar-panel-stages`

## Grammar tab (issue #4 — SUPERSEDED by redesign above)
- `data/grammar.js`: 40 delta cards with fields: `{id, title, category, difficulty, spanish: {label, example, note}, italian: {label, example, note}, trap, tip}`; 30 pattern drills with fields: `{id, grammarCardId, sentence (contains ___), answer, distractors[3], explanation}`
- Categories: tense(10), pronoun(8), subjunctive(6), reflexive(4), preposition(5), geminate(3), modal(4)
- `grammar.js`: vanilla JS IIFE — sub-tab switching (Verb Deltas / Pattern Drills / From Your Reading), category+difficulty filters, expand/collapse card grid (grid-template-rows animation), drill engine with shuffled queue + 4-option MCQ + immediate feedback + progress bar + first-try score
- Script load order: `data/grammar.js` → `app.js` → `grammar.js` (grammar.js loads after app.js)

## Flashcard system
- `app.js`: `FC_KEY = 'ponte_flashcards'`; tooltip has **Save ★** button; `populateTooltip` sets `currentTooltipEntry`/`currentTooltipWord` so the button knows what to save
- Card structure: `{id, italian, english, spanish, category, note, savedAt, sourceArticle, wordType, baseForm, baseFormEN, timesCorrect, timesWrong, lastSeen, lastDrilled}`
- `wordType`: populated from `/api/translate` response — "noun" | "verb" | "adjective" | "adverb" | "phrase" | "other"
- `baseForm` / `baseFormEN`: dictionary/infinitive form + English meaning, from `/api/translate`; shown as italic grey "Base: [form] · [meaning]" line below Italian word in library and drill back face; absent on older saved cards (shows nothing)
- `lastDrilled`: ISO timestamp set on every Got it / Tricky action in drill mode
- Save button: shows "Saved ✓" (green) if already in deck; click saves with flash animation; click again removes card
- Count badge (`fc-badge-sidebar`, `fc-badge-bottom`) updates immediately via `updateFlashcardBadge()`
- Cross-module sync: `app.js` fires `window.dispatchEvent(new CustomEvent('ponte:flashcard-saved'))` on save/delete; `flashcards.js` listens to re-render
- `flashcards.js` IIFE: library view (search, category filter, card grid, delete), drill mode (3D CSS flip, Got it/Tricky, score + tricky list)
- **Drill score tracking (issues #21/#22/#23, closed):**
  - Session stats bar in drill panel: "X correct · Y tricky · Z% this session" (resets each drill start)
  - Accuracy badge on library cards if drilled ≥1 time: 🟢 80%+, 🟡 50–79%, 🔴 <50%
  - Word type filter row in toolbar: All / Nouns / Verbs / Adjectives / Phrases (filters drill queue by `wordType` field)
  - Reset Scores button in toolbar: confirms then zeros `timesCorrect`, `timesWrong`, `lastDrilled` for all cards
- Script load order: `app.js` → `false-friends.js` → `grammar.js` → `flashcards.js`

## Tab navigation
- Left sidebar on desktop: logo at top, collapse toggle (‹/›), 8 nav tabs (icon + label)
- Collapsed sidebar: 54px wide, icon-only; expanded: 200px; state in `localStorage` (`ponte_sidebar`)
- Bottom tab bar on mobile (≤820px): icons + short labels, fixed to bottom (58px)
- Active tab persisted in `localStorage` (`ponte_tab`); 150ms fade-in on switch
- Non-reader tabs (except False Friends, Grammar, Flashcards) show a coming-soon placeholder
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
- `server.js`: `POST /api/translate` endpoint, `max_tokens: 400`, `temperature: 0.2`
- Response fields: `{italian, english, spanish, note, category, tense, root, pronunciation}`
  - `tense`: conjugated verb description e.g. `"passato prossimo, 1st person singular"`, or null
  - `root`: infinitive form e.g. `"svegliarsi"`, or null — displayed in cyan, reserved for future tap-to-look-up
  - `pronunciation`: always present, stress-marked e.g. `"TAR-di"`
- Tooltip shows TENSE row and INFINITIVE row (hidden when null); pronunciation already shown under word via `tooltipPron`

## Translation column toggle
- Toggle button in header (▶/◀) collapses/shows the English column
- Default state: **collapsed** (Italian-only view)
- State persisted in `localStorage` under key `ponte_translation`
- On mobile, collapse has no effect — both columns always stack

## PWA (Progressive Web App)
- `manifest.json`: name, short_name, icons (192+512), display=standalone, theme #00C2B8
- `icons/icon-192.png` + `icons/icon-512.png`: generated via Python/Pillow (dark bg, white P + cyan e)
- `sw.js`: cache name `ponte-v14`; precaches all static assets on install; network-first for `/api/*`; cache-first for everything else; old cache versions deleted on activate
- iOS meta tags: `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style=black-translucent`, `apple-touch-icon`
- Service worker registered in inline `<script>` at bottom of `index.html`
- Install banner: shown once on iOS Safari (not standalone), dismissable, stored in `localStorage` key `ponte_install_dismissed`
- `viewport-fit=cover` on viewport meta for edge-to-edge on notched iPhones
- Safe-area CSS: `env(safe-area-inset-bottom)` applied to `.bottom-nav` height + `.main-area` padding + `.tooltip` bottom offset

## Deployment
- **Production URL:** `http://198.199.88.229`
- **Server:** DigitalOcean Droplet, Ubuntu 24.04, 1GB RAM
- **Deploy command:** `ssh root@198.199.88.229 "cd /home/ponte && bash deploy.sh"`
  - Runs: `git pull origin main && npm install --production && pm2 restart ponte-api`
- **PM2 process:** `ponte-api` (`pm2 list`, `pm2 logs ponte-api`)
- **nginx:** serves static files from `/home/ponte`; proxies `/api/` → `localhost:3001`
- **Flashcards:** `/home/ponte/data/flashcards.json` (persisted across deploys)
- **`.env`** at `/home/ponte/.env` — `ANTHROPIC_API_KEY`, `FLASHCARDS_PATH`, `PORT=3001`
- HTTPS via Let's Encrypt still needed for PWA installability; domain TBD
- Update `CACHE_NAME` in `sw.js` (e.g. `ponte-v15`) after major frontend changes to bust service worker cache
- See issue #17 for full mobile testing checklist

## Audio pronunciation (issue #25, closed)
- **Bug fix:** tooltip 🔊 had `e.stopPropagation()` to prevent bubble to document click (tooltip dismiss)
- **Flashcard library:** 🔊 button (`fc-card-speak-btn`) inline with Italian word in each library card; handled via event delegation in `fcGrid` click listener
- **Drill front face:** 🔊 button (`fc-front-speak-btn`) lets user hear word before flipping
- **Drill back face:** auto-play on flip (350ms delay) + 🔊 replay button (`fc-speak-btn`)
- `window.ponteSpeak` set synchronously in app.js IIFE — available when flashcards.js runs

## Audio pronunciation (issue #25 — details)
- **Shared utility:** `speech.speak(text)` in `app.js` (inside IIFE); exposed as `window.ponteSpeak` for `flashcards.js`
  - `utterance.lang = 'it-IT'`, `rate = 0.85`, `pitch = 1.0`
  - Prefers Italian system voice: `voices.find(v => v.lang === 'it-IT')`
  - Handles async voice loading via `speechSynthesis.onvoiceschanged`
  - Calls `speechSynthesis.cancel()` before each new utterance
- **Tooltip:** 🔊 button in `.tooltip-word-line` (flex row wrapping word + button); inline with Italian word; pulses while speaking
- **Flashcard drill:** auto-plays 350ms after flip (card CSS animation); 🔊 replay button (`fc-speak-btn`) on back face
- **Reader column:** 🔊/⏹ button (`article-speak-btn`) next to "Italiano" label; reads full article; `articleSpeaking` state flag; stops on new article render (`stopArticleSpeech()` called in `renderArticle`)
- **Graceful degradation:** buttons hidden if `!speech.supported` (no `window.speechSynthesis`)
- Service worker bumped to `ponte-v4` (drill score tracking)

## Practice tab (issues #6, #39 closed)
- `practice.js`: IIFE — cloze fill-in-the-blank from generated articles stored in localStorage
- **Article selector:** dropdown of all `ponte_article_*` keys; "Generate new" switches to Reader tab; selector refreshes on tab click
- **Word selection:** from `article.words`; priority: false-friend > divergence > new > cognate; min 5 / max 10 blanks; cognates only if fewer than 5 non-cognates
- **Sentence extraction:** splits Italian + English on sentence boundaries; shows English sentence in muted text below Italian
- **Multiple choice mode** (default): 4 options (correct + 3 AI distractors); auto-advance 1.5s on correct; Next button on wrong
- **Type it mode:** text input + Enter/Check; Levenshtein ≤1 accepted as correct (shows exact spelling on close typo)
- **AI distractors:** `POST /api/distractors` — Claude generates 3 plausible wrong answers targeting Spanish-speaker confusion (wrong tense, Spanish cognate, transfer errors); cached in localStorage as `ponte_dist_{word}`; falls back to other article words if API fails
- **Loading state:** Start button shows "Loading…" while distractors are fetched in parallel via `Promise.all`
- **Missed words tracker:** `missedItems` array tracks wrong answers throughout session
- **End screen:** score + missed words list (Italian, English, category badge) + "Save N missed words to Flashcards ★" button
- **Save missed to flashcards:** writes directly to `ponte_flashcards` localStorage, syncs to server, fires `ponte:flashcard-saved` event
- **Progress bar** + X/Y counter at top
- sw.js bumped to `ponte-v14`

## Conversation tab (issue #31, closed)
- `conversation.js`: IIFE — AI conversation simulator; Claude plays native Italian speaker
- **Setup screen:** dropdown of 10 scenarios (Al bar, Dal fruttivendolo, Con un amico, Chiedere indicazioni, Al ristorante, Una discussione, Raccontare un aneddoto, Conoscere qualcuno, Dal medico, Fare un reclamo); "Start Conversation →" button
- **Chat screen:** alternating bubbles (Claude left, user right); `conv-chat-topbar` with scenario label + "End session" button; scrollable `conv-messages` area; text input + "Invia" button; Enter key sends
- **Claude bubbles:** sepia card style, 🔊 button (top-right) triggers `window.ponteSpeak`; loading state shows 3-dot bounce animation
- **User bubbles:** `#0055AA` blue background, white text
- **Feedback notes:** shown below Claude bubbles; `---` separator parsed from API response; errors shown with left border; `conv-feedback-ok` (green) for "✓ Ottimo!"
- **Session summary:** exchange count, numbered error cards, "Save flagged words to Flashcards ★" button (hidden if no errors), "Start new conversation" button
- **Save to flashcards:** extracts Italian word/phrase from error note (regex: quoted "right" form); saves as `wordType: 'phrase'`, `category: 'new'`, `sourceArticle: 'Conversation: [scenario]'`; fires `ponte:flashcard-saved` event
- **History management:** stores only clean Italian in history (no feedback); caps at 40 messages (20 exchanges); persisted in `localStorage` as `ponte_conversation_session`
- **Backend:** `POST /api/conversation` — `{ scenario, history, userMessage }`; system prompt has Claude respond in Italian + add `---` + feedback note; first message injected as "Ciao!" if history empty; `max_tokens: 400`, `temperature: 0.8`
- **Tab position:** between Practice and Flashcards; icon 💬; mobile label "Chat"
- Script load order: `app.js` → `false-friends.js` → `grammar.js` → `flashcards.js` → `practice.js` → `dictionary.js` → `conversation.js`
- sw.js bumped to `ponte-v15`

## Mobile drill scroll fix (issues #28/#29, closed)
- Both flashcard and false friends drill back faces use shared flex column layout
- Card containers use `height: clamp(280px, 65vh, 520px)`; inners use `height: 100%`; faces use `position: absolute; inset: 0`; back face has `padding: 0; gap: 0; overflow: hidden`
- Scrollable content: `<div class="drill-card-content">` — `flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 20px 24px 8px`
- Sticky buttons: `<div class="drill-card-buttons">` — `flex-shrink: 0; border-top: 1px solid var(--border); background: var(--bg-card); padding: 12px 24px 16px`
- Mobile media queries add `.fc-flip-back { padding: 0; }` and `.ff-flip-back { padding: 0; }` to override `.fc-flip-face` padding rule

## Reverse drill mode (issue #29, closed)
- `Reverse 🔄` toggle button in `.fc-drill-topbar` next to Exit; state in `localStorage` (`ponte_drill_reverse`)
- Standard mode: Italian on front, English + Spanish + category badge + note on back
- Reverse mode: English on front ("What is this in Italian?"), Italian on back with auto-play pronunciation + category badge + note; front speak button hidden
- `drillReverse` state variable in `flashcards.js`; `updateReverseBtn()` syncs label ("Standard 🔄" / "Reverse 🔄") and `.active` class
- Toggling mid-drill refreshes the current card immediately; sw.js bumped to `ponte-v8`

## Translate tab (issue #30, closed)
- Renamed from "Dictionary" — sidebar/bottom nav label is "Translate", icon 🔄; tab ID remains `dictionary` (CSS/localStorage)
- `dictionary.js`: IIFE — two sections: Translate + Usage Checker
- **Bidirectional input:** Italian input (`dict-it-input`) + ↔ swap button (`dict-swap-btn`) + English input (`dict-en-input`); `direction` state (`'it'`|`'en'`) tracks which input was last typed; Enter on either input triggers search in that direction; swap button swaps values and flips direction
- **IT→EN:** `POST /api/translate`; **EN→IT:** `POST /api/translate-to-italian` (new endpoint); after result, both inputs populate with the Italian/English values
- **Random word 🎲:** `dict-random-btn` picks from `falseFriends` global (loaded before `dictionary.js`), sets IT input, sets direction to `'it'`, triggers lookup
- **Search history:** last 20 lookups in `localStorage` (`ponte_dict_history`) — saves the Italian word; chips trigger IT→EN lookup
- **Save to Flashcards:** Italian always front; `sourceArticle: 'Translate lookup'`; fires `ponte:flashcard-saved` event; toggles to "Saved ✓" if already in deck
- **Usage Checker:** textarea → `POST /api/check-usage` → if correct: green "Looks good!"; if errors: corrected sentence in cyan + per-error cards (strikethrough wrong → green fix, explanation, Grammar/Spanish Transfer/Word Choice badge); encouragement always shown
- `server.js` `/api/translate-to-italian`: `max_tokens: 400`, `temperature: 0.2`; returns same shape as `/api/translate`
- `server.js` `/api/check-usage`: `max_tokens: 600`, `temperature: 0.2`; returns `{original, corrected, isCorrect, errors[], encouragement}`
- sw.js bumped to `ponte-v10`

## Fullscreen immersive drill mode (issue #31, closed)
- Flashcard drill and False Friends drill both enter fullscreen when started
- `body` gets class `drill-fullscreen` on entry; removed on exit
- **Fullscreen header** (`#drill-fullscreen-header`): fixed, `z-index: 100`, 56px tall — Ponte logo left, X/Y progress center (absolute-centered), Exit button right
- **Drill panel** (`.fc-drill`, `.ff-drill`): `position: fixed; top: 56px; inset: 0` when `:not([hidden])`, `display: flex; flex-direction: column`
- **Done screens** (`.fc-drill-done`, `.ff-drill-done`): same fixed fullscreen positioning
- **Hidden in fullscreen:** sidebar, bottom nav, `.tab-topbar`, `.ff-toolbar`, existing drill topbars, `fc-session-stats`
- **Entry:** 200ms `drill-fadein` opacity animation; **Exit:** class removed, all hidden elements restored
- **Escape key** exits drill in both FC and FF (each listens independently, guards on own state)
- Status text synced: `fcDrillStatus` → `syncFsStatus()`; `ffDrillStatus` → `syncFFStatus()`
- Exit button `onclick` reassigned per drill module on entry
- `sw.js` bumped to `ponte-v13`

## Kindle Sepia theme (current)
- Warm parchment background with brown text and blue accent
- CSS variables in `:root`: `--bg: #F8F1E3`, `--bg-card: #FBF5E9`, `--bg-italian: #F0E6D0`, `--border: #D9C9A8`, `--text: #3B2D1F`, `--text-mid: #6B5744`, `--text-dim: #9B8470`
- Accent: `#0055AA`
- Category colors: cognate `#2E6B3E`, false-friend `#B83232`, divergence `#B85C00`
- Active nav item: `#E8D9BC` background, `#0055AA` text
- Sidebar bg: `#F0E6D0`; card/tooltip/input bg: `#FBF5E9`; input border: `#C9B898`
- Got it button: `#2E6B3E` solid / white text; Tricky button: `#B85C00` solid / white text
- Grammar stage colors (set in grammar.js): Stage 1 `#0055AA`, Stage 2 `#B85C00`, Stage 3 `#B83232`, Stage 4 `#7B4AAA`
- PWA `manifest.json`: `background_color: #F8F1E3`, `theme_color: #0055AA`; iOS status bar: `default`
- sw.js bumped to `ponte-v13`

## Backlog (open issues)

### P1 — High priority
- **#32** Error-to-drill engine: track error pattern types across drill sessions, surface in Grammar tab as personalized weak areas
- **#33** Sentence rebuilding mode: show English sentence, user reconstructs full Italian from memory; third mode in Practice tab

### P2 — Medium priority
- **#34** Cultural context layer in Reader: 2-3 sentence cultural note per article, collapsible below article text
- **#35** Weekly learning mission: one goal per week in Progress tab, resets Monday, simple progress bar — no gamification
- **#36** Native audio per article: ElevenLabs or real audio; TTS insufficient for speech rhythm / connected speech

### P3 — Low priority
- **#37** Pronunciation lab: user records word/sentence, compares to native reference (requires #36 first)
- **#38** Collaborative deck sharing: export/import flashcard deck as JSON link, no accounts needed

## Key design decisions
- No frameworks, no build step — intentionally minimal
- Fallback: if backend is unreachable, `articles[0]` (hardcoded) is shown
- Wordmap is built dynamically from `article.words` for generated articles; uses `window.wordmap` (static) for the fallback article
