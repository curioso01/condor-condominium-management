// Service Worker para PWA do Condor
// __BUILD_ID__ é substituído automaticamente a cada build (vite.config.ts),
// garantindo que cada deploy gere um novo Service Worker e atualize os apps instalados.
const CACHE_NAME = 'condor-pwa-__BUILD_ID__';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon-32x32.png',
  '/apple-touch-icon.png',
  '/condor-emblem.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable-512x512.png'
];

// Install: pré-carrega recursos essenciais
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Falha ao precachear alguns arquivos:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate: limpa caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: Network-first com fallback para Cache para rotas de navegação, Cache-first para assets estáticos
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Ignora requisições não-GET ou extensões de terceiros
  if (req.method !== 'GET') return;
  if (!req.url.startsWith(self.location.origin) && !req.url.includes('fonts.googleapis.com') && !req.url.includes('fonts.gstatic.com')) {
    return;
  }

  // Navegações de página (SPA)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          return caches.match('/index.html');
        })
    );
    return;
  }

  // Imagens e fontes: Cache-first
  if (req.destination === 'image' || req.destination === 'font' || req.destination === 'style') {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) {
          // Atualiza em background (stale-while-revalidate)
          fetch(req).then((fresh) => {
            if (fresh.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(req, fresh));
            }
          }).catch(() => {});
          return cached;
        }
        return fetch(req).then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Demais requisições: Network-first
  event.respondWith(
    fetch(req)
      .then((response) => {
        return response;
      })
      .catch(() => caches.match(req))
  );
});
