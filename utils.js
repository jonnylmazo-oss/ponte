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
