'use strict';

// Combined endpoint — POST /api/practice-combined?action=...
// (merged to stay under Vercel Hobby's 12-serverless-function limit)
//   ?action=generate-practice → 8 practice translation exercises (auth required)
//   ?action=check-sentence    → score a sentence-rebuild / free-recall answer
//   ?action=distractors       → 3 plausible wrong-answer options for a cloze exercise
const { client, requireAuth, sanitizeUserText, sanitizeJSON } = require('../lib/ponte.js');

// ── generate-practice — Body: { topic, difficulty } — auth required
async function generatePractice(req, res) {
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
}

// ── check-sentence — Body: { english, userItalian, articleItalian }
async function checkSentence(req, res) {
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
}

// ── distractors — Body: { word, sentence, category }
async function distractors(req, res) {
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
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  switch ((req.query && req.query.action) || '') {
    case 'generate-practice': return generatePractice(req, res);
    case 'check-sentence':    return checkSentence(req, res);
    case 'distractors':       return distractors(req, res);
    default: return res.status(400).json({ error: 'Unknown or missing ?action= (expected generate-practice | check-sentence | distractors)' });
  }
};
