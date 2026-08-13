'use strict';

// One-time local script (NOT deployed). Phrase-chunking step for the fixed
// Beginner Stories set — the story-side counterpart to backfill-audio-script.js.
//
// KEY DIFFERENCE FROM THE FLASHCARD VERSION: flashcards chunk one given
// example sentence against a given English translation. A story is a whole
// short paragraph (7-21 sentences), so this script first splits `italian`
// into sentences (deterministic regex splitter, verified below to
// reconstruct every one of the 20 stories exactly), then runs the SAME
// phrase-chunking mechanism as backfill-audio-script.js — same
// verbatim-alignment safety property (a chunk's "it" must be an exact,
// in-order substring of the sentence, never invented) — per sentence. Unlike
// the flashcard version there is no pre-existing per-sentence English to
// align against, so the model is asked to translate + chunk each sentence in
// one pass, using the story's whole-paragraph English translation as
// register/context only (not sliced, not verified verbatim).
//
// Source data is `data/beginner-stories.js`, a static file — read-only by
// construction, nothing to protect it from (no live deck, no concurrent
// writer). Output goes to Redis key 'story_audio' — separate from both
// 'flashcards'/'flashcard_audio' and the story data file itself.
//
//   node backfill-story-audio-script.js --dry-run     print sentence splits, no API calls
//   node backfill-story-audio-script.js --sample 2    generate 2 stories, print, write nothing
//   node backfill-story-audio-script.js               full run
//   node backfill-story-audio-script.js --verify       compare Redis against local cache

require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });

const fs   = require('fs');
const path = require('path');
const { Redis } = require('@upstash/redis');
const Anthropic = require('@anthropic-ai/sdk');
const AnthropicClient = Anthropic.default || Anthropic;

const AUDIO_KEY = 'story_audio';
const MODEL      = 'claude-sonnet-4-6';
const MAX_TOKENS = 1536;
const MIN_CHUNKS = 2;
const MAX_CHUNKS = 4;

const OUT_DIR    = path.join(__dirname, 'audio-backfill');
const CACHE_FILE = path.join(OUT_DIR, 'story-audio-scripts.json');

function parseArgs(argv) {
  const num = (f, d) => {
    const i = argv.indexOf(f);
    if (i === -1) return d;
    const v = parseInt(argv[i + 1], 10);
    return Number.isFinite(v) && v > 0 ? v : d;
  };
  return {
    dryRun: argv.includes('--dry-run'),
    sample: num('--sample', 0),
    verify: argv.includes('--verify'),
    concurrency: num('--concurrency', 4),
  };
}

// ── Load the static story dataset (browser-style script, no module.exports) ─
function loadStories() {
  const src = fs.readFileSync(path.join(__dirname, 'data', 'beginner-stories.js'), 'utf8');
  return new Function(src + '; return beginnerStories;')();
}

