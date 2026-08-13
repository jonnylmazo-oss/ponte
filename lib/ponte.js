'use strict';

// Shared helpers for the Vercel serverless functions in /api.
// Logic copied verbatim from the legacy Express server (server.js) so the two
// stay behaviourally identical. The only adaptation is the auth middleware:
// Express `(req, res, next)` middleware becomes `(req, res) => boolean` guards
// because serverless handlers have no `next()`.

const crypto    = require('crypto');
const Anthropic = require('@anthropic-ai/sdk');

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

// Bearer-token guard. Returns true if the request may proceed; otherwise writes
// a 401 and returns false. Callers do: `if (!requireAuth(req, res)) return;`
function requireAuth(req, res) {
  if (!PONTE_PASSWORD) return true; // auth disabled if no password set
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token || token !== makeToken(PONTE_PASSWORD)) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

// SSE/EventSource cannot send custom headers, so this variant accepts ?token=
// in the query string. Query-param tokens are acceptable here because traffic
// is HTTPS in production and tokens are derived HMACs (not the password).
function requireAuthQuery(req, res) {
  if (!PONTE_PASSWORD) return true;
  const token = req.query.token || '';
  if (!token || token !== makeToken(PONTE_PASSWORD)) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

// ── Prompt building ──────────────────────────────────────────────────────────
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
  ],
  "culturalNote": "(2-3 sentences in English explaining WHY Italians actually do or say something shown in this specific article — a real cultural or social reason, not a language-learning tip and not a generic fact about Italy. Ground it in a concrete detail from the article you just wrote.)"
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
// Claude occasionally outputs “/” as string delimiters or ‘/’ inside values.
function sanitizeJSON(str) {
  return str
    .replace(/[“”]/g, '"')   // curly double quotes → "
    .replace(/[‘’]/g, "'");  // curly single quotes / apostrophes → '
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

module.exports = {
  client,
  PONTE_PASSWORD,
  PONTE_SESSION_SECRET,
  makeToken,
  requireAuth,
  requireAuthQuery,
  buildPrompt,
  sanitizeJSON,
  extractAndSanitize,
  sanitizeUserText,
  repairTruncatedJSON,
  extractFieldsViaRegex,
  parseArticleJSON,
};
