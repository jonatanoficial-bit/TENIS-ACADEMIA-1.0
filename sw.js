const CACHE_NAME = 'vale-tennis-v4.0.8-20260623-114902';
const CORE_ASSETS = ['./','./index.html','./css/styles.css','./js/main.js','./js/build.js','./build/build-info.json','./manifest.webmanifest','./assets/icons/icon.svg'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS)).finally(() => self.skipWaiting())); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request).then(response => { const copy=response.clone(); caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy)); return response; }).catch(()=>caches.match(event.request)));
});
