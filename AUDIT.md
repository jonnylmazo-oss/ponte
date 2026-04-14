# Ponte Codebase Audit — April 14, 2026

Full audit of all project files. Issues ranked by severity: **High**, **Medium**, **Low**.

---

## 1. Security

| # | File | Line(s) | Severity | Issue | Fix |
|---|------|---------|----------|-------|-----|
| S1 | `app.js` | 429, 437 | **High** | `tenseVal` and `rootVal` injected into `innerHTML` without escaping — XSS if API returns malicious HTML | Use `escapeHTML()` on both values |
| S2 | `grammar.js` | 491-495 | **High** | `drill.sentence` passed to `innerHTML` unescaped: `drill.sentence.replace(/___/g, '<span…>')` | Escape sentence first, then replace `___` |
| S3 | `practice.js` | 755-817 | **High** | `err.type` rendered in badge HTML without escaping — XSS vector from API response | Wrap in `escapeHTML(err.type \|\| 'error')` |
| S4 | `dictionary.js` | 321-358 | Medium | `typeLabel` fallback to raw `err.type` unescaped in usage checker result | Escape fallback value |
| S5 | `flashcards.js` | 780-795 | Medium | `CATEGORY_LABELS[card.category]` — if category not in map, raw value renders unescaped in innerHTML | Add fallback: `escapeHTML(card.category)` |
| S6 | `index.html` | 34 | Medium | Inline `onclick` handler with `localStorage` access — blocks CSP `script-src` hardening | Move to `app.js` event listener |
| S7 | `server.js` | 458 | Medium | User input interpolated into prompt string without escaping quotes: `"${text.trim().replace(/"/g, '\\"')}"` — prompt injection possible | Use parameterized prompt or stronger sanitization |

---

## 2. Performance

| # | File | Line(s) | Severity | Issue | Fix |
|---|------|---------|----------|-------|-----|
| P1 | `sw.js` | 5-23 | **High** | `data/safe-cognates.js` (48.8 KB) missing from PRECACHE — offline users get broken Safe Cognates tab | Add `/data/safe-cognates.js` to PRECACHE array |
| P2 | `index.html` | 831-843 | Medium | 181 KB of data files loaded synchronously on every page load (grammar 77 KB, false-friends 49 KB, safe-cognates 49 KB) | Lazy-load grammar/FF/SC data when tab first opened |
| P3 | `false-friends.js` | 498-509 | Medium | Event listeners added to flip/got/tricky buttons on every `scNextCard()` call — listeners accumulate per drill session | Add listeners once at init; use state-based handlers |
| P4 | `practice.js` | 565-577 | Medium | `renderSRBank()` adds click listeners to every tile on each render without removing old ones | Use event delegation on container |
| P5 | `flashcards.js` | 436-451 | Medium | Category checkbox listeners re-attached on every filter change | Register once at init |
| P6 | `grammar.js` | 413-426 | Medium | IntersectionObserver recreated on every `openStage()` without disconnecting previous | Disconnect before creating new; reuse single observer |
| P7 | `flashcards.js` | 415-500 | Medium | `renderLibrary()` rebuilds entire grid innerHTML + re-attaches all event listeners on every filter/search | Use event delegation on `fcGrid` container |
| P8 | `package.json` | 11 | Medium | `@anthropic-ai/sdk` at `^0.36.3` — significantly outdated (latest ~0.89) | Update SDK; review changelog for breaking changes |

---

## 3. Technical Debt

| # | File | Line(s) | Severity | Issue | Fix |
|---|------|---------|----------|-------|-----|
| T1 | All JS modules | Various | **High** | `escapeHTML()` duplicated in 6 files (conversation:31, grammar:12, practice:67, false-friends:5, dictionary:44, flashcards). `shuffle()` duplicated 4 times. `API_BASE` detection logic duplicated 5 times. | Create `ponte-utils.js` shared module |
| T2 | conversation.js, practice.js, dictionary.js | Various | Medium | "Save to flashcards" logic implemented 3 times with different field mappings | Extract shared `createFlashcard()` + `saveWordsToFlashcards()` |
| T3 | All JS modules | Various | Medium | Inconsistent `$()` helper — arrow function in 2 files, `function` declaration in 3, full `getElementById` in grammar.js | Standardize in shared utils |
| T4 | All JS modules | Various | Medium | Inconsistent localStorage error handling — some `catch { return [] }`, some `catch(e) {}`, some `catch { return {} }` | Create `getStorage(key, default)` wrapper |
| T5 | `flashcards.js` | 745-800 | Medium | `showDrillCard()` is 60+ lines handling queue, progress, reverse mode, HTML generation, DOM update | Break into `getCurrentCard()`, `renderDrillCardFront()`, `updateDrillProgress()` |
| T6 | `practice.js` | 221-275 | Medium | `generatePractice()` handles API call, validation, word bank, escaping, distractors in one function | Extract `fetchPracticeFromAPI()`, `processSentenceData()`, `buildWordBankTiles()` |
| T7 | `app.js` | 375-396 | Medium | Same fallback-to-`articles[0]` code duplicated in 3 error handlers | Extract `restoreArticleFromFallback()` helper |
| T8 | `style.css` | Throughout | Medium | `#0055AA` appears 90+ times hardcoded; `#3B2D1F` 11+ times — both have CSS variables defined (`--text`) but unused | Replace hardcoded hex values with `var(--text)`, create `--primary` variable |
| T9 | `style.css` | 14-31 | Low | Duplicate CSS variables: `--bg-card`/`--card-bg` same value, `--border`/`--border-mid` same value, `--text-translation`/`--text-mid` same value | Consolidate duplicates |
| T10 | `app.js` | 1134 | Low | `msgs` array declared but never used | Remove dead code |

