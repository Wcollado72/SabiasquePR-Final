// ============================================================
// sw.js — Service Worker · Sabías que PR
// Estrategia: Cache-first para assets estáticos,
//             Network-first para páginas HTML.
// ============================================================

const CACHE_NAME  = 'sqpr-v3';
const CACHE_PAGES = 'sqpr-pages-v3';

// Assets estáticos que se cachean al instalar
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/about.html',
  '/noticias.html',
  '/tecnologia.html',
  '/educacion.html',
  '/tienda.html',
  '/contacto.html',
  '/details.html',
  '/privacidad.html',
  '/terminos.html',
  '/404.html',
  '/styles.css',
  '/script.js',
  '/auth.js',
  '/manifest.json',
  '/favicon.svg',
  '/images/Coqui.webp',
  '/images/nuevoshumanos.webp',
];

// ── INSTALL — precachear assets estáticos ──────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE — limpiar caches obsoletas ────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME && key !== CACHE_PAGES)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH — estrategia por tipo de recurso ─────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo interceptar peticiones del mismo origen
  if (url.origin !== location.origin) return;

  // HTML → Network-first (siempre mostrar contenido fresco)
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_PAGES).then(c => c.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request).then(cached => cached || caches.match('/404.html')))
    );
    return;
  }

  // Assets (CSS, JS, imágenes) → Cache-first
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(res => {
        if (!res || res.status !== 200 || res.type !== 'basic') return res;
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(request, clone));
        return res;
      });
    })
  );
});
