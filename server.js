'use strict';

require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const fs       = require('fs');
const path     = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const app  = express();
const PORT = process.env.PORT || 3000;

const FLASHCARDS_PATH = process.env.FLASHCARDS_PATH || path.join(__dirname, 'data', 'flashcards.json');

const ALLOWED_ORIGINS = [
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://198.199.88.229',
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
    { "w": "italian word", "en": "english", "es": "spanish", "c": "cognate|false-friend|divergence|new", "n": "one short note", "p": "stress hint e.g. BUR-ro" }
  ]
}
The words array must include minimum 6 annotated words covering all four categories: cognate, false-friend, divergence, new. For false-friend and divergence entries, the note field must explain specifically how it differs from Spanish. Return only the JSON object, no markdown, no code fences.${strictNote}`;
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
  "category": "cognate or false-friend or divergence or new",
  "tense": "if a conjugated verb, e.g. 'passato prossimo, 1st person singular' — otherwise null",
  "root": "if a conjugated verb, the infinitive form e.g. 'svegliarsi' — otherwise null",
  "pronunciation": "stress-marked syllable pronunciation e.g. 'TAR-di' or 'ka-FFÈ' — always include",
  "wordType": "noun or verb or adjective or adverb or phrase or other",
  "baseForm": "the dictionary/infinitive form of this word — for verbs use infinitive (e.g. 'svegliarsi'), for nouns use singular nominative (e.g. 'caffè'), for adjectives use masculine singular (e.g. 'bello'). If the word is already in base form, repeat it here.",
  "baseFormEN": "English meaning of the base form (e.g. 'to wake up', 'coffee', 'beautiful')"
}
Category guide — "cognate": looks and means the same as Spanish; "false-friend": looks Spanish but means something different; "divergence": exists in Spanish but used differently in Italian; "new": no close Spanish equivalent.
wordType guide — classify the selected text: "noun" (includes proper nouns), "verb" (any conjugated form or infinitive), "adjective", "adverb", "phrase" (multi-word expression), "other" (conjunctions, prepositions, articles, etc.).`;

  try {
    const message = await client.messages.create({
      model:       'claude-sonnet-4-20250514',
      max_tokens:  400,
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

  const prompt = `Generate 3 short Italian example sentences demonstrating "${concept}" (Stage ${stage || ''} Italian grammar for Spanish speakers).
Current example already shown: "${(currentExample || '').slice(0, 200)}"
Each new sentence must use a different verb and context from the current example.
Return JSON only — no markdown, no code fences:
{ "examples": [ { "italian": "...", "english": "..." }, { "italian": "...", "english": "..." }, { "italian": "...", "english": "..." } ] }
Keep sentences short (8-12 words). Natural colloquial Italian, not textbook.`;

  try {
    const message = await client.messages.create({
      model:       'claude-sonnet-4-20250514',
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
app.get('/api/flashcards', (req, res) => {
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
// Body: full cards array — written atomically via temp file
app.post('/api/flashcards', (req, res) => {
  const cards = req.body;
  if (!Array.isArray(cards)) {
    return res.status(400).json({ error: 'Expected array' });
  }
  try {
    fs.mkdirSync(path.dirname(FLASHCARDS_PATH), { recursive: true });
    const tmp = FLASHCARDS_PATH + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(cards, null, 2), 'utf8');
    fs.renameSync(tmp, FLASHCARDS_PATH);
    res.json({ ok: true, count: cards.length });
  } catch (err) {
    console.error('Error writing flashcards:', err.message);
    res.status(500).json({ error: 'Failed to save flashcards' });
  }
});

// ── Backfill baseForm — POST /api/backfill-flashcards
// Reads flashcards.json, calls /api/translate for cards missing baseForm,
// writes results back. Rate-limited to 500ms between calls.
app.post('/api/backfill-flashcards', async (req, res) => {
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
        model:       'claude-sonnet-4-20250514',
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
    fs.writeFileSync(tmp, JSON.stringify(cards, null, 2), 'utf8');
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

  const prompt = `The user is an English speaker learning Italian. Translate this English text to Italian: "${text.trim()}"
Return JSON only — no markdown, no code fences:
{
  "italian": "Italian translation",
  "english": "${text.trim().replace(/"/g, '\\"')}",
  "spanish": "Spanish equivalent or translation",
  "note": "One sentence for a Spanish speaker: is this a safe cognate, false friend, or does it diverge from Spanish usage?",
  "category": "cognate or false-friend or divergence or new",
  "tense": "if a conjugated verb, e.g. 'passato prossimo, 1st person singular' — otherwise null",
  "root": "if a conjugated verb, the infinitive form e.g. 'svegliarsi' — otherwise null",
  "pronunciation": "stress-marked syllable pronunciation of the Italian word e.g. 'TAR-di' — always include",
  "wordType": "noun or verb or adjective or adverb or phrase or other"
}
Category guide — cognate: looks and means the same as Spanish; false-friend: looks Spanish but means something different; divergence: exists in Spanish but used differently in Italian; new: no close Spanish equivalent.`;

  try {
    const message = await client.messages.create({
      model:       'claude-sonnet-4-20250514',
      max_tokens:  400,
      temperature: 0.2,
      messages:    [{ role: 'user', content: prompt }],
    });

    const result = parseArticleJSON(message.content[0].text);
    if (!result.italian) result.italian = '';
    res.json(result);
  } catch (err) {
    console.error('Translate-to-Italian error:', err.message);
    res.json({
      italian:  '',
      english:  text.trim(),
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

  const prompt = `The user is an English speaker learning Italian who also knows Spanish. They are doing a cloze exercise.
Correct answer: "${word.trim()}"
Sentence: "${(sentence || '').slice(0, 200)}"
Category: ${category || 'new'}
${catHints[category] || 'Generate plausible Italian word distractors.'}

Generate exactly 3 plausible wrong answer options for multiple choice. They must be:
1. Real Italian words (not random strings)
2. Targeting Spanish-speaker confusion — wrong tense of the same verb, a Spanish cognate, similar-sounding Italian word, or common transfer error
3. Each different from "${word.trim()}" and from each other

Return JSON only — no markdown, no code fences:
{ "distractors": ["word1", "word2", "word3"] }`;

  try {
    const message = await client.messages.create({
      model:       'claude-sonnet-4-20250514',
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

  const prompt = `The user is an English speaker learning Italian who also speaks Spanish. They wrote this Italian sentence: "${sentence.trim().replace(/"/g, '\\"')}"

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
      model:       'claude-sonnet-4-20250514',
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
app.post('/api/conversation', async (req, res) => {
  const { scenario, history = [], userMessage } = req.body;

  if (!scenario || !scenario.trim()) {
    return res.status(400).json({ error: 'scenario is required' });
  }

  const systemPrompt = `You are a native Italian speaker in this scenario: "${scenario.trim()}".
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
      model:       'claude-sonnet-4-20250514',
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

  const prompt = `The user is learning Italian. They were shown this English sentence:
"${english}"

They wrote this Italian:
"${userItalian}"

The ideal Italian from the article is:
"${articleItalian || ''}"

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
      model:       'claude-sonnet-4-20250514',
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

  const prompt = `Given this Italian flashcard, identify which grammar/vocabulary error patterns it relates to.

Italian: "${italian}"
English: "${english || ''}"
Category: "${category || ''}"
Note: "${note || ''}"

Return ONLY a JSON array of pattern keys from this list (return empty array [] if none apply):
- "false-friend" — word is a false cognate with Spanish
- "divergence" — used differently than Spanish equivalent
- "verb-essere" — uses essere as auxiliary in perfect tenses
- "passato-prossimo" — passato prossimo conjugation
- "clitic-placement" — clitic or object pronoun placement
- "subjunctive" — subjunctive / congiuntivo mood
- "geminates" — double consonant / geminate spelling
- "verb-general" — verb conjugation (any other aspect not covered above)

Return only the JSON array, no explanation.`;

  try {
    const message = await client.messages.create({
      model:       'claude-sonnet-4-20250514',
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
app.post('/api/generate-practice', async (req, res) => {
  const { topic, difficulty } = req.body;
  if (!topic || !topic.trim()) return res.status(400).json({ error: 'topic required' });
  const diff = difficulty || 'B1';

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1400,
      temperature: 0.8,
      messages: [{
        role: 'user',
        content: `Generate 8 Italian translation exercises for a Spanish speaker learning Italian at ${diff} level.
Topic: "${topic}".
Write natural, conversational Italian — not textbook phrasing. Vary sentence structures.
Return JSON only, no markdown:
{
  "sentences": [
    {
      "english": "the English sentence",
      "italian": "the ideal Italian translation",
      "words": ["key", "italian", "words"],
      "distractors": ["wrong1", "wrong2", "wrong3", "wrong4"]
    }
  ]
}
words: 4-8 key content words from the Italian sentence (nouns, verbs, adjectives — not articles or prepositions)
distractors: 4 plausible wrong Italian words targeting Spanish-speaker errors (wrong tense, Spanish cognate, gender/number mistake, false friend)`,
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

app.listen(PORT, () => {
  console.log(`Ponte server running on http://localhost:${PORT}`);
});
