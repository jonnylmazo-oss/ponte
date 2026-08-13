// utils.js — Shared utilities for Ponte
// Loaded before all other modules via <script src="utils.js"></script>

'use strict';

/**
 * Escape HTML special characters to prevent XSS.
 * All modules use window.ponteEsc instead of local escapeHTML / esc functions.
 */
window.ponteEsc = function ponteEsc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

/**
 * Normalize a flashcard's Italian headword casing at save time.
 *
 * Lookup sources sentence-case their output, so words arrive as "Garantire",
 * "Permettere". That is wrong for a headword, and it matters beyond cosmetics:
 * generated audio is content-addressed by SHA-1 of the exact text, so
 * "Garantire" and "garantire" are different blobs.
 *
 * Only the FIRST character is ever touched — "Rendersi conto" becomes
 * "rendersi conto", never "rendersi Conto".
 *
 * Proper-noun safety:
 *   - Non-nouns (verb/adjective/adverb/phrase) are lowercased unconditionally.
 *     There is no such thing as a proper verb, so this cannot misfire.
 *   - Nouns and 'other' are left ALONE by default. They are only lowercased
 *     when an example sentence positively confirms the word is common — i.e.
 *     it appears lowercase mid-sentence there. A proper noun stays capitalised
 *     mid-sentence, so this can only ever confirm, never guess.
 *   - card.isProperNoun === true always wins. The translate/lookup prompts now
 *     return it, so newer cards are authoritative rather than heuristic.
 *
 * Italian helps here: unlike English it does not capitalise days, months,
 * languages or nationalities, so the risk set is just names and places.
 */
window.ponteNormalizeItalian = function ponteNormalizeItalian(text, opts) {
  const raw = String(text == null ? '' : text).trim();
  if (!raw) return raw;

  // Nothing to do unless it starts with an uppercase letter.
  const first = raw.charAt(0);
  if (first !== first.toUpperCase() || first === first.toLowerCase()) return raw;

  const o = opts || {};
  if (o.isProperNoun === true) return raw;          // authoritative source

  const lower = first.toLowerCase() + raw.slice(1);
  const type  = String(o.wordType || '').toLowerCase();

  // Rule 1 — non-nouns are always safe.
  if (type === 'verb' || type === 'adjective' || type === 'adverb' || type === 'phrase') {
    return lower;
  }

  // Rule 2 — nouns/other: only act on positive evidence from an example.
  const example = String(o.example == null ? '' : o.example);
  if (example) {
    // Look for the word after the first character of the sentence. Lowercase
    // there means common; capitalised there means a name — leave it alone.
    const escaped = lower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const midSentence = new RegExp('(?!^)\\b' + escaped + '\\b');
    if (midSentence.test(example)) return lower;
  }

  return raw;   // no evidence — never guess on a noun
};
