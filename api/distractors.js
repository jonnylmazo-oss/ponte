'use strict';

// POST /api/distractors — 3 plausible wrong-answer options for a cloze exercise
// Body: { word, sentence, category }
const { client, sanitizeUserText, sanitizeJSON } = require('../lib/ponte.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { word, sentence, category } = req.body || {};

  if (!word || !word.trim()) {
    return res.status(400).json({ error: 'word is required' });
  }

  const catHints = {
    'false-friend': 'This is a false friend with Spanish. Generate distractors that look like the Spanish equivalent or reflect common Spanish-to-Italian transfer errors.',
    'divergence':   'This word diverges from Spanish usage. Generate distractors reflecting Spanish usage patterns an Italian learner might confuse.',
    'new':          'This has no Spanish equivalent. Generate distractors that are visually or semantically similar Italian words.',
    'cognate':      'This is a cognate with Spanish. Generate distractors from the same word family or similar Italian words.',
  };

  const safeWord     = sanitizeUserText(word, 100);
  const safeSentence = sanitizeUserText(sentence, 200);
  const safeCategory = sanitizeUserText(category || 'new', 30);

  const prompt = `The user is an English speaker learning Italian who also knows Spanish. They are doing a cloze exercise.
Correct answer: "${safeWord}"
Sentence: "${safeSentence}"
Category: ${safeCategory}
${catHints[category] || 'Generate plausible Italian word distractors.'}

Generate exactly 3 plausible wrong answer options for multiple choice. They must be:
1. Real Italian words (not random strings)
2. Targeting Spanish-speaker confusion — wrong tense of the same verb, a Spanish cognate, similar-sounding Italian word, or common transfer error
3. Each different from "${safeWord}" and from each other

Return JSON only — no markdown, no code fences:
{ "distractors": ["word1", "word2", "word3"] }`;

  try {
    const message = await client.messages.create({
      model:       'claude-sonnet-4-6',
      max_tokens:  120,
      temperature: 0.7,
      messages:    [{ role: 'user', content: prompt }],
    });

    const raw    = message.content[0].text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    const result = JSON.parse(sanitizeJSON(raw));
    if (!Array.isArray(result.distractors) || result.distractors.length < 3) {
      throw new Error('Invalid distractors response');
    }
    res.json({ distractors: result.distractors.slice(0, 3) });
  } catch (err) {
    console.error('Distractors error:', err.message);
    res.json({ distractors: ['è', 'ha', 'sono'] });
  }
};