// ── Sentence splitter — verified to exactly reconstruct all 20 stories ─────
function splitSentences(text) {
  const protectedText = text.replace(/\.\.\./g, '…'); // protect ellipses from the boundary regex
  const parts = protectedText.match(/[^.!?]+[.!?]+(?:['’"»)]*)/g) || [protectedText];
  return parts.map((s) => s.trim().replace(/…/g, '...')).filter(Boolean);
}

// ── Text alignment — copied verbatim from backfill-audio-script.js ─────────
const WORD_CHAR = /[\p{L}\p{N}]/u;
function letterStream(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''); }
function buildIndex(original) {
  const chars = [], pos = [];
  for (let i = 0; i < original.length; i++) {
    if (WORD_CHAR.test(original[i])) { chars.push(original[i].toLowerCase()); pos.push(i); }
  }
  return { stream: chars.join(''), pos };
}
function alignToOriginal(original, modelChunks) {
  const { stream, pos } = buildIndex(original);
  if (!stream) return { error: 'sentence has no word characters' };
  let cursor = 0;
  const cuts = [];
  for (let k = 0; k < modelChunks.length; k++) {
    const cs = letterStream(modelChunks[k]);
    if (!cs) return { error: `chunk ${k + 1} has no word characters` };
    if (!stream.startsWith(cs, cursor)) {
      return { error: `chunk ${k + 1} ("${modelChunks[k]}") is not the next verbatim span of the sentence — altered, reordered, or a word was dropped` };
    }
    cursor += cs.length;
    cuts.push(cursor);
  }
  if (cursor !== stream.length) return { error: 'the chunks do not cover the whole sentence — text is missing from the end' };
  const out = [];
  let start = 0;
  for (let k = 0; k < cuts.length; k++) {
    let end;
    if (k === cuts.length - 1) { end = original.length; }
    else {
      end = pos[cuts[k] - 1] + 1;
      while (end < original.length && !WORD_CHAR.test(original[end]) && !/\s/.test(original[end])) end++;
    }
    const slice = original.slice(start, end).trim();
    if (!slice) return { error: `chunk ${k + 1} sliced to empty text` };
    out.push(slice);
    start = end;
  }
  if (out.map(letterStream).join('') !== stream) return { error: 'internal alignment check failed' };
  return { chunks: out };
}

// ── Prompt ───────────────────────────────────────────────────────────────
// Adapted from backfill-audio-script.js's SYSTEM_PROMPT: that version aligns
// against a GIVEN English translation; a story sentence has no pre-existing
// per-sentence English, so the model translates AND chunks in one pass,
// using the story's paragraph-level translation only for register/context —
// it must not copy from it verbatim, and nothing about it is verified (only
// the Italian side is verbatim-checked, same as the flashcard version).
const SYSTEM_PROMPT = `You segment a single Italian sentence from a short story into phrase-level chunks for a language-learning audio player, and provide your own natural English translation for each chunk.

Rules:
- Never invent, reword, translate, or correct the Italian. Each chunk's "it" must be a contiguous, verbatim span of the given Italian sentence. In order, the chunks must cover the entire sentence with nothing added, dropped, or reordered.
- Split only at natural phrase boundaries: after a verb and its object, before a prepositional phrase, before a subordinate clause or conjunction. Never split inside a noun phrase, a compound verb tense, or a preposition + article pair (del, nella, sugli, ...).
- Each chunk's "en" is your own natural English translation of that Italian span. Use the given whole-story English translation only as context for register and continuity (character names, tone) — do not copy sentences from it verbatim, since it may phrase things differently than a literal per-chunk rendering needs to.
- Produce between ${MIN_CHUNKS} and ${MAX_CHUNKS} chunks. Short sentences get ${MIN_CHUNKS}; longer ones get 3 or ${MAX_CHUNKS}. A very short sentence (under ~5 words) may need only ${MIN_CHUNKS}.

Return ONLY this JSON. No markdown, no code fences, no commentary:
{"chunks":[{"it":"...","en":"..."}]}`;

function userPrompt(sentence, storyEnglish, retryNote) {
  const base = `Italian sentence: ${sentence}\nWhole-story English translation (context only, do not copy verbatim): ${storyEnglish}`;
  if (!retryNote) return base;
  return `${base}\n\nYour previous attempt was rejected: ${retryNote}\nSplit the Italian sentence again, copying each span character-for-character from the sentence above.`;
}

function parseChunkJSON(raw) {
  const cleaned = String(raw).trim()
    .replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')
    .replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  const start = cleaned.indexOf('{'), end = cleaned.lastIndexOf('}');
  return JSON.parse(start !== -1 && end > start ? cleaned.slice(start, end + 1) : cleaned);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function generateForSentence(client, sentence, storyEnglish) {
  let retryNote = null;
  for (let pass = 1; pass <= 2; pass++) {
    let raw;
    try {
      const message = await client.messages.create({
        model: MODEL, max_tokens: MAX_TOKENS, temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt(sentence, storyEnglish, retryNote) }],
      });
      const textBlock = message.content.find((b) => b.type === 'text');
      raw = textBlock ? textBlock.text : '';
    } catch (err) {
      return { error: `API error: ${err.message}` };
    }

    let parsed;
    try { parsed = parseChunkJSON(raw); }
    catch (err) {
      retryNote = 'your output was not valid JSON';
      if (pass === 2) return { error: `unparseable JSON: ${raw.slice(0, 200)}` };
      continue;
    }

    const chunks = parsed && parsed.chunks;
    if (!Array.isArray(chunks) || chunks.length < MIN_CHUNKS || chunks.length > MAX_CHUNKS) {
      retryNote = `you returned ${Array.isArray(chunks) ? chunks.length : 'no'} chunks; produce between ${MIN_CHUNKS} and ${MAX_CHUNKS}`;
      if (pass === 2) return { error: `bad chunk count: ${Array.isArray(chunks) ? chunks.length : 'none'}` };
      continue;
    }
    if (chunks.some((c) => !c || typeof c.it !== 'string' || typeof c.en !== 'string' || !c.en.trim())) {
      retryNote = 'every chunk needs a non-empty "it" and "en" string';
      if (pass === 2) return { error: 'chunk missing it/en text' };
      continue;
    }

    const aligned = alignToOriginal(sentence, chunks.map((c) => c.it));
    if (aligned.error) {
      retryNote = aligned.error;
      if (pass === 2) return { error: `alignment failed: ${aligned.error}` };
      continue;
    }

    return { chunks: aligned.chunks.map((itText, i) => ({ it: itText, en: chunks[i].en.trim() })) };
  }
  return { error: 'exhausted retries' };
}

async function pool(items, n, worker) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const idx = i++; await worker(items[idx], idx); }
  }));
}

