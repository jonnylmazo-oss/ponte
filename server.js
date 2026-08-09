'use strict';

// Legacy Express server — kept for local dev reference. Production runs on Vercel
// functions in /api/ (shared helpers in lib/ponte.js; flashcards persist to Vercel KV).

const fs = require('fs');
require('dotenv').config({ path: fs.existsSync('/root/ponte.env') ? '/root/ponte.env' : '.env' });
const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const crypto   = require('crypto');
const Anthropic = require('@anthropic-ai/sdk');

const app  = express();
const PORT = process.env.PORT || 3000;

const FLASHCARDS_PATH = process.env.FLASHCARDS_PATH || path.join(__dirname, 'data', 'flashcards.json');

// Hosting TBD — migration in progress. Add the production origin here once chosen.
const ALLOWED_ORIGINS = [
  'http://localhost:8080',
  'http://127.0.0.1:8080',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
}));

app.use(express.json({ limit: '1mb' }));

const AnthropicClient = Anthropic.default || Anthropic;
const client = new AnthropicClient({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Auth ───────────────────────────────────────────────────────────────────
const PONTE_PASSWORD       = process.env.PONTE_PASSWORD || '';
const PONTE_SESSION_SECRET = process.env.PONTE_SESSION_SECRET || '';

// Fail-fast on insecure session secret — never run in prod with the placeholder
if (!PONTE_SESSION_SECRET || PONTE_SESSION_SECRET === 'dev-secret-change-me') {
  console.error('FATAL: PONTE_SESSION_SECRET not set or is default. Exiting.');
  process.exit(1);
}

function makeToken(password) {
  return crypto.createHmac('sha256', PONTE_SESSION_SECRET).update(password).digest('hex');
}

function requireAuth(req, res, next) {
  if (!PONTE_PASSWORD) return next(); // auth disabled if no password set
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token || token !== makeToken(PONTE_PASSWORD)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// SSE/EventSource cannot send custom headers, so this variant accepts ?token=
// in the query string. Query-param tokens are acceptable here because traffic
// is HTTPS in production and tokens are derived HMACs (not the password).
function requireAuthQuery(req, res, next) {
  if (!PONTE_PASSWORD) return next();
  const token = req.query.token || '';
  if (!token || token !== makeToken(PONTE_PASSWORD)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ── Login — POST /api/login
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (!PONTE_PASSWORD) return res.json({ token: 'no-auth' });
  if (!password || password !== PONTE_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect password' });
  }
  res.json({ token: makeToken(password) });
});

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

// Replace curly/smart quotes with straight ASCII equivalents so JSON.parse succeeds.
// Claude occasionally outputs \u201C/\u201D as string delimiters or \u2018/\u2019 inside values.
function sanitizeJSON(str) {
  return str
    .replace(/[\u201C\u201D]/g, '"')   // curly double quotes → "
    .replace(/[\u2018\u2019]/g, "'");  // curly single quotes / apostrophes → '
}

function extractAndSanitize(raw) {
  const stripped = raw.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '');
  return sanitizeJSON(stripped);
}

// Sanitize free-text user input before embedding it in a Claude prompt.
// Naive quote-escaping does not stop prompt injection — a user can still close
// the framing and inject instructions. Instead we strip control characters and
// code fences, collapse the payload to a single logical block, and cap length.
// The caller must also wrap the result in an explicit delimiter and instruct the
// model to treat the delimited content as data, never as instructions.
function sanitizeUserText(str, maxLen = 600) {
  return String(str == null ? '' : str)
    .slice(0, maxLen)
    .replace(/[\x00-\x1F\x7F]/g, ' ') // control chars (incl. newlines/tabs)
    .replace(/```/g, "'''")                  // neutralize code-fence breakouts
    .replace(/\s+/g, ' ')                    // collapse whitespace
    .trim();
}

// If the JSON is truncated (response cut off before closing brace), attempt to
// close it so JSON.parse has a chance. Strategy: walk backwards from the end,
// close any open string, then close open arrays and objects in reverse order.
function repairTruncatedJSON(str) {
  // Walk forward tracking open structures so we can close them.
  // This is intentionally simple: handles the common truncation-at-words-array case.
  let inString = false;
  let escaped  = false;
  const stack  = []; // 'o' = object, 'a' = array

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\' && inString) { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') stack.push('o');
    else if (ch === '[') stack.push('a');
    else if (ch === '}') stack.pop();
    else if (ch === ']') stack.pop();
  }

  let repaired = str;

  // If we ended mid-string, close it
  if (inString) repaired += '"';

  // Close any trailing comma before we start closing brackets
  repaired = repaired.replace(/,\s*$/, '');

  // Close open structures in reverse order
  for (let i = stack.length - 1; i >= 0; i--) {
    repaired += stack[i] === 'a' ? ']' : '}';
  }

  return repaired;
}

// Last-resort regex extraction: pull the four core text fields and return a
// minimal article object so the reader can still render something.
function extractFieldsViaRegex(str) {
  function extractField(src, field) {
    // Match "field": "value" — value may span multiple lines and contain escapes
    const re = new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`);
    const m = src.match(re);
    return m ? m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\') : null;
  }

  const title      = extractField(str, 'title');
  const italian    = extractField(str, 'italian');
  const english    = extractField(str, 'english');
  const spanish    = extractField(str, 'spanish');
  const difficulty = extractField(str, 'difficulty');
  const topic      = extractField(str, 'topic');

  if (!italian) return null; // can't render anything useful without the main text

  return {
    id:         0,
    title:      title      || '(untitled)',
    difficulty: difficulty || '—',
    topic:      topic      || '—',
    italian,
    english:    english    || '',
    spanish:    spanish    || '',
    words:      [],  // no annotations — truncation ate the words array
  };
}

// Full parse pipeline: sanitize → try parse → try repair+parse → regex fallback
function parseArticleJSON(raw) {
  const sanitized = extractAndSanitize(raw);

  // Attempt 1: clean parse after sanitization
  try {
    return JSON.parse(sanitized);
  } catch (e1) {
    // Attempt 2: repair truncated JSON then parse
    try {
      return JSON.parse(repairTruncatedJSON(sanitized));
    } catch (e2) {
      // Attempt 3: regex field extraction — renders without word annotations
      const partial = extractFieldsViaRegex(sanitized);
      if (partial) {
        console.warn('Serving partial article (regex fallback) — no word annotations.');
        return partial;
      }
      throw e1; // nothing worked; surface original error
    }
  }
}

// ── SSE streaming endpoint — GET /api/generate-article-stream?topic=...&difficulty=...&token=...
app.get('/api/generate-article-stream', requireAuthQuery, async (req, res) => {
  const { topic, difficulty } = req.query;

  if (!topic || !difficulty) {
    return res.status(400).json({ error: 'topic and difficulty are required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  let accumulated = '';

  try {
    const stream = await client.messages.create({
      model:       'claude-sonnet-4-6',
      max_tokens:  1200,
      temperature: 0.8,
      stream:      true,
      messages:    [{ role: 'user', content: buildPrompt(topic, difficulty) }],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        const token = event.delta.text;
        accumulated += token;
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      }
    }

    // Parse the complete accumulated JSON and emit the done event
    let article;
    try {
      article = parseArticleJSON(accumulated);
    } catch (parseErr) {
      console.error('All local parse attempts failed:', parseErr.message);
      console.error('Raw response length:', accumulated.length);
      console.error('Raw response (first 300 chars):', accumulated.slice(0, 300));
      const errPos = parseErr.message.match(/position (\d+)/);
      if (errPos) {
        const pos = parseInt(errPos[1], 10);
        console.error(`Raw response around error (pos ${pos}):`, JSON.stringify(accumulated.slice(Math.max(0, pos - 40), pos + 40)));
      }

      // Retry once with explicit ASCII-only instruction and lower temperature
      console.log('Retrying with strict JSON prompt...');
      try {
        const retry = await client.messages.create({
          model:       'claude-sonnet-4-6',
          max_tokens:  1200,
          temperature: 0.4,
          messages:    [{ role: 'user', content: buildPrompt(topic, difficulty, true) }],
        });
        article = parseArticleJSON(retry.content[0].text);
        console.log('Retry succeeded.');
      } catch (retryErr) {
        console.error('Retry also failed:', retryErr.message);
        throw parseErr; // surface original error to the outer catch
      }
    }

    res.write(`event: done\ndata: ${JSON.stringify(article)}\n\n`);
    res.end();
  } catch (err) {
    console.error('Streaming error:', err.message);
    res.write(`event: generation-error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// ── Non-streaming fallback — POST /api/generate-article-full
app.post('/api/generate-article-full', requireAuth, async (req, res) => {
  const { topic, difficulty } = req.body;

  if (!topic || !difficulty) {
    return res.status(400).json({ error: 'topic and difficulty are required' });
  }

  try {
    const message = await client.messages.create({
      model:       'claude-sonnet-4-6',
      max_tokens:  1200,
      temperature: 0.8,
      messages:    [{ role: 'user', content: buildPrompt(topic, difficulty) }],
    });

    const article = parseArticleJSON(message.content[0].text);
    res.json(article);
  } catch (err) {
    console.error('Generation error:', err.message);
    if (err instanceof SyntaxError) {
      return res.status(500).json({ error: 'Model returned invalid JSON', details: err.message });
    }
    res.status(500).json({ error: 'Failed to generate article', details: err.message });
  }
});

// ── On-demand translation — POST /api/translate
// Body: { text: string, context?: string }
app.post('/api/translate', async (req, res) => {
  const { text, context } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'text is required' });
  }

  const safeText    = sanitizeUserText(text, 300);
  const safeContext = sanitizeUserText(context || text, 600);

  const prompt = `The user is learning Italian and selected this text: "${safeText}"
Full Italian context (the article being read): "${safeContext}"
Return JSON only — no markdown, no code fences:
{
  "italian": "${safeText}",
  "english": "English translation",
  "spanish": "Spanish equivalent or translation",
  "note": "One sentence for a Spanish speaker: is this the same as the Spanish word, similar with an added or narrower sense, a false friend, or unrelated to Spanish?",
  "category": "same or similar or false-friend or new",
  "tense": "if a conjugated verb, e.g. 'passato prossimo, 1st person singular' — otherwise null",
  "root": "if a conjugated verb, the infinitive form e.g. 'svegliarsi' — otherwise null",
  "pronunciation": "stress-marked syllable pronunciation e.g. 'TAR-di' or 'ka-FFÈ' — always include",
  "wordType": "noun or verb or adjective or adverb or phrase or other",
  "baseForm": "the dictionary/infinitive form of this word — for verbs use infinitive (e.g. 'svegliarsi'), for nouns use singular nominative (e.g. 'caffè'), for adjectives use masculine singular (e.g. 'bello'). If the word is already in base form, repeat it here.",
  "baseFormEN": "English meaning of the base form (e.g. 'to wake up', 'coffee', 'beautiful')",
  "example": "a natural Italian sentence using the word in context (10-15 words)",
  "exampleEN": "English translation of the example sentence",
  "nounNumber": "if wordType is noun: 'singular' or 'plural' — otherwise null",
  "nounOtherForm": "if wordType is noun: the opposite number form (e.g. if amico → amici; if amici → amico) — otherwise null"
}
Category rules — the category must be exactly one of: 'same', 'similar', 'false-friend', 'new'.
'same' — the Italian word is visually near-identical to Spanish AND the meaning is fully equivalent with no added or missing senses.
'similar' — the Italian word resembles Spanish and the core meaning transfers, but Italian carries an additional sense, narrower usage, or different register than the Spanish equivalent. The Spanish meaning is a subset or overlap, not a wrong answer.
'false-friend' — the Italian word resembles Spanish but produces a WRONG meaning if the Spanish instinct is applied. This is not about added nuance — it's about the Spanish meaning being actively incorrect in Italian.
'new' — the Italian word has no meaningful visual or semantic connection to Spanish.
wordType guide — classify the selected text: "noun" (includes proper nouns), "verb" (any conjugated form or infinitive), "adjective", "adverb", "phrase" (multi-word expression), "other" (conjunctions, prepositions, articles, etc.).
nounNumber/nounOtherForm: only for nouns — state whether the saved form is singular or plural, and provide the other form.`;

  try {
    const message = await client.messages.create({
      model:       'claude-sonnet-4-6',
      max_tokens:  500,
      temperature: 0.2,
      messages:    [{ role: 'user', content: prompt }],
    });

    const result = parseArticleJSON(message.content[0].text);
    if (!result.italian) result.italian = text.trim();
    res.json(result);
  } catch (err) {
    console.error('Translation error:', err.message);
    console.error('Translation raw text:', err._rawText || '(not available)');
    // Graceful fallback: return the raw model text as english so the UI shows something
    res.json({
      italian:  text.trim(),
      english:  err._rawText || '(translation failed)',
      spanish:  '',
      note:     '',
      category: 'new',
    });
  }
});

// ── Grammar examples — POST /api/grammar-examples
// Body: { concept, stage, currentExample }
app.post('/api/grammar-examples', async (req, res) => {
  const { concept, stage, currentExample } = req.body;

  if (!concept) {
    return res.status(400).json({ error: 'concept is required' });
  }

  const safeConcept        = sanitizeUserText(concept, 200);
  const safeStage          = sanitizeUserText(stage, 20);
  const safeCurrentExample = sanitizeUserText(currentExample, 200);

  const prompt = `Generate 3 short Italian example sentences demonstrating "${safeConcept}" (Stage ${safeStage} Italian grammar for Spanish speakers).
Current example already shown: "${safeCurrentExample}"
Each new sentence must use a different verb and context from the current example.
Return JSON only — no markdown, no code fences:
{ "examples": [ { "italian": "...", "english": "..." }, { "italian": "...", "english": "..." }, { "italian": "...", "english": "..." } ] }
Keep sentences short (8-12 words). Natural colloquial Italian, not textbook.`;

  try {
    const message = await client.messages.create({
      model:       'claude-sonnet-4-6',
      max_tokens:  400,
      temperature: 0.7,
      messages:    [{ role: 'user', content: prompt }],
    });

    const raw    = message.content[0].text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    const result = JSON.parse(sanitizeJSON(raw));
    if (!result.examples) throw new Error('Missing examples field');
    res.json(result);
  } catch (err) {
    console.error('Grammar examples error:', err.message);
    res.status(500).json({ error: 'Failed to generate examples' });
  }
});

// ── Flashcard persistence — GET /api/flashcards
app.get('/api/flashcards', requireAuth, (req, res) => {
  try {
    if (!fs.existsSync(FLASHCARDS_PATH)) return res.json([]);
    const data = fs.readFileSync(FLASHCARDS_PATH, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    console.error('Error reading flashcards:', err.message);
    res.json([]);
  }
});

// ── Flashcard persistence — POST /api/flashcards
// Body: full cards array (optionally { cards, override: true } to bypass shrink guard)
// In-memory write lock prevents concurrent writes from clobbering each other.
let flashcardWriteLock = false;

app.post('/api/flashcards', requireAuth, (req, res) => {
  // Accept both { cards, override } envelope and a bare array (legacy clients)
  const isEnvelope = req.body && !Array.isArray(req.body) && Array.isArray(req.body.cards);
  const cards    = isEnvelope ? req.body.cards    : req.body;
  const override = isEnvelope ? req.body.override === true : false;

  if (!Array.isArray(cards)) {
    return res.status(400).json({ error: 'Expected array (or { cards, override })' });
  }

  if (flashcardWriteLock) {
    return res.status(409).json({ error: 'Another write in progress — retry in 500ms', retryMs: 500 });
  }

  // Read current count before acquiring the lock
  let currentCount = 0;
  try {
    if (fs.existsSync(FLASHCARDS_PATH)) {
      const existing = JSON.parse(fs.readFileSync(FLASHCARDS_PATH, 'utf8'));
      if (Array.isArray(existing)) currentCount = existing.length;
    }
  } catch (_) { /* ignore read errors */ }

  const clientIp = req.headers['x-forwarded-for'] || req.ip;
  console.log(`[flashcards] POST from ${clientIp}: incoming=${cards.length} current=${currentCount}${override ? ' override=true' : ''}`);

  // Reject empty-overwrite: never allow wiping a non-empty deck
  if (cards.length === 0 && currentCount > 0) {
    console.error(`[flashcards] BLOCKED: empty array would wipe ${currentCount} cards`);
    return res.status(409).json({ error: `Refusing to overwrite ${currentCount} cards with empty array` });
  }

  // Hard shrink guard: reject writes that drop > 10% of cards unless override:true
  if (!override && currentCount > 0 && cards.length < currentCount * 0.9) {
    console.error(`[flashcards] BLOCKED: incoming ${cards.length} < 90% of current ${currentCount}`);
    return res.status(409).json({
      error:    `Refusing write — incoming deck (${cards.length}) is significantly smaller than current (${currentCount}). Send override:true to force.`,
      incoming: cards.length,
      current:  currentCount,
    });
  }

  // Backup BEFORE acquiring the lock so concurrent writes don't clobber the backup
  try {
    fs.mkdirSync(path.dirname(FLASHCARDS_PATH), { recursive: true });
    if (fs.existsSync(FLASHCARDS_PATH)) {
      fs.copyFileSync(FLASHCARDS_PATH, FLASHCARDS_PATH + '.bak');
    }
  } catch (err) {
    console.error('[flashcards] backup failed:', err.message);
    return res.status(500).json({ error: 'Backup failed before write' });
  }

  flashcardWriteLock = true;
  try {
    const tmp = FLASHCARDS_PATH + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(cards), 'utf8');
    fs.renameSync(tmp, FLASHCARDS_PATH);
    res.json({ ok: true, count: cards.length });
  } catch (err) {
    console.error('Error writing flashcards:', err.message);
    res.status(500).json({ error: 'Failed to save flashcards' });
  } finally {
    flashcardWriteLock = false;
  }
});

// ── Backfill baseForm — POST /api/backfill-flashcards
// Reads flashcards.json, calls /api/translate for cards missing baseForm,
// writes results back. Rate-limited to 500ms between calls.
app.post('/api/backfill-flashcards', requireAuth, async (req, res) => {
  let cards;
  try {
    if (!fs.existsSync(FLASHCARDS_PATH)) return res.json({ updated: 0, skipped: 0, errors: [] });
    cards = JSON.parse(fs.readFileSync(FLASHCARDS_PATH, 'utf8'));
  } catch (err) {
    return res.status(500).json({ error: 'Failed to read flashcards: ' + err.message });
  }

  const toUpdate = cards.filter(c => !c.baseForm);
  const errors   = [];
  let updated    = 0;

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  for (const card of toUpdate) {
    try {
      const prompt = `The user is learning Italian and selected this text: "${card.italian}"
Full Italian context (the article being read): "${card.italian}"
Return JSON only — no markdown, no code fences:
{
  "baseForm": "the dictionary/infinitive form of this word — for verbs use infinitive (e.g. 'svegliarsi'), for nouns use singular nominative (e.g. 'caffè'), for adjectives use masculine singular (e.g. 'bello'). If the word is already in base form, repeat it here.",
  "baseFormEN": "English meaning of the base form (e.g. 'to wake up', 'coffee', 'beautiful')"
}`;

      const message = await client.messages.create({
        model:       'claude-sonnet-4-6',
        max_tokens:  100,
        temperature: 0.1,
        messages:    [{ role: 'user', content: prompt }],
      });

      const result = parseArticleJSON(message.content[0].text);
      if (result.baseForm) {
        card.baseForm   = result.baseForm;
        card.baseFormEN = result.baseFormEN || '';
        updated++;
      } else {
        errors.push({ word: card.italian, error: 'No baseForm in response' });
      }
    } catch (err) {
      errors.push({ word: card.italian, error: err.message });
    }

    if (toUpdate.indexOf(card) < toUpdate.length - 1) {
      await sleep(500);
    }
  }

  // Write back atomically
  try {
    const tmp = FLASHCARDS_PATH + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(cards), 'utf8');
    fs.renameSync(tmp, FLASHCARDS_PATH);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to write flashcards: ' + err.message });
  }

  res.json({ updated, skipped: cards.length - toUpdate.length, errors });
});

// ── Translate to Italian — POST /api/translate-to-italian
// Body: { text: string }
app.post('/api/translate-to-italian', async (req, res) => {
  const { text } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'text is required' });
  }

  const englishInput = text.trim();
  const safeEnglishInput = sanitizeUserText(englishInput, 200);

  // Prompt is structured so Claude cannot confuse roles:
  // - The English word lives outside the JSON schema (its own labeled line).
  // - The "english" field is NOT pre-filled — server enforces it after parse,
  //   removing the temptation for the model to copy the input into "italian".
  // - Each schema value uses <angle-bracket placeholders> so it's unambiguous
  //   that the value must be replaced, not echoed verbatim.
  const prompt = `You are translating an English word to Italian for a Spanish speaker who is learning Italian.

English word to translate: ${safeEnglishInput}

Return JSON only — no markdown, no code fences. Replace every <placeholder> with the correct value:
{
  "italian": "<the Italian translation of the English word above — this MUST be a real Italian word and MUST NOT echo the English input>",
  "spanish": "<Spanish equivalent of the same word>",
  "note": "<one sentence for a Spanish speaker: is the Italian word the same as Spanish, similar with an added/narrower sense, a false friend, or unrelated to Spanish?>",
  "category": "<exactly one of: same, similar, false-friend, new>",
  "tense": "<if the Italian translation is a conjugated verb form, e.g. 'passato prossimo, 1st person singular' — otherwise null>",
  "root": "<if the Italian translation is a conjugated verb, the infinitive form e.g. 'svegliarsi' — otherwise null>",
  "pronunciation": "<stress-marked syllable pronunciation of the Italian word, e.g. 'TAR-di' — always include>",
  "wordType": "<one of: noun, verb, adjective, adverb, phrase, other>",
  "nounNumber": "<if wordType is noun: 'singular' or 'plural' — otherwise null>",
  "nounOtherForm": "<if wordType is noun: the opposite number form (e.g. amico → amici; amici → amico) — otherwise null>"
}

Category rules — the category must be exactly one of: 'same', 'similar', 'false-friend', 'new'.
'same' — the Italian word is visually near-identical to Spanish AND the meaning is fully equivalent with no added or missing senses.
'similar' — the Italian word resembles Spanish and the core meaning transfers, but Italian carries an additional sense, narrower usage, or different register than the Spanish equivalent. The Spanish meaning is a subset or overlap, not a wrong answer.
'false-friend' — the Italian word resembles Spanish but produces a WRONG meaning if the Spanish instinct is applied. This is not about added nuance — it's about the Spanish meaning being actively incorrect in Italian.
'new' — the Italian word has no meaningful visual or semantic connection to Spanish.
nounNumber/nounOtherForm: only for nouns — state whether the translated Italian form is singular or plural, and provide the other form.`;

  try {
    const message = await client.messages.create({
      model:       'claude-sonnet-4-6',
      max_tokens:  400,
      temperature: 0.2,
      messages:    [{ role: 'user', content: prompt }],
    });

    const result = parseArticleJSON(message.content[0].text);
    // Server is authoritative for the english field — never trust the model to echo.
    result.english = englishInput;
    if (!result.italian) result.italian = '';
    res.json(result);
  } catch (err) {
    console.error('Translate-to-Italian error:', err.message);
    res.json({
      italian:  '',
      english:  englishInput,
      spanish:  '',
      note:     '',
      category: 'new',
    });
  }
});

// ── Usage checker — POST /api/check-usage
// Body: { sentence: string }
// ── Practice distractors — POST /api/distractors
// Body: { word, sentence, category }
app.post('/api/distractors', async (req, res) => {
  const { word, sentence, category } = req.body;

  if (!word || !word.trim()) {
    return res.status(400).json({ error: 'word is required' });
  }

  const catHints = {
    'false-friend': 'This is a false friend with Spanish. Generate distractors that look like the Spanish equivalent or reflect common Spanish-to-Italian transfer errors.',
    'divergence':   'This word diverges from Spanish usage. Generate distractors reflecting Spanish usage patterns an Italian learner might confuse.',
    'new':          'This has no Spanish equivalent. Generate distractors that are visually or semantically similar Italian words.',
    'cognate':      'This is a cognate with Spanish. Generate distractors from the same word family or similar Italian words.',
  };

  const safeWord     = sanitizeUserText(word, 100);
  const safeSentence = sanitizeUserText(sentence, 200);
  const safeCategory = sanitizeUserText(category || 'new', 30);

  const prompt = `The user is an English speaker learning Italian who also knows Spanish. They are doing a cloze exercise.
Correct answer: "${safeWord}"
Sentence: "${safeSentence}"
Category: ${safeCategory}
${catHints[category] || 'Generate plausible Italian word distractors.'}

Generate exactly 3 plausible wrong answer options for multiple choice. They must be:
1. Real Italian words (not random strings)
2. Targeting Spanish-speaker confusion — wrong tense of the same verb, a Spanish cognate, similar-sounding Italian word, or common transfer error
3. Each different from "${safeWord}" and from each other

Return JSON only — no markdown, no code fences:
{ "distractors": ["word1", "word2", "word3"] }`;

  try {
    const message = await client.messages.create({
      model:       'claude-sonnet-4-6',
      max_tokens:  120,
      temperature: 0.7,
      messages:    [{ role: 'user', content: prompt }],
    });

    const raw    = message.content[0].text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    const result = JSON.parse(sanitizeJSON(raw));
    if (!Array.isArray(result.distractors) || result.distractors.length < 3) {
      throw new Error('Invalid distractors response');
    }
    res.json({ distractors: result.distractors.slice(0, 3) });
  } catch (err) {
    console.error('Distractors error:', err.message);
    res.json({ distractors: ['è', 'ha', 'sono'] });
  }
});

app.post('/api/check-usage', async (req, res) => {
  const { sentence } = req.body;

  if (!sentence || !sentence.trim()) {
    return res.status(400).json({ error: 'sentence is required' });
  }

  const safeSentence = sanitizeUserText(sentence, 600);

  const prompt = `The user is an English speaker learning Italian who also speaks Spanish. They wrote this Italian sentence: "${safeSentence}"

Check for:
1. Grammar errors
2. Spanish transfer errors (Spanglish patterns — using Spanish structure in Italian)
3. Word choice issues

Return JSON only — no markdown, no code fences:
{
  "original": "their sentence",
  "corrected": "corrected version or same if correct",
  "isCorrect": true or false,
  "errors": [
    {
      "original": "the wrong part",
      "correction": "the right part",
      "explanation": "why it is wrong, specifically referencing Spanish interference if relevant",
      "type": "grammar or transfer or word-choice"
    }
  ],
  "encouragement": "one positive sentence about what they got right or attempted"
}
If the sentence is correct, errors should be an empty array.`;

  try {
    const message = await client.messages.create({
      model:       'claude-sonnet-4-6',
      max_tokens:  600,
      temperature: 0.2,
      messages:    [{ role: 'user', content: prompt }],
    });

    const raw    = message.content[0].text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    const result = JSON.parse(sanitizeJSON(raw));
    res.json(result);
  } catch (err) {
    console.error('Usage check error:', err.message);
    res.status(500).json({ error: 'Failed to check usage' });
  }
});

// ── Conversation simulator — POST /api/conversation ──────────────
app.post('/api/conversation', requireAuth, async (req, res) => {
  const { scenario, history = [], userMessage } = req.body;

  if (!scenario || !scenario.trim()) {
    return res.status(400).json({ error: 'scenario is required' });
  }

  const safeScenario = sanitizeUserText(scenario, 200);

  const systemPrompt = `You are a native Italian speaker in this scenario: "${safeScenario}".
Speak only in Italian. Keep your responses conversational and natural — 2–4 sentences max.
After your Italian response, add a new line with exactly "---" followed by a brief English note (1–2 lines) covering any errors in the user's Italian (grammar, Spanish transfer, word choice). Start each error with ⚠️. Add a vocabulary tip starting with 💡 if relevant.
If the user's Italian had no errors, just write "✓ Ottimo!" after the ---.
If this is your opening message (no prior exchange), skip the --- section entirely and just start the conversation naturally.
Stay warm, in-character, and encouraging throughout.`;

  // Build message array from history (must alternate user/assistant)
  const messages = (history || []).map(h => ({ role: h.role, content: String(h.content) }));

  // If history starts with an assistant message, prepend the hidden opener
  if (messages.length > 0 && messages[0].role === 'assistant') {
    messages.unshift({ role: 'user', content: 'Ciao!' });
  }

  // Append the new user message, or inject opener if no history
  if (userMessage) {
    messages.push({ role: 'user', content: userMessage });
  } else if (messages.length === 0) {
    messages.push({ role: 'user', content: 'Ciao!' });
  }

  try {
    const message = await client.messages.create({
      model:       'claude-sonnet-4-6',
      max_tokens:  400,
      temperature: 0.8,
      system:      systemPrompt,
      messages,
    });

    const reply = message.content[0].text.trim();
    res.json({ reply });
  } catch (err) {
    console.error('Conversation error:', err.message);
    res.status(500).json({ error: 'Failed to get conversation response' });
  }
});

// ── Check sentence rebuilding answer ──────────────────────────────────────
app.post('/api/check-sentence', async (req, res) => {
  const { english, userItalian, articleItalian } = req.body;
  if (!english || !userItalian) return res.status(400).json({ error: 'english and userItalian required' });

  const safeEnglish        = sanitizeUserText(english, 400);
  const safeUserItalian    = sanitizeUserText(userItalian, 400);
  const safeArticleItalian = sanitizeUserText(articleItalian, 400);

  const prompt = `The user is learning Italian. They were shown this English sentence:
"${safeEnglish}"

They wrote this Italian:
"${safeUserItalian}"

The ideal Italian from the article is:
"${safeArticleItalian}"

Evaluate their answer. Return valid JSON only (no markdown):
{
  "correct": true or false,
  "score": 0-100,
  "idealItalian": "the best Italian translation",
  "errors": [{"userText": "word/phrase user wrote", "correction": "correct form", "explanation": "brief explanation", "type": "grammar|spanish-transfer|word-choice|spelling"}],
  "encouragement": "one positive note about what they got right, even if small"
}

Be generous — accept valid alternate phrasings. Focus on meaningful errors, not minor stylistic differences. If score >= 75, set correct: true.`;

  try {
    const message = await client.messages.create({
      model:       'claude-sonnet-4-6',
      max_tokens:  600,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
    });
    let result;
    try {
      const raw = message.content[0].text.trim().replace(/^```json\s*|\s*```$/g, '');
      result = JSON.parse(raw);
    } catch (e) {
      result = { correct: false, score: 0, idealItalian: articleItalian || '', errors: [], encouragement: 'Keep practising!' };
    }
    res.json(result);
  } catch (err) {
    console.error('Check sentence error:', err.message);
    res.status(500).json({ error: 'Failed to check sentence' });
  }
});

// ── Detect grammar patterns for a flashcard ────────────────────────────────
app.post('/api/detect-patterns', async (req, res) => {
  const { italian, english, category, note } = req.body;
  if (!italian) return res.status(400).json({ error: 'italian required' });

  const safeItalian  = sanitizeUserText(italian, 300);
  const safeEnglish  = sanitizeUserText(english, 300);
  const safeCategory = sanitizeUserText(category, 30);
  const safeNote     = sanitizeUserText(note, 300);

  const prompt = `Given this Italian flashcard, identify which grammar/vocabulary error patterns it relates to.

Italian: "${safeItalian}"
English: "${safeEnglish}"
Category: "${safeCategory}"
Note: "${safeNote}"

Return ONLY a JSON array of pattern keys from this list (return empty array [] if none apply):
- "false-friend" — word looks similar to a Spanish word but means something different
- "divergence" — word looks similar to a Spanish word but is used differently in Italian
- "verb-essere" — uses essere as auxiliary in perfect tenses
- "passato-prossimo" — passato prossimo conjugation
- "clitic-placement" — clitic or object pronoun placement
- "subjunctive" — subjunctive / congiuntivo mood
- "geminates" — double consonant / geminate spelling
- "verb-general" — verb conjugation (any other aspect not covered above)

Return only the JSON array, no explanation.`;

  try {
    const message = await client.messages.create({
      model:       'claude-sonnet-4-6',
      max_tokens:  100,
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }],
    });
    let patterns = [];
    try { patterns = JSON.parse(message.content[0].text.trim()); } catch (e) {}
    if (!Array.isArray(patterns)) patterns = [];
    res.json({ patterns });
  } catch (err) {
    console.error('Detect patterns error:', err.message);
    res.status(500).json({ error: 'Failed to detect patterns' });
  }
});

// ── Generate practice sentences ───────────────────────────────────────────
// Body: { topic, difficulty }
app.post('/api/generate-practice', requireAuth, async (req, res) => {
  const { topic, difficulty } = req.body;
  if (!topic || !topic.trim()) return res.status(400).json({ error: 'topic required' });
  const diff = difficulty || 'B1';
  const safeTopic = sanitizeUserText(topic, 200);

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      temperature: 0.8,
      messages: [{
        role: 'user',
        content: `Generate 8 Italian translation exercises for a Spanish speaker learning Italian at ${diff} level.
Topic: "${safeTopic}".
Write natural, conversational Italian — not textbook phrasing. Vary sentence structures.
Return JSON only, no markdown:
{
  "sentences": [
    {
      "english": "the English sentence",
      "italian": "the ideal Italian translation",
      "words": ["every", "single", "word", "in", "the", "italian", "sentence"],
      "distractors": ["wrong1", "wrong2", "wrong3", "wrong4"]
    }
  ]
}
CRITICAL: words must contain EVERY token that appears in the italian sentence, in the same order, including:
- Articles: il, la, lo, i, le, gli, un, una, uno, del, della, dello, dei, delle, degli
- Prepositions: di, a, in, con, per, su, tra, fra, da, al, alla, agli, alle, dal, dalla, nel, nella
- Conjunctions: e, ma, che, però, perché, quando, mentre, se, o, anche, quindi
- Pronouns: io, tu, lui, lei, noi, voi, loro, mi, ti, si, ci, vi, lo, la, li, le, ne
- All nouns, verbs (conjugated form exactly as in italian), adjectives, adverbs
If a word appears twice in the sentence, include it twice. The word bank must have everything needed to build the exact sentence.
distractors: 4 plausible wrong Italian words targeting Spanish-speaker errors (wrong conjugation, Spanish cognate that fails in Italian, wrong gender agreement, false friend)`,
      }],
    });

    let raw = message.content[0].text.trim().replace(/^```json\s*|\s*```$/g, '');
    const result = JSON.parse(raw);
    res.json(result);
  } catch (err) {
    console.error('/api/generate-practice error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Post-reading quiz ─────────────────────────────────────────────────────
// Body: { italian, english, title }
app.post('/api/reading-quiz', async (req, res) => {
  const { italian, english, title } = req.body;
  if (!italian || !english) return res.status(400).json({ error: 'italian and english required' });

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      temperature: 0.5,
      messages: [{
        role: 'user',
        content: `You are a comprehension quiz generator for an Italian reading app. Given an Italian article and its English translation, generate 5 comprehension questions that test whether the reader understood the content.

Article title: "${sanitizeUserText(title || 'Italian article', 200)}"

Italian text:
${italian}

English translation:
${english}

Generate 5 questions. Mix question types: 3 multiple choice (4 options each) and 2 true/false.
Questions must be answerable from the article content — no outside knowledge needed.
For multiple choice, exactly one option is correct. Make distractors plausible but clearly wrong to a careful reader.

Return JSON only, no markdown:
{
  "questions": [
    {
      "type": "mc",
      "question": "question text in English",
      "options": ["option A", "option B", "option C", "option D"],
      "correct": 0
    },
    {
      "type": "tf",
      "question": "True or false: statement in English",
      "options": ["True", "False"],
      "correct": 0
    }
  ]
}
For mc: "correct" is 0-indexed position of the correct option.
For tf: "correct" is 0 for True, 1 for False.`,
      }],
    });

    let raw = message.content[0].text.trim().replace(/^```json\s*|\s*```$/g, '');
    const result = JSON.parse(raw);
    res.json(result);
  } catch (err) {
    console.error('/api/reading-quiz error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Scripted dialogue — POST /api/generate-dialogue
// Body: { scenario, difficulty }
app.post('/api/generate-dialogue', requireAuth, async (req, res) => {
  const { scenario, difficulty } = req.body;
  if (!scenario || !scenario.trim()) {
    return res.status(400).json({ error: 'scenario is required' });
  }
  const diff = (['B1', 'B2'].includes((difficulty || '').toUpperCase()))
    ? difficulty.toUpperCase() : 'B1';

  const safeScenario = sanitizeUserText(scenario, 200);

  const prompt = `Generate a realistic scripted dialogue in Italian for a language learner.
Scenario: ${safeScenario}
Difficulty: ${diff}

Two characters: a native Italian speaker and the learner. Return JSON only — no markdown, no code fences:
{
  "title": "scenario title",
  "context": "one sentence in English setting the scene",
  "characters": { "native": "first name + brief role description e.g. Marco (barista)", "learner": "Learner" },
  "exchanges": [
    {
      "speaker": "native",
      "italian": "the line in Italian",
      "english": "English translation",
      "isUserTurn": false
    },
    {
      "speaker": "learner",
      "italian": "ideal learner response in Italian",
      "english": "English translation",
      "isUserTurn": true,
      "options": ["ideal response", "wrong option 1", "wrong option 2", "wrong option 3"]
    }
  ]
}

Rules:
- 10-14 exchanges total, alternating speakers naturally
- Mark exactly 4-5 exchanges as isUserTurn: true (the learner lines)
- For every isUserTurn exchange, include "options": [correct, wrong1, wrong2, wrong3]
  - Correct answer is always first in the array
  - Wrong options must be plausible Italian phrases a ${diff} learner might confuse:
    wrong tense, wrong register, Spanish-transfer error, or similar-sounding phrase
  - Wrong options should be full phrases, not single words
- Language natural and colloquial at ${diff} level`;

  try {
    const message = await client.messages.create({
      model:       'claude-sonnet-4-6',
      max_tokens:  1400,
      temperature: 0.8,
      messages:    [{ role: 'user', content: prompt }],
    });

    let raw = message.content[0].text.trim()
      .replace(/^```json\s*/i, '').replace(/\s*```\s*$/, '');
    const result = JSON.parse(sanitizeJSON(raw));
    if (!Array.isArray(result.exchanges) || result.exchanges.length < 4) {
      throw new Error('Invalid dialogue response');
    }
    res.json(result);
  } catch (err) {
    console.error('/api/generate-dialogue error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Ponte server running on http://localhost:${PORT}`);
});
