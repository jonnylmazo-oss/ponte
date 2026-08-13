'use strict';

// One-time local script (NOT deployed).
// Generates example + exampleEN for cards that have neither. Word-lookup saves
// never populate them (#69), which blocks the audio-script backfill and so
// blocks ElevenLabs audio entirely (#86).
//
//   node backfill-examples.js --dry-run
//   node backfill-examples.js --limit 5
//   node backfill-examples.js

require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });

const fs = require('fs');
const path = require('path');
const { Redis } = require('@upstash/redis');
const Anthropic = require('@anthropic-ai/sdk');
const AnthropicClient = Anthropic.default || Anthropic;

const MODEL    = 'claude-sonnet-4-6';
const CACHE    = path.join(__dirname, 'audio-backfill', 'examples-cache.json');
const DRY      = process.argv.includes('--dry-run');
const limitArg = process.argv.indexOf('--limit');
const LIMIT    = limitArg !== -1 ? parseInt(process.argv[limitArg + 1], 10) : 0;
const CONC     = 4;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadCache() {
  if (!fs.existsSync(CACHE)) return {};
  try { return JSON.parse(fs.readFileSync(CACHE, 'utf8')) || {}; } catch { return {}; }
}
function saveCache(c) {
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  const t = CACHE + '.tmp';
  fs.writeFileSync(t, JSON.stringify(c, null, 2));
  fs.renameSync(t, CACHE);
}

function buildPrompt(card) {
  return `Write one natural Italian example sentence using the word "${card.italian}"${card.baseForm && card.baseForm !== card.italian ? ` (base form: ${card.baseForm})` : ''}, which means "${card.english}".

Requirements:
- 8-14 words, natural and colloquial — not textbook Italian.
- The sentence MUST contain the word "${card.italian}" (an inflected form is fine for verbs).
- Everyday, concrete context a learner can picture.

Return ONLY this JSON, no markdown or code fences:
{"example":"the Italian sentence","exampleEN":"a natural English translation"}`;
}

function parseJSON(raw) {
  const t = String(raw).trim()
    .replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')
    .replace(/[""]/g, '"').replace(/['']/g, "'");
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  return JSON.parse(a !== -1 && b > a ? t.slice(a, b + 1) : t);
}

async function pool(items, n, worker) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) await worker(items[i++]);
  }));
}

(async () => {
  const url = process.env.KV_REST_API_URL;
  const read  = new Redis({ url, token: process.env.KV_REST_API_READ_ONLY_TOKEN });
  const write = new Redis({ url, token: process.env.KV_REST_API_TOKEN });
  const client = new AnthropicClient({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 3 });

  const deck = await read.get('flashcards');
  const blank = (v) => v === undefined || v === null || !String(v).trim();
  let todo = deck.filter((c) => blank(c.example) || blank(c.exampleEN));

  const cache = loadCache();
  const pending = todo.filter((c) => !cache[String(c.id)]);

  console.log('deck cards            :', deck.length);
  console.log('missing an example    :', todo.length);
  console.log('already in cache      :', todo.length - pending.length);
  console.log('to generate           :', LIMIT ? Math.min(LIMIT, pending.length) : pending.length);
  if (DRY) { console.log('\n--dry-run: no API calls.'); return; }

  const work = LIMIT ? pending.slice(0, LIMIT) : pending;
  let done = 0, failed = [];

  await pool(work, CONC, async (card) => {
    try {
      const msg = await client.messages.create({
        model: MODEL, max_tokens: 400, temperature: 0.6,
        messages: [{ role: 'user', content: buildPrompt(card) }],
      });
      const j = parseJSON(msg.content.find((b) => b.type === 'text').text);
      if (!j.example || !j.exampleEN) throw new Error('missing fields');
      cache[String(card.id)] = { example: String(j.example).trim(), exampleEN: String(j.exampleEN).trim() };
    } catch (e) {
      failed.push({ id: String(card.id), italian: card.italian, error: e.message });
    }
    if (++done % 20 === 0 || done === work.length) {
      saveCache(cache);
      console.log('  ' + done + '/' + work.length + (failed.length ? '  failed:' + failed.length : ''));
    }
    await sleep(120);
  });
  saveCache(cache);

  // Merge into the deck.
  const ids = Object.keys(cache);
  const next = deck.map((c) => {
    const hit = cache[String(c.id)];
    if (!hit) return c;
    if (!blank(c.example) && !blank(c.exampleEN)) return c;   // never overwrite real data
    return { ...c, example: hit.example, exampleEN: hit.exampleEN };
  });
  const changed = next.filter((c, i) => c.example !== deck[i].example).length;

  if (next.length !== deck.length) { console.error('ABORT: card count changed'); process.exit(1); }
  console.log('\ncached examples:', ids.length, ' cards updated:', changed, ' failures:', failed.length);
  if (failed.length) fs.writeFileSync(path.join(__dirname, 'audio-backfill', 'examples-failures.json'), JSON.stringify(failed, null, 2));

  if (!changed) { console.log('nothing to write.'); return; }
  await write.set('flashcards_bak_pre_examples', deck);
  await write.set('flashcards', next);
  const after = await read.get('flashcards');
  const stillBlank = after.filter((c) => blank(c.example) || blank(c.exampleEN)).length;
  console.log('wrote ' + after.length + ' cards; still missing an example: ' + stillBlank);
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
