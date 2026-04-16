# Ponte — CLAUDE.md

## What this is
Ponte is a vanilla HTML/CSS/JS Italian reading web app for intermediate English speakers who also know Spanish. Color-coded word intelligence (cognate / false-friend / divergence / new) and tooltip cards help Spanish speakers leverage structural vocabulary overlap when learning Italian.

## Project layout
```
ponte/
├── index.html          — single-page reader UI
├── utils.js            — shared utilities (ponteEsc HTML escaping)
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
- `false-friends.js`: vanilla JS IIFE — two sub-tabs (⚠️ False Friends / ✅ Safe Cognates); each has independent search, filter, card grid, and drill mode
- Drill mode: CSS 3D flip, Got it / Tricky queue management, first-try score at end; respects active filter/search
- Script load order: `data/false-friends.js` → `data/safe-cognates.js` → `app.js` → `false-friends.js`

## Safe Cognates (in False Friends tab)
- `data/safe-cognates.js`: 200 entries (`safeCognates` array) with fields `{ id, italian, spanish, english, similarity, example, exampleEN }`
  - `similarity`: `"identical"` (same spelling), `"near-identical"` (1–3 char diff), `"similar-root"` (clearly same root, more different form)
  - Categories covered: daily life, adjectives, places, academic, food/drink, arts/culture/tech, nature, body, people/professions, verbs/abstract
- Entire SC panel scoped under `#ff-panel-cognates` — green palette: card bg `#F4FAF6`, border `#C8E6C9`, hover `#F0FAF4`, expanded left inset `#A8D5B5`
- Italian word in cards shown in green (`#2E6B3E`); similarity badge classes: `sc-sim-identical` (dark green `#2E6B3E`), `sc-sim-nearidentical` (`#4CAF7D`), `sc-sim-similarroot` (`#A8D5B5` bg / `#1B5E20` text)
  - Badge class generated in JS: `'sc-sim-' + similarity.replace('-', '')` (replaces first hyphen only)
- Filter chips use `.sc-filter` class; active state = cognate green `rgba(46,107,62,0.1)` bg
- `.ff-subtabs` sticky `z-index: 22`; `.ff-toolbar` sticky `top: 44px` (desktop) / `top: calc(var(--header-h) + 44px)` (mobile)
- Expand card → shows example sentence + English translation
- Drill: same flip mechanic as False Friends; back face shows English meaning, Spanish equivalent, similarity badge, example; drill front/back face bg `#F4FAF6`, flip button green `#2E6B3E`

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
- **Data wipe protection (triple guard):**
  - Client (app.js): `persistFlashcardsToServer(cards)` returns early with `console.error` if `cards.length === 0`
  - Client (flashcards.js): `saveCards(cards)` returns early with `console.error` if `cards.length === 0`
  - Server (server.js): POST `/api/flashcards` reads existing count; returns 409 if incoming is empty but current file has cards; logs `[flashcards] POST from <ip>: incoming=N current=N` on every write; logs warning if incoming < current (but still writes — could be intentional delete); creates `.bak` copy before every write
- **Cross-device sync:**
  - `syncFlashcardsFromServer()` runs on page load — merges server + localStorage, pushes local-only cards back
  - `startFlashcardPoll()` runs every 60s after initial sync — silently pulls new server cards into localStorage if any IDs are missing locally; fires `ponte:flashcard-saved` to re-render if changes found
  - `window.manualSyncFlashcards()` exposed for Sync button — same merge logic, throws on error so caller can show feedback
  - **Sync button** in Cards toolbar (`.fc-sync-btn`): shows "Syncing…" → "Synced ✓" or "Failed" → resets after 2s
  - `mergeFlashcards(serverCards, localCards)` shared helper: server wins on ID conflicts, appends local-only cards
  - `syncFlashcardsFromServer()` always pushes merged result back to server (unconditional) — ensures server always has the complete union
  - **Race condition fix:** `backfillDueDates(silent=false)` — pre-sync init call passes `silent=true` (writes localStorage only, no server POST); post-sync `doInitialRender()` call passes `silent=false` (safe to POST). Prevents stale pre-sync array from wiping a larger server-side deck.
  - nginx `/api/` block sets `proxy_set_header X-Forwarded-For $remote_addr` — real client IPs visible in server logs
