'use strict';

require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const Anthropic = require('@anthropic-ai/sdk');

const app  = express();
const PORT = process.env.PORT || 3000;

const ALLOWED_ORIGINS = [
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'https://ponte.market',
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

app.use(express.json());

const AnthropicClient = Anthropic.default || Anthropic;
const client = new AnthropicClient({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildPrompt(topic, difficulty, strict = false) {
  const strictNote = strict
    ? ' CRITICAL: use only straight ASCII double-quote characters (") for all JSON strings — no curly quotes, no smart quotes, no special Unicode punctuation anywhere in the output.'
    : '';
  return `You are an Italian language learning content generator. Write a short ${difficulty} Italian article about "${topic}" in a colloquial, natural register — not textbook Italian. Return ONLY valid JSON with this exact structure:
{
  "id": 0,
  "title": "...",
  "difficulty": "${difficulty}",
  "topic": "${topic}",
  "italian": "(80-120 words, natural colloquial Italian)",
  "english": "(natural English translation, not literal)",
  "spanish": "(natural Spanish translation)",
  "words": [
    { "word": "...", "english": "...", "spanish": "...", "category": "cognate|false-friend|divergence|new", "note": "...", "pronunciation": "...", "example": "...", "exampleEN": "..." }
  ]
}
The words array must include minimum 8 annotated words covering all four categories: cognate, false-friend, divergence, new. For false-friend and divergence entries, the note field must explain specifically how it differs from Spanish. The pronunciation field should be a simple stress-marked syllable hint (e.g. "kaf-FE", "BUR-ro"). The example field is a short natural Italian sentence using that word. The exampleEN field is the English translation of that sentence. Return only the JSON object, no markdown, no code fences.${strictNote}`;
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

// ── SSE streaming endpoint — GET /api/generate-article-stream?topic=...&difficulty=...
app.get('/api/generate-article-stream', async (req, res) => {
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
      model:       'claude-sonnet-4-20250514',
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
          model:       'claude-sonnet-4-20250514',
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
app.post('/api/generate-article-full', async (req, res) => {
  const { topic, difficulty } = req.body;

  if (!topic || !difficulty) {
    return res.status(400).json({ error: 'topic and difficulty are required' });
  }

  try {
    const message = await client.messages.create({
      model:       'claude-sonnet-4-20250514',
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

  const prompt = `The user is learning Italian and selected this text: "${text}"
Full Italian context (the article being read): "${(context || text).slice(0, 600)}"
Return JSON only — no markdown, no code fences:
{
  "italian": "${text}",
  "english": "English translation",
  "spanish": "Spanish equivalent or translation",
  "note": "One sentence for a Spanish speaker: is this a safe cognate, false friend, or does it diverge from Spanish usage?",
  "category": "cognate or false-friend or divergence or new"
}
Category guide — "cognate": looks and means the same as Spanish; "false-friend": looks Spanish but means something different; "divergence": exists in Spanish but used differently in Italian; "new": no close Spanish equivalent.`;

  try {
    const message = await client.messages.create({
      model:       'claude-sonnet-4-20250514',
      max_tokens:  300,
      temperature: 0.2,
      messages:    [{ role: 'user', content: prompt }],
    });

    const result = parseArticleJSON(message.content[0].text);
    if (!result.italian) result.italian = text.trim();
    res.json(result);
  } catch (err) {
    console.error('Translation error:', err.message);
    res.status(500).json({ error: 'Translation failed', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Ponte server running on http://localhost:${PORT}`);
});
