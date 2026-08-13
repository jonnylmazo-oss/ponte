'use strict';
// One-time generator (not deployed) for #14 — the public SEO landing page.
// Reads the curated dataset directly so content stays in sync with the app's
// own False Friends tab, then bakes it into fully static HTML (no client-side
// rendering required for the content to be crawlable) — regenerate manually
// if data/false-friends.js ever changes.
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const src = fs.readFileSync(path.join(ROOT, 'data', 'false-friends.js'), 'utf8');
const falseFriends = new Function(src + '; return falseFriends;')();

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const DANGER_ORDER = ['high', 'medium', 'low'];
const DANGER_LABEL = {
  high:   { title: 'High danger',   sub: 'Confidently wrong — these will actively mislead you.' },
  medium: { title: 'Medium danger', sub: 'Easy to guess wrong in the moment.' },
  low:    { title: 'Low danger',    sub: 'Minor mix-ups, rarely a real misunderstanding.' },
};

function cardHTML(w) {
  return `
      <article class="ff-card" id="ff-${w.id}">
        <div class="ff-card-head">
          <span class="ff-it">${esc(w.italian)}</span>
          <span class="ff-arrow">≠</span>
          <span class="ff-es">${esc(w.spanishLookalike)}</span>
        </div>
        <p class="ff-meaning">
          <strong>${esc(w.italian)}</strong> means <em>${esc(w.italianMeaning)}</em> in Italian —
          but looks just like Spanish <strong>${esc(w.spanishLookalike)}</strong>, which means <em>${esc(w.spanishMeaning)}</em>.
        </p>
        <p class="ff-example">
          <span class="ff-example-it">${esc(w.example)}</span>
          <span class="ff-example-en">${esc(w.exampleEN)}</span>
        </p>
        <p class="ff-tip">💡 ${esc(w.tip)}</p>
      </article>`;
}

function sectionHTML(danger) {
  const items = falseFriends.filter((w) => w.danger === danger);
  if (!items.length) return '';
  const label = DANGER_LABEL[danger];
  return `
    <section class="ff-danger-section" id="${danger}">
      <h2 class="ff-danger-title ff-danger-${danger}">${esc(label.title)} <span class="ff-danger-count">(${items.length})</span></h2>
      <p class="ff-danger-sub">${esc(label.sub)}</p>
      <div class="ff-card-grid">
        ${items.map(cardHTML).join('')}
      </div>
    </section>`;
}

