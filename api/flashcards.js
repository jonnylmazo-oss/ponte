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

// Phrase-level audio scripts, written by the local backfill-audio-script.js.
// Deliberately a separate key from 'flashcards': the deck is blind-overwritten
// on every client save, so anything stored on the cards themselves can be
// wiped by a stale browser tab.
const AUDIO_KEY = 'flashcard_audio';

// In-memory write lock — best-effort within a single warm instance.
let flashcardWriteLock = false;

// The 4 valid taxonomy categories (see CLAUDE.md). A stale browser tab
// holding a pre-migration deck (old vocabulary: cognate/divergence) can
// still POST — saveCards() sends the client's entire localStorage array,
// and neither the empty-overwrite guard nor the >10% shrink guard notices a
// same-count deck with wrong field *values* (see #65: this is exactly how
// the taxonomy migration got silently reverted). This guard catches that
// class of regression at the value level, not just the count level.
const VALID_CATEGORIES = new Set(['same', 'similar', 'false-friend', 'new']);

function findInvalidCategory(cards) {
  for (const c of cards) {
    if (!VALID_CATEGORIES.has(c && c.category)) {
      return { id: c && c.id, italian: c && c.italian, category: c && c.category };
    }
  }
  return null;
}

module.exports = async function handler(req, res) {
  if (!requireAuth(req, res)) return;

  if (req.method === 'GET') {
    // ?key=audio → the flashcard_audio map ({ [cardId]: { chunks } }).
    // Opt-in via query param rather than bundled into the default response:
    // three callers in app.js (syncFlashcardsFromServer, manualSyncFlashcards,
    // startFlashcardPoll) assert Array.isArray on the deck response, so
    // changing its shape would break all of them — and the 60s poll would
    // otherwise carry ~85KB of chunk data on every tick.
    if (req.query && req.query.key === 'audio') {
      try {
        const audio = (await redis.get(AUDIO_KEY)) ?? {};
        return res.json(audio);
      } catch (err) {
        console.error('Error reading flashcard_audio:', err.message);
        return res.json({});
      }
    }

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

    // Reject any card outside the 4-value taxonomy — see VALID_CATEGORIES comment.
    // Not bypassable by override:true: override is for the shrink guard (a
    // count problem), this is a value problem, and a stale-taxonomy deck is
    // never a legitimate write regardless of size.
    const invalid = findInvalidCategory(cards);
    if (invalid) {
      console.error(`[flashcards] BLOCKED: invalid category "${invalid.category}" on card ${invalid.id} (${invalid.italian})`);
      return res.status(409).json({
        error: `Refusing write — card ${invalid.id} ("${invalid.italian}") has category "${invalid.category}", not one of: ${[...VALID_CATEGORIES].join(', ')}`,
      });
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
