'use strict';

// Combined endpoint — POST /api/feedback-combined?action=...
// (merged to stay under Vercel Hobby's 12-serverless-function limit)
//   ?action=check-usage     → Italian sentence usage/grammar feedback
//   ?action=detect-patterns → map a flashcard to grammar error pattern keys
//   ?action=reading-quiz    → 5 comprehension questions for an article
//   ?action=deep-dive       → full word exploration (all senses → examples → etymology)
const { client, sanitizeUserText, sanitizeJSON } = require('../lib/ponte.js');

// ── check-usage — Body: { sentence }
async function checkUsage(req, res) {
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
}

// ── detect-patterns — Body: { italian, english, category, note }
async function detectPatterns(req, res) {
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
}

// ── reading-quiz — Body: { italian, english, title }
async function readingQuiz(req, res) {
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
}

// ── deep-dive — Body: { word } — all senses, then per-sense examples, then etymology
async function deepDive(req, res) {
  const { word } = req.body || {};
  if (!word || !word.trim()) return res.status(400).json({ error: 'word is required' });

  const safeWord = sanitizeUserText(word, 80);

  const prompt = `Provide a deep dive on the Italian word '${safeWord}' for a Spanish-speaking B1/B2 learner.

Return JSON only — no markdown, no code fences:
{
  "word": "the italian word",
  "senses": [
    {
      "definition": "English definition of this sense",
      "wordType": "noun|verb|adjective|adverb|phrase",
      "category": "same|similar|false-friend|new",
      "spanishNote": "brief note on the Spanish relationship for THIS sense, only if category is similar or false-friend, otherwise null",
      "examples": [ { "italian": "sentence", "english": "translation" } ]
    }
  ],
  "etymology": "brief shared-root note if genuinely interesting, or null"
}

Rules:
- List ALL common senses, ordered by frequency of use (most common first).
- Most words have 1 sense; only split into multiple when meanings are genuinely distinct (like intimo: 1. intimate/close (emotional) vs 2. underwear/intimate apparel).
- 2-3 examples per sense; each sentence must clearly target that specific sense — not a generic sentence that could fit any meaning.
- category and spanishNote reflect the SPECIFIC sense, not the word in general — a word can be 'same' in one sense and 'false-friend' in another.
- Category meanings: 'same' = visually near-identical to Spanish AND fully equivalent meaning; 'similar' = resembles Spanish, core meaning transfers but Italian adds/narrows a sense; 'false-friend' = resembles Spanish but the Spanish instinct gives a WRONG meaning; 'new' = no meaningful Spanish connection.
- etymology: only include a real shared Latin/Greek root worth noting (e.g. "coltello shares its root with English 'cutlery' and Spanish 'cuchillo' — all from Latin cultellus"); return null when the connection is obvious or nonexistent.`;

  try {
    const message = await client.messages.create({
      model:       'claude-sonnet-4-6',
      max_tokens:  1500,
      temperature: 0.4,
      messages:    [{ role: 'user', content: prompt }],
    });

    const raw    = message.content[0].text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    const result = JSON.parse(sanitizeJSON(raw));
    if (!Array.isArray(result.senses)) result.senses = [];
    if (!result.word) result.word = word.trim();
    res.json(result);
  } catch (err) {
    console.error('Deep-dive error:', err.message);
    res.status(500).json({ error: 'Failed to generate deep dive' });
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  switch ((req.query && req.query.action) || '') {
    case 'check-usage':     return checkUsage(req, res);
    case 'detect-patterns': return detectPatterns(req, res);
    case 'reading-quiz':    return readingQuiz(req, res);
    case 'deep-dive':       return deepDive(req, res);
    default: return res.status(400).json({ error: 'Unknown or missing ?action= (expected check-usage | detect-patterns | reading-quiz | deep-dive)' });
  }
};
