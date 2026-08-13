'use strict';

// Local ElevenLabs audio backfill (NOT deployed).
//
// Renders the phrase-level scripts already in Redis key 'flashcard_audio' to
// real speech via ElevenLabs, capturing character-level timestamps in the same
// pass (needed later for Phase 2 karaoke sync — regenerating for them would
// cost the full character spend a second time and produce a different render).
//
// Texts are content-addressed by SHA-1, so the example sentence — which every
// card speaks twice — is rendered once and referenced twice.
//
//   node backfill-audio-elevenlabs.js --dry-run    counts + cost, no API calls
//   node backfill-audio-elevenlabs.js --sample 3   render N cards to local mp3
//
// --sample writes to audio-backfill/el-sample/ and uploads NOTHING. It also
// writes a listen.html that plays a card end to end with the real inter-segment
// gaps, so the sample is judged the way the app will actually sound.
//
// Credentials come from .env / .env.local and are never logged:
//   ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID

require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const { Redis } = require('@upstash/redis');

const MODEL         = 'eleven_multilingual_v2';
const OUTPUT_FORMAT = 'mp3_44100_128';
const API           = 'https://api.elevenlabs.io/v1/text-to-speech';

const OUT_DIR    = path.join(__dirname, 'audio-backfill', 'el-sample');
const MANIFEST   = path.join(__dirname, 'audio-backfill', 'el-manifest.json');
// Alignment lives in its own file (compact) and its own Redis key. It is ~3x
// the size of the URL map and only Phase 2 karaoke needs it, so bundling it
// into flashcard_audio would make every audio session pay for it.
const ALIGN_FILE = path.join(__dirname, 'audio-backfill', 'el-alignments.json');
const FAILURES   = path.join(__dirname, 'audio-backfill', 'el-failures.json');
const AUDIO_KEY  = 'flashcard_audio';
const BAK_KEY    = 'flashcard_audio_bak_pre_el';
const ALIGN_KEY  = 'flashcard_audio_align';
const BLOB_DIR   = 'audio/';
const IT = 'it', EN = 'en';

// Redis is read with the read-only token; the write client is used only for
// AUDIO_KEY / BAK_KEY, never for the 'flashcards' deck.
function makeRedis() {
  const url = process.env.KV_REST_API_URL;
  const w   = process.env.KV_REST_API_TOKEN;
  const r   = process.env.KV_REST_API_READ_ONLY_TOKEN || w;
  return {
    read:  new Redis({ url, token: r }),
    write: new Redis({ url, token: w }),
  };
}

// Must mirror audio-player.js segmentsFor() exactly, including the gaps, or the
// sample will not sound like the product.
const GAP_MS = 260, GAP_LANG_MS = 420, GAP_CARD_MS = 700, GAP_SECTION_MS = 1100;

function parseArgs(argv) {
  const num = (f, d) => {
    const i = argv.indexOf(f);
    if (i === -1) return d;
    const v = parseInt(argv[i + 1], 10);
    if (!Number.isFinite(v) || v <= 0) { console.error(f + ' needs a positive integer'); process.exit(1); }
    return v;
  };
  return {
    dryRun:      argv.includes('--dry-run'),
    sample:      num('--sample', 0),
    run:         argv.includes('--run'),
    repair:      argv.includes('--repair'),
    verify:      argv.includes('--verify'),
    limit:       num('--limit', 0),
    concurrency: num('--concurrency', 4),
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadManifest() {
  if (!fs.existsSync(MANIFEST)) return {};
  try {
    const j = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
    return (j && typeof j === 'object' && !Array.isArray(j)) ? j : {};
  } catch (e) {
    console.error('Manifest is corrupt: ' + e.message + '\nMove it aside; refusing to overwrite generated work.');
    process.exit(1);
  }
}

// Atomic — a crash mid-write must not truncate a file that represents real
// money already spent.
function saveManifest(m) {
  fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
  const tmp = MANIFEST + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(m, null, 2));
  fs.renameSync(tmp, MANIFEST);
}

function loadAlignments() {
  if (!fs.existsSync(ALIGN_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(ALIGN_FILE, 'utf8')) || {}; }
  catch (e) { console.error('Alignment file corrupt: ' + e.message); process.exit(1); }
}

function saveAlignments(a) {
  fs.mkdirSync(path.dirname(ALIGN_FILE), { recursive: true });
  const tmp = ALIGN_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(a)); // compact: arrays of floats
  fs.renameSync(tmp, ALIGN_FILE);
}

