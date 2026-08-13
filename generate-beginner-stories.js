'use strict';

// One-time local script (NOT deployed). Generates the fixed 20-story
// "Beginner Stories" set using the EXACT SAME prompt the live Reader uses for
// dynamic generation (buildPrompt in lib/ponte.js), just with difficulty set
// to A1/A2 instead of B1/B2 and a fixed topic list instead of free text.
//
// lib/ponte.js is deliberately NOT required here (same reason
// backfill-audio-script.js and backfill-examples.js don't require it): it
// process.exit()s at import time if PONTE_SESSION_SECRET is unset, which is
// fine in the deployed serverless context but not for a local script. The
// buildPrompt() function below is copied verbatim from lib/ponte.js so the
// generated stories go through the identical prompt/schema/category rules as
// every dynamically-generated article.
//
//   node generate-beginner-stories.js --dry-run     print topics, no API calls
//   node generate-beginner-stories.js                full run

require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });

const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const AnthropicClient = Anthropic.default || Anthropic;

const MODEL   = 'claude-sonnet-4-6';
const CACHE   = path.join(__dirname, 'audio-backfill', 'beginner-stories-cache.json');
const DRY     = process.argv.includes('--dry-run');
const CONC    = 3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Topics ──────────────────────────────────────────────────────────────────
const STORIES = [
  { id: 'beg01', difficulty: 'A1', topic: 'ordinare un caffè al bar' },
  { id: 'beg02', difficulty: 'A1', topic: 'presentarsi a una persona nuova' },
  { id: 'beg03', difficulty: 'A1', topic: 'la mia famiglia' },
  { id: 'beg04', difficulty: 'A1', topic: 'la routine del mattino' },
  { id: 'beg05', difficulty: 'A1', topic: 'fare la spesa al mercato' },
  { id: 'beg06', difficulty: 'A1', topic: 'chiedere indicazioni per strada' },
  { id: 'beg07', difficulty: 'A1', topic: 'che tempo fa oggi' },
  { id: 'beg08', difficulty: 'A1', topic: 'il mio animale domestico' },
  { id: 'beg09', difficulty: 'A1', topic: 'comprare vestiti nuovi' },
  { id: 'beg10', difficulty: 'A1', topic: 'una telefonata con un amico' },
  { id: 'beg11', difficulty: 'A2', topic: 'cena al ristorante' },
  { id: 'beg12', difficulty: 'A2', topic: 'un viaggio in treno' },
  { id: 'beg13', difficulty: 'A2', topic: 'il check-in in albergo' },
  { id: 'beg14', difficulty: 'A2', topic: 'in farmacia per un raffreddore' },
  { id: 'beg15', difficulty: 'A2', topic: 'una giornata al mare' },
  { id: 'beg16', difficulty: 'A2', topic: 'una cena a casa di un amico' },
  { id: 'beg17', difficulty: 'A2', topic: 'il mio lavoro in ufficio' },
  { id: 'beg18', difficulty: 'A2', topic: 'organizzare una festa di compleanno' },
  { id: 'beg19', difficulty: 'A2', topic: 'un weekend in campagna' },
  { id: 'beg20', difficulty: 'A2', topic: 'un appuntamento dal medico' },
];

