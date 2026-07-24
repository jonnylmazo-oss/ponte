'use strict';

// POST /api/generate-article-full — non-streaming article generation (fallback)
const { client, requireAuth, buildPrompt, parseArticleJSON } = require('../lib/ponte.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAuth(req, res)) return;

  const { topic, difficulty } = req.body || {};

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
};
