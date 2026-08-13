'use strict';

// One-time local backfill script (NOT deployed).
// Generates phrase-level audio scripts for flashcards that already have an
// example sentence + translation, and stores them in a SEPARATE Redis key.
//
// KEY SEPARATION (the whole point of this design):
//   'flashcards'      — the live deck. READ ONLY, and read with the read-only
//                       Upstash token so writing to it is impossible at the
//                       credential level, not just by convention.
//   'flashcard_audio' — { [String(card.id)]: { chunks: [{ it, en }] } }
//                       The only key this script ever writes.
// The app blind-overwrites the whole 'flashcards' array on every save
// (flashcards.js saveCards → api/flashcards.js redis.set), so anything stored
// on the cards themselves can be wiped by a stale browser tab. Nothing here
// touches that key, so the two data sets cannot clobber each other.
//
// The local cache (audio-backfill/audio-scripts.json) is the source of truth:
// every generated chunk set is written to disk BEFORE any Redis write, so a
// crash, a bad write, or a wiped key can be re-applied with --repair at zero
// API cost.
//
// Usage:
//   node backfill-audio-script.js --sample 5     generate 5, print them, write nothing
//   node backfill-audio-script.js --dry-run      no API calls, no writes; reports + skip list
//   node backfill-audio-script.js                full run
//   node backfill-audio-script.js --repair       re-apply local cache to Redis, no API calls
//   node backfill-audio-script.js --verify       compare Redis against local cache, exit
//
// Flags: --limit N  --batch-size N  --concurrency N  --force  --thinking

require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });

const fs   = require('fs');
const path = require('path');
const { Redis } = require('@upstash/redis');
const Anthropic = require('@anthropic-ai/sdk');

const AnthropicClient = Anthropic.default || Anthropic;

// ── Constants ───────────────────────────────────────────────────────────────
const DECK_KEY      = 'flashcards';           // read-only, never written
const AUDIO_KEY     = 'flashcard_audio';      // the only key we write
const AUDIO_BAK_KEY = 'flashcard_audio_bak';  // backup of AUDIO_KEY before first write

const MODEL      = 'claude-sonnet-4-6';
const MAX_TOKENS = 1024;

const OUT_DIR      = path.join(__dirname, 'audio-backfill');
const CACHE_FILE   = path.join(OUT_DIR, 'audio-scripts.json');
const SKIPPED_JSON = path.join(OUT_DIR, 'skipped-cards.json');
const SKIPPED_TXT  = path.join(OUT_DIR, 'skipped-cards.txt');
const FAILURES     = path.join(OUT_DIR, 'failures.json');

const MIN_CHUNKS = 2;
const MAX_CHUNKS = 4;

// ── CLI ─────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const has = (f) => argv.includes(f);
  const num = (f, dflt) => {
    const i = argv.indexOf(f);
    if (i === -1) return dflt;
    const v = parseInt(argv[i + 1], 10);
    if (!Number.isFinite(v) || v <= 0) {
      console.error(`${f} requires a positive integer`);
      process.exit(1);
    }
    return v;
  };
  return {
    dryRun:      has('--dry-run'),
    repair:      has('--repair'),
    verify:      has('--verify'),
    force:       has('--force'),
    thinking:    has('--thinking'),
    sample:      num('--sample', 0),
    limit:       num('--limit', 0),
    batchSize:   num('--batch-size', 25),
    concurrency: num('--concurrency', 4),
  };
}

// ── Redis clients ───────────────────────────────────────────────────────────
// Two clients, deliberately. redisRead carries the read-only token wherever one
// is configured, so the deck read cannot mutate anything even if this file has
// a bug. redisWrite is used by exactly two functions, both of which hardcode
// AUDIO_KEY / AUDIO_BAK_KEY.
function makeClients() {
  const url = process.env.KV_REST_API_URL;
  const writeToken = process.env.KV_REST_API_TOKEN;
  const readToken  = process.env.KV_REST_API_READ_ONLY_TOKEN || writeToken;

  if (!url || !writeToken) {
    console.error('Missing KV_REST_API_URL / KV_REST_API_TOKEN (check .env.local).');
    process.exit(1);
  }
  if (!process.env.KV_REST_API_READ_ONLY_TOKEN) {
    console.warn('Note: KV_REST_API_READ_ONLY_TOKEN not set — reading the deck with the write token.');
  }
  return {
    redisRead:  new Redis({ url, token: readToken }),
    redisWrite: new Redis({ url, token: writeToken }),
  };
}

