'use strict';

// Local ElevenLabs audio backfill for the Beginner Stories set (NOT deployed).
// Story-side counterpart to backfill-audio-elevenlabs.js, same SHA-1/Blob/Redis
// pattern, adapted for one crucial reason found while building the
// phrase-chunking step: a story is read as ONE continuous narration, not
// assembled from separate word/meaning/example/phrase segments like a
// flashcard drill. Rendering per-sentence or per-phrase fragments produced
// choppy audio on dialogue-heavy stories (no cross-sentence prosody) for
// zero cost benefit — segmentation doesn't change total characters spoken,
// confirmed against story-audio-scripts.json before choosing this design.
// So: exactly one ElevenLabs render per story, the whole `italian` field.
//
// KEY SEPARATION, same discipline as the flashcard scripts:
//   'story_audio' — { [storyId]: { sentences, audio, voice, model, at } }.
//   `sentences` (from backfill-story-audio-script.js) is preserved via a
//   per-id merge, never touched by this script. This is the ONLY key this
//   script writes to besides its backup and the alignment key.
//   data/beginner-stories.js is READ ONLY — static file, not Redis.
//
//   node backfill-story-audio-elevenlabs.js --dry-run    counts + cost, no API calls
//   node backfill-story-audio-elevenlabs.js --sample 2   render N stories to local mp3
//   node backfill-story-audio-elevenlabs.js --run        full run
//   node backfill-story-audio-elevenlabs.js --verify     compare Redis against manifest

require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const { Redis } = require('@upstash/redis');

const MODEL         = 'eleven_multilingual_v2';
const OUTPUT_FORMAT = 'mp3_44100_128';
const API           = 'https://api.elevenlabs.io/v1/text-to-speech';

const OUT_DIR     = path.join(__dirname, 'audio-backfill', 'story-el-sample');
const MANIFEST    = path.join(__dirname, 'audio-backfill', 'story-el-manifest.json');
const ALIGN_FILE  = path.join(__dirname, 'audio-backfill', 'story-el-alignments.json');
const FAILURES    = path.join(__dirname, 'audio-backfill', 'story-el-failures.json');

const AUDIO_KEY  = 'story_audio';
const BAK_KEY    = 'story_audio_bak_pre_el';
const ALIGN_KEY  = 'story_audio_align';
const BLOB_DIR   = 'story-audio/'; // distinct from flashcards' 'audio/' prefix

const sha1 = (s) => crypto.createHash('sha1').update(s, 'utf8').digest('hex').slice(0, 16);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadStories() {
  const src = fs.readFileSync(path.join(__dirname, 'data', 'beginner-stories.js'), 'utf8');
  return new Function(src + '; return beginnerStories;')();
}

function parseArgs(argv) {
  const num = (f, d) => {
    const i = argv.indexOf(f);
    if (i === -1) return d;
    const v = parseInt(argv[i + 1], 10);
    return Number.isFinite(v) && v > 0 ? v : d;
  };
  return {
    dryRun: argv.includes('--dry-run'),
    sample: num('--sample', 0),
    run:    argv.includes('--run'),
    verify: argv.includes('--verify'),
    concurrency: num('--concurrency', 4),
  };
}

function loadJSON(file, dflt) {
  if (!fs.existsSync(file)) return dflt;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {
    console.error(`${file} is corrupt: ${e.message}\nMove it aside; refusing to overwrite generated work.`);
    process.exit(1);
  }
}
function saveJSON(file, data, pretty) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data));
  fs.renameSync(tmp, file);
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

async function withRetry(fn, label) {
  const MAX = 5;
  for (let attempt = 1; ; attempt++) {
    try { return await fn(); }
    catch (err) {
      const m = /HTTP (\d{3})/.exec(err.message || '');
      const status = m ? parseInt(m[1], 10) : null;
      const retryable = status === null || status === 429 || status >= 500;
      if (!retryable || attempt >= 5) throw err;
      const wait = Math.min(16000, 1000 * 2 ** (attempt - 1)) * (0.8 + Math.random() * 0.4);
      console.warn(`    [${label}] ${status || 'network'} — retry ${attempt}/${MAX} in ${Math.round(wait)}ms`);
      await sleep(wait);
    }
  }
}

