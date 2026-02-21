/* Static-cache SW (sin Workbox) — reproducible y fácil de depurar */
const CACHE_VERSION = 'tdr2-v9';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-256.png',
  './icons/icon-384.png',
  './icons/icon-512.png',
  './assets/ui/orientation_portrait.png'
];
  self.addEventListener('message', (event) => {
  if (event?.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(CORE_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => (k === CACHE_VERSION ? Promise.resolve() : caches.delete(k))));
      await self.clients.claim();
    })()
  );
});

function isNavigationRequest(req) {
  return (
    req.mode === 'navigate' ||
    (req.method === 'GET' && req.headers.get('accept') && req.headers.get('accept').includes('text/html'))
  );
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navegación: network-first con fallback a index cacheado (clave por URL real)
  if (isNavigationRequest(req)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_VERSION);
        const indexUrl = new URL('./index.html', self.location.href).toString();

        try {
          const fresh = await fetch(req);
          // Guardamos SIEMPRE el index bajo una clave absoluta estable
          cache.put(indexUrl, fresh.clone());
          return fresh;
        } catch {
          const cached = await cache.match(indexUrl);
          return cached || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
        }
      })()
    );
    return;
  }

// Assets: cache-first, pero NO cacheamos errores (404/500/etc.)
event.respondWith(
  (async () => {
    const cached = await caches.match(req);
    if (cached) return cached;

    try {
      const fresh = await fetch(req);

      // 👇 CLAVE: si no es OK (p.ej. 404), lo devolvemos pero NO lo cacheamos
      if (!fresh || !fresh.ok) return fresh;

      const cache = await caches.open(CACHE_VERSION);
      cache.put(req, fresh.clone());
      return fresh;
    } catch {
      return new Response('', { status: 504 });
    }
  })()
);
});
