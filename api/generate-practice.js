'use strict';

// POST /api/generate-practice — 8 practice translation exercises
// Body: { topic, difficulty }
const { client, requireAuth, sanitizeUserText } = require('../lib/ponte.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAuth(req, res)) return;

  const { topic, difficulty } = req.body || {};
  if (!topic || !topic.trim()) return res.status(400).json({ error: 'topic required' });
  const diff = difficulty || 'B1';
  const safeTopic = sanitizeUserText(topic, 200);

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      temperature: 0.8,
      messages: [{
        role: 'user',
        content: `Generate 8 Italian translation exercises for a Spanish speaker learning Italian at ${diff} level.
Topic: "${safeTopic}".
Write natural, conversational Italian — not textbook phrasing. Vary sentence structures.
Return JSON only, no markdown:
{
  "sentences": [
    {
      "english": "the English sentence",
      "italian": "the ideal Italian translation",
      "words": ["every", "single", "word", "in", "the", "italian", "sentence"],
      "distractors": ["wrong1", "wrong2", "wrong3", "wrong4"]
    }
  ]
}
CRITICAL: words must contain EVERY token that appears in the italian sentence, in the same order, including:
- Articles: il, la, lo, i, le, gli, un, una, uno, del, della, dello, dei, delle, degli
- Prepositions: di, a, in, con, per, su, tra, fra, da, al, alla, agli, alle, dal, dalla, nel, nella
- Conjunctions: e, ma, che, però, perché, quando, mentre, se, o, anche, quindi
- Pronouns: io, tu, lui, lei, noi, voi, loro, mi, ti, si, ci, vi, lo, la, li, le, ne
- All nouns, verbs (conjugated form exactly as in italian), adjectives, adverbs
If a word appears twice in the sentence, include it twice. The word bank must have everything needed to build the exact sentence.
distractors: 4 plausible wrong Italian words targeting Spanish-speaker errors (wrong conjugation, Spanish cognate that fails in Italian, wrong gender agreement, false friend)`,
      }],
    });

    let raw = message.content[0].text.trim().replace(/^```json\s*|\s*```$/g, '');
    const result = JSON.parse(raw);
    res.json(result);
  } catch (err) {
    console.error('/api/generate-practice error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
