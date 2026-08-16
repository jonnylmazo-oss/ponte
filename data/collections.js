'use strict';
// ── Puzzle collections (#82) — named, renewable, built once ────────────────
// Landmark/scenery collections for the Complete-the-Picture mechanic. Each
// collection is one flat-cartoon hero image (Replicate flux-schnell, same
// style DNA as the visual deck's illustrations, 3:2 at 1MP) hosted in Vercel
// Blob under content-hashed paths — Blob's CDN serves stale bytes for
// overwritten pathnames, so a regenerated image must land at a NEW path;
// identity lives in this file, not the URL.
//
// Renewable: append entries here (+ one generated image) — the puzzle module
// activates the first entry not yet completed, in this order. Names are in
// Italian deliberately (free vocabulary), with an English subtitle.
window.PONTE_COLLECTIONS = [
  { id: 'colosseo', name: 'Il Colosseo', nameEN: 'The Colosseum', img: 'https://kiq4syiuxqwlvn4e.public.blob.vercel-storage.com/collections/colosseo.webp' },
  { id: 'toscana', name: 'La Campagna Toscana', nameEN: 'Tuscan Countryside', img: 'https://kiq4syiuxqwlvn4e.public.blob.vercel-storage.com/collections/toscana.webp' },
  { id: 'venezia', name: 'I Canali di Venezia', nameEN: 'Venetian Canals', img: 'https://kiq4syiuxqwlvn4e.public.blob.vercel-storage.com/collections/venezia-61dccd90.webp' },
  { id: 'amalfi', name: 'La Costiera Amalfitana', nameEN: 'Amalfi Coast', img: 'https://kiq4syiuxqwlvn4e.public.blob.vercel-storage.com/collections/amalfi-d35223ed.webp' },
  { id: 'firenze', name: 'Il Duomo di Firenze', nameEN: 'Florence Cathedral', img: 'https://kiq4syiuxqwlvn4e.public.blob.vercel-storage.com/collections/firenze-5989dbd5.webp' },
  { id: 'cinqueterre', name: 'Le Cinque Terre', nameEN: 'Cinque Terre', img: 'https://kiq4syiuxqwlvn4e.public.blob.vercel-storage.com/collections/cinqueterre-d55470c5.webp' },
  { id: 'pisa', name: 'La Torre di Pisa', nameEN: 'Tower of Pisa', img: 'https://kiq4syiuxqwlvn4e.public.blob.vercel-storage.com/collections/pisa-3602d6fe.webp' },
  { id: 'como', name: 'Il Lago di Como', nameEN: 'Lake Como', img: 'https://kiq4syiuxqwlvn4e.public.blob.vercel-storage.com/collections/como-01278328.webp' },
];
