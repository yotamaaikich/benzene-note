const CACHE = 'benzene-note-v3';
const FILES = ['./', './index.html', './styles.css?v=3', './app.js?v=2', './data.js', './logic.js', './molecules.js', './origins.js', './icon.svg', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
self.addEventListener('install', event => {
  const freshFiles = FILES.map(path => new Request(path, { cache: 'reload' }));
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(freshFiles)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('benzene-note-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin || !event.request.url.startsWith(self.registration.scope)) return;
  const navigation = event.request.mode === 'navigate';
  event.respondWith(fetch(event.request, navigation ? { cache: 'no-cache' } : undefined).then(response => {
    if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy))); }
    return response;
  }).catch(async () => (await caches.match(event.request)) || (navigation ? await caches.match('./index.html') : Response.error())));
});