// ── Prompt — copied verbatim from lib/ponte.js buildPrompt() ────────────────
function sanitizeUserText(str, maxLen = 600) {
  return String(str == null ? '' : str)
    .slice(0, maxLen)
    .replace(/[\x00-\x1F\x7F]/g, ' ')
    .replace(/```/g, "'''")
    .replace(/\s+/g, ' ')
    .trim();
}

function buildPrompt(topic, difficulty, strict = false) {
  const safeTopic      = sanitizeUserText(topic, 200);
  const safeDifficulty = sanitizeUserText(difficulty, 20);
  const strictNote = strict
    ? ' CRITICAL: use only straight ASCII double-quote characters (") for all JSON strings — no curly quotes, no smart quotes, no special Unicode punctuation anywhere in the output.'
    : '';
  return `You are an Italian language learning content generator. Write a short ${safeDifficulty} Italian article about "${safeTopic}" in a colloquial, natural register — not textbook Italian. Return ONLY valid JSON with this exact structure:
{
  "id": 0,
  "title": "...",
  "difficulty": "${safeDifficulty}",
  "topic": "${safeTopic}",
  "italian": "(80-120 words, natural colloquial Italian)",
  "english": "(natural English translation, not literal)",
  "spanish": "(natural Spanish translation)",
  "words": [
    { "w": "italian word", "en": "english", "es": "spanish", "c": "same|similar|false-friend|new", "n": "one short note", "p": "stress hint e.g. BUR-ro" }
  ]
}
The words array must include minimum 6 annotated words covering all four categories: same, similar, false-friend, new. For false-friend and similar entries, the note field must explain specifically how it differs from Spanish.
Category rules for the "c" field — the category must be exactly one of: same, similar, false-friend, new.
"same" — the Italian word is visually near-identical to Spanish AND the meaning is fully equivalent with no added or missing senses. Examples: turista/turista, musica/música.
"similar" — the Italian word resembles Spanish and the core meaning transfers, but Italian carries an additional sense, narrower usage, or different register than the Spanish equivalent. The Spanish meaning is a subset or overlap, not a wrong answer.
"false-friend" — the Italian word resembles Spanish but produces a WRONG meaning if the Spanish instinct is applied. This is not about added nuance — it's about the Spanish meaning being actively incorrect in Italian. Examples: burro (Italian=butter, Spanish=donkey), largo (Italian=wide, Spanish=long).
"new" — the Italian word has no meaningful visual or semantic connection to Spanish. Examples: sotto (under) vs bajo, scegliere vs elegir.
Return only the JSON object, no markdown, no code fences.${strictNote}`;
}

// ── JSON parsing (same tolerance as lib/ponte.js, inlined) ──────────────────
function sanitizeJSON(str) {
  return str.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
}
function extractAndSanitize(raw) {
  const stripped = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  return sanitizeJSON(stripped);
}
function parseArticleJSON(raw) {
  const sanitized = extractAndSanitize(raw);
  return JSON.parse(sanitized);
}

// ── Validation ────────────────────────────────────────────────────────────
function validate(story, spec) {
  const problems = [];
  if (!story.title || !story.italian || !story.english || !story.spanish) problems.push('missing a core text field');
  const wc = (story.italian || '').trim().split(/\s+/).filter(Boolean).length;
  if (wc < 50 || wc > 160) problems.push(`italian word count out of range (${wc})`);
  if (!Array.isArray(story.words) || story.words.length < 6) problems.push(`words array too short (${story.words ? story.words.length : 0})`);
  const cats = new Set((story.words || []).map((w) => w.c));
  ['same', 'similar', 'false-friend', 'new'].forEach((c) => { if (!cats.has(c)) problems.push(`missing category "${c}" in words`); });
  return problems;
}

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

async function pool(items, n, worker) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) await worker(items[i++]);
  }));
}

(async () => {
  console.log('Stories to generate:', STORIES.length);
  STORIES.forEach((s) => console.log(`  ${s.id}  [${s.difficulty}]  ${s.topic}`));
  if (DRY) { console.log('\n--dry-run: no API calls.'); return; }

  if (!process.env.ANTHROPIC_API_KEY) { console.error('ANTHROPIC_API_KEY not set'); process.exit(1); }
  const client = new AnthropicClient({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 3 });

  const cache = loadCache();
  const failures = [];
  let done = 0;

  await pool(STORIES, CONC, async (spec) => {
    if (cache[spec.id] && !cache[spec.id].__failed) { done++; return; } // resume support

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const msg = await client.messages.create({
          model: MODEL, max_tokens: 1500, temperature: 0.8,
          messages: [{ role: 'user', content: buildPrompt(spec.topic, spec.difficulty, attempt > 1) }],
        });
        const textBlock = msg.content.find((b) => b.type === 'text');
        const story = parseArticleJSON(textBlock.text);
        story.id = spec.id;
        story.difficulty = spec.difficulty;
        story.topic = spec.topic;

        const problems = validate(story, spec);
        if (problems.length && attempt === 1) {
          console.warn(`  ${spec.id} attempt 1 flagged: ${problems.join('; ')} — retrying`);
          continue;
        }
        if (problems.length) console.warn(`  ${spec.id} still flagged after retry: ${problems.join('; ')} (keeping anyway, review manually)`);

        cache[spec.id] = story;
        break;
      } catch (e) {
        if (attempt === 2) {
          failures.push({ id: spec.id, topic: spec.topic, error: e.message });
          cache[spec.id] = { __failed: true, error: e.message };
        }
      }
    }
    done++;
    saveCache(cache);
    console.log(`  ${done}/${STORIES.length}  ${spec.id}  ${cache[spec.id] && cache[spec.id].title ? '"' + cache[spec.id].title + '"' : 'FAILED'}`);
    await sleep(150);
  });

  saveCache(cache);
  console.log('\ndone:', done, '/', STORIES.length, ' failures:', failures.length);
  if (failures.length) console.log(JSON.stringify(failures, null, 2));
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
