'use strict';

// POST /api/translate — on-demand IT word/phrase translation + metadata
// Body: { text: string, context?: string }
const { client, sanitizeUserText, parseArticleJSON } = require('../lib/ponte.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text, context } = req.body || {};

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'text is required' });
  }

  const safeText    = sanitizeUserText(text, 300);
  const safeContext = sanitizeUserText(context || text, 600);

  const prompt = `The user is learning Italian and selected this text: "${safeText}"
Full Italian context (the article being read): "${safeContext}"
Return JSON only — no markdown, no code fences:
{
  "italian": "${safeText}",
  "english": "English translation",
  "spanish": "Spanish equivalent or translation",
  "note": "One sentence for a Spanish speaker: is this the same as the Spanish word, similar with an added or narrower sense, a false friend, or unrelated to Spanish?",
  "category": "same or similar or false-friend or new",
  "tense": "if a conjugated verb, e.g. 'passato prossimo, 1st person singular' — otherwise null",
  "root": "if a conjugated verb, the infinitive form e.g. 'svegliarsi' — otherwise null",
  "pronunciation": "stress-marked syllable pronunciation e.g. 'TAR-di' or 'ka-FFÈ' — always include",
  "isProperNoun": "true only if this is a proper noun — a place, person, brand or other name that stays capitalised mid-sentence in Italian. Note Italian does NOT capitalise days, months, languages or nationalities, so those are false.",
  "wordType": "noun or verb or adjective or adverb or phrase or other",
  "baseForm": "the dictionary/infinitive form of this word — for verbs use infinitive (e.g. 'svegliarsi'), for nouns use singular nominative (e.g. 'caffè'), for adjectives use masculine singular (e.g. 'bello'). If the word is already in base form, repeat it here.",
  "baseFormEN": "English meaning of the base form (e.g. 'to wake up', 'coffee', 'beautiful')",
  "example": "a natural Italian sentence using the word in context (10-15 words)",
  "exampleEN": "English translation of the example sentence",
  "nounNumber": "if wordType is noun: 'singular' or 'plural' — otherwise null",
  "nounOtherForm": "if wordType is noun: the opposite number form (e.g. if amico → amici; if amici → amico) — otherwise null"
}
Category rules — the category must be exactly one of: 'same', 'similar', 'false-friend', 'new'.
'same' — the Italian word is visually near-identical to Spanish AND the meaning is fully equivalent with no added or missing senses.
'similar' — the Italian word resembles Spanish and the core meaning transfers, but Italian carries an additional sense, narrower usage, or different register than the Spanish equivalent. The Spanish meaning is a subset or overlap, not a wrong answer.
'false-friend' — the Italian word resembles Spanish but produces a WRONG meaning if the Spanish instinct is applied. This is not about added nuance — it's about the Spanish meaning being actively incorrect in Italian.
'new' — the Italian word has no meaningful visual or semantic connection to Spanish.
wordType guide — classify the selected text: "noun" (includes proper nouns), "verb" (any conjugated form or infinitive), "adjective", "adverb", "phrase" (multi-word expression), "other" (conjunctions, prepositions, articles, etc.).
nounNumber/nounOtherForm: only for nouns — state whether the saved form is singular or plural, and provide the other form.`;

  try {
    const message = await client.messages.create({
      model:       'claude-sonnet-4-6',
      max_tokens:  500,
      temperature: 0.2,
      messages:    [{ role: 'user', content: prompt }],
    });

    const result = parseArticleJSON(message.content[0].text);
    if (!result.italian) result.italian = text.trim();
    res.json(result);
  } catch (err) {
    console.error('Translation error:', err.message);
    console.error('Translation raw text:', err._rawText || '(not available)');
    // Graceful fallback: return the raw model text as english so the UI shows something
    res.json({
      italian:  text.trim(),
      english:  err._rawText || '(translation failed)',
      spanish:  '',
      note:     '',
      category: 'new',
    });
  }
};
