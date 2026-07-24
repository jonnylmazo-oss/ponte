'use strict';

// POST /api/reading-quiz — 5 comprehension questions for an article
// Body: { italian, english, title }
const { client, sanitizeUserText } = require('../lib/ponte.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { italian, english, title } = req.body || {};
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
};