const counts = DANGER_ORDER.map((d) => `${falseFriends.filter((w) => w.danger === d).length} ${d}`).join(', ');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>100 Italian False Friends for Spanish Speakers | Ponte</title>
<meta name="description" content="100 Italian words that look like Spanish but mean something completely different — the exact traps Spanish speakers hit learning Italian. Free reference list with examples, sorted by how dangerous the mix-up is.">
<meta property="og:title" content="100 Italian False Friends for Spanish Speakers">
<meta property="og:description" content="Italian words that look like Spanish but mean something completely different — free reference list with examples.">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary">
<link rel="canonical" href="https://ponte-ten-sooty.vercel.app/false-friends-spanish.html">
<link rel="stylesheet" href="style.css">
<style>
  /* Page-specific layout only — colors/fonts/spacing tokens come from style.css's
     existing Kindle-sepia custom properties, kept visually consistent with the app. */
  body { max-width: 880px; margin: 0 auto; padding: 0 20px 80px; background: var(--bg); color: var(--text); }
  .ff-hero { padding: 48px 0 28px; border-bottom: 1px solid var(--border); }
  .ff-hero h1 { font-size: 1.7rem; margin: 10px 0 14px; line-height: 1.3; }
  .ff-hero p { font-size: 1.02rem; line-height: 1.6; color: var(--text-mid); max-width: 640px; }
  .ff-logo { font-size: 1.3rem; font-weight: 800; color: var(--text); text-decoration: none; }
  .ff-logo span { color: #0055AA; }
  .ff-stats { display: flex; gap: 18px; margin-top: 18px; flex-wrap: wrap; }
  .ff-stat { font-size: 0.8rem; color: var(--text-dim); }
  .ff-jump { display: flex; gap: 8px; margin-top: 20px; flex-wrap: wrap; }
  .ff-jump a { font-size: 0.8rem; padding: 6px 12px; border: 1px solid var(--border-mid); border-radius: 20px; color: var(--text-mid); text-decoration: none; }
  .ff-jump a:hover { background: var(--bg-card); }
  .ff-search { width: 100%; box-sizing: border-box; margin-top: 20px; padding: 10px 14px; font-size: 15px; border: 1px solid var(--border-mid); border-radius: 8px; background: var(--bg-card); color: var(--text); font-family: var(--font); }
  .ff-danger-section { margin-top: 40px; }
  .ff-danger-title { font-size: 1.15rem; margin-bottom: 2px; }
  .ff-danger-count { font-weight: 400; color: var(--text-dim); font-size: 0.9rem; }
  .ff-danger-high   { color: var(--false-friend); }
  .ff-danger-medium { color: #B85C00; }
  .ff-danger-low    { color: var(--text-mid); }
  .ff-danger-sub { color: var(--text-dim); font-size: 0.85rem; margin: 0 0 18px; }
  .ff-card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
  .ff-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; }
  .ff-card-head { display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px; }
  .ff-it { font-size: 1.05rem; font-weight: 700; color: var(--text); }
  .ff-arrow { color: var(--false-friend); font-weight: 700; }
  .ff-es { font-size: 0.95rem; color: var(--text-mid); }
  .ff-meaning { font-size: 0.87rem; line-height: 1.5; color: var(--text-mid); margin: 0 0 10px; }
  .ff-example { display: block; font-size: 0.85rem; line-height: 1.5; margin: 0 0 8px; padding: 8px 10px; background: var(--bg-italian); border-radius: 6px; }
  .ff-example-it { display: block; color: var(--text); }
  .ff-example-en { display: block; color: var(--text-dim); font-style: italic; margin-top: 2px; }
  .ff-tip { font-size: 0.82rem; color: var(--text-mid); margin: 0; }
  .ff-cta { margin-top: 56px; padding: 28px; text-align: center; background: var(--bg-italian); border-radius: 12px; border: 1px solid var(--border); }
  .ff-cta h2 { margin: 0 0 8px; font-size: 1.2rem; }
  .ff-cta p { color: var(--text-mid); margin: 0 0 16px; }
  .ff-cta a.ff-cta-btn { display: inline-block; padding: 11px 26px; background: #0055AA; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 600; }
  .ff-hidden { display: none !important; }
  @media (prefers-color-scheme: dark) { body { background: var(--bg); } }
</style>
</head>
<body>

  <!-- div, not header-tag — style.css has a bare header element selector
       (position: sticky, fixed height, for the app's own top nav) that would
       collide with any header tag on the page regardless of class. -->
  <div class="ff-hero">
    <a class="ff-logo" href="/">Pon<span>te</span></a>
    <h1>100 Italian False Friends for Spanish Speakers</h1>
    <p>
      If you already speak Spanish, most Italian vocabulary is a shortcut — but not all of it.
      These are the Italian words that <em>look</em> like Spanish and will make you confidently say
      the wrong thing. <strong>burro</strong> is not a donkey, <strong>salire</strong> is not to leave,
      and <strong>subire</strong> is not to go up. This is the full reference list, sorted by how
      badly each one will trip you up.
    </p>
    <div class="ff-stats">
      <span class="ff-stat">${falseFriends.length} entries</span>
      <span class="ff-stat">${counts}</span>
    </div>
    <div class="ff-jump">
      <a href="#high">High danger</a>
      <a href="#medium">Medium danger</a>
      <a href="#low">Low danger</a>
    </div>
    <input type="text" class="ff-search" id="ff-search" placeholder="Search a word… (e.g. burro, salire, subire)" autocomplete="off">
  </div>

  <main id="ff-main">
    ${DANGER_ORDER.map(sectionHTML).join('')}
  </main>

  <div class="ff-cta">
    <h2>Learning Italian as a Spanish speaker?</h2>
    <p>Ponte reads Italian text aloud and color-codes every word by how much Spanish already gets you there — same word, similar-but-different, false friend, or genuinely new.</p>
    <a class="ff-cta-btn" href="/">Try Ponte →</a>
  </div>

  <script>
    // Progressive enhancement only — all ${falseFriends.length} entries are
    // already real, static, crawlable HTML above; this just filters visibility.
    (function () {
      var input = document.getElementById('ff-search');
      var cards = Array.prototype.slice.call(document.querySelectorAll('.ff-card'));
      var sections = Array.prototype.slice.call(document.querySelectorAll('.ff-danger-section'));
      input.addEventListener('input', function () {
        var q = input.value.trim().toLowerCase();
        cards.forEach(function (c) {
          var match = !q || c.textContent.toLowerCase().indexOf(q) !== -1;
          c.classList.toggle('ff-hidden', !match);
        });
        sections.forEach(function (s) {
          var anyVisible = s.querySelector('.ff-card:not(.ff-hidden)');
          s.classList.toggle('ff-hidden', !anyVisible);
        });
      });
    })();
  </script>
</body>
</html>
`;

fs.writeFileSync(path.join(ROOT, 'false-friends-spanish.html'), html);
console.log('wrote false-friends-spanish.html —', falseFriends.length, 'entries,', html.length, 'bytes');