// Retry on rate limits and transport errors; never on a 4xx that isn't 429.
async function withRetry(fn, label) {
  const MAX = 5;
  for (let attempt = 1; ; attempt++) {
    try { return await fn(); }
    catch (err) {
      const m = /HTTP (\d{3})/.exec(err.message || '');
      const status = m ? parseInt(m[1], 10) : null;
      const retryable = status === null || status === 429 || status >= 500;
      if (!retryable || attempt >= MAX) throw err;
      const wait = Math.min(16000, 1000 * 2 ** (attempt - 1)) * (0.8 + Math.random() * 0.4);
      console.warn(`    [${label}] ${status || 'network'} — retry ${attempt}/${MAX} in ${Math.round(wait)}ms`);
      await sleep(wait);
    }
  }
}

// Fixed-size worker pool.
async function pool(items, n, worker) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await worker(items[idx], idx);
    }
  }));
}

const sha1 = (s) => crypto.createHash('sha1').update(s, 'utf8').digest('hex').slice(0, 16);

// One card's script, in playback order. Mirrors the player.
function segmentsFor(card, chunks) {
  const out = [
    { text: card.italian, lang: IT, label: 'Word' },
    { text: card.english, lang: EN, label: 'Meaning' },
    { text: card.example, lang: IT, label: 'Sentence', gapAfter: GAP_SECTION_MS },
  ];
  (chunks || []).forEach((ch, i) => {
    out.push({ text: ch.it, lang: IT, label: 'Phrase ' + (i + 1) });
    out.push({ text: ch.en, lang: EN, label: 'Phrase ' + (i + 1) });
  });
  out.push({ text: card.example, lang: IT, label: 'Sentence again' });
  return out
    .filter((s) => s.text && String(s.text).trim())
    .map((s) => ({ ...s, text: String(s.text).trim(), hash: sha1(String(s.text).trim()) }));
}

async function synthesize(text, apiKey, voiceId) {
  const url = `${API}/${voiceId}/with-timestamps?output_format=${OUTPUT_FORMAT}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model_id: MODEL }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status} — ${body.slice(0, 300)}`);
  }
  const json = await res.json();
  if (!json.audio_base64) throw new Error('response had no audio_base64');
  return { audio: Buffer.from(json.audio_base64, 'base64'), alignment: json.alignment || null };
}

