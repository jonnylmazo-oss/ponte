'use strict';

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
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

// Support both ESM-default-wrapped and direct CJS exports
const AnthropicClient = Anthropic.default || Anthropic;
const client = new AnthropicClient({ apiKey: process.env.ANTHROPIC_API_KEY });

app.post('/api/generate-article', async (req, res) => {
  const { topic, difficulty } = req.body;

  if (!topic || !difficulty) {
    return res.status(400).json({ error: 'topic and difficulty are required' });
  }

  const prompt = `You are an Italian language learning content generator. Write a short ${difficulty} Italian article about "${topic}" in a colloquial, natural register — not textbook Italian. Return ONLY valid JSON with this exact structure:
{
  "id": 0,
  "title": "...",
  "difficulty": "${difficulty}",
  "topic": "${topic}",
  "italian": "(80-120 words, natural colloquial Italian)",
  "english": "(natural English translation, not literal)",
  "spanish": "(natural Spanish translation)",
  "words": [
    { "word": "...", "english": "...", "spanish": "...", "category": "cognate|false-friend|divergence|new", "note": "...", "example": "..." }
  ]
}
The words array must include minimum 8 annotated words covering all four categories: cognate, false-friend, divergence, new. For false-friend and divergence entries, the note field must explain specifically how it differs from Spanish. Return only the JSON object, no markdown, no code fences.`;

  try {
    const message = await client.messages.create({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages:   [{ role: 'user', content: prompt }],
    });

    const raw  = message.content[0].text.trim();
    // Strip accidental code fences the model may add despite instructions
    const json = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    const article = JSON.parse(json);

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
