#!/usr/bin/env node
// Run once: node icons/generate-icons.js
// Requires: npm install canvas  (or uses system node-canvas if available)
// Falls back to pure Node.js Buffer approach if canvas isn't available.

const fs   = require('fs');
const path = require('path');

function drawIcon(size) {
  // Try to use the 'canvas' npm package if installed
  let createCanvas;
  try {
    ({ createCanvas } = require('canvas'));
  } catch {
    console.error('canvas package not found. Install with: npm install canvas');
    process.exit(1);
  }

  const canvas = createCanvas(size, size);
  const ctx    = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#0D0D0D';
  ctx.beginPath();
  // Rounded rect (radius = 22% of size for iOS-style)
  const r = Math.round(size * 0.22);
  ctx.roundRect(0, 0, size, size, r);
  ctx.fill();

  // Subtle teal border/glow ring
  ctx.strokeStyle = 'rgba(0, 194, 184, 0.3)';
  ctx.lineWidth   = size * 0.025;
  ctx.beginPath();
  ctx.roundRect(
    ctx.lineWidth / 2,
    ctx.lineWidth / 2,
    size - ctx.lineWidth,
    size - ctx.lineWidth,
    r
  );
  ctx.stroke();

  // "P" in white — left part of logo
  const fontSz = Math.round(size * 0.52);
  ctx.font      = `700 ${fontSz}px Inter, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Measure full word to split "P" + "onte" with correct x positions
  const full    = 'Po';
  const pMetric = ctx.measureText('P');
  const full2   = ctx.measureText(full);

  // Draw word centered: "P" white + "o" cyan
  // For icon simplicity: just "P" in white + "e" subscript in cyan
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('P', size * 0.5 - size * 0.09, size * 0.50);

  ctx.fillStyle = '#00C2B8';
  ctx.font      = `700 ${Math.round(fontSz * 0.72)}px Inter, Arial, sans-serif`;
  ctx.fillText('e', size * 0.5 + size * 0.16, size * 0.52);

  return canvas.toBuffer('image/png');
}

[192, 512].forEach((size) => {
  const buf  = drawIcon(size);
  const dest = path.join(__dirname, `icon-${size}.png`);
  fs.writeFileSync(dest, buf);
  console.log(`✓ icon-${size}.png (${(buf.length / 1024).toFixed(1)} KB)`);
});