- `app.js`: `FC_KEY = 'ponte_flashcards'`; tooltip has **Save ★** button; `populateTooltip` sets `currentTooltipEntry`/`currentTooltipWord` so the button knows what to save
- Card structure: `{id, italian, english, spanish, category, note, savedAt, sourceArticle, wordType, baseForm, baseFormEN, timesCorrect, timesWrong, lastSeen, lastDrilled, interval, easeFactor, dueDate, reviewCount, lastReviewed}`
- `wordType`: populated from `/api/translate` response — "noun" | "verb" | "adjective" | "adverb" | "phrase" | "other"
- `baseForm` / `baseFormEN`: dictionary/infinitive form + English meaning, from `/api/translate`; shown as italic grey "Base: [form] · [meaning]" line below Italian word in library and drill back face; absent on older saved cards (shows nothing)
- **Backfill (completed):** `backfill.js` one-time script and `POST /api/backfill-flashcards` endpoint used to populate `baseForm`/`baseFormEN` on all 92 existing cards. Script and endpoint remain in codebase for future use; UI button removed.
- `lastDrilled`: ISO timestamp set on every Got it / Tricky action in drill mode
- Save button: shows "Saved ✓" (green) if already in deck; click saves with flash animation; click again removes card
- Count badge (`fc-badge-sidebar`, `fc-badge-bottom`) updates immediately via `updateFlashcardBadge()`
- Cross-module sync:
  - `ponte:flashcard-saved` — fired by `app.js` on tooltip save/delete and after server sync; `flashcards.js` listens to re-render library
  - `ponte:flashcards-synced` — fired by `app.js`'s `signalFCReady()` in ALL exit paths of `syncFlashcardsFromServer()` (success, early-return, offline catch); `flashcards.js` uses this for its initial library render so it always uses merged server+local data, not empty pre-sync localStorage
  - `window._ponteFCReady = true` flag set alongside the event, as a fallback check in `flashcards.js` for the edge case where the event fires before the listener registers
- `flashcards.js` IIFE: library view (search, dropdown filters, card grid, delete), drill mode (3D CSS flip, Again/Hard/Easy, score)
- **Library filters (dropdown style):**
  - **Type dropdown:** multi-select checkboxes — Same in Spanish / False Friend / Used differently / New word; button label updates to show active selections; blue border when filtered
  - **Status dropdown:** multi-select checkboxes — Due today / New (reviewCount===0) / Upcoming / Mastered (easeFactor>3.5 AND interval>30); uses `getCardStatus(card)` helper
  - Both filters combine with AND logic; if all items in a filter are selected, that filter is off
  - `activeCats` Set and `activeStatuses` Set are the filter state; checkboxes reset to all-selected if last item is deselected
