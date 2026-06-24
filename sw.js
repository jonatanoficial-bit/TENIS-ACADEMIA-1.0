const CACHE_NAME = 'vale-tennis-v4.1.8-20260624-142131';
const BUILD_VERSION = '4.1.8';
const BUILD_ID = '20260624-142131';
const CORE_ASSETS = [
  './',
  './index.html?v=4.1.8-20260624-142131',
  './css/styles.css?v=4.1.8-20260624-142131',
  './js/main.js?v=4.1.8-20260624-142131',
  './js/build.js?v=4.1.8-20260624-142131',
  './js/contentLoader.js?v=4.1.8-20260624-142131',
  './js/state.js?v=4.1.8-20260624-142131',
  './build/build-info.json?v=4.1.8-20260624-142131',
  './manifest.webmanifest?v=4.1.8-20260624-142131',
  './assets/icons/icon.svg'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS)));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('vale-tennis-') && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach(client => client.postMessage({ type:'BUILD_READY', version: BUILD_VERSION, build: BUILD_ID, cache: CACHE_NAME }));
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'BUILD_CHECK') event.source?.postMessage?.({ type:'BUILD_ACK', cache:CACHE_NAME, build:BUILD_ID, version:BUILD_VERSION });
  if (event.data?.type === 'CLEAR_OLD_CACHES') event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('vale-tennis-') && key !== CACHE_NAME).map(key => caches.delete(key)))));
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.searchParams.has('fresh') || url.searchParams.has('hardreset')) {
    event.respondWith(fetch(req, { cache:'no-store' }));
    return;
  }
  if (url.pathname.endsWith('/build-info.json') || url.pathname.includes('/build/build-info.json')) {
    event.respondWith(fetch(req, { cache:'no-store' }).catch(() => caches.match(req)));
    return;
  }
  event.respondWith(
    fetch(req).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => {});
      return response;
    }).catch(() => caches.match(req).then(match => match || caches.match('./index.html?v=4.1.8-20260624-142131')))
  );
});
