'use strict';

// Combined endpoint — POST /api/translate-combined?action=...
// (merged to stay under Vercel Hobby's 12-serverless-function limit)
//   ?action=translate-to-italian → EN word → IT translation + metadata
//   ?action=grammar-examples     → 3 extra grammar card examples
const { client, sanitizeUserText, parseArticleJSON, sanitizeJSON } = require('../lib/ponte.js');

// ── translate-to-italian — Body: { text }
async function translateToItalian(req, res) {
  const { text } = req.body || {};

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'text is required' });
  }

  const englishInput = text.trim();
  const safeEnglishInput = sanitizeUserText(englishInput, 200);

  // Prompt is structured so Claude cannot confuse roles:
  // - The English word lives outside the JSON schema (its own labeled line).
  // - The "english" field is NOT pre-filled — server enforces it after parse,
  //   removing the temptation for the model to copy the input into "italian".
  // - Each schema value uses <angle-bracket placeholders> so it's unambiguous
  //   that the value must be replaced, not echoed verbatim.
  const prompt = `You are translating an English word to Italian for a Spanish speaker who is learning Italian.

English word to translate: ${safeEnglishInput}

Return JSON only — no markdown, no code fences. Replace every <placeholder> with the correct value:
{
  "italian": "<the Italian translation of the English word above — this MUST be a real Italian word and MUST NOT echo the English input>",
  "spanish": "<Spanish equivalent of the same word>",
  "note": "<one sentence for a Spanish speaker: is the Italian word the same as Spanish, similar with an added/narrower sense, a false friend, or unrelated to Spanish?>",
  "category": "<exactly one of: same, similar, false-friend, new>",
  "tense": "<if the Italian translation is a conjugated verb form, e.g. 'passato prossimo, 1st person singular' — otherwise null>",
  "root": "<if the Italian translation is a conjugated verb, the infinitive form e.g. 'svegliarsi' — otherwise null>",
  "pronunciation": "<stress-marked syllable pronunciation of the Italian word, e.g. 'TAR-di' — always include>",
  "isProperNoun": "true only if this is a proper noun — a place, person, brand or other name that stays capitalised mid-sentence in Italian. Note Italian does NOT capitalise days, months, languages or nationalities, so those are false.",
  "wordType": "<one of: noun, verb, adjective, adverb, phrase, other>",
  "nounNumber": "<if wordType is noun: 'singular' or 'plural' — otherwise null>",
  "nounOtherForm": "<if wordType is noun: the opposite number form (e.g. amico → amici; amici → amico) — otherwise null>"
}

Category rules — the category must be exactly one of: 'same', 'similar', 'false-friend', 'new'.
'same' — the Italian word is visually near-identical to Spanish AND the meaning is fully equivalent with no added or missing senses.
'similar' — the Italian word resembles Spanish and the core meaning transfers, but Italian carries an additional sense, narrower usage, or different register than the Spanish equivalent. The Spanish meaning is a subset or overlap, not a wrong answer.
'false-friend' — the Italian word resembles Spanish but produces a WRONG meaning if the Spanish instinct is applied. This is not about added nuance — it's about the Spanish meaning being actively incorrect in Italian.
'new' — the Italian word has no meaningful visual or semantic connection to Spanish.
nounNumber/nounOtherForm: only for nouns — state whether the translated Italian form is singular or plural, and provide the other form.`;

  try {
    const message = await client.messages.create({
      model:       'claude-sonnet-4-6',
      max_tokens:  400,
      temperature: 0.2,
      messages:    [{ role: 'user', content: prompt }],
    });

    const result = parseArticleJSON(message.content[0].text);
    // Server is authoritative for the english field — never trust the model to echo.
    result.english = englishInput;
    if (!result.italian) result.italian = '';
    res.json(result);
  } catch (err) {
    console.error('Translate-to-Italian error:', err.message);
    res.json({
      italian:  '',
      english:  englishInput,
      spanish:  '',
      note:     '',
      category: 'new',
    });
  }
}

// ── grammar-examples — Body: { concept, stage, currentExample }
async function grammarExamples(req, res) {
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
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  switch ((req.query && req.query.action) || '') {
    case 'translate-to-italian': return translateToItalian(req, res);
    case 'grammar-examples':     return grammarExamples(req, res);
    default: return res.status(400).json({ error: 'Unknown or missing ?action= (expected translate-to-italian | grammar-examples)' });
  }
};
