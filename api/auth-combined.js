'use strict';

// Combined endpoint — POST /api/auth-combined?action=...
// (merged to stay under Vercel Hobby's 12-serverless-function limit)
//   ?action=login              → password → Bearer token
//   ?action=backfill-flashcards → fill missing baseForm/baseFormEN on saved cards (auth required)
const { Redis } = require('@upstash/redis');
const { PONTE_PASSWORD, makeToken, client, requireAuth, parseArticleJSON } = require('../lib/ponte.js');

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// ── login — Body: { password }
async function login(req, res) {
  const { password } = req.body || {};
  if (!PONTE_PASSWORD) return res.json({ token: 'no-auth' });
  if (!password || password !== PONTE_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect password' });
  }
  res.json({ token: makeToken(password) });
}

// ── backfill-flashcards — reads deck from Redis, fills baseForm, writes back (auth required)
async function backfillFlashcards(req, res) {
  if (!requireAuth(req, res)) return;

  let cards;
  try {
    cards = await redis.get('flashcards');
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
    await redis.set('flashcards', cards);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to write flashcards: ' + err.message });
  }

  res.json({ updated, skipped: cards.length - toUpdate.length, errors });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  switch ((req.query && req.query.action) || '') {
    case 'login':               return login(req, res);
    case 'backfill-flashcards': return backfillFlashcards(req, res);
    default: return res.status(400).json({ error: 'Unknown or missing ?action= (expected login | backfill-flashcards)' });
  }
};