// ── Text alignment ──────────────────────────────────────────────────────────
// The "do not invent" guarantee is structural, not hopeful: the model only ever
// supplies boundary positions. We match its chunks against the original as a
// letters-and-digits-only stream, then slice the ORIGINAL sentence at the
// derived boundaries. Whatever the model actually typed is discarded.

const WORD_CHAR = /[\p{L}\p{N}]/u;

function letterStream(s) {
  return String(s == null ? '' : s).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

function buildIndex(original) {
  const chars = [];
  const pos   = []; // pos[k] = index in `original` of the k-th stream char
  for (let i = 0; i < original.length; i++) {
    if (WORD_CHAR.test(original[i])) {
      chars.push(original[i].toLowerCase());
      pos.push(i);
    }
  }
  return { stream: chars.join(''), pos };
}

// Returns { chunks: [it...] } sliced from `original`, or { error } describing
// the first divergence so the retry can quote it back to the model.
function alignToOriginal(original, modelChunks) {
  const { stream, pos } = buildIndex(original);
  if (!stream) return { error: 'original sentence has no word characters' };

  let cursor = 0;
  const cuts = [];

  for (let k = 0; k < modelChunks.length; k++) {
    const cs = letterStream(modelChunks[k]);
    if (!cs) return { error: `chunk ${k + 1} has no word characters` };
    if (!stream.startsWith(cs, cursor)) {
      return {
        error: `chunk ${k + 1} ("${modelChunks[k]}") is not the next verbatim span of the ` +
               `Italian sentence — the text was altered, reordered, or a word was dropped`,
      };
    }
    cursor += cs.length;
    cuts.push(cursor); // cumulative stream position after this chunk
  }

  if (cursor !== stream.length) {
    return { error: 'the chunks do not cover the whole Italian sentence — text is missing from the end' };
  }

  // Turn cumulative stream positions into character boundaries in `original`,
  // pulling any immediately-trailing punctuation into the preceding chunk.
  const out = [];
  let start = 0;
  for (let k = 0; k < cuts.length; k++) {
    let end;
    if (k === cuts.length - 1) {
      end = original.length; // last chunk absorbs the trailing period
    } else {
      end = pos[cuts[k] - 1] + 1;
      while (end < original.length && !WORD_CHAR.test(original[end]) && !/\s/.test(original[end])) {
        end++; // trailing , . ! ? » ) etc. belong with the chunk they follow
      }
    }
    const slice = original.slice(start, end).trim();
    if (!slice) return { error: `chunk ${k + 1} sliced to empty text` };
    out.push(slice);
    start = end;
  }

  // Final invariant: the sliced chunks reproduce the original word-for-word.
  if (out.map(letterStream).join('') !== stream) {
    return { error: 'internal alignment check failed' };
  }
  return { chunks: out };
}

// ── Prompt ──────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You segment Italian sentences into phrase-level chunks for a language-learning audio player.

You are given an Italian sentence and an existing English translation of it. Split BOTH into aligned chunks.

Rules:
- Never invent, reword, translate, or correct the Italian. Each chunk's "it" must be a contiguous, verbatim span of the given Italian sentence. In order, the chunks must cover the entire sentence with nothing added, dropped, or reordered.
- Split only at natural phrase boundaries: after a verb and its object, before a prepositional phrase, before a subordinate clause or conjunction. Never split inside a noun phrase, a compound verb tense, or a preposition + article pair (del, nella, sugli, ...).
- Each chunk's "en" is the portion of the GIVEN English translation corresponding to that Italian chunk. English and Italian word order differ, so you may reorder or lightly adjust wording so the pairs line up — but stay faithful to the translation you were given. Do not retranslate from scratch.
- Produce between ${MIN_CHUNKS} and ${MAX_CHUNKS} chunks. Short sentences get ${MIN_CHUNKS}; longer ones get 3 or ${MAX_CHUNKS}.

Return ONLY this JSON. No markdown, no code fences, no commentary:
{"chunks":[{"it":"...","en":"..."}]}`;

function userPrompt(it, en, retryNote) {
  const base = `Italian: ${it}\nEnglish: ${en}`;
  if (!retryNote) return base;
  return `${base}\n\nYour previous attempt was rejected: ${retryNote}\nSplit the Italian sentence again, copying each span character-for-character from the sentence above.`;
}

// ── JSON parsing (same tolerance as lib/ponte.js, inlined) ──────────────────
// lib/ponte.js cannot be required here: it process.exit()s at import time when
// PONTE_SESSION_SECRET is unset, which is the normal local case.
function parseChunkJSON(raw) {
  const cleaned = String(raw).trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
  const start = cleaned.indexOf('{');
  const end   = cleaned.lastIndexOf('}');
  const body  = (start !== -1 && end > start) ? cleaned.slice(start, end + 1) : cleaned;
  return JSON.parse(body);
}

// ── API call with backoff ───────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Classify by HTTP status rather than message text. 4xx (other than 429) is a
// bad request — retrying it just burns quota.
function classifyError(err) {
  const status = err && typeof err.status === 'number' ? err.status : null;
  if (status === 429) return 'rate-limit';
  if (status !== null && status >= 500) return 'server';
  if (status !== null) return 'client';
  return 'connection';
}

function retryAfterMs(err) {
  const h = err && err.headers;
  if (!h) return null;
  const raw = typeof h.get === 'function' ? h.get('retry-after') : h['retry-after'];
  const secs = parseFloat(raw);
  return Number.isFinite(secs) && secs >= 0 ? secs * 1000 : null;
}

async function callWithRetry(client, params, label) {
  const MAX_ATTEMPTS = 5;
  for (let attempt = 1; ; attempt++) {
    try {
      return await client.messages.create(params);
    } catch (err) {
      const kind = classifyError(err);
      if (kind === 'client' || attempt >= MAX_ATTEMPTS) throw err;
      const backoff = Math.min(8000, 1000 * 2 ** (attempt - 1));
      const jitter  = backoff * (0.8 + Math.random() * 0.4);
      const waitMs  = retryAfterMs(err) ?? jitter;
      console.warn(`  [${label}] ${kind} (attempt ${attempt}/${MAX_ATTEMPTS}) — retrying in ${Math.round(waitMs)}ms`);
      await sleep(waitMs);
    }
  }
}

// ── Generation ──────────────────────────────────────────────────────────────
// Returns { chunks } on success or { error } after one corrective retry.
async function generateForCard(client, card, opts) {
  const it = String(card.example).trim();
  const en = String(card.exampleEN).trim();
  const label = String(card.id);

  let retryNote = null;

  for (let pass = 1; pass <= 2; pass++) {
    const params = {
      model:       MODEL,
      max_tokens:  MAX_TOKENS,
      temperature: 0,
      system:      SYSTEM_PROMPT,
      messages:    [{ role: 'user', content: userPrompt(it, en, retryNote) }],
    };
    // The boundary check catches bad output deterministically, so thinking is
    // off by default; --thinking flips it on if sample quality warrants it.
    if (opts.thinking) {
      params.thinking = { type: 'adaptive' };
      params.max_tokens = 4096;
    }

    let raw;
    try {
      const message = await callWithRetry(client, params, label);
      const textBlock = message.content.find((b) => b.type === 'text');
      raw = textBlock ? textBlock.text : '';
    } catch (err) {
      return { error: `API error: ${err.message}` };
    }

    let parsed;
    try {
      parsed = parseChunkJSON(raw);
    } catch (err) {
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

    const aligned = alignToOriginal(it, chunks.map((c) => c.it));
    if (aligned.error) {
      retryNote = aligned.error;
      if (pass === 2) return { error: `alignment failed: ${aligned.error}` };
      continue;
    }

    // Italian comes from slicing the original; English comes from the model.
    return {
      chunks: aligned.chunks.map((itText, i) => ({
        it: itText,
        en: chunks[i].en.trim(),
      })),
    };
  }

  return { error: 'exhausted retries' };
}

// ── Concurrency pool ────────────────────────────────────────────────────────
async function runPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let next = 0;
  const lanes = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
      await sleep(150); // stagger so a lane finishing doesn't cause a burst
    }
  });
  await Promise.all(lanes);
  return results;
}

// ── Local cache ─────────────────────────────────────────────────────────────
function ensureOutDir() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
}

function loadCache() {
  if (!fs.existsSync(CACHE_FILE)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
  } catch (err) {
    console.error(`Cache file ${CACHE_FILE} is corrupt: ${err.message}`);
    console.error('Move it aside and re-run, or fix the JSON. Refusing to overwrite it.');
    process.exit(1);
  }
}

function saveCache(cache) {
  ensureOutDir();
  const tmp = `${CACHE_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(cache, null, 2));
  fs.renameSync(tmp, CACHE_FILE); // atomic — a crash mid-write can't truncate the cache
}