function writeListenPage(cards) {
  // Plays each card end to end with the real gaps, so the voice is judged in
  // context rather than as isolated clips.
  const data = JSON.stringify(cards, null, 2);
  return `<!doctype html><meta charset="utf-8"><title>ElevenLabs sample — Ponte</title>
<style>
 body{font:16px/1.5 -apple-system,system-ui,sans-serif;background:#F8F1E3;color:#3B2D1F;max-width:640px;margin:40px auto;padding:0 20px}
 h1{font-size:1.2rem}h2{font-size:1rem;margin:26px 0 6px}
 .card{background:#FBF5E9;border:1px solid #D9C9A8;border-radius:12px;padding:16px;margin:14px 0}
 button{font:inherit;padding:10px 16px;border:1px solid #D9C9A8;border-radius:8px;background:#fff;cursor:pointer}
 button.play{background:#0055AA;color:#fff;border-color:#0055AA}
 .seg{padding:4px 8px;border-radius:6px;font-size:.92rem}
 .seg.on{background:#F0E6D0;font-weight:600}
 .en{color:#6B5744;font-style:italic}
 .meta{font-size:.78rem;color:#9B8470}
</style>
<h1>ElevenLabs sample — plays with the real app gaps</h1>
<p class="meta">Gaps: 260ms between phrases, 420ms on language switch, <b>1100ms</b> before the phrase breakdown, 700ms between cards.</p>
<div id="app"></div>
<script>
const CARDS = ${data};
const app = document.getElementById('app');
CARDS.forEach((c, ci) => {
  const d = document.createElement('div'); d.className = 'card';
  d.innerHTML = '<h2>' + c.italian + ' <span class="meta">— ' + c.english + '</span></h2>' +
    '<button class="play" id="b'+ci+'">▶ Play this card</button><div id="s'+ci+'"></div>';
  app.appendChild(d);
  const segs = document.getElementById('s'+ci);
  c.segments.forEach((s, si) => {
    const e = document.createElement('div');
    e.className = 'seg' + (s.lang === 'en' ? ' en' : ''); e.id = 'seg'+ci+'_'+si;
    e.textContent = s.label + ' — ' + s.text;
    segs.appendChild(e);
  });
  document.getElementById('b'+ci).onclick = () => playCard(c, ci);
});
function playCard(c, ci) {
  let i = 0;
  const audio = new Audio();
  const step = () => {
    document.querySelectorAll('.seg.on').forEach(e => e.classList.remove('on'));
    if (i >= c.segments.length) return;
    const s = c.segments[i];
    document.getElementById('seg'+ci+'_'+i).classList.add('on');
    audio.src = s.file; audio.play();
    const prev = s;
    audio.onended = () => {
      i++;
      const next = c.segments[i];
      let gap = !next ? ${GAP_CARD_MS}
              : prev.gapAfter ? prev.gapAfter
              : (prev.lang !== next.lang ? ${GAP_LANG_MS} : ${GAP_MS});
      setTimeout(step, gap);
    };
  };
  step();
}
</script>`;
}

