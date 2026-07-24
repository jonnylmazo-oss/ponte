'use strict';

// POST /api/backfill-flashcards — fill missing baseForm/baseFormEN on saved cards.
// Reads the deck from Vercel KV, calls Claude for cards missing baseForm, writes
// the deck back to KV. Rate-limited to 500ms between calls.
const { kv } = require('@vercel/kv');
const { client, requireAuth, parseArticleJSON } = require('../lib/ponte.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAuth(req, res)) return;

  let cards;
  try {
    cards = await kv.get('flashcards');
    if (!Array.isArray(cards)) return res.json({ updated: 0, skipped: 0, errors: [] });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to read flashcards: ' + err.message });
  }

  const toUpdate = cards.filter(c => !c.baseForm);
  const errors   = [];
  let updated    = 0;

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  for (const card of toUpdate) {
    try {
      const prompt = `The user is learning Italian and selected this text: "${card.italian}"
Full Italian context (the article being read): "${card.italian}"
Return JSON only — no markdown, no code fences:
{
  "baseForm": "the dictionary/infinitive form of this word — for verbs use infinitive (e.g. 'svegliarsi'), for nouns use singular nominative (e.g. 'caffè'), for adjectives use masculine singular (e.g. 'bello'). If the word is already in base form, repeat it here.",
  "baseFormEN": "English meaning of the base form (e.g. 'to wake up', 'coffee', 'beautiful')"
}`;

      const message = await client.messages.create({
        model:       'claude-sonnet-4-6',
        max_tokens:  100,
        temperature: 0.1,
        messages:    [{ role: 'user', content: prompt }],
      });

      const result = parseArticleJSON(message.content[0].text);
      if (result.baseForm) {
        card.baseForm   = result.baseForm;
        card.baseFormEN = result.baseFormEN || '';
        updated++;
      } else {
        errors.push({ word: card.italian, error: 'No baseForm in response' });
      }
    } catch (err) {
      errors.push({ word: card.italian, error: err.message });
    }

    if (toUpdate.indexOf(card) < toUpdate.length - 1) {
      await sleep(500);
    }
  }

  // Write back
  try {
    await kv.set('flashcards', cards);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to write flashcards: ' + err.message });
  }

  res.json({ updated, skipped: cards.length - toUpdate.length, errors });
};