- **Drill score tracking (issues #21/#22/#23, closed):**
  - Session stats bar in drill panel: "X correct · Y again · Z% this session" (resets each drill start)
  - Accuracy badge on library cards if drilled ≥1 time: 🟢 80%+, 🟡 50–79%, 🔴 <50%
  - Reset Scores button in toolbar: confirms then zeros `timesCorrect`, `timesWrong`, `lastDrilled` for all cards
- **Drill setup screen:** shown when clicking "🃏 Drill mode"; lets user select word type (All/Nouns/Verbs/Adjectives/Phrases as radio buttons) before starting; applies on top of library filters; "Cancel" returns to library
- **Word lookup modal** (`#wl-modal`): "**+ Add word**" button (`#fc-add-word-btn`, green) in `fc-toolbar-actions` opens a modal; user types an Italian word, "Translate →" calls `POST /api/translate`, shows word/EN/ES/category badge/note; "Save to Cards ★" saves a full card to the deck; detects duplicates and shows "Already saved ✓"; Escape or backdrop click closes; bottom-sheet on mobile (≤480px)
- Script load order: `app.js` → `false-friends.js` → `grammar.js` → `flashcards.js`

## Tab navigation
- **Desktop sidebar** (>820px): 5 top-level items — Read, Learn ▾, Practice ▾, Cards, More ▾
  - Learn group: False Friends + Grammar sub-items (expand inline with animated chevron)
  - Practice group: Practice + Conversation sub-items
  - More group: Translate + Shadowing + Progress sub-items
  - Collapsed sidebar (54px): clicking a group header navigates to last-visited sub-tab for that group
  - Group headers have `data-nav-group` attribute; sub-items have `data-tab` attribute
  - State: `ponte_last_learn`, `ponte_last_practice`, `ponte_last_more` localStorage keys track last-visited sub-tab per group
  - All sidebar items use inline `onclick` HTML attributes calling `window.switchTab(id)` or `window.toggleNavGroup(id)` — `addEventListener` was unreliable on some desktop browsers in certain states
  - `window.toggleNavGroup(groupId)` exposed from IIFE: expands/collapses group in sidebar, or navigates directly if sidebar is collapsed
- **Mobile bottom nav** (≤820px): 5 items — Read, Learn, Practice, Cards, More
  - Read (`id="bn-read"`) → `switchTab('reader')`
  - Learn (`id="bn-learn"`) → `switchTab(ponte_last_learn || 'grammar')`
  - Practice (`id="bn-practice"`) → `switchTab(ponte_last_practice || 'practice')`
  - Cards (`id="bn-cards"`) → `switchTab('flashcards')`
  - More (`id="bn-more"`) → toggles `.more-panel` slide-up sheet
  - All 5 use inline `onclick`/`ontouchend` HTML attributes calling `window.switchTab(id)` — most reliable on iOS Safari (addEventListener approach was unreliable on fixed-position elements)
  - `ontouchend` returns `false` to prevent subsequent `click` event firing
  - `window.switchTab` exposed from IIFE; handles shorthand IDs: `'learn'` → last learn tab, `'practice'` → last practice, `'more'` → toggle More panel; `'flashcards'` is passed directly
  - All 5 buttons keep `data-tab` or `data-nav-group` attributes for `updateNavActive()` active state highlighting
  - CSS: `touch-action: manipulation` on `.bottom-nav-item` removes 300ms tap delay; `.bottom-nav-item > * { pointer-events: none }` ensures taps target the button, not inner SVG/span; `-webkit-tap-highlight-color` provides tap feedback
- **More panel** (`#more-panel`): slide-up sheet above mobile bottom nav; backdrop `#more-panel-backdrop` (z-index 28); panel z-index 29; `.open` class triggers `transform: translateY(0)` transition; `hidden` attribute used for display-none when closed
- `switchTab(tabId)`: hides all `.tab-panel`, shows `#tab-{id}`, calls `updateNavActive()`, tracks last-visited, calls `closeMorePanel()`; no-ops if panel doesn't exist; skips if already active
- Active tab persisted in `localStorage` (`ponte_tab`); 150ms fade-in on switch
- Non-reader tabs (except False Friends, Grammar, Flashcards) show a coming-soon placeholder
- SVG icons (inline `<svg>`) for all 5 main nav items; emoji for sub-items

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
- **iOS text selection CSS:** `.column-italian .column-body` has `padding-left: 4px` (first word not flush at edge), `-webkit-user-select: text; user-select: text` (explicit selection enable), `touch-action: pan-y` (vertical scroll doesn't block horizontal text selection)
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
- Default state: **always collapsed** — `<main class="reader translation-collapsed">` in HTML prevents flash before JS runs; `initTranslationToggle` always calls `applyTranslationState(false, false)`; `renderArticle` also resets to collapsed on each new article
- `applyTranslationState` uses explicit `classList.add/remove` (not `toggle`) with null-guards on `translToggleBtn`
- State saved to localStorage (`ponte_translation`) on click; never restored on load
- Two-column layout: `grid-template-columns: 1fr 1fr` (50/50) — Italian expands to full width when collapsed (`1fr`)
- "ITALIANO 🔊" label: wrapped in `.col-label-left` (inline-flex, gap 8px) so text + speak button sit as one unit left-aligned; legend pushes right via `space-between`
- On mobile, collapse has no effect — both columns always stack
- **Click reliability (iOS Safari):** `window.toggleTranslation` exposed; button uses inline `onclick` + `ontouchend` (same pattern as bottom nav); `addEventListener` removed from `initTranslationToggle` to prevent double-firing

## Reader initial state
- On page load: reader starts empty — no article auto-loaded, no column labels, no title/badges, no "Test yourself" button
- `reader-has-article` CSS class added to `#reader` by `setLoading(true)` (shows "Italiano" label during skeleton) and `renderArticle` (shows both labels + article)
- CSS rule: `.reader:not(.reader-has-article) .column-label { display: none }` — column labels hidden until content loads
- Fallback article (`articles[0]`) only loads on generation error, not on init
- `quizTriggerBtn` hidden during `setLoading(true)`, revealed in `renderArticle`

## Shared utilities (utils.js)
- `utils.js` loaded first via `<script>` before all data files and modules
- Exposes `window.ponteEsc(str)` — HTML-escapes `&`, `<`, `>`, `"` and handles null/undefined
- All modules reference it as `const escapeHTML = window.ponteEsc` or `const esc = window.ponteEsc` (no local duplicates)
- Script load order: `utils.js` → `data/*.js` → `app.js` → `false-friends.js` → `grammar.js` → `flashcards.js` → `practice.js` → `dictionary.js` → `conversation.js`

## PWA (Progressive Web App)
- `manifest.json`: name, short_name, icons (192+512), display=standalone, theme #00C2B8
- `icons/icon-192.png` + `icons/icon-512.png`: generated via Python/Pillow (dark bg, white P + cyan e)
- `sw.js`: cache name `ponte-v47`; install uses `fetch(url, { cache: 'reload' })` per file to bypass browser HTTP cache; network-first for `/api/*`; cache-first for everything else; old cache versions deleted on activate
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
- **nginx cache headers**: JS/CSS/HTML served with `Cache-Control: no-cache, must-revalidate` — browser always revalidates with server (uses ETag/Last-Modified for conditional requests)
- **nginx config**: `/etc/nginx/sites-available/ponte` symlinked as `/etc/nginx/sites-enabled/default`; only one symlink to avoid duplicate server_name warning
- Update `CACHE_NAME` in `sw.js` (e.g. `ponte-v47`) after major frontend changes to bust service worker cache
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

## Practice tab (issues #6, #39, #33 closed)
- `practice.js`: IIFE — fully independent from Reader; generates custom practice sentences via Claude
- **No article dependency** — article selector and `+ Generate new` button removed
- **Setup screen:** topic text input → difficulty (B1/B2) → mode → "Generate Practice →"
  - "Surprise me 🎲" button (`prac-surprise-btn`, `.gen-btn`): picks randomly from `PRACTICE_SURPRISE_TOPICS` (30 topics, 6 registers: grammar, daily life, emotional, storytelling, cultural, travel), fills input
  - "🎯 Practice my weak areas" button reads `ponte_error_patterns`, maps top error key to a topic string via `PATTERN_TOPICS` map, pre-fills input
  - Enter in topic input submits; button disabled when input empty
- **Backend:** `POST /api/generate-practice` — `{ topic, difficulty }` → Claude returns 8 sentences: `{ sentences: [{ english, italian, words, distractors }] }`; `max_tokens: 1400`, `temperature: 0.8`
  - `words`: 4–8 key content words from the Italian sentence
  - `distractors`: 4 plausible wrong words targeting Spanish-speaker errors
- **Mode selector:** Multiple Choice (default) / Type It / Sentence Rebuild — pill buttons; Sentence Rebuild shows difficulty sub-row (Word Bank / Free Recall)
- **Difficulty selector:** B1 / B2 pill buttons (separate from mode row)

### Multiple Choice mode (`prac-drill` panel)
- English sentence shown above; Italian sentence with blank below
- 4 options: `words[0]` (correct) + first 3 distractors; auto-advance 1.5s on correct
- Feedback: correct/wrong result + category badge

### Type It mode (`prac-sr-drill` panel — recall UI)
- English sentence shown; user types full Italian sentence
- Local Levenshtein check: correct if normalized strings match or distance ≤ max(2, 12% of target length)
- Shows ideal Italian in feedback; no API call

### Sentence Rebuild mode (`prac-sr-drill` panel — issue #33, closed)
- **Word Bank (intermediate):** tiles = `words` + equal-count `distractors` from API response, shuffled; tap to build; submit compares normalized token sequence
- **Free Recall (advanced):** textarea → `POST /api/check-sentence`; score ≥ 75 = correct; per-error cards with type badges

### Shared
- **Missed words tracker:** `missedItems` array tracks wrong answers throughout session
- **End screen:** score + missed words list + "Save N missed words to Flashcards ★"
  - `sourceArticle: 'Practice: [topic]'` on saved cards
- **Retry:** re-generates from same topic/difficulty (new sentences each time)
- **Progress bar** + X/Y counter at top
- sw.js bumped to `ponte-v22`

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

## Post-reading Quiz (issue #24, closed)
- **Trigger:** "Test yourself" button in `header-right` (next to EN toggle), hidden until first article renders; `renderArticle` shows it and also resets translation to Italian-only (collapsed)
- **Modal:** overlay with backdrop blur; header shows article title + "Quick Quiz" label + × close; ESC and overlay click also close
- **Question generation:** `POST /api/reading-quiz` with `{ italian, english, title }`; returns 5 questions (3 MC + 2 TF); `max_tokens: 800`, `temperature: 0.5`
- **Question flow:** progress bar + X/Y counter; question text; option buttons; immediate feedback on answer (correct = green, wrong = red strikethrough + reveal correct); Next/See results button
- **Score screen:** colored circle (green ≥80%, amber ≥60%, red <60%) + encouragement label + last 5 quiz history rows
- **Score persistence:** `ponte_quiz_scores` localStorage key — array of `{ date, title, score, total }`, max 20 entries, most recent first
- **Retake quiz:** reruns same questions without re-fetching; Done returns to reader
- sw.js bumped to `ponte-v29`

## Error-to-drill engine (issue #32, closed)
- **Error pattern tracking:** `ponte_error_patterns` localStorage key maps pattern keys → `{ count, lastSeen, label }`
  - Patterns: `false-friend`, `divergence`, `verb-essere`, `passato-prossimo`, `clitic-placement`, `subjunctive`, `geminates`, `verb-general`
  - `recordErrorPatterns(card)` called in `flashcards.js` on Again or Hard answers — rule-based detection from card.category + card.note + card.grammarPatterns
  - Fires `ponte:error-patterns-updated` custom event after write; grammar.js listens to re-render Weak Areas panel if open
- **Claude pattern detection on save:** `POST /api/detect-patterns` (`{ italian, english, category, note }` → `{ patterns: [] }`); `max_tokens: 100`, `temperature: 0.1`
  - `detectAndSavePatterns(cardId, ...)` in `app.js`: fire-and-forget; updates `card.grammarPatterns` in localStorage + re-syncs to server
- **Weak Areas sub-tab** (first sub-tab in Grammar, before Learn):
  - `#grammar-panel-weakareas`, rendered by `renderWeakAreas()` in `grammar.js`
  - Ranked list sorted by miss count; left-border color: red ≥5, yellow 2-4, grey 1
  - Each row: rank, label, miss count + last-seen date, "Study →" (opens grammar stage) and "Drill →" (filters Pattern Drills) buttons
  - Empty state: "Complete some flashcard drills to see your weak areas."
  - `PATTERN_META` map: pattern key → `{ label, drillCat, studyStage }` for button routing
- **Smart drill ordering:** `sortDueByPatterns(due)` replaces `shuffle(due)` in `startDrill()`
  - Top-3 error patterns (by count) → matching cards first, sorted by accuracy ascending
  - Remaining due cards: sorted by accuracy ascending
  - `drillAll` mode still uses shuffle (intentional for variety)
- sw.js bumped to `ponte-v18`

## Mobile drill scroll fix (issues #28/#29, closed)
- Both flashcard and false friends drill back faces use shared flex column layout
- Card containers use `height: clamp(280px, 65vh, 520px)`; inners use `height: 100%`; faces use `position: absolute; inset: 0`; back face has `padding: 0; gap: 0; overflow: hidden`
- Scrollable content: `<div class="drill-card-content">` — `flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 20px 24px 8px`
- Sticky buttons: `<div class="drill-card-buttons">` — `flex-shrink: 0; border-top: 1px solid var(--border); background: var(--bg-card); padding: 12px 24px 16px`
- Mobile media queries add `.fc-flip-back { padding: 0; }` and `.ff-flip-back { padding: 0; }` to override `.fc-flip-face` padding rule

## SM-2 spaced repetition (issue #10, closed)
- `applySmTwo(card, rating)` in `flashcards.js` — rating: `'again'` | `'hard'` | `'easy'`
  - **Again** (wrong): interval=1, easeFactor-=0.2 (min 1.3), card re-queued
  - **Hard** (correct, struggled): interval 1→3→round(iv×1.2), easeFactor unchanged
  - **Easy** (correct, instant): interval 1→6→round(iv×ef×1.3), easeFactor+=0.15 (max 4.0)
  - All three: increment `reviewCount`, set `lastReviewed`, set `dueDate`
- `backfillDueDates()` runs on init: cards missing `dueDate` get `dueDate = now` so all existing cards appear due immediately
- `isDue(card)`: true if `!dueDate` or `dueDate ≤ now`
- **Drill queue:** due cards shuffled first, not-due cards shuffled after; if no due cards → "No cards due" screen with soonest due date + "Drill anyway →" button (`startDrill(true)` bypasses due check)
- **Due badges:** sidebar shows `fc-due-label-sidebar` — "N due today" text label in small red (`#B83232`) inline after "Cards" label; bottom nav shows `fc-due-badge-bottom` red pill + `title` tooltip "N cards due for review"; both hidden when dueCount === 0. Green total count badge (`fc-badge`) removed entirely.
- **Library card indicators:** "New" (blue, `reviewCount === 0`), "Due today" (red, `isDue`), "Due in Xd" (muted, upcoming)
- **Drill done screen:** "Next review" section shows up to 6 cards with `next review tomorrow / in N days`; populated from `sessionDrilledCards` Map (id → {italian, interval})
- Drill buttons: `fc-again-btn` (red `#B83232`) / `fc-hard-btn` (amber `#CC6600`) / `fc-easy-btn` (green `#2E6B3E`); each `flex: 1` across `.drill-card-buttons`
- Session stats: "X correct · Y again · Z% this session" (`sessionAgain` replaces old `sessionTricky`)
- sw.js bumped to `ponte-v17`

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

## Open Issues Audit — April 2026

### Closed in this audit (already built)
- **#2 Tooltip polish** — usage notes, example sentences (IT+EN), 🔊 audio pronunciation all live
- **#9 AI writing feedback** — Usage Checker in Translate tab: Spanish-transfer error analysis, corrected sentence in cyan, per-error badge cards
- **#19 Flashcard drill scroll on mobile** — flex column layout with clamp height, scrollable content div, sticky action buttons; fullscreen drill mode reinforces this
- **#20 Remove dev cache-clear** — confirmed absent from app.js; only scoped localStorage gets/sets remain
- **#31 Conversation simulator** — fully built: 10 scenarios, chat bubbles, feedback notes, session summary, save-to-flashcards, `POST /api/conversation`

### Still open — partial build
- **#1 Article library + switcher** — generation + Practice tab selector exist; no dedicated library browser UI
- **#3 Article difficulty filter** — difficulty selector in generator exists; no filter on stored articles (blocked by #1)
- **#17 Mobile setup and testing** — app deployed at http://198.199.88.229; HTTPS / domain still needed for full PWA installability
- **#27 Cognate categorization fix** — basic category guide in translate prompt exists; specific guardrails (register, gender, usage-breadth rules) not yet added

### Still open — not started
| # | Title | Priority |
|---|-------|----------|
| #7 | Shadowing mode | P1 (requires #36) |
| #8 | Weak word tracker | P2 |
| #10 | Spaced repetition queue | P2 |
| #11 | Onboarding flow | P3 |
| #12 | Progress dashboard | P3 |
| #13 | Mobile layout polish | P3 |
| #14 | Public false friend SEO page | P3 |
| #18 | Flashcard visual images via Unsplash | P2 |
| ~~#24~~ | ~~Post-reading quiz (comprehension Qs)~~ | closed |
| #26 | Classic literature content category | P1 |
| #32 | Error-to-drill engine | P1 |
| ~~#33~~ | ~~Sentence rebuilding mode~~ | closed |
| #34 | Cultural context layer in Reader | P2 |
| #35 | Weekly learning mission | P2 |
| #36 | Native audio per article | P2 |
| #37 | Pronunciation lab | P3 |
| #38 | Collaborative deck sharing | P3 |

### Gaps — retroactive issues created and closed in this audit
- **#40** Safe Cognates section (200 entries, sub-tab UI, drill mode, green palette)
- **#41** Grammar 4-stage learning path redesign (tiles → card list, stage progress, "See more examples →")
- **#42** Reverse drill mode (EN→IT flip, localStorage toggle)
- **#43** Fullscreen immersive drill mode (body.drill-fullscreen, shared header)
- **#44** Bidirectional Translate tab (IT↔EN, random word, history chips, save to flashcards)
- **#45** Drill score tracking and accuracy badges (session stats, per-card %, word-type filter, Reset Scores)
- **#46** Practice tab cloze mode (fill-in-the-blank from generated articles, AI distractors, miss-to-flashcards)
- **#47** Base form on flashcards (library + drill back face; backfill on 92 existing cards)
- **#48** Verb reference card in pattern drills (verbRef on 18 of 30 drills)

## Backlog (open issues)

### P1 — High priority (ranked by learning impact)
- ~~**#32** Error-to-drill engine~~ — **closed, built** (see Error-to-Drill section below)
- ~~**#33** Sentence rebuilding mode~~ — **closed, built** (see Sentence Rebuild section in Practice tab)
- ~~**#24** Post-reading quiz~~ — **closed, built** (see Post-reading Quiz section)
- **#27** Cognate categorization fix: tighten translate/generate prompts with register/gender/usage-breadth guardrails

### P2 — Medium priority
- **#1** Article library + switcher: browsable shelf of cached articles (generation exists; library UI missing)
- **#3** Article difficulty filter: filter stored articles by difficulty (blocked by #1)
- **#7** Shadowing mode: sentence-by-sentence audio + record & compare (blocked by #36)
- **#8** Weak word tracker: track most-tapped words in reader; foundation for SRS
- ~~**#10** Spaced repetition queue~~ — **closed, built** (see SM-2 section below)
- **#12** Progress dashboard: learning stats across tabs
- **#17** Mobile setup and iPhone testing: HTTPS + domain still needed; checklist not fully verified
- **#18** Flashcard visual images via Unsplash API: contextual photos on noun flashcards
- **#26** Classic literature content category: dedicated UI button/tier for literary-register articles
- **#34** Cultural context layer in Reader: 2-3 sentence cultural note per article, collapsible
- **#35** Weekly learning mission: one goal per week, resets Monday, simple progress bar
- **#36** Native audio per article: ElevenLabs or real audio; TTS insufficient for speech rhythm

### P3 — Low priority
- **#11** Onboarding flow
- **#13** Mobile layout polish: ongoing UX pass
- **#14** Public false friend SEO page
- **#37** Pronunciation lab: record + compare to native reference (requires #36)
- **#38** Collaborative deck sharing: export/import flashcard deck as JSON link

## Key design decisions
- No frameworks, no build step — intentionally minimal
- Fallback: if backend is unreachable, `articles[0]` (hardcoded) is shown
- Wordmap is built dynamically from `article.words` for generated articles; uses `window.wordmap` (static) for the fallback article
