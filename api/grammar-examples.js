'use strict';

// POST /api/grammar-examples — 3 extra grammar card examples
// Body: { concept, stage, currentExample }
const { client, sanitizeUserText, sanitizeJSON } = require('../lib/ponte.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { concept, stage, currentExample } = req.body || {};

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
};
