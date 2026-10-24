// ============================================================
// sw.js — Service Worker · Sabías que PR
// Estrategia: Network-first para páginas HTML,
//             Stale-while-revalidate para CSS y JS,
//             Cache-first para imágenes y demás assets.
// Las llamadas a la API (otro origen) no se interceptan.
// ============================================================

// Sube estos números en cada rediseño o cambio de imágenes:
// las imágenes usan cache-first y, sin cambiar la versión, se quedarían viejas.
const CACHE_NAME  = 'sqpr-v42';
const CACHE_PAGES = 'sqpr-pages-v23';

// Assets estáticos que se cachean al instalar (todos deben existir)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/noticias.html',
  '/articulo.html',
  '/recurso.html',
  '/reset-password.html',
  '/revolucion-humana.html',
  '/educacion.html',
  '/premium.html',
  '/tienda.html',
  '/contacto.html',
  '/details.html',
  '/privacidad.html',
  '/terminos.html',
  '/404.html',
  '/script.js',
  '/i18n.js',
  '/auth.js',
  '/ia-herramientas.js',
  '/editorial.js',
  '/home.js',
  '/regiones.js',
  '/clasificacion.js',
  '/correccion.js',
  '/taller.js',
  '/noticias.js',
  '/articulo.js',
  '/contenidos.js',
  '/citas.js',
  '/recurso.js',
  '/reset-password.js',
  '/reporte.js',
  '/debate.js',
  '/logica-humana.js',
  '/rh-significado.js',
  '/premium.js',
  '/productos.js',
  '/manifest.json',
  '/favicon.svg',
  '/images/Coqui-sm.webp',
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

// Guarda el CSS/JS versionado (styles.css?v=hash) y borra sus versiones viejas
async function putVersioned(cache, request, response) {
  await cache.put(request, response);
  const current = new URL(request.url);
  const keys = await cache.keys();
  await Promise.all(keys
    .filter(k => {
      const u = new URL(k.url);
      return u.pathname === current.pathname && u.search !== current.search;
    })
    .map(k => cache.delete(k)));
}

// ── FETCH — estrategia por tipo de recurso ─────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
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
        .catch(() => caches.match(request, { ignoreSearch: true }).then(cached => cached || caches.match('/404.html')))
    );
    return;
  }

  // CSS y JS → Stale-while-revalidate (rápido, y se actualiza en segundo plano)
  if (/\.(css|js)$/.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(request).then(cached => {
          const network = fetch(request)
            .then(res => {
              if (res && res.status === 200 && res.type === 'basic') putVersioned(cache, request, res.clone());
              return res;
            })
            .catch(() => cached || cache.match(request, { ignoreSearch: true }));
          return cached || network;
        })
      )
    );
    return;
  }

  // Imágenes y demás assets → Cache-first
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