function loadCache() {
  if (!fs.existsSync(CACHE_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) || {}; } catch { return {}; }
}
function saveCache(c) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const t = CACHE_FILE + '.tmp';
  fs.writeFileSync(t, JSON.stringify(c, null, 2));
  fs.renameSync(t, CACHE_FILE);
}

// Per-id merge — NOT a flat { ...remote, ...cache } spread. See
// backfill-audio-script.js's mergeAudioMap() for exactly why that shape
// silently clobbers fields (audio/voice/model/at) that this script doesn't
// know about, once the render step (backfill-story-audio-elevenlabs.js) adds
// them. Written correctly from the start here.
function mergeStoryAudioMap(remote, cache) {
  const merged = { ...remote };
  for (const [id, entry] of Object.entries(cache)) {
    merged[id] = { ...remote[id], ...entry };
  }
  return merged;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const stories = loadStories();

  // Verify the splitter reconstructs every story exactly before trusting it —
  // a silent mis-split would mean a chunk's "it" is verbatim-correct against
  // the WRONG sentence boundary, not something alignToOriginal alone catches.
  const bySentences = {};
  let splitFailures = 0;
  for (const s of stories) {
    const sentences = splitSentences(s.italian);
    const rejoined = sentences.join(' ').replace(/\s+/g, ' ').trim();
    const original  = s.italian.replace(/\s+/g, ' ').trim();
    if (rejoined !== original) { splitFailures++; console.error(`SPLIT MISMATCH: ${s.id}`); continue; }
    bySentences[s.id] = sentences;
  }
  if (splitFailures) { console.error(`\n${splitFailures} stor(y/ies) failed sentence reconstruction — aborting.`); process.exit(1); }

  const totalSentences = Object.values(bySentences).reduce((n, s) => n + s.length, 0);
  console.log(`Stories: ${stories.length}   Sentences: ${totalSentences} (verified exact reconstruction on all)`);

  if (opts.dryRun) {
    stories.forEach((s) => console.log(`  ${s.id} [${s.difficulty}] ${bySentences[s.id].length} sentences`));
    console.log('\n--dry-run: no API calls.');
    return;
  }

  const url = process.env.KV_REST_API_URL;
  const redisRead  = new Redis({ url, token: process.env.KV_REST_API_READ_ONLY_TOKEN || process.env.KV_REST_API_TOKEN });
  const redisWrite = new Redis({ url, token: process.env.KV_REST_API_TOKEN });

  if (opts.verify) {
    const cache  = loadCache();
    const remote = (await redisRead.get(AUDIO_KEY)) || {};
    const cacheIds  = Object.keys(cache);
    const remoteIds = Object.keys(remote);
    const missing = cacheIds.filter((id) => !remote[id]);
    console.log(`Local cache: ${cacheIds.length}   Redis (${AUDIO_KEY}): ${remoteIds.length}`);
    if (missing.length) console.error('MISSING from Redis:', missing);
    else console.log('Verified: Redis matches local cache.');
    return;
  }

  const client = new AnthropicClient({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2 });
  if (!process.env.ANTHROPIC_API_KEY) { console.error('ANTHROPIC_API_KEY not set'); process.exit(1); }

  let work = stories;
  const sampleMode = opts.sample > 0;
  if (sampleMode) work = work.slice(0, opts.sample);

  const cache = loadCache();
  let generated = 0;
  const failures = [];

  for (const story of work) {
    const sentences = bySentences[story.id];
    const cached = (cache[story.id] && cache[story.id].sentences) || [];
    if (!sampleMode && cached.length === sentences.length) { console.log(`  ${story.id} already chunked (${sentences.length} sentences) — skipping`); continue; }

    const results = new Array(sentences.length);
    await pool(sentences, opts.concurrency, async (sentence, i) => {
      results[i] = await generateForSentence(client, sentence, story.english);
      await sleep(120);
    });

    const okSentences = [];
    let storyFailed = false;
    results.forEach((res, i) => {
      if (res.error) { failures.push({ storyId: story.id, sentenceIndex: i, sentence: sentences[i], error: res.error }); storyFailed = true; }
      else okSentences.push({ it: sentences[i], chunks: res.chunks });
    });

    if (sampleMode) {
      console.log('\n' + '='.repeat(70));
      console.log(story.id, story.title);
      okSentences.forEach((s, i) => {
        console.log(`  [${i + 1}] ${s.it}`);
        s.chunks.forEach((c) => console.log(`       - ${c.it}  →  ${c.en}`));
      });
      if (storyFailed) console.log('  (some sentences failed — see failures list at the end)');
      continue;
    }

    // Best-effort: this is supplementary metadata (not an audio-render input —
    // the render step uses the whole story text, see backfill-story-audio-elevenlabs.js),
    // so a handful of odd sentence fragments failing (e.g. a quote-boundary
    // artifact from the sentence splitter) shouldn't discard everything that
    // DID chunk cleanly. cached.length === sentences.length above means a
    // partial story is retried in full on the next run.
    if (!okSentences.length) { console.log(`  ${story.id} — all ${sentences.length} sentence(s) failed, nothing to cache`); continue; }

    cache[story.id] = { sentences: okSentences };
    generated++;
    saveCache(cache);
    const note = storyFailed ? ` (${failures.filter(f=>f.storyId===story.id).length} sentence(s) failed, omitted)` : '';
    console.log(`  ${story.id}  ${okSentences.length}/${sentences.length} sentences chunked${note}`);
  }

  if (sampleMode) {
    console.log('\n--sample: nothing written to Redis or the local cache.');
    if (failures.length) console.log('failures:', JSON.stringify(failures, null, 2));
    return;
  }

  saveCache(cache);
  if (failures.length) {
    fs.writeFileSync(path.join(OUT_DIR, 'story-chunk-failures.json'), JSON.stringify(failures, null, 2));
    console.log(`\n${failures.length} sentence failure(s) written to story-chunk-failures.json`);
  }
  console.log(`\nGenerated this run: ${generated} / ${work.length} stories.`);

  if (!generated && !Object.keys(cache).length) { console.log('Nothing to write.'); return; }

  const remote = await redisRead.get(AUDIO_KEY) || {};
  const merged = mergeStoryAudioMap(remote, cache);
  await redisWrite.set(AUDIO_KEY, merged);
  console.log(`Wrote ${AUDIO_KEY}: ${Object.keys(merged).length} stories.`);

  const after = await redisRead.get(AUDIO_KEY);
  console.log(`Verify: ${Object.keys(after || {}).length} stories readable back.`);
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
