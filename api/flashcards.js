'use strict';

// GET/POST /api/flashcards — deck persistence via Upstash Redis (was a JSON file on disk)
//   Key 'flashcards'      → the deck array
//   Key 'flashcards_bak'  → last-known-good backup, written before each overwrite
// Guards preserved from the legacy Express handler: in-memory write lock,
// empty-overwrite block, and >10% anti-shrink guard (bypassable with override:true).
const { Redis } = require('@upstash/redis');
const { requireAuth } = require('../lib/ponte.js');

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// In-memory write lock — best-effort within a single warm instance.
let flashcardWriteLock = false;

module.exports = async function handler(req, res) {
  if (!requireAuth(req, res)) return;

  if (req.method === 'GET') {
    try {
      const cards = (await redis.get('flashcards')) ?? [];
      return res.json(cards);
    } catch (err) {
      console.error('Error reading flashcards:', err.message);
      return res.json([]);
    }
  }

  if (req.method === 'POST') {
    // Accept both { cards, override } envelope and a bare array (legacy clients)
    const body = req.body;
    const isEnvelope = body && !Array.isArray(body) && Array.isArray(body.cards);
    const cards    = isEnvelope ? body.cards    : body;
    const override = isEnvelope ? body.override === true : false;

    if (!Array.isArray(cards)) {
      return res.status(400).json({ error: 'Expected array (or { cards, override })' });
    }

    if (flashcardWriteLock) {
      return res.status(409).json({ error: 'Another write in progress — retry in 500ms', retryMs: 500 });
    }

    // Read current deck (for count + backup) before acquiring the lock
    let existing = null;
    let currentCount = 0;
    try {
      existing = await redis.get('flashcards');
      if (Array.isArray(existing)) currentCount = existing.length;
    } catch (_) { /* ignore read errors */ }

    const clientIp = req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress);
    console.log(`[flashcards] POST from ${clientIp}: incoming=${cards.length} current=${currentCount}${override ? ' override=true' : ''}`);

    // Reject empty-overwrite: never allow wiping a non-empty deck
    if (cards.length === 0 && currentCount > 0) {
      console.error(`[flashcards] BLOCKED: empty array would wipe ${currentCount} cards`);
      return res.status(409).json({ error: `Refusing to overwrite ${currentCount} cards with empty array` });
    }

    // Hard shrink guard: reject writes that drop > 10% of cards unless override:true
    if (!override && currentCount > 0 && cards.length < currentCount * 0.9) {
      console.error(`[flashcards] BLOCKED: incoming ${cards.length} < 90% of current ${currentCount}`);
      return res.status(409).json({
        error:    `Refusing write — incoming deck (${cards.length}) is significantly smaller than current (${currentCount}). Send override:true to force.`,
        incoming: cards.length,
        current:  currentCount,
      });
    }

    // Backup BEFORE acquiring the lock so concurrent writes don't clobber the backup
    try {
      if (existing != null) {
        await redis.set('flashcards_bak', existing);
      }
    } catch (err) {
      console.error('[flashcards] backup failed:', err.message);
      return res.status(500).json({ error: 'Backup failed before write' });
    }

    flashcardWriteLock = true;
    try {
      await redis.set('flashcards', cards);
      return res.json({ ok: true, count: cards.length });
    } catch (err) {
      console.error('Error writing flashcards:', err.message);
      return res.status(500).json({ error: 'Failed to save flashcards' });
    } finally {
      flashcardWriteLock = false;
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
