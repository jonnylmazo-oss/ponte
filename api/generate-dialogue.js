'use strict';

// POST /api/generate-dialogue — scripted dialogue JSON
// Body: { scenario, difficulty }
const { client, requireAuth, sanitizeUserText, sanitizeJSON } = require('../lib/ponte.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAuth(req, res)) return;

  const { scenario, difficulty } = req.body || {};
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
};
