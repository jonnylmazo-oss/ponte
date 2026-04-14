'use strict';

// One-time script: backfill baseForm + baseFormEN for flashcards that are missing them.
// Run on the server: node backfill.js
// Reads FLASHCARDS_PATH from .env (or defaults to ./data/flashcards.json).

require('dotenv').config();
const fs        = require('fs');
const path      = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const FLASHCARDS_PATH = process.env.FLASHCARDS_PATH || path.join(__dirname, 'data', 'flashcards.json');

const AnthropicClient = Anthropic.default || Anthropic;
const client = new AnthropicClient({ apiKey: process.env.ANTHROPIC_API_KEY });

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function sanitizeJSON(str) {
  return str
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");
}

function parseJSON(raw) {
  const stripped = raw.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '');
  return JSON.parse(sanitizeJSON(stripped));
}

async function main() {
  if (!fs.existsSync(FLASHCARDS_PATH)) {
    console.log('No flashcards file found at', FLASHCARDS_PATH);
    return;
  }

  const cards = JSON.parse(fs.readFileSync(FLASHCARDS_PATH, 'utf8'));
  const toUpdate = cards.filter(c => !c.baseForm);

  console.log(`Total cards: ${cards.length} | Need backfill: ${toUpdate.length}`);
  if (toUpdate.length === 0) { console.log('Nothing to do.'); return; }

  let updated = 0;
  const errors = [];

  for (let i = 0; i < toUpdate.length; i++) {
    const card = toUpdate[i];
    process.stdout.write(`[${i + 1}/${toUpdate.length}] "${card.italian}" ... `);

    try {
      const prompt = `The user is learning Italian. The word or phrase is: "${card.italian}"
Return JSON only — no markdown, no code fences:
{
  "baseForm": "the dictionary/infinitive form — for verbs use infinitive (e.g. 'svegliarsi'), for nouns singular nominative (e.g. 'caffè'), for adjectives masculine singular (e.g. 'bello'). If already base form, repeat it.",
  "baseFormEN": "English meaning of the base form (e.g. 'to wake up', 'coffee', 'beautiful')"
}`;

      const message = await client.messages.create({
        model:       'claude-sonnet-4-20250514',
        max_tokens:  100,
        temperature: 0.1,
        messages:    [{ role: 'user', content: prompt }],
      });

      const result = parseJSON(message.content[0].text);
      if (result.baseForm) {
        card.baseForm   = result.baseForm;
        card.baseFormEN = result.baseFormEN || '';
        updated++;
        console.log(`→ ${result.baseForm} (${result.baseFormEN})`);
      } else {
        throw new Error('No baseForm in response: ' + message.content[0].text);
      }
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      errors.push({ word: card.italian, error: err.message });
    }

    if (i < toUpdate.length - 1) await sleep(500);
  }

  // Write back atomically
  const tmp = FLASHCARDS_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(cards, null, 2), 'utf8');
  fs.renameSync(tmp, FLASHCARDS_PATH);

  console.log(`\nDone. Updated: ${updated} | Errors: ${errors.length}`);
  if (errors.length) {
    console.log('Errors:');
    errors.forEach(e => console.log(`  ${e.word}: ${e.error}`));
  }
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