// ── Redis write (the ONLY functions that touch redisWrite) ──────────────────
// The local cache only ever knows about `chunks` — it has no idea
// backfill-audio-elevenlabs.js also stores `audio`/`voice`/`model`/`at` on
// these same ids. A flat `{ ...remote, ...cache }` spread replaces each id's
// WHOLE entry with cache's bare `{ chunks }`, silently discarding those
// fields on every id the cache has ever touched — which is exactly what
// wiped ElevenLabs audio off all 482 rendered cards on 2026-08-13. Merge per
// id instead, so cache's fields extend remote's rather than replacing them.
function mergeAudioMap(remote, cache) {
  const merged = { ...remote };
  for (const [id, entry] of Object.entries(cache)) {
    merged[id] = { ...remote[id], ...entry };
  }
  return merged;
}

async function readAudioMap(redisRead) {
  const existing = await redisRead.get(AUDIO_KEY);
  if (existing == null) return {};
  if (typeof existing !== 'object' || Array.isArray(existing)) {
    throw new Error(`${AUDIO_KEY} holds a ${Array.isArray(existing) ? 'array' : typeof existing}, expected an object`);
  }
  return existing;
}

async function writeAudioMap(redisWrite, merged, expectedMin) {
  const count = Object.keys(merged).length;
  if (count === 0) {
    throw new Error('refusing to write an empty object to ' + AUDIO_KEY);
  }
  if (count < expectedMin) {
    throw new Error(`refusing to write ${count} entries — fewer than the ${expectedMin} expected`);
  }
  await redisWrite.set(AUDIO_KEY, merged);
  return count;
}