(async () => {
  const opts = parseArgs(process.argv.slice(2));
  const apiKey  = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!apiKey || !voiceId) { console.error('ELEVENLABS_API_KEY / ELEVENLABS_VOICE_ID missing from .env'); process.exit(1); }

  const redis = new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_READ_ONLY_TOKEN || process.env.KV_REST_API_TOKEN,
  });

  const deck  = await redis.get('flashcards');
  const audio = await redis.get('flashcard_audio');
  if (!Array.isArray(deck) || !audio) { console.error('Could not read flashcards / flashcard_audio'); process.exit(1); }
  const byId = {};
  deck.forEach((c) => { byId[String(c.id)] = c; });

  // Whole-deck accounting, so --sample reports the real full-run cost too.
  const allTexts = new Map(); // hash -> { text, lang }
  let cardCount = 0;
  for (const [id, entry] of Object.entries(audio)) {
    const card = byId[id];
    if (!card) continue;
    cardCount++;
    segmentsFor(card, entry.chunks).forEach((s) => {
      if (!allTexts.has(s.hash)) allTexts.set(s.hash, { text: s.text, lang: s.lang });
    });
  }
  const uniqueChars = [...allTexts.values()].reduce((n, t) => n + t.text.length, 0);

  console.log('Model  :', MODEL);
  console.log('Voice  :', voiceId);
  console.log('Cards  :', cardCount);
  console.log('Unique texts (deduped by SHA-1):', allTexts.size.toLocaleString());
  console.log('Unique characters               :', uniqueChars.toLocaleString(), '← full-run credit cost at 1 credit/char');
  console.log();

  if (opts.dryRun) { console.log('--dry-run: no API calls made.'); return; }

  // ── Full run / repair / verify ───────────────────────────────────────────
  if (opts.run || opts.repair || opts.verify) {
    const { put } = require('@vercel/blob');
    const { read, write } = makeRedis();
    const manifest   = loadManifest();
    const alignments = loadAlignments();

    // The first run uploaded alignment as separate blobs. Pull those back down
    // once so everything lives in one place — reads are cheap and cost no
    // ElevenLabs credits, unlike regenerating.
    async function hydrateAlignments() {
      const need = Object.keys(manifest).filter((h) => !alignments[h]);
      if (!need.length) return;
      console.log('hydrating ' + need.length + ' alignment(s) from existing blobs (no credits spent)...');
      let got = 0, gone = 0;
      await pool(need, 8, async (h) => {
        try {
          const r = await fetch(manifest[h].url.replace('.mp3', '.align.json'));
          if (r.ok) { alignments[h] = await r.json(); got++; }
          else gone++;
        } catch (_) { gone++; }
        if ((got + gone) % 250 === 0) { saveAlignments(alignments); console.log('  ' + (got + gone) + '/' + need.length); }
      });
      saveAlignments(alignments);
      console.log('  recovered ' + got + (gone ? ', ' + gone + ' unavailable' : ''));
    }

    // Rebuild the per-card audio map from the manifest. Pure function of
    // (deck, chunks, manifest), so it is safe to re-run at any time.
    function buildAudioMap(existing) {
      const out = {};
      let missing = 0;
      for (const [id, entry] of Object.entries(audio)) {
        const card = byId[id];
        if (!card) continue;
        const segs = segmentsFor(card, entry.chunks);
        const map = {};
        let complete = true;
        for (const s of segs) {
          const m = manifest[s.hash];
          if (!m) { complete = false; missing++; continue; }
          map[s.hash] = { url: m.url, ms: m.ms };
        }
        // Preserve chunks — the player still needs the text for display, for
        // Phase 2 highlighting, and as the Web Speech fallback.
        out[id] = Object.assign({}, existing[id], entry, {
          audio: map,
          voice: voiceId,
          model: MODEL,
          at: new Date().toISOString(),
        });
        if (!complete) out[id].partial = true; else delete out[id].partial;
      }
      return { out, missing };
    }

    if (opts.verify) {
      const remote = await read.get(AUDIO_KEY);
      const withAudio = Object.values(remote || {}).filter((v) => v.audio && Object.keys(v.audio).length).length;
      const partial   = Object.values(remote || {}).filter((v) => v.partial).length;
      console.log('manifest entries      :', Object.keys(manifest).length.toLocaleString(), '/', allTexts.size.toLocaleString());
      console.log(AUDIO_KEY + ' cards      :', Object.keys(remote || {}).length);
      console.log('  ...carrying audio   :', withAudio);
      console.log('  ...marked partial   :', partial);
      // Spot-check that a stored URL actually serves.
      const anyCard = Object.values(remote || {}).find((v) => v.audio && Object.keys(v.audio).length);
      if (anyCard) {
        const u = Object.values(anyCard.audio)[0].url;
        const r = await fetch(u, { method: 'HEAD' });
        console.log('  spot-check fetch    : HTTP', r.status, r.ok ? '(ok)' : '(FAILED)');
      }
      return;
    }

    if (!opts.repair) {
      await hydrateAlignments();

      // Generate + upload everything not already in the manifest.
      let todo = [...allTexts.entries()]
        .filter(([hash]) => !manifest[hash])
        .map(([hash, t]) => ({ hash, ...t }));
      if (opts.limit) todo = todo.slice(0, opts.limit);

      const already = allTexts.size - [...allTexts.keys()].filter((h) => !manifest[h]).length;
      console.log('already generated :', already.toLocaleString());
      console.log('to generate       :', todo.length.toLocaleString(),
        '(' + todo.reduce((n, t) => n + t.text.length, 0).toLocaleString() + ' characters)');
      if (!todo.length) console.log('nothing to generate — skipping to the Redis write.');
      console.log();

      const failures = [];
      let done = 0, chars = 0, bytes = 0;
      const started = Date.now();

      await pool(todo, opts.concurrency, async (item) => {
        try {
          const r = await withRetry(() => synthesize(item.text, apiKey, voiceId), item.hash);
          const base = BLOB_DIR + item.hash;
          // Deterministic pathnames: re-running overwrites rather than
          // accumulating duplicate blobs.
          const up = await withRetry(() => put(base + '.mp3', r.audio, {
            access: 'public', addRandomSuffix: false, contentType: 'audio/mpeg',
            token: process.env.BLOB_READ_WRITE_TOKEN, allowOverwrite: true,
          }), item.hash + ' blob');
          // Alignment is NOT uploaded as a blob. Two puts per text is what
          // doubled the operation count and tripped the store limit; it goes
          // to Redis instead, where it is small and rarely read.
          if (r.alignment) alignments[item.hash] = r.alignment;
          const endTimes = r.alignment && r.alignment.character_end_times_seconds;
          manifest[item.hash] = {
            url: up.url,
            ms: endTimes ? Math.round(endTimes[endTimes.length - 1] * 1000) : null,
            chars: item.text.length,
            lang: item.lang,
          };
          chars += item.text.length; bytes += r.audio.length;
        } catch (e) {
          failures.push({ hash: item.hash, text: item.text.slice(0, 80), error: e.message });
        }
        done++;
        // Disk first, always: every entry here is credits already spent.
        if (done % 25 === 0 || done === todo.length) {
          saveManifest(manifest);
          saveAlignments(alignments);
          const el = (Date.now() - started) / 1000;
          const rate = done / el;
          const eta = rate > 0 ? Math.round((todo.length - done) / rate) : 0;
          console.log(`  ${done}/${todo.length}  ${chars.toLocaleString()}ch  ` +
            `${(bytes / 1024 / 1024).toFixed(1)}MB  ${rate.toFixed(1)}/s  ETA ${Math.floor(eta / 60)}m${eta % 60}s` +
            (failures.length ? `  failures:${failures.length}` : ''));
        }
      });

      saveManifest(manifest);
      saveAlignments(alignments);
      if (failures.length) {
        fs.writeFileSync(FAILURES, JSON.stringify(failures, null, 2));
        console.log('\n' + failures.length + ' failure(s) written to ' + path.relative(__dirname, FAILURES));
      }
      console.log('\ngenerated this run:', done - failures.length, ' characters:', chars.toLocaleString());
    }

    // ── Write to Redis ────────────────────────────────────────────────────
    const existing = (await read.get(AUDIO_KEY)) || {};
    if (!Object.keys(manifest).length) { console.error('Manifest empty — refusing to write.'); process.exit(1); }

    const { out: merged, missing } = buildAudioMap(existing);
    const cardsWithAudio = Object.values(merged).filter((v) => v.audio && Object.keys(v.audio).length).length;

    if (Object.keys(merged).length < Object.keys(existing).length) {
      console.error('ABORT: would write fewer cards than exist. ' +
        Object.keys(merged).length + ' < ' + Object.keys(existing).length);
      process.exit(1);
    }
    // Every card must keep its chunks — losing them breaks display and fallback.
    const lostChunks = Object.entries(merged).filter(([, v]) => !Array.isArray(v.chunks) || !v.chunks.length);
    if (lostChunks.length) { console.error('ABORT: ' + lostChunks.length + ' card(s) lost their chunks.'); process.exit(1); }

    const sizeMB = Buffer.byteLength(JSON.stringify(merged)) / 1024 / 1024;
    console.log('\nkey size after write:', sizeMB.toFixed(2) + 'MB');
    if (sizeMB > 3) { console.error('ABORT: ' + AUDIO_KEY + ' would exceed 3MB — restructure before writing.'); process.exit(1); }

    if (Object.keys(existing).length) {
      await write.set(BAK_KEY, existing);
      console.log('backed up existing ' + AUDIO_KEY + ' to ' + BAK_KEY);
    }
    await write.set(AUDIO_KEY, merged);
    console.log('wrote ' + Object.keys(merged).length + ' cards; ' + cardsWithAudio + ' carry audio' +
      (missing ? '; ' + missing + ' segment(s) still missing audio' : ''));

    // Alignment goes to its own key so a normal audio session never downloads it.
    const alignCount = Object.keys(alignments).length;
    if (alignCount) {
      const alignMB = Buffer.byteLength(JSON.stringify(alignments)) / 1024 / 1024;
      console.log(ALIGN_KEY + ' size:', alignMB.toFixed(2) + 'MB across ' + alignCount + ' texts');
      if (alignMB > 8) { console.error('ABORT: alignment payload too large for one key.'); process.exit(1); }
      await write.set(ALIGN_KEY, alignments);
      console.log('wrote ' + ALIGN_KEY);
    }

    const after = await read.get(AUDIO_KEY);
    console.log('verify: ' + Object.keys(after || {}).length + ' cards readable back');
    return;
  }

  if (!opts.sample) {
    console.log('Nothing to do. Use --dry-run, --sample N, --run, --repair or --verify.');
    return;
  }

  // Spread the sample across the deck rather than taking the first N.
  const ids = Object.keys(audio).filter((id) => byId[id]);
  const picks = [];
  for (let i = 0; i < opts.sample && i < ids.length; i++) {
    picks.push(ids[Math.floor((i + 0.5) * ids.length / opts.sample)]);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const cache = new Map(); // hash -> filename
  let chars = 0, calls = 0, bytes = 0;
  const outCards = [];

  for (const id of picks) {
    const card = byId[id];
    const segs = segmentsFor(card, audio[id].chunks);
    console.log('─'.repeat(70));
    console.log(card.italian + '  (' + (card.wordType || '—') + ')  — ' + card.english);

    const outSegs = [];
    for (const s of segs) {
      let file = cache.get(s.hash);
      if (!file) {
        const r = await synthesize(s.text, apiKey, voiceId);
        file = s.hash + '.mp3';
        fs.writeFileSync(path.join(OUT_DIR, file), r.audio);
        if (r.alignment) {
          fs.writeFileSync(path.join(OUT_DIR, s.hash + '.align.json'), JSON.stringify(r.alignment));
        }
        cache.set(s.hash, file);
        chars += s.text.length; calls++; bytes += r.audio.length;
        const dur = r.alignment && r.alignment.character_end_times_seconds
          ? r.alignment.character_end_times_seconds.slice(-1)[0] : null;
        console.log('  [' + s.lang + '] ' + s.label.padEnd(15) +
          String(s.text.length).padStart(4) + 'ch  ' +
          (r.audio.length / 1024).toFixed(1).padStart(6) + 'KB  ' +
          (dur ? dur.toFixed(2) + 's' : '?') +
          (r.alignment ? '  align:' + r.alignment.characters.length + 'ch' : '  NO ALIGNMENT'));
        await new Promise((r2) => setTimeout(r2, 250));
      } else {
        console.log('  [' + s.lang + '] ' + s.label.padEnd(15) + '  (reused — identical text)');
      }
      outSegs.push({ text: s.text, lang: s.lang, label: s.label, gapAfter: s.gapAfter || null, file });
    }
    outCards.push({ italian: card.italian, english: card.english, segments: outSegs });
  }

  fs.writeFileSync(path.join(OUT_DIR, 'listen.html'), writeListenPage(outCards));

  console.log('─'.repeat(70));
  console.log('API calls        :', calls);
  console.log('Characters spent :', chars.toLocaleString());
  console.log('Audio written    :', (bytes / 1024).toFixed(0) + 'KB across ' + cache.size + ' files');
  console.log('Est. full run    :', uniqueChars.toLocaleString(), 'chars →',
    ((bytes / chars) * uniqueChars / 1024 / 1024).toFixed(0) + 'MB projected');
  console.log();
  console.log('Listen:  open ' + path.relative(__dirname, path.join(OUT_DIR, 'listen.html')));
  console.log('Nothing uploaded. Redis untouched.');
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
