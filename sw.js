const CACHE_NAME = 'vale-tennis-v4.1.1-20260623-150206';
const CORE_ASSETS = ['./','./index.html?v=4.1.1-20260623-150206','./css/styles.css?v=4.1.1-20260623-150206','./js/main.js?v=4.1.1-20260623-150206','./js/build.js?v=4.1.1-20260623-150206','./build/build-info.json?v=4.1.1-20260623-150206','./manifest.webmanifest','./assets/icons/icon.svg'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS)).finally(() => self.skipWaiting())); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request).then(response => { const copy=response.clone(); caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy)); return response; }).catch(()=>caches.match(event.request)));
});
