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

function buildPrompt(topic, difficulty) {
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
The words array must include minimum 8 annotated words covering all four categories: cognate, false-friend, divergence, new. For false-friend and divergence entries, the note field must explain specifically how it differs from Spanish. The pronunciation field should be a simple stress-marked syllable hint (e.g. "kaf-FÈ", "BUR-ro"). The example field is a short natural Italian sentence using that word. The exampleEN field is the English translation of that sentence. Return only the JSON object, no markdown, no code fences.`;
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
      model:      'claude-sonnet-4-20250514',
      max_tokens: 2048,
      stream:     true,
      messages:   [{ role: 'user', content: buildPrompt(topic, difficulty) }],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        const token = event.delta.text;
        accumulated += token;
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      }
    }

    // Parse the complete accumulated JSON and emit the done event
    const raw     = accumulated.trim();
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    const article = JSON.parse(jsonStr);
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
      model:      'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages:   [{ role: 'user', content: buildPrompt(topic, difficulty) }],
    });

    const raw     = message.content[0].text.trim();
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    const article = JSON.parse(jsonStr);
    res.json(article);
  } catch (err) {
    console.error('Generation error:', err.message);
    if (err instanceof SyntaxError) {
      return res.status(500).json({ error: 'Model returned invalid JSON', details: err.message });
    }
    res.status(500).json({ error: 'Failed to generate article', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Ponte server running on http://localhost:${PORT}`);
});
