'use strict';

const CACHE_NAME = 'ponte-v68';

const PRECACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/utils.js',
  '/app.js',
  '/false-friends.js',
  '/grammar.js',
  '/flashcards.js',
  '/practice.js',
  '/dictionary.js',
  '/conversation.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/data/articles.js',
  '/data/wordmap.js',
  '/data/false-friends.js',
  '/data/safe-cognates.js',
  '/data/grammar.js',
];

// Install: pre-cache all static assets, bypassing browser HTTP cache.
// Each URL is fetched independently — a single failure won't abort the whole install.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) =>
        Promise.all(
          PRECACHE.map((url) =>
            fetch(url, { cache: 'reload' })
              .then((res) => {
                if (!res.ok) throw new Error(`${res.status} ${url}`);
                return cache.put(url, res);
              })
              .catch((err) => console.warn('[SW] precache miss:', err.message))
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

// Activate: delete old caches, then claim all clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: network-first for API calls, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API calls: network-first, no caching of responses
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(
          JSON.stringify({ offline: true, error: 'You are offline. Connect to use this feature.' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );
    return;
  }

  // Google Fonts: network-first, fall back to cache
  if (url.hostname.includes('fonts.g')) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // All other requests: cache-first, fall back to network
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const clone = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
        return res;
      });
    })
  );
});
