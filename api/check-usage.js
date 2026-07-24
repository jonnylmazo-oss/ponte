'use strict';

// POST /api/check-usage — Italian sentence usage/grammar feedback
// Body: { sentence: string }
const { client, sanitizeUserText, sanitizeJSON } = require('../lib/ponte.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { sentence } = req.body || {};

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
};
