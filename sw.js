const CACHE_NAME = 'ace-manager-static-v0-1-0';
const APP_SHELL = [
  './',
  './index.html',
  './admin.html',
  './css/main.css',
  './js/main.js',
  './js/admin.js',
  './build/build-info.json',
  './content/manifest.json',
  './assets/icons/favicon.svg',
  './assets/icons/logo-mark.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/backgrounds/bg-dashboard.svg',
  './assets/backgrounds/bg-court-night.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      const clone = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
      return response;
    }).catch(() => caches.match('./index.html')))
  );
});
