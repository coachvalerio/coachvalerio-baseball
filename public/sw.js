// COACH service worker — offline shell + cache-first static assets
const CACHE = 'coach-v1';
const SHELL = ['/'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Never cache API calls — always network
  if (url.pathname.startsWith('/api/')) return;

  // Static assets: cache-first
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|woff2?)$/)) {
    e.respondWith(
      caches.match(request).then((cached) =>
        cached ?? fetch(request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(request, clone));
          return res;
        })
      )
    );
    return;
  }

  // Pages: network-first, fall back to cache, then shell
  e.respondWith(
    fetch(request).catch(() =>
      caches.match(request).then((r) => r ?? caches.match('/'))
    )
  );
});