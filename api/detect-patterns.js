'use strict';

// POST /api/detect-patterns — map a flashcard to grammar error pattern keys
// Body: { italian, english, category, note }
const { client, sanitizeUserText } = require('../lib/ponte.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { italian, english, category, note } = req.body || {};
  if (!italian) return res.status(400).json({ error: 'italian required' });

  const safeItalian  = sanitizeUserText(italian, 300);
  const safeEnglish  = sanitizeUserText(english, 300);
  const safeCategory = sanitizeUserText(category, 30);
  const safeNote     = sanitizeUserText(note, 300);

  const prompt = `Given this Italian flashcard, identify which grammar/vocabulary error patterns it relates to.

Italian: "${safeItalian}"
English: "${safeEnglish}"
Category: "${safeCategory}"
Note: "${safeNote}"

Return ONLY a JSON array of pattern keys from this list (return empty array [] if none apply):
- "false-friend" — word looks similar to a Spanish word but means something different
- "divergence" — word looks similar to a Spanish word but is used differently in Italian
- "verb-essere" — uses essere as auxiliary in perfect tenses
- "passato-prossimo" — passato prossimo conjugation
- "clitic-placement" — clitic or object pronoun placement
- "subjunctive" — subjunctive / congiuntivo mood
- "geminates" — double consonant / geminate spelling
- "verb-general" — verb conjugation (any other aspect not covered above)

Return only the JSON array, no explanation.`;

  try {
    const message = await client.messages.create({
      model:       'claude-sonnet-4-6',
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
};