---

## 4. Mobile Friendliness

| # | File | Line(s) | Severity | Issue | Fix |
|---|------|---------|----------|-------|-----|
| M1 | `style.css` | 124 | Medium | `.sidebar-toggle` has `padding: 4px 5px` — touch target ~18x18px, well under 44px minimum | Set `min-width: 44px; min-height: 44px` |
| M2 | `style.css` | 766 | Medium | `.word-tag` has `padding: 1px 5px` — too small for touch | Increase padding to `6px 12px` |
| M3 | `style.css` | 2336 | Medium | `.gr-cat-btn` has `padding: 4px 7px` — undersized for touch | Increase to `8px 14px` minimum |
| M4 | `conversation.js` | 174 | Medium | Auto-scroll always fires on new message — pulls user back down if they scrolled up to re-read | Only auto-scroll if user is near bottom |
| M5 | `false-friends.js` | 272-296 | Medium | No touch event handling for drill cards — 300ms click delay on some mobile browsers | Add `touchend` handler with `preventDefault` |
| M6 | `style.css` | Throughout | Medium | Only 2 breakpoints used (820px, 480px) — no tablet breakpoint (~768px), no landscape handling | Add intermediate breakpoint and `orientation: landscape` queries |
| M7 | `style.css` | 549 | Low | `.column { padding: 40px 44px }` — large padding wastes mobile screen space (only adjusted at 820px breakpoint) | Reduce base padding; use clamp() |
| M8 | `style.css` | 417 | Low | `.topic-panel { min-width: 200px }` — could overflow narrow screens | Use `min-width: min(100%, 200px)` |

---

## 5. Accessibility

| # | File | Line(s) | Severity | Issue | Fix |
|---|------|---------|----------|-------|-----|
| A1 | `style.css` | All animations | **High** | No `@media (prefers-reduced-motion: reduce)` — 7 animations with no opt-out for motion-sensitive users | Add media query to disable/reduce all animations |
| A2 | `style.css` | 425, 1194, 3888, 5295 | **High** | Multiple inputs remove `outline: none` on focus with only subtle border-color change — breaks keyboard navigation | Use `outline: 3px solid #0055AA; outline-offset: 2px` on `:focus-visible` |
| A3 | `index.html` | 113-122 | **High** | `#topic-input` and `#difficulty-select` have no `<label>` elements — invisible to screen readers | Add `<label for="..." class="sr-only">` |
| A4 | `index.html` | 367-373 | **High** | `#dict-it-input` and `#dict-en-input` missing labels | Add visually-hidden labels |
| A5 | `index.html` | 562-564 | Medium | `#conv-input` textarea missing label | Add `<label for="conv-input" class="sr-only">` |
| A6 | `index.html` | 162, 222, 596 | Medium | Search inputs (`ff-search`, `sc-search`, `fc-search`) have placeholders but no `aria-label` | Add `aria-label="Search..."` |
| A7 | `style.css` | 578-579 | Medium | `color: #666666` on `--bg-italian: #F0E6D0` background — likely fails WCAG AA 4.5:1 contrast | Darken text to `#555` or use `var(--text-mid)` |

---

## 6. Error Handling