// ── Partitioning ────────────────────────────────────────────────────────────
function partition(cards, audioMap, force) {
  const todo = [], skipped = [], done = [];

  for (const card of cards) {
    const id = String(card.id);
    const ex = typeof card.example   === 'string' ? card.example.trim()   : '';
    const en = typeof card.exampleEN === 'string' ? card.exampleEN.trim() : '';

    let reason = null;
    if (card.example   === undefined) reason = 'missing-example';
    else if (!ex)                     reason = 'empty-example';
    else if (card.exampleEN === undefined) reason = 'missing-english';
    else if (!en)                     reason = 'empty-english';

    if (reason) {
      skipped.push({
        id, reason,
        italian:       card.italian || '',
        english:       card.english || '',
        category:      card.category || '',
        wordType:      card.wordType || '',
        sourceArticle: card.sourceArticle || '',
      });
      continue;
    }
    if (!force && audioMap[id]) { done.push(id); continue; }
    todo.push(card);
  }
  return { todo, skipped, done };
}

function writeSkipList(skipped) {
  ensureOutDir();
  fs.writeFileSync(SKIPPED_JSON, JSON.stringify(skipped, null, 2));
  const lines = [
    `# Cards skipped by backfill-audio-script.js — ${new Date().toISOString()}`,
    `# ${skipped.length} card(s) lack a usable example / exampleEN pair.`,
    '',
    ...skipped.map((s) =>
      `${s.id}\t${s.reason}\t${s.italian}\t${s.english}\t[${s.category}/${s.wordType}]\t${s.sourceArticle}`),
    '',
  ];
  fs.writeFileSync(SKIPPED_TXT, lines.join('\n'));
  console.log(`Skip list written to ${path.relative(__dirname, SKIPPED_JSON)} and .txt`);
}

