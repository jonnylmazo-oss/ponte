'use strict';

// POST /api/check-sentence — score a sentence-rebuild / free-recall answer
// Body: { english, userItalian, articleItalian }
const { client, sanitizeUserText } = require('../lib/ponte.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { english, userItalian, articleItalian } = req.body || {};
  if (!english || !userItalian) return res.status(400).json({ error: 'english and userItalian required' });

  const safeEnglish        = sanitizeUserText(english, 400);
  const safeUserItalian    = sanitizeUserText(userItalian, 400);
  const safeArticleItalian = sanitizeUserText(articleItalian, 400);

  const prompt = `The user is learning Italian. They were shown this English sentence:
"${safeEnglish}"

They wrote this Italian:
"${safeUserItalian}"

The ideal Italian from the article is:
"${safeArticleItalian}"

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
      model:       'claude-sonnet-4-6',
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
};