| # | File | Line(s) | Severity | Issue | Fix |
|---|------|---------|----------|-------|-----|
| E1 | `conversation.js` | 188-196 | Medium | `callAPI()` fetch has no timeout — hangs indefinitely if server unresponsive | Add `AbortController` with 10s timeout |
| E2 | `grammar.js` | 282-318 | Medium | "See more examples" API call has no timeout — button stuck on "Loading..." if API hangs | Add timeout + error state: "Try again (error)" |
| E3 | `practice.js` | 305-315 | Medium | Generic error message, no distinction between network timeout and API error, no retry button | Parse error types; offer retry |
| E4 | `flashcards.js` | 815-870 | Medium | `handleCorrect()`/`fcAgainBtn` assume card exists in localStorage — if deleted externally, ghost card in UI | Check `idx === -1` and skip/remove from queue |
| E5 | `conversation.js` | 239-250 | Medium | Error recovery attempts `inputEl.focus()` even when `convChat` is hidden | Guard with visibility check |
| E6 | `app.js` | 1016-1032 | Medium | `detectAndSavePatterns` — fire-and-forget with empty `.catch(() => {})` | Log warning on failure |
| E7 | `conversation.js` | 353-357 | Low | Flashcard sync `.catch(() => {})` silently swallows errors | Log: `.catch(err => console.warn(...))` |
| E8 | `flashcards.js` | 35-38 | Low | `saveCards()` server sync catches error but only logs — user unaware sync failed | Track sync status; show indicator on persistent failure |

---

## 7. Consistency

| # | File | Line(s) | Severity | Issue | Fix |
|---|------|---------|----------|-------|-----|
| C1 | `style.css` | Throughout | Medium | 17 `!important` declarations — many avoidable with proper specificity | Refactor selectors; keep `!important` only on `[hidden]` utility |
| C2 | `style.css` | Throughout | Medium | Inconsistent spacing: gap values range from 2px to 8px with no scale system | Define spacing scale: `--space-xs: 2px`, `--space-sm: 4px`, `--space-md: 8px`, `--space-lg: 16px` |
| C3 | All JS | Various | Medium | Different localStorage key naming — some use constants (`FC_KEY`, `EP_KEY`), some hardcode strings (`'ponte_drill_reverse'`) | Centralize all keys in shared `STORAGE_KEYS` object |
| C4 | All JS | Various | Medium | Inconsistent event delegation — some use `.closest()`, others use `querySelectorAll + forEach`, others use direct listeners | Establish pattern: `.closest()` for delegated, direct for known single elements |
| C5 | `index.html` | 72, 775 | Low | Flashcard badge IDs inconsistent: sidebar uses `fc-due-label-sidebar`, bottom uses `fc-due-badge-bottom` — different prefixes | Standardize to `fc-due-badge-*` |
| C6 | `server.js` | 340-341, 532-533, etc. | Low | JSON sanitization code duplicated across endpoints — `trim().replace(/^```.../)` pattern repeated 4 times | Extract to shared `parseClaudeJSON()` helper (already have `parseArticleJSON` but not used everywhere) |

---

## 8. Server-Side Issues

| # | File | Line(s) | Severity | Issue | Fix |
|---|------|---------|----------|-------|-----|
| SV1 | `server.js` | 364-378 | Medium | `POST /api/flashcards` accepts any array and writes to disk — no validation of card structure, no size limit | Validate card schema; add `express.json({ limit: '1mb' })` |
| SV2 | `server.js` | 384-443 | Medium | `POST /api/backfill-flashcards` iterates all cards with 500ms sleep — no request timeout; could run for minutes | Add max card count per request; return partial results |
| SV3 | `server.js` | 165-233 | Low | Streaming endpoint retries on parse failure with a second full API call (non-streaming) — doubles cost on malformed responses | Log retry rate; consider circuit breaker if retry rate exceeds threshold |
| SV4 | `server.js` | 496-542 | Low | `/api/distractors` endpoint exists but appears unused in current frontend code | Verify usage; remove if dead code |

---

## Summary

| Category | High | Medium | Low | Total |
|----------|------|--------|-----|-------|
| Security | 3 | 4 | 0 | **7** |
| Performance | 1 | 7 | 0 | **8** |
| Technical Debt | 1 | 7 | 2 | **10** |
| Mobile | 0 | 6 | 2 | **8** |
| Accessibility | 3 | 3 | 0 | **6** (user-facing) |
| Error Handling | 0 | 6 | 2 | **8** |
| Consistency | 0 | 4 | 2 | **6** |
| Server | 0 | 2 | 2 | **4** |
| **TOTAL** | **8** | **39** | **10** | **57** |

---

## Top 10 Priority Fixes

1. **S1-S3**: Escape all API response data before `innerHTML` (app.js, grammar.js, practice.js)
2. **P1**: Add `safe-cognates.js` to service worker PRECACHE
3. **A1**: Add `prefers-reduced-motion` media query
4. **A2**: Restore keyboard focus indicators (`outline` on `:focus-visible`)
5. **A3-A4**: Add `<label>` elements to all form inputs
6. **T1**: Extract shared utilities (escapeHTML, shuffle, API_BASE, getStorage)
7. **P3-P5**: Fix event listener accumulation in drill modes
8. **E1-E2**: Add fetch timeouts to all API calls
9. **T8**: Replace 90+ hardcoded `#0055AA` with CSS variable
10. **P2**: Lazy-load grammar/false-friends/safe-cognates data files
