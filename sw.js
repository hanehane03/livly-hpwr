'use strict';

// Keep both cache lookup and cleanup inside this app's registration scope.
// Bump VERSION whenever a precached file changes.
const VERSION = 'v2';
const CACHE_PREFIX = `livly-hpwr:${self.registration.scope}:`;
const CACHE_NAME = `${CACHE_PREFIX}${VERSION}`;
const ASSETS = [
  './', './index.html', './styles.css', './calculator.js', './app.js',
  './manifest.webmanifest', './icon.svg', './icons/icon-192.png',
  './icons/icon-512.png', './icons/apple-touch-icon.png',
];
const ASSET_URLS = new Set(ASSETS.map(asset => new URL(asset, self.registration.scope).href));

self.addEventListener('install', event => {
  // An update waits for user confirmation or until all older tabs have closed.
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  // Query strings on the app entry point should also work offline. Do not
  // substitute the app shell for unknown routes or unrelated resources.
  const assetUrl = new URL(url);
  assetUrl.search = '';
  if (!ASSET_URLS.has(assetUrl.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    return await cache.match(assetUrl.href) || fetch(request);
  })());
});
