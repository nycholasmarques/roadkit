/* Roadkit service worker: opens the app with no network.
   Served by tools/roadkit.py at /sw.js, with VERSION replaced by a hash of the interface files, so any
   new release (or edit) installs a fresh copy of the interface in one go.
   - Interface (the page, src/*): from the cache, installed all at once per version.
   - Roadmaps, manifest.json and labels: network first, the last copy as a fallback.
   - API (/api/*): never touched here; the app keeps its own offline copy of progress and notes. */
'use strict';
const VERSION = '__ROADKIT_VERSION__';
const SHELL_CACHE = `roadkit-shell-${VERSION}`;
const DATA_CACHE = 'roadkit-data';   // survives updates: roadmaps you opened stay available offline
const SHELL = [
  './', 'src/style.css', 'src/markdown.js', 'src/app.js', 'src/ai-prompt.txt', 'src/manifest.webmanifest',
  'src/icons/icon.svg', 'src/icons/icon-192.png', 'src/icons/icon-512.png', 'src/icons/maskable-512.png', 'src/icons/apple-touch-icon.png',
];
const scoped = path => new URL(path, self.registration.scope).href;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL.map(p => new Request(scoped(p), { cache: 'reload' })))));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name.startsWith('roadkit-shell-') && name !== SHELL_CACHE) await caches.delete(name);
    await self.clients.claim();
  })());
});

/* The page asks for the new version once the user accepts it, and lists roadmaps to keep for offline use. */
self.addEventListener('message', event => {
  const msg = event.data || {};
  if (msg.type === 'skipWaiting') self.skipWaiting();
  if (msg.type === 'warm' && Array.isArray(msg.urls)) event.waitUntil(warm(msg.urls));
});

async function warm(urls) {
  const cache = await caches.open(DATA_CACHE);
  for (const u of urls.slice(0, 200)) {
    const url = scoped(u);
    if (new URL(url).origin !== self.location.origin || (await cache.match(url))) continue;
    try { const r = await fetch(url, { cache: 'no-store' }); if (r.ok) await cache.put(url, r); } catch { /* offline: next time */ }
  }
}

async function networkFirst(request) {
  const cache = await caches.open(DATA_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request.url.split('?')[0], response.clone());
    return response;
  } catch (err) {
    const copy = await cache.match(request.url.split('?')[0]);
    if (copy) return copy;
    throw err;
  }
}

async function shellFirst(request, key) {
  const copy = await caches.match(key, { cacheName: SHELL_CACHE });
  return copy || fetch(request);
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const path = url.pathname.slice(new URL(self.registration.scope).pathname.length);   // relative to the app's root
  if (path.startsWith('api/') || path === 'sw.js') return;   // live data and the worker itself: always the network
  if (request.mode === 'navigate') { event.respondWith(shellFirst(request, scoped('./'))); return; }   // any ?r=... opens the same page
  if (SHELL.includes(path) && !path.endsWith('.json')) { event.respondWith(shellFirst(request, scoped(path))); return; }
  event.respondWith(networkFirst(request));   // manifest.json, labels, roadmaps (examples/, roadmaps/, user/)
});
