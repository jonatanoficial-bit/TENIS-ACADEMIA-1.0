const CACHE_NAME = 'vale-tennis-v4.1.2-20260623-181210';
const CORE_ASSETS = ['./','./index.html?v=4.1.2-20260623-181210','./css/styles.css?v=4.1.2-20260623-181210','./js/main.js?v=4.1.2-20260623-181210','./js/build.js?v=4.1.2-20260623-181210','./js/contentLoader.js?v=4.1.2-20260623-181210','./js/state.js?v=4.1.2-20260623-181210','./build/build-info.json?v=4.1.2-20260623-181210','./manifest.webmanifest?v=4.1.2-20260623-181210','./assets/icons/icon.svg'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS)).finally(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => (key.includes('vale') || key.includes('tennis')) && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'BUILD_CHECK') event.source?.postMessage?.({ type:'BUILD_ACK', cache:CACHE_NAME, build:'20260623-181210', version:'4.1.2' });
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;
  event.respondWith(fetch(event.request, { cache: 'no-store' }).then(response => {
    const copy = response.clone();
    caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => null);
    return response;
  }).catch(() => caches.match(event.request).then(match => match || caches.match('./index.html?v=4.1.2-20260623-181210'))));
});