async function pool(items, n, worker) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const idx = i++; await worker(items[idx], idx); }
  }));
}

(async () => {
  const opts = parseArgs(process.argv.slice(2));
  const apiKey  = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!apiKey || !voiceId) { console.error('ELEVENLABS_API_KEY / ELEVENLABS_VOICE_ID missing from .env'); process.exit(1); }

  const stories = loadStories();
  const texts = stories.map((s) => ({ id: s.id, text: s.italian.trim(), hash: sha1(s.italian.trim()) }));
  const uniqueChars = texts.reduce((n, t) => n + t.text.length, 0);
  const dupCheck = new Set(texts.map((t) => t.hash));

  console.log('Model  :', MODEL);
  console.log('Voice  :', voiceId);
  console.log('Stories:', stories.length);
  console.log('Unique texts (deduped by SHA-1):', dupCheck.size, dupCheck.size !== texts.length ? '(duplicates found!)' : '');
  console.log('Total characters                :', uniqueChars.toLocaleString(), '← full-run credit cost at 1 credit/char');
  console.log();

  if (opts.dryRun) { console.log('--dry-run: no API calls made.'); return; }

  const url = process.env.KV_REST_API_URL;
  const redisRead  = new Redis({ url, token: process.env.KV_REST_API_READ_ONLY_TOKEN || process.env.KV_REST_API_TOKEN });
  const redisWrite = new Redis({ url, token: process.env.KV_REST_API_TOKEN });

  if (opts.verify) {
    const remote = (await redisRead.get(AUDIO_KEY)) || {};
    const withAudio = Object.values(remote).filter((v) => v.audio && Object.keys(v.audio).length).length;
    console.log(`${AUDIO_KEY} stories: ${Object.keys(remote).length}   ...carrying audio: ${withAudio}`);
    const anyEntry = Object.values(remote).find((v) => v.audio && Object.keys(v.audio).length);
    if (anyEntry) {
      const u = Object.values(anyEntry.audio)[0].url;
      const r = await fetch(u, { method: 'HEAD' });
      console.log('spot-check fetch:', 'HTTP', r.status, r.ok ? '(ok)' : '(FAILED)');
    }
    return;
  }

  if (opts.sample > 0) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const picks = texts.slice(0, opts.sample);
    for (const item of picks) {
      const r = await synthesize(item.text, apiKey, voiceId);
      const file = path.join(OUT_DIR, item.id + '.mp3');
      fs.writeFileSync(file, r.audio);
      const dur = r.alignment && r.alignment.character_end_times_seconds
        ? r.alignment.character_end_times_seconds.slice(-1)[0] : null;
      console.log(item.id, item.text.length + 'ch', (r.audio.length / 1024).toFixed(1) + 'KB',
        dur ? dur.toFixed(1) + 's' : '?', '->', path.relative(__dirname, file));
      await sleep(250);
    }
    console.log('\nNothing uploaded, Redis untouched. Listen to the local files above.');
    return;
  }

  if (!opts.run) { console.log('Nothing to do. Use --dry-run, --sample N, --run, or --verify.'); return; }

  const manifest   = loadJSON(MANIFEST, {});
  const alignments = loadJSON(ALIGN_FILE, {});
  const { put } = require('/Users/jonnymazo/ponte/node_modules/@vercel/blob');

  const todo = texts.filter((t) => !manifest[t.hash]);
  console.log('already generated:', texts.length - todo.length);
  console.log('to generate      :', todo.length, `(${todo.reduce((n, t) => n + t.text.length, 0).toLocaleString()} characters)`);
  if (!todo.length) console.log('nothing to generate — skipping to the Redis write.');
  console.log();

  const failures = [];
  let done = 0, chars = 0, bytes = 0;

  await pool(todo, opts.concurrency, async (item) => {
    try {
      const r = await withRetry(() => synthesize(item.text, apiKey, voiceId), item.id);
      const up = await withRetry(() => put(BLOB_DIR + item.hash + '.mp3', r.audio, {
        access: 'public', addRandomSuffix: false, contentType: 'audio/mpeg',
        token: process.env.BLOB_READ_WRITE_TOKEN, allowOverwrite: true,
      }), item.id + ' blob');
      if (r.alignment) alignments[item.hash] = r.alignment;
      const endTimes = r.alignment && r.alignment.character_end_times_seconds;
      manifest[item.hash] = {
        url: up.url,
        ms: endTimes ? Math.round(endTimes[endTimes.length - 1] * 1000) : null,
        chars: item.text.length,
        storyId: item.id,
      };
      chars += item.text.length; bytes += r.audio.length;
    } catch (e) {
      failures.push({ id: item.id, text: item.text.slice(0, 80), error: e.message });
    }
    done++;
    saveJSON(MANIFEST, manifest, true);       // disk first, always — money already spent
    saveJSON(ALIGN_FILE, alignments, false);
    console.log(`  ${done}/${todo.length}  ${item.id}  ${item.text.length}ch`);
  });

  if (failures.length) {
    saveJSON(FAILURES, failures, true);
    console.log('\n' + failures.length + ' failure(s) written to story-el-failures.json');
  }
  console.log('\ngenerated this run:', done - failures.length, ' characters:', chars.toLocaleString(), ' bytes:', bytes.toLocaleString());

  // ── Write to Redis: per-id merge, preserving `sentences` from the chunking step ──
  const existing = (await redisRead.get(AUDIO_KEY)) || {};
  const merged = {};
  let missing = 0;
  for (const item of texts) {
    const m = manifest[item.hash];
    const audio = m ? { [item.hash]: { url: m.url, ms: m.ms } } : {};
    if (!m) missing++;
    merged[item.id] = {
      ...existing[item.id],
      audio,
      voice: voiceId,
      model: MODEL,
      at: new Date().toISOString(),
    };
  }

  if (Object.keys(merged).length !== stories.length) {
    console.error('ABORT: would write a different story count than exists in data/beginner-stories.js.');
    process.exit(1);
  }
  const cardsWithAudio = Object.values(merged).filter((v) => v.audio && Object.keys(v.audio).length).length;
  const sizeMB = Buffer.byteLength(JSON.stringify(merged)) / 1024 / 1024;
  console.log('\nkey size after write:', sizeMB.toFixed(2) + 'MB');
  if (sizeMB > 3) { console.error('ABORT: ' + AUDIO_KEY + ' would exceed 3MB — restructure before writing.'); process.exit(1); }

  if (Object.keys(existing).length) {
    await redisWrite.set(BAK_KEY, existing);
    console.log('backed up existing ' + AUDIO_KEY + ' to ' + BAK_KEY);
  }
  await redisWrite.set(AUDIO_KEY, merged);
  console.log('wrote ' + Object.keys(merged).length + ' stories; ' + cardsWithAudio + ' carry audio' +
    (missing ? '; ' + missing + ' still missing audio' : ''));

  const alignCount = Object.keys(alignments).length;
  if (alignCount) {
    const alignMB = Buffer.byteLength(JSON.stringify(alignments)) / 1024 / 1024;
    console.log(ALIGN_KEY + ' size:', alignMB.toFixed(2) + 'MB across ' + alignCount + ' texts');
    await redisWrite.set(ALIGN_KEY, alignments);
    console.log('wrote ' + ALIGN_KEY);
  }

  const after = await redisRead.get(AUDIO_KEY);
  console.log('verify: ' + Object.keys(after || {}).length + ' stories readable back');
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