// ── Modes ───────────────────────────────────────────────────────────────────
async function modeVerify(redisRead) {
  const cache  = loadCache();
  const remote = await readAudioMap(redisRead);
  const cacheIds  = Object.keys(cache);
  const remoteIds = Object.keys(remote);
  const missing = cacheIds.filter((id) => !remote[id]);
  const extra   = remoteIds.filter((id) => !cache[id]);

  console.log(`Local cache : ${cacheIds.length} entries`);
  console.log(`${AUDIO_KEY} : ${remoteIds.length} entries`);

  if (missing.length) {
    console.error(`\nMISSING from Redis: ${missing.length} entr(ies) present locally but not remotely.`);
    console.error(`First few: ${missing.slice(0, 10).join(', ')}`);
    console.error('Run with --repair to re-apply them (no API calls).');
  }
  if (extra.length) {
    console.warn(`\n${extra.length} entr(ies) in Redis are not in the local cache (older run?).`);
  }
  if (!missing.length && !extra.length) {
    console.log('\nVerified: Redis matches the local cache exactly.');
  }
  return missing.length === 0;
}

async function modeRepair(redisRead, redisWrite) {
  const cache = loadCache();
  const ids = Object.keys(cache);
  if (!ids.length) {
    console.error('Local cache is empty — nothing to repair.');
    process.exit(1);
  }
  const existing = await readAudioMap(redisRead);
  const merged = mergeAudioMap(existing, cache);
  const count = await writeAudioMap(redisWrite, merged, Math.max(ids.length, Object.keys(existing).length));
  console.log(`Repaired: re-applied ${ids.length} cached entr(ies); ${AUDIO_KEY} now holds ${count}. No API calls made.`);
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const { redisRead, redisWrite } = makeClients();

  if (opts.verify) {
    const ok = await modeVerify(redisRead);
    process.exit(ok ? 0 : 1);
  }
  if (opts.repair) {
    await modeRepair(redisRead, redisWrite);
    return;
  }

  // Read the deck — read-only credential, never written.
  const raw = await redisRead.get(DECK_KEY);
  if (!Array.isArray(raw)) {
    console.error(`'${DECK_KEY}' is not an array (got ${typeof raw}) — aborting.`);
    process.exit(1);
  }
  const cards = raw;
  const audioMap = await readAudioMap(redisRead);
  const cache = loadCache();

  console.log(`Deck              : ${cards.length} cards (read-only)`);
  console.log(`${AUDIO_KEY}: ${Object.keys(audioMap).length} existing entries`);
  console.log(`Local cache       : ${Object.keys(cache).length} entries`);

  const { todo, skipped, done } = partition(cards, audioMap, opts.force);
  console.log(`\nAlready generated : ${done.length}`);
  console.log(`Skipped (no example): ${skipped.length}`);
  console.log(`To generate       : ${todo.length}`);

  writeSkipList(skipped);

  if (opts.dryRun) {
    console.log('\n--dry-run: no API calls, no writes. Skip list above is the deliverable.');
    return;
  }

  let work = todo;
  const sampleMode = opts.sample > 0;
  if (sampleMode) work = work.slice(0, opts.sample);
  else if (opts.limit) work = work.slice(0, opts.limit);

  if (!work.length) {
    console.log('\nNothing to generate.');
    return;
  }

  const client = new AnthropicClient({
    apiKey:     process.env.ANTHROPIC_API_KEY,
    maxRetries: 2,
  });
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set (check .env).');
    process.exit(1);
  }

  console.log(`\nGenerating ${work.length} card(s) with ${MODEL} ` +
              `(concurrency ${opts.concurrency}${opts.thinking ? ', thinking on' : ''})...\n`);

  const failures = [];
  let generated = 0;

  // Sample mode: generate, print, write nothing anywhere.
  if (sampleMode) {
    const results = await runPool(work, opts.concurrency, (card) => generateForCard(client, card, opts));
    results.forEach((res, i) => {
      const card = work[i];
      console.log('─'.repeat(72));
      console.log(`${card.italian}  (${card.wordType || '—'}, id ${card.id})`);
      console.log(`  IT: ${card.example}`);
      console.log(`  EN: ${card.exampleEN}`);
      if (res.error) {
        console.log(`  ✗ FAILED: ${res.error}`);
        failures.push({ id: String(card.id), italian: card.italian, error: res.error });
      } else {
        console.log('  chunks:');
        res.chunks.forEach((c, n) => {
          console.log(`    ${n + 1}. ${c.it}`);
          console.log(`       ${c.en}`);
        });
        const rebuilt = res.chunks.map((c) => c.it).join(' ');
        console.log(`  reconstruction: ${rebuilt === card.example.trim() ? 'exact' : `differs only in spacing → "${rebuilt}"`}`);
      }
    });
    console.log('─'.repeat(72));
    console.log(`\n--sample: ${results.length - failures.length} ok, ${failures.length} failed. ` +
                'Nothing written to Redis or the local cache.');
    return;
  }

  // Full run: batches of batchSize, each generated concurrently, then written.
  let backedUp = false;
  const batches = [];
  for (let i = 0; i < work.length; i += opts.batchSize) batches.push(work.slice(i, i + opts.batchSize));

  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];
    const results = await runPool(batch, opts.concurrency, (card) => generateForCard(client, card, opts));

    let okInBatch = 0;
    results.forEach((res, i) => {
      const card = batch[i];
      if (res.error) {
        failures.push({ id: String(card.id), italian: card.italian, example: card.example, error: res.error });
      } else {
        cache[String(card.id)] = { chunks: res.chunks };
        okInBatch++;
        generated++;
      }
    });

    // Disk first, always — the cache is the source of truth.
    saveCache(cache);

    if (okInBatch === 0) {
      console.log(`[batch ${b + 1}/${batches.length}] 0 ok, ${results.length} failed — nothing to write`);
      continue;
    }

    // Back up the existing audio key once, before the first mutation.
    if (!backedUp) {
      const current = await readAudioMap(redisRead);
      if (Object.keys(current).length) {
        await redisWrite.set(AUDIO_BAK_KEY, current);
        console.log(`Backed up ${Object.keys(current).length} existing entries to '${AUDIO_BAK_KEY}'.`);
      }
      ensureOutDir();
      fs.writeFileSync(
        path.join(OUT_DIR, `deck-snapshot-${new Date().toISOString().replace(/[:.]/g, '-')}.json`),
        JSON.stringify(cards, null, 2),
      );
      backedUp = true;
    }

    // Re-read + merge so a concurrent writer to this key is preserved.
    const remote = await readAudioMap(redisRead);
    const merged = mergeAudioMap(remote, cache);
    const expectedMin = Math.max(Object.keys(remote).length, Object.keys(cache).length);
    const total = await writeAudioMap(redisWrite, merged, expectedMin);

    console.log(`[batch ${b + 1}/${batches.length}] ${okInBatch}/${results.length} ok ` +
                `— ${AUDIO_KEY} now holds ${total} entries`);
  }

  if (failures.length) {
    ensureOutDir();
    fs.writeFileSync(FAILURES, JSON.stringify(failures, null, 2));
  }

  // Post-run verification.
  console.log('\nVerifying...');
  const finalRemote = await readAudioMap(redisRead);
  const cacheCount  = Object.keys(cache).length;
  const remoteCount = Object.keys(finalRemote).length;
  const missing = Object.keys(cache).filter((id) => !finalRemote[id]);

  console.log('\n' + '='.repeat(60));
  console.log(`Generated this run : ${generated}`);
  console.log(`Skipped (no example): ${skipped.length}`);
  console.log(`Failed             : ${failures.length}${failures.length ? ` (see ${path.relative(__dirname, FAILURES)})` : ''}`);
  console.log(`Local cache        : ${cacheCount} entries`);
  console.log(`${AUDIO_KEY}       : ${remoteCount} entries`);
  console.log('='.repeat(60));

  if (missing.length) {
    console.error(`\nVERIFY FAILED: ${missing.length} cached entr(ies) are not in Redis. Run --repair.`);
    process.exitCode = 1;
  } else {
    console.log('\nVerified: every cached entry is present in Redis.');
  }
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
