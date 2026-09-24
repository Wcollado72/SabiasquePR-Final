#!/usr/bin/env node
// ============================================================
// build.js — Sabías que PR · Generador de sitio estático v2
// ============================================================
// Uso: node build.js
// Genera todos los HTML, sitemap.xml y robots.txt desde aquí.
// ¡Solo edita este archivo — NUNCA los HTML directamente!
// ============================================================

const fs = require('fs');

// ── CONFIGURACIÓN GLOBAL ────────────────────────────────────
const SITE = {
  url:             'https://sabiasquepr.com',    // ← Actualizar con URL real
  name:            'Sabías que PR',
  email:           'sabiasquepr@yahoo.com',
  phone:           '(787) 435-8872',
  location:        'San Juan, Puerto Rico',
  ogImage:         'https://sabiasquepr.com/images/portada-social.webp',

  // ── Backend API (foro) ───────────────────────────────────
  // URL del servidor Express. En local: http://localhost:3000
  // En Netlify: definir la variable de entorno API_URL con la URL de Render.
  apiUrl:          process.env.API_URL || 'http://localhost:3000',

  // ── Formspree (contacto) ─────────────────────────────────
  // 1. Crear cuenta en https://formspree.io → New Form
  // 2. Pegar el ID aquí y ejecutar: node build.js
  formspreeId:     'xwleylbw',

  // ── Google Analytics 4 ──────────────────────────────────
  // 1. Ir a https://analytics.google.com → crear propiedad
  // 2. Copiar el Measurement ID (G-XXXXXXXXXX) y pegarlo aquí
  ga4Id:           'G-5YQT158RHH',

  // ── Supabase (autenticación) ─────────────────────────────
  // 1. Crear proyecto en https://supabase.com
  // 2. Settings → API → copiar Project URL y anon public key
  supabaseUrl:     'https://qmlhjacduuvptxglqxqn.supabase.co',
  supabaseKey:     'sb_publishable_xeRmzsC6kmPflMm7FimG4g_-4mDoSbi',

  // ── Mailchimp (newsletter) ───────────────────────────────
  // 1. En Mailchimp: Audience → Signup forms → Embedded forms
  // 2. Del código embed, extraer u=XXXX&id=XXXX y server (us1, us2…)
  mcUser:          'YOUR_MC_USER',
  mcList:          'YOUR_MC_LIST',
  mcServer:        'us1',

  // ── YouTube Data API (panel admin — elegir video del canal) ──
  // Llave PÚBLICA restringida por dominio (HTTP referrer) en Google
  // Cloud Console — es seguro exponerla en el navegador solo si está
  // restringida así. Se lee de la variable de entorno YOUTUBE_API_KEY
  // en el momento del build (Netlify), igual patrón que API_URL.
  youtubeApiKey:   process.env.YOUTUBE_API_KEY || '',

  // ── Stripe (tienda) ──────────────────────────────────────
  // 1. En Stripe dashboard: Products → Payment Links
  // 2. Crear un link por producto y pegarlo en _content/productos.json
};

// ── CONTENIDO DESDE CMS JSON ────────────────────────────────
const noticias  = JSON.parse(fs.readFileSync('_content/noticias.json',  'utf8'));

// Versión de assets: hash del CSS, para evitar CSS viejo en caché
const ASSET_VERSION = require('crypto').createHash('md5').update(fs.readFileSync('styles.css')).digest('hex').slice(0,8);

// ── HELPERS DE RENDERIZADO ──────────────────────────────────

// noticias/tienda ahora se cargan en el navegador vía la API REST
// (noticias.js / productos.js) en vez de pre-renderizarse aquí.
// `noticias` sigue leyéndose arriba porque generateRSS() la usa.

// Ordena un mapa {valor: etiqueta} por la ETIQUETA mostrada (no por la
// clave interna), sensible al idioma. Se ordena aquí, en Node, al generar
// el sitio (todas estas listas son HTML estático) — cuando el sitio sea
// multilingüe, este mismo helper se llama una vez por idioma con el mapa
// de etiquetas de ese idioma, sin rediseño.
function sortLabelEntries(map, locale = 'es') {
  return Object.entries(map).sort((a, b) => a[1].localeCompare(b[1], locale));
}
function optionsHtml(map, { includeEmpty } = {}) {
  const empty = includeEmpty ? `<option value="">${includeEmpty}</option>\n` : '';
  return empty + sortLabelEntries(map).map(([v, l]) => `<option value="${v}">${l}</option>`).join('\n');
}

// ── COMPONENTES COMPARTIDOS ─────────────────────────────────

// Taxonomía compartida por Noticias, Contenidos, Revolución Humana y
// Educación. Deben coincidir con los CHECK de backend/sql/schema.sql y
// con editorial.js (CATEGORIAS / FORMATO_LABEL / etc.).
const CATEGORIAS = {
  general: 'General', internacionales: 'Internacionales', crimen: 'Crimen', salud: 'Salud',
  deportes: 'Deportes', finanzas: 'Finanzas', tecnologia: 'Tecnología', descubrimientos: 'Descubrimientos',
  politica: 'Política', clima: 'Clima y Medio Ambiente', cultura: 'Cultura', ciencia: 'Ciencia',
};
const TIPOS_FORMATO = {
  video: 'Video', audio: 'Audio', foto: 'Foto', ensayo: 'Ensayo', noticia: 'Noticia', lectura_corta: 'Lectura corta',
};
const SUBFORMATOS = {
  podcast: 'Podcast', entrevista: 'Entrevista', galeria: 'Galería', opinion: 'Opinión',
  reportaje: 'Reportaje', cronica: 'Crónica', guia: 'Guía', infografia: 'Infografía',
  tutorial: 'Tutorial', documental: 'Documental', columna: 'Columna',
};
const DIVULGACION_IA = {
  no: 'No se usó IA', parcial: 'Asistencia parcial de IA', generado: 'Generado principalmente con IA',
};
const CITA_ESTILOS = {
  apa: 'APA', mla: 'MLA', chicago: 'Chicago', turabian: 'Turabian', ama: 'AMA',
  vancouver: 'Vancouver', abnt: 'ABNT', icontec: 'ICONTEC', ieee: 'IEEE', bluebook: 'Bluebook',
};
// Sub-secciones de Revolución Humana. Solo "Lógica Humana" y "Nuevo PR"
// tienen pestaña pública por ahora; las otras 2 ya se admiten en el
// modelo/admin para no migrar de nuevo cuando se activen.
const SUBSECCIONES = {
  'humanos-inhumanos': 'Humanos Inhumanos', 'nuevo-pr': 'Nuevo PR',
  'revolucion-mundial': 'Revolución Mundial', 'logica-humana': 'Lógica Humana',
};

// Botones de filtro por categoría, compartidos entre Noticias, Revolución
// Humana y Educación. "Todas" siempre primero, sin ordenar (es el reset).
const CATEGORIA_FILTER_BUTTONS = `<button type="button" class="foro-filter-btn active" data-categoria="">Todas</button>\n`
  + sortLabelEntries(CATEGORIAS).map(([v, l]) => `        <button type="button" class="foro-filter-btn" data-categoria="${v}">${l}</button>`).join('\n');

const SOCIAL_ICONS = `
        <div class="social-links">
          <a href="https://x.com/SabiasquePR" target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)">
            <img src="images/Xlogo.webp" alt="X" width="28" height="28" loading="lazy">
          </a>
          <a href="https://www.instagram.com/SabiasquePR" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
            <img src="images/instagram.webp" alt="Instagram" width="28" height="28" loading="lazy">
          </a>
          <a href="https://www.youtube.com/@sabiasquePR" target="_blank" rel="noopener noreferrer" aria-label="YouTube" class="social-youtube">
            <svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true"><rect x="1" y="5" width="26" height="18" rx="6" fill="#FF0000"/><path d="M11.5 9.7l7.5 4.3-7.5 4.3z" fill="#fff"/></svg>
          </a>
        </div>`;

const PASS_TOGGLE_BTN = (targetId) => `<button type="button" class="pass-toggle" data-target="${targetId}" aria-label="Mostrar contraseña" aria-pressed="false">
              <svg class="icon-eye" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>
              <svg class="icon-eye-off" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a21.77 21.77 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 5c7 0 11 7 11 7a21.77 21.77 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/></svg>
            </button>`;

const LOGIN_BOX = `
      <div class="login-box" id="login-box">
        <div id="auth-logged-out">
          <label for="login-email">Usuario o correo</label>
          <input type="email" id="login-email" placeholder="tucorreo@example.com" autocomplete="email">
          <label for="login-pass">Contraseña</label>
          <div class="pass-field">
            <input type="password" id="login-pass" placeholder="••••••••" autocomplete="current-password">
            ${PASS_TOGGLE_BTN('login-pass')}
          </div>
          <div class="login-actions">
            <button type="button" id="btn-login">Entrar</button>
            <button type="button" id="btn-google" class="btn-google" title="Entrar con Google">G</button>
          </div>
          <div class="login-links">
            <a href="#" id="link-register">Registrar</a>
            <span>|</span>
            <a href="#" id="link-forgot">¿Olvidaste tu contraseña?</a>
          </div>
          <p id="auth-status" class="auth-status" aria-live="polite"></p>
        </div>
        <div id="auth-logged-in" style="display:none;">
          <p class="user-greeting">Bienvenido/a,</p>
          <p class="user-email" id="user-email-display"></p>
          <p class="foro-badge" id="user-status-badge"></p>
          <nav class="account-menu">
            <a href="mi-cuenta.html">Mi cuenta</a>
            <a href="reset-password.html">Cambiar contraseña</a>
            <a href="admin.html" id="link-admin-shortcut" style="display:none;">Panel de administración</a>
          </nav>
          <button type="button" id="btn-logout" class="btn-logout">Cerrar sesión</button>
        </div>
      </div>`;

const FOOTER = `
    <footer class="footer">
      <div class="footer-inner">
        <div class="footer-brand">
          <a class="brand" href="index.html">
            <img class="brand-mark" src="images/Coqui-sm.webp" alt="" width="32" height="32" loading="lazy">
            <span class="brand-name">Sabías que PR</span>
          </a>
          <p>Un proyecto para entender, cuestionar y mejorar la sociedad en la que vivimos.</p>
          <div class="footer-social">${SOCIAL_ICONS}</div>
        </div>
        <nav aria-label="Secciones">
          <h2 class="footer-h">Secciones</h2>
          <ul>
            <li><a href="noticias.html">Noticias</a></li>
            <li><a href="nuevos-humanos.html">Revolución Humana</a></li>
            <li><a href="educacion.html">Educación</a></li>
            <li><a href="foro.html">Foro</a></li>
            <li><a href="tienda.html">Tienda</a></li>
          </ul>
        </nav>
        <nav aria-label="Proyecto">
          <h2 class="footer-h">Proyecto</h2>
          <ul>
            <li><a href="manifiesto.html">Manifiesto</a></li>
            <li><a href="details.html">Servicios</a></li>
            <li><a href="premium.html">Hazte premium</a></li>
            <li><a href="contacto.html">Contacto</a></li>
            <li><a href="rss.xml">RSS</a></li>
          </ul>
        </nav>
        <div>
          <h2 class="footer-h">Contacto</h2>
          <address>
            <a href="mailto:${SITE.email}">${SITE.email}</a><br>
            ${SITE.phone}<br>
            ${SITE.location}<br>
            Universidad Interamericana de Puerto Rico, Recinto de Fajardo
          </address>
        </div>
      </div>
      <div class="footer-bottom">
        <p>© ${new Date().getFullYear()} Sabías que PR. Todos los derechos reservados.</p>
        <p>Concepto y contenido original: Aliado Imperfekto. Código e imágenes generadas con asistencia de Inteligencia Artificial.</p>
        <p><a href="privacidad.html">Privacidad</a> · <a href="terminos.html">Términos</a> · <a href="#arriba">↑ Volver arriba</a></p>
      </div>
    </footer>`;

const LOGIN_MODAL = `
  <div class="login-modal-overlay" id="login-modal-overlay">
    <div class="login-modal" id="login-modal" role="dialog" aria-modal="true" aria-label="Iniciar sesión">
      <button type="button" class="login-modal-close" id="login-modal-close" aria-label="Cerrar">✕</button>
      ${LOGIN_BOX}
    </div>
  </div>`;

// ── LAYOUT BASE ─────────────────────────────────────────────

function buildPage(p) {
  const heroButtons = p.heroButtons !== undefined ? p.heroButtons : '';

  // ── Schema.org JSON-LD ─────────────────────────────────────
  const jsonLd = p.jsonLd || {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    'name': p.title,
    'description': p.description,
    'url': `${SITE.url}/${p.file}`,
    'publisher': {
      '@type': 'Organization',
      'name': SITE.name,
      'url': SITE.url,
      'logo': { '@type': 'ImageObject', 'url': `${SITE.url}/images/Coqui.webp` }
    }
  };
  const jsonLdStr = JSON.stringify(jsonLd);

  const ga4Script = SITE.ga4Id === 'G-XXXXXXXXXX' ? `
  <!-- Google Analytics 4: reemplaza G-XXXXXXXXXX con tu Measurement ID real -->
  <!-- <script async src="https://www.googletagmanager.com/gtag/js?id=${SITE.ga4Id}"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${SITE.ga4Id}');</script> -->` : `
  <script async src="https://www.googletagmanager.com/gtag/js?id=${SITE.ga4Id}"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${SITE.ga4Id}');</script>`;

  return `<!DOCTYPE html>
<html lang="es" data-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${p.title}</title>
  <meta name="description" content="${p.description}">
  <meta name="author" content="Aliado Imperfekto">
  <link rel="canonical" href="${SITE.url}/${p.file}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${SITE.url}/${p.file}">
  <meta property="og:title" content="${p.title}">
  <meta property="og:description" content="${p.description}">
  <meta property="og:image" content="${SITE.ogImage}">
  <meta property="og:locale" content="es_PR">
  <meta property="og:site_name" content="${SITE.name}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${p.title}">
  <meta name="twitter:description" content="${p.description}">
  <meta name="twitter:image" content="${SITE.ogImage}">
  <link rel="manifest" href="manifest.json">
  <link rel="preconnect" href="https://www.googletagmanager.com">
  <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,400&family=Inter:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&display=swap" rel="stylesheet">
  <script>try{document.documentElement.dataset.theme=localStorage.getItem('sqpr-theme')==='dark'?'dark':'light'}catch(e){}</script>
  <link rel="alternate" type="application/rss+xml" title="${SITE.name} — Noticias" href="${SITE.url}/rss.xml">
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="images/icon-192.png">
  <link rel="stylesheet" href="styles.css?v=${ASSET_VERSION}">
  <script type="application/ld+json">${jsonLdStr}</script>${ga4Script}
</head>
<body>
  <a href="#main-content" class="skip-nav">Saltar al contenido principal</a>

    <header class="site-header" id="arriba">
      <div class="site-header-inner">
        <a class="brand" href="index.html" aria-label="Sabías que PR — Inicio">
          <img class="brand-mark" src="images/Coqui-sm.webp" alt="" width="32" height="32">
          <span class="brand-name">Sabías que PR</span>
        </a>
        <nav class="nav" aria-label="Principal">
          <button class="nav-toggle" aria-expanded="false" aria-controls="nav-menu" aria-label="Abrir menú">
            <span class="hamburger-bar"></span>
            <span class="hamburger-bar"></span>
            <span class="hamburger-bar"></span>
          </button>
          <ul id="nav-menu" role="list">
            <li><a href="noticias.html">Noticias</a></li>
            <li><a href="nuevos-humanos.html">Revolución Humana</a></li>
            <li><a href="educacion.html">Educación</a></li>
            <li><a href="foro.html">Foro</a></li>
            <li><a href="tienda.html">Tienda</a></li>
            <li><a href="contacto.html">Contacto</a></li>
            <li><a href="premium.html" class="nav-premium">Hazte premium</a></li>
          </ul>
        </nav>
        <div class="header-controls">
          <button class="theme-toggle" id="theme-toggle" aria-label="Cambiar a modo oscuro">
            <span class="theme-icon" aria-hidden="true">
              <svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
              <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
            </span>
            <span class="theme-label">Oscuro</span>
          </button>
          <button class="cart-btn" id="cart-btn" aria-label="Ver carrito" title="Ver carrito de compras">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 8h14l-1.2 11.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/></svg>
            <span class="cart-count" id="cart-count">0</span>
          </button>
          <button type="button" class="login-trigger-btn" id="login-trigger-btn" aria-haspopup="dialog" aria-expanded="false">
            <span id="login-trigger-label">Iniciar sesión</span>
          </button>
        </div>
      </div>
    </header>

    <div class="page">

    ${p.noHero ? (p.noHeading ? '' : `<h1 class="visually-hidden">${p.heroH2}</h1>`) : `<section class="hero${p.heroClass ? ' ' + p.heroClass : ''}">
      <div class="hero-content">
        ${p.heroEyebrow ? `<span class="hero-eyebrow">${p.heroEyebrow}</span>` : ''}
        <h1>${p.heroH2}</h1>
        ${p.heroP ? `<p>${p.heroP}</p>` : ''}
        <div class="hero-buttons">${heroButtons}</div>
      </div>
    </section>`}

    <main class="main${p.mainClass ? ' ' + p.mainClass : ''}" id="main-content" tabindex="-1">
      ${p.mainContent}
    </main>

    </div>

    ${FOOTER}

  ${LOGIN_MODAL}

  <!-- Carrito lateral -->
  <div class="cart-drawer" id="cart-drawer" aria-hidden="true">
    <div class="cart-drawer-header">
      <h2>Tu carrito</h2>
      <button class="cart-close" id="cart-close" aria-label="Cerrar carrito">✕</button>
    </div>
    <div class="cart-items" id="cart-items"></div>
    <div class="cart-footer">
      <p class="cart-total">Total: <strong id="cart-total">$0.00</strong></p>
      <button class="cart-checkout" id="cart-checkout">Ir al pago →</button>
      <p class="cart-note">Pagos seguros vía Stripe</p>
    </div>
  </div>
  <div class="cart-overlay" id="cart-overlay"></div>

  <script>
    // Configuración para auth.js y script.js
    window.SITE_CONFIG = {
      supabaseUrl: '${SITE.supabaseUrl}',
      supabaseKey: '${SITE.supabaseKey}',
      apiUrl:      '${SITE.apiUrl}',
      mcUser:      '${SITE.mcUser}',
      mcList:      '${SITE.mcList}',
      mcServer:    '${SITE.mcServer}',
      youtubeApiKey: '${SITE.youtubeApiKey}'
    };
  </script>
  <script src="auth.js" type="module"></script>
  <script src="script.js"></script>
  ${p.extraScript || ''}
  <script>if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});</script>
</body>
</html>`;
}

// ── PÁGINAS ─────────────────────────────────────────────────

const PAGES = [
  {
    file: 'index.html',
    title: 'Sabías que PR — Noticias, Educación e Información',
    description: 'Un proyecto para entender, cuestionar y mejorar la sociedad en la que vivimos. Noticias, educación e información desde Puerto Rico.',
    heroH2: 'Sabías que PR — Noticias, Educación e Información',
    noHero: true,
    mainClass: 'main-home',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      'name': 'Sabías que PR',
      'url': 'https://sabiasquepr.com',
      'logo': 'https://sabiasquepr.com/images/Coqui.webp',
      'sameAs': [
        'https://x.com/SabiasquePR',
        'https://www.instagram.com/SabiasquePR',
        'https://www.youtube.com/@sabiasquePR'
      ],
      'contactPoint': { '@type': 'ContactPoint', 'email': 'sabiasquepr@yahoo.com', 'contactType': 'customer service' }
    },
    mainContent: `
      <section class="featured" id="home-featured" aria-live="polite" aria-busy="true">
        <div class="card skeleton-card" aria-hidden="true">
          <div class="card-link">
            <div class="card-media skeleton"></div>
            <div class="card-body">
              <div class="skeleton skeleton-line short"></div>
              <div class="skeleton skeleton-line"></div>
              <div class="skeleton skeleton-line"></div>
            </div>
          </div>
        </div>
        <noscript><p class="empty-state">Activa JavaScript para ver las noticias más recientes.</p></noscript>
      </section>
      <p class="home-hint" id="home-hint" aria-live="polite"></p>

      <div class="section-head" id="home-latest-head">
        <h2>Lo más reciente</h2>
        <a href="noticias.html">Ver todas</a>
      </div>
      <div class="card-grid" id="home-latest">
        <div class="card skeleton-card" aria-hidden="true"><div class="card-media skeleton"></div><div class="skeleton skeleton-line short"></div><div class="skeleton skeleton-line"></div></div>
        <div class="card skeleton-card" aria-hidden="true"><div class="card-media skeleton"></div><div class="skeleton skeleton-line short"></div><div class="skeleton skeleton-line"></div></div>
        <div class="card skeleton-card" aria-hidden="true"><div class="card-media skeleton"></div><div class="skeleton skeleton-line short"></div><div class="skeleton skeleton-line"></div></div>
      </div>

      <div class="section-head">
        <h2>Explora</h2>
      </div>
      <div class="section-strip">
        <div class="strip-item">
          <h3><a href="noticias.html">Noticias</a></h3>
          <p>Noticias internacionales con contexto y análisis: descubrimientos, ciencia, política y sociedad.</p>
        </div>
        <div class="strip-item">
          <h3><a href="nuevos-humanos.html">Revolución Humana</a></h3>
          <p>Lo que la humanidad está logrando, descubriendo y sanando.</p>
        </div>
        <div class="strip-item">
          <h3><a href="educacion.html">Educación</a></h3>
          <p>Recursos, lecturas y proyectos para aprender, cuestionar y transformar nuestra realidad.</p>
        </div>
      </div>

      <section class="newsletter">
        <h3>Recibe nuevo contenido</h3>
        <p>Déjanos tu correo para avisarte cuando publiquemos nuevas noticias, guías y recursos.</p>
        <form class="newsletter-form">
          <label for="home-email" class="visually-hidden">Correo electrónico</label>
          <input id="home-email" type="email" placeholder="tucorreo@example.com" required autocomplete="email">
          <button type="submit">Suscribirme</button>
        </form>
        <p class="newsletter-status" aria-live="polite"></p>
      </section>

      <div class="section-head">
        <h2>Sobre el proyecto</h2>
        <a href="manifiesto.html">Leer el manifiesto</a>
      </div>
      <p class="home-about">Un proyecto para entender, cuestionar y mejorar la sociedad en la que vivimos.</p>`,
    extraScript: `<script src="editorial.js"></script>
  <script src="home.js"></script>`,
  },

  {
    file: 'manifiesto.html',
    title: 'Sabías que PR — Manifiesto',
    description: 'Conoce la visión, misión y datos del proyecto Sabías que PR: despertar conciencias en todo el mundo.',
    heroH2: 'Manifiesto',
    heroP: 'Un proyecto para entender, cuestionar y mejorar la sociedad en la que vivimos.',
    heroButtons: '',
    mainContent: `
      <section class="manifiesto-split manifiesto-split-flip">
        <figure class="manifiesto-media">
          <img src="images/manifiesto-vision.webp" alt="Amanecer visto desde un mirador en la costa de Puerto Rico, con el sol saliendo sobre el mar" width="1000" height="750" loading="lazy">
        </figure>
        <div class="manifiesto-text">
          <h2>Visión del proyecto</h2>
          <p>Sabías que PR es una iniciativa social dedicada al despertar de la conciencia humana. Nació en Puerto Rico, pero su misión no conoce fronteras: mediante herramientas creativas y accesibles, buscamos comprender el entorno actual para formar individuos comprometidos con un futuro mejor para toda la humanidad. Está dirigido a cualquier persona, en cualquier parte del mundo, dispuesta a fomentar su evolución integral —mental, física y espiritual— en un ambiente de inclusión libre de distinciones por raza, género, credo, ideología, nacionalidad o condición social.</p>
          <p>A través de la lógica, la ingeniería inversa y el pensamiento crítico, facilitamos los recursos para cuestionar el entorno y mejorar la toma de decisiones diaria. Nuestro objetivo final es que más seres humanos, sin importar dónde vivan, se reconozcan como agentes de cambio capaces de construir un planeta más justo, solidario y consciente.</p>
        </div>
      </section>
      <section class="manifiesto-split">
        <figure class="manifiesto-media">
          <img src="images/manifiesto-datos.webp" alt="Libreta en blanco sobre un escritorio de madera, junto a café, una lupa y un mapa" width="1000" height="750" loading="lazy">
        </figure>
        <div class="manifiesto-text">
          <h2>Datos del proyecto</h2>
          <p><strong>Nombre:</strong> Sabías que PR</p>
          <p><strong>Año de inicio:</strong> 2025</p>
          <p><strong>Origen:</strong> Proyecto independiente creado en Puerto Rico, inspirado en la necesidad de entender mejor la realidad social, política y económica del mundo — y con la ambición de servir a cualquier persona, en cualquier lugar.</p>
          <p><strong>Enfoques principales:</strong></p>
          <ul>
            <li>Noticias y reportajes con contexto histórico y social.</li>
            <li>Educación y recursos para el pensamiento crítico.</li>
            <li>Investigación, datos y análisis de largo plazo.</li>
            <li>Espacios para la participación y la reflexión comunitaria.</li>
          </ul>
          <p><strong>Público al que se dirige:</strong> cualquier persona, en cualquier país, interesada en comprender la realidad desde una perspectiva humana, crítica y solidaria — y dispuesta a ser parte del cambio.</p>
        </div>
      </section>`,
  },

  {
    file: 'noticias.html',
    title: 'Sabías que PR — Noticias',
    description: 'Noticias internacionales con contexto y análisis: descubrimientos, ciencia, política y sociedad.',
    heroH2: 'Noticias',
    heroP: '',
    heroButtons: `
      <div class="noticias-hero-categorias" id="noticias-filters">${CATEGORIA_FILTER_BUTTONS}</div>`,
    mainClass: 'main-block',
    mainContent: `
      <p class="home-hint" id="noticias-hint" aria-live="polite"></p>
      <div class="card-grid" id="noticias-list" aria-live="polite" aria-busy="true"></div>
      <noscript><p class="empty-state">Activa JavaScript para ver las noticias.</p></noscript>`,
    extraScript: `<script src="editorial.js"></script>
  <script src="noticias.js"></script>`,
  },

  {
    file: 'articulo.html',
    title: 'Sabías que PR — Artículo',
    description: 'Noticias internacionales con contexto y análisis: descubrimientos, ciencia, política y sociedad.',
    heroH2: 'Artículo',
    noHero: true,
    noHeading: true,
    mainClass: 'main-block',
    mainContent: `
      <div class="reading-progress" id="reading-progress" aria-hidden="true"></div>
      <article class="article" id="article" aria-live="polite" aria-busy="true">
        <div class="article-state" id="article-state">Cargando…</div>
        <noscript><div class="article-state">Activa JavaScript para leer este artículo.</div></noscript>
      </article>
      <section class="article-more" id="article-more" hidden>
        <div class="section-head">
          <h2>Sigue leyendo</h2>
          <a href="noticias.html">Ver todas</a>
        </div>
        <div class="card-grid" id="article-more-grid"></div>
      </section>`,
    extraScript: `<script src="editorial.js"></script>
  <script src="articulo.js"></script>`,
  },

  {
    file: 'recurso.html',
    title: 'Sabías que PR — Recurso',
    description: 'Videos, ensayos y lecturas curadas sobre lo que la humanidad está logrando, descubriendo y aprendiendo.',
    heroH2: 'Recurso',
    noHero: true,
    noHeading: true,
    mainClass: 'main-block',
    mainContent: `
      <article class="article" id="recurso" aria-live="polite" aria-busy="true">
        <div class="article-state" id="recurso-state">Cargando…</div>
        <noscript><div class="article-state">Activa JavaScript para ver este contenido.</div></noscript>
      </article>`,
    extraScript: `<script src="editorial.js"></script>
  <script src="citas.js"></script>
  <script src="recurso.js"></script>`,
  },

  {
    file: 'nuevos-humanos.html',
    title: 'Sabías que PR — Revolución Humana',
    description: 'Videos, ensayos y noticias sobre lo que la humanidad está logrando, descubriendo y sanando.',
    heroH2: 'Revolución Humana',
    heroP: 'Lo que la humanidad está logrando, descubriendo y sanando.',
    heroClass: 'hero-positivo',
    mainClass: 'main-block',
    mainContent: `
      <p class="home-hint" id="rh-hint" aria-live="polite"></p>
      <div class="card-grid contenidos-grid" id="rh-list" data-seccion="revolucion-humana" data-hint="rh-hint" aria-live="polite" aria-busy="true"></div>
      <noscript><p class="empty-state">Activa JavaScript para ver este contenido.</p></noscript>`,
    extraScript: `<script src="editorial.js"></script>
  <script src="contenidos.js"></script>`,
  },

  {
    file: 'educacion.html',
    title: 'Sabías que PR — Educación',
    description: 'Videos, ensayos y lecturas curadas para aprender, cuestionar y transformar nuestra realidad.',
    heroH2: 'Educación',
    heroP: 'Recursos, lecturas y proyectos para aprender, cuestionar y transformar nuestra realidad.',
    mainClass: 'main-block',
    mainContent: `
      <div class="foro-filters" id="edu-filters">${CATEGORIA_FILTER_BUTTONS}</div>
      <p class="home-hint" id="edu-hint" aria-live="polite"></p>
      <div class="card-grid contenidos-grid" id="edu-list" data-seccion="educacion" data-filters="edu-filters" data-hint="edu-hint" aria-live="polite" aria-busy="true"></div>
      <noscript><p class="empty-state">Activa JavaScript para ver este contenido.</p></noscript>
      <section class="newsletter">
        <h3>Recibe nuevo contenido educativo</h3>
        <p>Déjanos tu correo para avisarte cuando publiquemos nuevas guías, videos y recursos.</p>
        <form class="newsletter-form">
          <label for="edu-email" class="visually-hidden">Correo electrónico</label>
          <input id="edu-email" type="email" placeholder="tucorreo@example.com" required autocomplete="email">
          <button type="submit">Suscribirme</button>
        </form>
        <p class="newsletter-status" aria-live="polite"></p>
      </section>
      <section class="box box-blog contact-box">
        <h3>¿Tienes ideas o sugerencias?</h3>
        <p>Escríbenos: <a href="mailto:${SITE.email}">${SITE.email}</a></p>
      </section>`,
    extraScript: `<script src="editorial.js"></script>
  <script src="contenidos.js"></script>`,
  },

  {
    file: 'foro.html',
    title: 'Sabías que PR — Foro de la comunidad',
    description: 'Foro de la comunidad de Sabías que PR: comparte ideas, preguntas y descubrimientos sobre tecnología, crítica internacional, nuevos humanos y educación.',
    heroH2: 'Foro de la Comunidad',
    heroP: 'Comparte, pregunta y debate con otros lectores de Sabías que PR.',
    mainClass: 'main-stack',
    mainContent: `
      <section class="box box-blog foro-intro">
        <h3>Foro de la comunidad</h3>
        <p>Comparte ideas, preguntas y descubrimientos con la comunidad. Inicia sesión para publicar.</p>
      </section>

      <section class="box box-blog contact-box foro-new-post" id="foro-new-post" style="display:none;">
        <h3>Nueva publicación</h3>
        <form id="foro-post-form">
          <label for="foro-titulo">Título</label>
          <input type="text" id="foro-titulo" required maxlength="140">
          <label for="foro-categoria">Categoría</label>
          <select id="foro-categoria">
            <option value="general">General</option>
            <option value="tecnologia">Tecnología</option>
            <option value="internacionales">Internacionales</option>
            <option value="nuevos-humanos">Revolución Humana</option>
            <option value="educacion">Educación</option>
          </select>
          <label for="foro-cuerpo">Mensaje</label>
          <textarea id="foro-cuerpo" rows="4" required minlength="10"></textarea>
          <p id="foro-cuerpo-counter" class="foro-word-counter"></p>
          <button type="submit" id="foro-submit-btn">Publicar</button>
          <p id="foro-form-status" class="form-status" aria-live="polite"></p>
        </form>
      </section>
      <p id="foro-login-hint" class="foro-login-hint"><a href="#" class="login-modal-trigger">Inicia sesión</a> para publicar en el foro.</p>

      <section class="foro-filters" id="foro-filters">
        <button type="button" class="foro-filter-btn active" data-categoria="">Todos</button>
        <button type="button" class="foro-filter-btn" data-categoria="tecnologia">Tecnología</button>
        <button type="button" class="foro-filter-btn" data-categoria="internacionales">Internacionales</button>
        <button type="button" class="foro-filter-btn" data-categoria="nuevos-humanos">Revolución Humana</button>
        <button type="button" class="foro-filter-btn" data-categoria="educacion">Educación</button>
      </section>

      <div id="foro-post-list" class="foro-post-list"><p class="foro-loading">Cargando publicaciones...</p></div>
      <div id="foro-post-detail" class="foro-post-detail" style="display:none;"></div>`,
    extraScript: `<script src="foro.js"></script>`,
  },

  {
    file: 'premium.html',
    title: 'Sabías que PR — Premium',
    description: 'Hazte miembro premium de Sabías que PR y publica mensajes más largos en el foro de la comunidad.',
    heroH2: 'Sabías que PR Premium',
    heroP: 'Publica mensajes más largos en el foro y apoya el proyecto.',
    mainClass: 'main-stack',
    mainContent: `
      <section class="box box-blog foro-intro">
        <h3>Beneficios premium</h3>
        <ul>
          <li>Publica hasta <strong>500 palabras</strong> por mensaje en el foro (en vez de 100).</li>
          <li>Apoyas directamente el sostenimiento del proyecto.</li>
        </ul>
        <p id="premium-status" class="form-status" aria-live="polite"></p>
        <button type="button" id="premium-subscribe-btn" class="btn btn-premium">Suscribirme</button>
        <p class="foro-login-hint" id="premium-login-hint" style="display:none;"><a href="#" class="login-modal-trigger">Inicia sesión</a> para suscribirte.</p>
      </section>`,
    extraScript: `<script src="premium.js"></script>`,
  },

  {
    file: 'tienda.html',
    title: 'Sabías que PR — Tienda',
    description: 'Apoya el proyecto Sabías que PR con artículos únicos: camisetas, tazas, gorras y más.',
    heroH2: 'Tienda Sabías que PR',
    heroP: 'Artículos para apoyar el proyecto y llevar el mensaje a todas partes.',
    heroButtons: `
          <a href="#productos" class="btn btn-alt">Ver productos</a>
          <a href="manifiesto.html" class="btn btn-alt">Sobre el proyecto</a>`,
    mainClass: 'tienda-main',
    mainContent: `<div id="productos"><p class="foro-loading">Cargando productos...</p></div>`,
    extraScript: `<script src="productos.js"></script>`,
  },

  {
    file: 'admin.html',
    title: 'Sabías que PR — Panel de administración',
    description: 'Panel de administración de Sabías que PR: gestión de noticias y productos.',
    heroH2: 'Panel de administración',
    heroP: 'Gestiona las noticias y los productos de la tienda.',
    heroButtons: `<a href="index.html" class="btn btn-alt">← Volver al inicio</a>`,
    mainClass: 'admin-main',
    hideRefs: true,
    mainContent: `
      <section class="box box-blog admin-gate" id="admin-gate">
        <p class="foro-loading">Verificando acceso...</p>
      </section>

      <div id="admin-panel" style="display:none;">
        <nav class="foro-filters admin-tabs">
          <button type="button" class="foro-filter-btn active" data-tab="noticias">Noticias</button>
          <button type="button" class="foro-filter-btn" data-tab="contenidos">Contenidos</button>
          <button type="button" class="foro-filter-btn" data-tab="productos">Productos</button>
        </nav>

        <section class="admin-tab-panel" id="admin-panel-noticias">
          <div class="admin-toolbar">
            <input type="search" id="admin-noticias-search" placeholder="Buscar noticia por título...">
            <button type="button" id="admin-noticias-new" class="admin-btn-new">+ Nueva noticia</button>
          </div>
          <div id="admin-noticias-list" class="admin-list"></div>

          <section class="box box-blog contact-box admin-form" id="admin-noticias-form-box" style="display:none;">
            <h3 id="admin-noticias-form-title">Nueva noticia</h3>
            <form id="admin-noticias-form">
              <input type="hidden" id="an-id">
              <fieldset class="citation-group" id="an-autocompletar-group">
                <legend>Autocompletar con IA (opcional)</legend>
                <label for="an-autocompletar-url">URL del artículo original</label>
                <input type="url" id="an-autocompletar-url" placeholder="https://ejemplo.com/articulo">
                <button type="button" id="an-autocompletar-ia" class="admin-btn-cancel">Autocompletar con IA</button>
                <p class="admin-hint" id="an-autocompletar-status" aria-live="polite"></p>
              </fieldset>
              <label for="an-titulo">Título</label>
              <input type="text" id="an-titulo" required minlength="3" maxlength="160">
              <label for="an-categoria">Categoría</label>
              <select id="an-categoria">
                ${optionsHtml(CATEGORIAS)}
              </select>
              <label for="an-fecha">Fecha</label>
              <input type="date" id="an-fecha" required>
              <label for="an-imagen">Imagen (ruta o URL)</label>
              <input type="text" id="an-imagen" required placeholder="images/mi-imagen.webp">
              <div class="admin-image-actions">
                <button type="button" id="an-elegir-imagen" class="admin-btn-cancel">Elegir imagen de la galería</button>
              </div>
              <img id="an-imagen-preview" class="admin-image-preview" alt="" hidden>
              <label for="an-imagen-alt">Texto alternativo de la imagen</label>
              <input type="text" id="an-imagen-alt" required>
              <label for="an-imagen-caption">Pie de imagen (opcional)</label>
              <input type="text" id="an-imagen-caption">
              <label for="an-fuente-url">URL de la fuente</label>
              <input type="url" id="an-fuente-url" required>
              <label for="an-fuente-texto">Nombre de la fuente</label>
              <input type="text" id="an-fuente-texto" required>
              <label for="an-parrafos">Párrafos (uno por línea)</label>
              <textarea id="an-parrafos" rows="6" required></textarea>
              <label for="an-divulgacion-ia">Divulgación de uso de IA</label>
              <select id="an-divulgacion-ia">
                ${optionsHtml(DIVULGACION_IA)}
              </select>
              <p class="admin-hint">Transparencia editorial: indica si se usó inteligencia artificial para redactar o asistir esta noticia. Se muestra públicamente.</p>
              <label class="admin-checkbox"><input type="checkbox" id="an-publicado" checked> Publicado (desmárcalo para guardar como borrador, visible solo en el panel)</label>
              <label class="admin-checkbox"><input type="checkbox" id="an-destacado"> Artículo destacado en la portada (reemplaza al anterior)</label>
              <div class="admin-form-actions">
                <button type="submit">Guardar</button>
                <button type="button" class="admin-btn-cancel" id="an-cancel">Cancelar</button>
              </div>
              <p id="an-status" class="form-status" aria-live="polite"></p>
            </form>
          </section>
        </section>

        <section class="admin-tab-panel" id="admin-panel-contenidos" style="display:none;">
          <div class="admin-toolbar">
            <input type="search" id="admin-contenidos-search" placeholder="Buscar por título...">
            <button type="button" id="admin-contenidos-new" class="admin-btn-new">+ Nuevo contenido</button>
          </div>
          <div id="admin-contenidos-list" class="admin-list"></div>

          <section class="box box-blog contact-box admin-form" id="admin-contenidos-form-box" style="display:none;">
            <h3 id="admin-contenidos-form-title">Nuevo contenido</h3>
            <form id="admin-contenidos-form">
              <input type="hidden" id="ac-id">
              <label for="ac-seccion">Sección</label>
              <select id="ac-seccion">
                <option value="noticias">Noticias</option>
                <option value="revolucion-humana">Revolución Humana</option>
                <option value="educacion">Educación</option>
              </select>
              <label for="ac-subseccion">Sub-sección de Revolución Humana (opcional)</label>
              <select id="ac-subseccion">
                ${optionsHtml(SUBSECCIONES, { includeEmpty: 'Ninguna' })}
              </select>
              <label for="ac-tipo-formato">Tipo de formato</label>
              <select id="ac-tipo-formato">
                ${optionsHtml(TIPOS_FORMATO)}
              </select>
              <label for="ac-subformato">Subformato (opcional)</label>
              <select id="ac-subformato">
                ${optionsHtml(SUBFORMATOS, { includeEmpty: 'Ninguno' })}
              </select>
              <label for="ac-categoria">Categoría</label>
              <select id="ac-categoria">
                ${optionsHtml(CATEGORIAS)}
              </select>
              <label for="ac-titulo">Título</label>
              <input type="text" id="ac-titulo" required minlength="3" maxlength="160" spellcheck="true" lang="es">
              <label for="ac-subtitulo">Resumen (2-3 oraciones, redacción propia)</label>
              <textarea id="ac-subtitulo" rows="3" required minlength="10" spellcheck="true" lang="es"></textarea>
              <div class="spellcheck-actions"><button type="button" class="admin-btn-cancel" data-revisar="ac-subtitulo">Revisar texto</button></div>
              <ul class="suggestion-list" id="ac-subtitulo-suggestions"></ul>
              <label for="ac-cuerpo">Cuerpo del texto (opcional — solo ensayo/lectura corta con texto propio)</label>
              <textarea id="ac-cuerpo" rows="6" spellcheck="true" lang="es"></textarea>
              <div class="spellcheck-actions"><button type="button" class="admin-btn-cancel" data-revisar="ac-cuerpo">Revisar texto</button></div>
              <ul class="suggestion-list" id="ac-cuerpo-suggestions"></ul>
              <label for="ac-autor">Autor (opcional)</label>
              <input type="text" id="ac-autor">
              <label for="ac-divulgacion-ia">Divulgación de uso de IA</label>
              <select id="ac-divulgacion-ia">
                ${optionsHtml(DIVULGACION_IA)}
              </select>
              <p class="admin-hint">Transparencia editorial: indica si se usó inteligencia artificial para redactar o asistir este contenido. Se muestra públicamente en la tarjeta y el artículo.</p>
              <label for="ac-url-media">Video/audio embebible (obligatorio si el tipo es Video o Audio, ej. https://www.youtube.com/embed/ID)</label>
              <input type="url" id="ac-url-media" placeholder="Pega cualquier enlace de YouTube (watch, youtu.be, embed...)">
              <div class="admin-image-actions">
                <button type="button" id="ac-autocompletar-youtube" class="admin-btn-cancel">Autocompletar desde YouTube</button>
                <button type="button" id="ac-elegir-video-canal" class="admin-btn-cancel">Elegir de mi canal de YouTube</button>
              </div>
              <p class="admin-hint" id="ac-youtube-status"></p>
              <label for="ac-fuente-url">URL de la fuente (opcional)</label>
              <input type="url" id="ac-fuente-url">
              <label for="ac-fuente-texto">Nombre de la fuente (opcional)</label>
              <input type="text" id="ac-fuente-texto">
              <fieldset class="citation-group" id="ac-citation-group">
                <legend>Citación de la fuente</legend>
                <label class="admin-checkbox"><input type="checkbox" id="ac-cita-sin-fuente"> Sin fuente externa / contenido 100% original</label>
                <label for="ac-cita-estilo">Estilo de citación</label>
                <select id="ac-cita-estilo">
                  ${optionsHtml(CITA_ESTILOS, { includeEmpty: 'Seleccionar estilo...' })}
                </select>
                <label for="ac-cita-autor">Autor de la fuente</label>
                <input type="text" id="ac-cita-autor" spellcheck="true" lang="es">
                <label for="ac-cita-anio">Año</label>
                <input type="text" id="ac-cita-anio" placeholder="2026">
                <label for="ac-cita-titulo-original">Título del artículo original</label>
                <input type="text" id="ac-cita-titulo-original" spellcheck="true" lang="es">
                <label for="ac-cita-fecha-acceso">Fecha de acceso</label>
                <input type="date" id="ac-cita-fecha-acceso">
                <p class="citation-preview" id="ac-cita-preview" aria-live="polite"></p>
              </fieldset>
              <label for="ac-duracion">Duración (minutos de lectura, video o audio)</label>
              <input type="number" id="ac-duracion" required min="1" step="1" value="1" list="ac-duracion-presets">
              <datalist id="ac-duracion-presets">
                <option value="3"><option value="5"><option value="8"><option value="10">
                <option value="15"><option value="20"><option value="30"><option value="45"><option value="60">
              </datalist>
              <label for="ac-url-portada">Imagen de portada (ruta o URL)</label>
              <input type="text" id="ac-url-portada" required placeholder="images/mi-imagen.webp">
              <div class="admin-image-actions">
                <button type="button" id="ac-usar-imagen-categoria" class="admin-btn-cancel">Usar imagen de la categoría seleccionada</button>
                <button type="button" id="ac-elegir-imagen" class="admin-btn-cancel">Elegir imagen de la galería</button>
              </div>
              <img id="ac-url-portada-preview" class="admin-image-preview" alt="" hidden>
              <label for="ac-portada-alt">Texto alternativo de la imagen</label>
              <input type="text" id="ac-portada-alt" required>
              <label for="ac-fecha">Fecha de publicación</label>
              <input type="date" id="ac-fecha" required>
              <label class="admin-checkbox"><input type="checkbox" id="ac-destacado"> Destacado en su sección (reemplaza al anterior de esa sección)</label>
              <label class="admin-checkbox"><input type="checkbox" id="ac-premium"> Contenido premium (vista previa parcial para quien no sea premium/admin)</label>
              <div class="admin-form-actions">
                <button type="submit">Guardar</button>
                <button type="button" class="admin-btn-cancel" id="ac-cancel">Cancelar</button>
              </div>
              <p id="ac-status" class="form-status" aria-live="polite"></p>
            </form>
          </section>
        </section>

        <section class="admin-tab-panel" id="admin-panel-productos" style="display:none;">
          <div class="admin-toolbar">
            <input type="search" id="admin-productos-search" placeholder="Buscar producto por nombre...">
            <button type="button" id="admin-productos-new" class="admin-btn-new">+ Nuevo producto</button>
          </div>
          <div id="admin-productos-list" class="admin-list"></div>

          <section class="box box-blog contact-box admin-form" id="admin-productos-form-box" style="display:none;">
            <h3 id="admin-productos-form-title">Nuevo producto</h3>
            <form id="admin-productos-form">
              <input type="hidden" id="ap-id">
              <label for="ap-nombre">Nombre</label>
              <input type="text" id="ap-nombre" required minlength="3" maxlength="120">
              <label for="ap-descripcion">Descripción</label>
              <textarea id="ap-descripcion" rows="3" required></textarea>
              <label for="ap-precio">Precio (USD)</label>
              <input type="number" id="ap-precio" required min="0.01" step="0.01">
              <label for="ap-imagen">Imagen (ruta o URL)</label>
              <input type="text" id="ap-imagen" required placeholder="images/mi-producto.webp">
              <label for="ap-imagen-alt">Texto alternativo de la imagen</label>
              <input type="text" id="ap-imagen-alt" required>
              <label for="ap-stripe-price-id">Price ID de Stripe (para el checkout del carrito)</label>
              <input type="text" id="ap-stripe-price-id" placeholder="price_...">
              <p class="admin-hint">Créalo en Stripe → Product catalog → Add product (tipo "One time"), y pega aquí el Price ID (no el Product ID).</p>
              <label for="ap-stripe-link">Enlace de pago directo de Stripe (opcional, respaldo)</label>
              <input type="url" id="ap-stripe-link">
              <label class="admin-checkbox"><input type="checkbox" id="ap-disponible" checked> Disponible en la tienda</label>
              <div class="admin-form-actions">
                <button type="submit">Guardar</button>
                <button type="button" class="admin-btn-cancel" id="ap-cancel">Cancelar</button>
              </div>
              <p id="ap-status" class="form-status" aria-live="polite"></p>
            </form>
          </section>
        </section>
      </div>

      <div class="image-picker-modal" id="image-picker-modal" hidden>
        <div class="image-picker-box">
          <div class="admin-toolbar">
            <strong>Elegir imagen</strong>
            <button type="button" id="image-picker-close" class="admin-btn-cancel">Cerrar</button>
          </div>
          <div class="image-picker-grid" id="image-picker-grid"></div>
        </div>
      </div>

      <div class="image-picker-modal" id="youtube-picker-modal" hidden>
        <div class="image-picker-box">
          <div class="admin-toolbar">
            <strong>Elegir video de @sabiasquePR</strong>
            <button type="button" id="youtube-picker-close" class="admin-btn-cancel">Cerrar</button>
          </div>
          <div class="image-picker-grid" id="youtube-picker-grid"></div>
        </div>
      </div>`,
    extraScript: `<script src="editorial.js"></script>
  <script src="citas.js"></script>
  <script src="admin.js"></script>`,
  },

  {
    file: 'mi-cuenta.html',
    title: 'Sabías que PR — Mi cuenta',
    description: 'Administra tu perfil y revisa el estado de tu cuenta en Sabías que PR.',
    heroH2: 'Mi cuenta',
    noHero: true,
    noHeading: true,
    hideRefs: true,
    mainClass: 'main-block',
    mainContent: `
      <section class="box box-blog contact-box" id="cuenta-gate" style="max-width:460px;margin:0 auto;">
        <p class="foro-loading">Verificando acceso...</p>
      </section>

      <section class="box box-blog contact-box" id="cuenta-panel" style="max-width:460px;margin:0 auto;display:none;">
        <h3>Mi cuenta</h3>
        <p class="admin-hint">Correo</p>
        <p class="user-email" id="cuenta-email"></p>
        <p class="foro-badge" id="cuenta-estado"></p>

        <form id="cuenta-form">
          <label for="cuenta-nombre">Nombre</label>
          <input type="text" id="cuenta-nombre" maxlength="80" placeholder="Tu nombre" spellcheck="true" lang="es">
          <button type="submit">Guardar cambios</button>
        </form>
        <p id="cuenta-status" class="form-status" aria-live="polite"></p>

        <p class="admin-hint" style="margin-top:16px;">¿Necesitas cambiar tu contraseña?
          <a href="reset-password.html">Restablécela aquí</a>.
        </p>
        <p style="margin-top:4px;"><a href="admin.html" id="cuenta-link-admin" style="display:none;">Ir al panel de administración →</a></p>
        <p style="margin-top:14px;"><a href="index.html">← Volver al inicio</a></p>
      </section>

      <section class="box box-blog contact-box" id="cuenta-pedidos" style="max-width:460px;margin:24px auto 0;display:none;">
        <h3>Mis pedidos</h3>
        <div id="cuenta-pedidos-list"><p class="foro-loading">Cargando...</p></div>
      </section>`,
    extraScript: `<script src="mi-cuenta.js"></script>`,
  },

  {
    file: 'reset-password.html',
    title: 'Sabías que PR — Restablecer contraseña',
    description: 'Restablece la contraseña de tu cuenta de Sabías que PR.',
    heroH2: 'Restablecer contraseña',
    noHero: true,
    noHeading: true,
    hideRefs: true,
    mainClass: 'main-block',
    mainContent: `
      <section class="box box-blog contact-box" id="reset-box" style="max-width:420px;margin:0 auto;">
        <h3>Restablecer contraseña</h3>
        <p id="reset-intro">Verificando el enlace...</p>
        <form id="reset-form" style="display:none; flex-direction:column; gap:8px;">
          <label for="reset-pass">Nueva contraseña</label>
          <div class="pass-field">
            <input type="password" id="reset-pass" required minlength="6" autocomplete="new-password">
            ${PASS_TOGGLE_BTN('reset-pass')}
          </div>
          <label for="reset-pass2">Confirma la contraseña</label>
          <div class="pass-field">
            <input type="password" id="reset-pass2" required minlength="6" autocomplete="new-password">
            ${PASS_TOGGLE_BTN('reset-pass2')}
          </div>
          <button type="submit">Guardar nueva contraseña</button>
        </form>
        <p id="reset-status" class="form-status" aria-live="polite"></p>
        <p style="margin-top:14px;"><a href="index.html">← Volver al inicio</a></p>
      </section>`,
    extraScript: `<script src="reset-password.js"></script>`,
  },

  {
    file: 'contacto.html',
    title: 'Sabías que PR — Contacto',
    description: 'Contáctanos para ideas, colaboraciones o sugerencias. Puente directo con el equipo de Sabías que PR.',
    heroH2: 'Contacto',
    heroP: 'Puente directo para ideas, sugerencias y colaboraciones.',
    mainContent: `
      <section class="box box-blog contact-box">
        <h3>Cómo comunicarte</h3>
        <ul>
          <li><strong>Correo:</strong> <a href="mailto:${SITE.email}">${SITE.email}</a></li>
          <li><strong>Teléfono:</strong> ${SITE.phone}</li>
          <li><strong>Ubicación:</strong> ${SITE.location}</li>
        </ul>
        <p>Puedes escribirnos para enviar ideas, reportar errores, proponer colaboraciones o compartir investigaciones.</p>
        <h3>Envíanos un mensaje</h3>
        <form id="contact-form"
              action="https://formspree.io/f/${SITE.formspreeId}"
              method="POST" novalidate>
          <label for="nombre">Nombre</label>
          <input type="text" id="nombre" name="nombre" required autocomplete="name">
          <label for="email">Correo electrónico</label>
          <input type="email" id="email" name="email" required autocomplete="email">
          <label for="motivo">Motivo de contacto</label>
          <select id="motivo" name="motivo">
            <option value="general">Consulta general</option>
            <option value="colaboracion">Propuesta de colaboración</option>
            <option value="error">Reportar un error</option>
            <option value="contenido">Sugerencia de contenido</option>
            <option value="otro">Otro</option>
          </select>
          <label for="mensaje">Mensaje</label>
          <textarea id="mensaje" name="mensaje" rows="5" required></textarea>
          <button type="submit" id="submit-btn">Enviar mensaje</button>
          <p id="form-status" class="form-status" aria-live="polite"></p>
        </form>
      </section>`,
  },

  {
    file: 'details.html',
    title: 'Sabías que PR — Servicios',
    description: 'Conoce todos los servicios y formatos que ofrece Sabías que PR: noticias, educación, comunidad y más.',
    heroH2: 'Nuestros Servicios',
    heroP: 'Todo lo que Sabías que PR tiene para ti: información, formación y comunidad.',
    mainContent: `
      <section class="box box-blog">
        <h3>Noticias con Contexto</h3>
        <p>No publicamos solo titulares. Cada noticia viene acompañada de contexto histórico, análisis crítico y fuentes verificables.</p>
        <ul>
          <li>Noticias internacionales relevantes para la vida cotidiana.</li>
          <li>Descubrimientos científicos y tecnológicos.</li>
          <li>Temas de política, economía y sociedad con perspectiva puertorriqueña.</li>
        </ul>
      </section>
      <section class="box box-blog">
        <h3>Educación y Rutas de Aprendizaje</h3>
        <ul>
          <li>Guías descargables en PDF para estudiantes y educadores.</li>
          <li>Rutas de estudio en historia, derechos humanos y tecnología.</li>
          <li>Próximamente: podcasts y videos educativos.</li>
        </ul>
      </section>
      <section class="box box-blog">
        <h3>Tienda Oficial</h3>
        <p>Apoya el proyecto llevando el mensaje contigo. Cada compra contribuye al sostenimiento del proyecto.</p>
        <p class="box-link"><a class="link-arrow" href="tienda.html">Ver la tienda →</a></p>
      </section>
      <section class="box box-blog">
        <h3>Boletín Informativo</h3>
        <p>Resumen semanal de noticias, nuevos recursos educativos y novedades del proyecto.</p>
        <form class="newsletter-form">
          <label for="srv-email" class="visually-hidden">Correo electrónico</label>
          <input id="srv-email" type="email" placeholder="tucorreo@example.com" required autocomplete="email">
          <button type="submit">Suscribirme</button>
        </form>
        <p class="newsletter-status" aria-live="polite"></p>
      </section>
      <section class="box box-blog">
        <h3>Colaboraciones</h3>
        <ul>
          <li>Investigadores, periodistas y educadores independientes.</li>
          <li>Organizaciones comunitarias y grupos de base.</li>
          <li>Artistas y creadores comprometidos con el cambio social.</li>
        </ul>
        <p class="box-link"><a class="link-arrow" href="contacto.html">Escríbenos para colaborar →</a></p>
      </section>
      <section class="box box-blog">
        <h3>Comunidad (Próximamente)</h3>
        <ul>
          <li>Foros de discusión por temas.</li>
          <li>Comentarios en artículos.</li>
          <li>Proyectos colaborativos de investigación comunitaria.</li>
        </ul>
      </section>`,
  },

  {
    file: 'privacidad.html',
    title: 'Sabías que PR — Política de Privacidad',
    description: 'Política de privacidad de Sabías que PR: qué datos recopilamos, para qué los usamos y tus derechos como usuario.',
    heroH2: 'Política de Privacidad',
    heroP: 'Cómo recopilamos, usamos y protegemos tu información.',
    heroButtons: `<a href="index.html" class="btn btn-alt">← Volver al inicio</a>`,
    hideRefs: true,
    mainContent: `
      <section class="box box-blog contact-box">
        <p><em>Última actualización: ${new Date().toLocaleDateString('es-PR', { year: 'numeric', month: 'long', day: 'numeric' })}</em></p>

        <h3>1. Qué datos recopilamos</h3>
        <ul>
          <li><strong>Formulario de contacto:</strong> nombre, correo electrónico y mensaje, procesados por <a href="https://formspree.io" target="_blank" rel="noopener noreferrer">Formspree</a>.</li>
          <li><strong>Boletín / Newsletter:</strong> tu correo electrónico, gestionado por <a href="https://mailchimp.com" target="_blank" rel="noopener noreferrer">Mailchimp</a>.</li>
          <li><strong>Cuenta de usuario (login):</strong> correo y contraseña (cifrada), gestionados por <a href="https://supabase.com" target="_blank" rel="noopener noreferrer">Supabase</a>.</li>
          <li><strong>Analítica de navegación:</strong> páginas visitadas, dispositivo y ubicación aproximada, mediante <a href="https://analytics.google.com" target="_blank" rel="noopener noreferrer">Google Analytics 4</a>.</li>
          <li><strong>Compras en la tienda:</strong> los pagos son procesados directamente por <a href="https://stripe.com" target="_blank" rel="noopener noreferrer">Stripe</a>; nosotros no almacenamos datos de tarjetas.</li>
        </ul>

        <h3>2. Para qué usamos tus datos</h3>
        <ul>
          <li>Responder tus mensajes y solicitudes de colaboración.</li>
          <li>Enviarte el boletín informativo, solo si te suscribiste voluntariamente.</li>
          <li>Permitirte iniciar sesión y guardar tus preferencias.</li>
          <li>Entender cómo se usa el sitio para mejorarlo (analítica agregada, no identificable individualmente).</li>
          <li>Procesar compras en la tienda oficial.</li>
        </ul>

        <h3>3. Con quién compartimos datos</h3>
        <p>No vendemos tu información. Solo la compartimos con los proveedores de servicio mencionados arriba (Formspree, Mailchimp, Supabase, Google Analytics, Stripe), únicamente para cumplir la función por la que los usas.</p>

        <h3>4. Cookies</h3>
        <p>Usamos almacenamiento local del navegador (localStorage) para recordar tu preferencia de modo oscuro/claro, y cookies de Google Analytics para estadísticas de visitas.</p>

        <h3>5. Tus derechos</h3>
        <p>Puedes solicitar acceso, corrección o eliminación de tus datos personales, así como darte de baja del boletín en cualquier momento (enlace de baja incluido en cada correo). Escríbenos a <a href="mailto:${SITE.email}">${SITE.email}</a> para ejercer estos derechos.</p>

        <h3>6. Contacto</h3>
        <p>Si tienes preguntas sobre esta política, escríbenos a <a href="mailto:${SITE.email}">${SITE.email}</a>.</p>
      </section>`,
  },

  {
    file: 'terminos.html',
    title: 'Sabías que PR — Términos y Condiciones',
    description: 'Términos y condiciones de uso del sitio Sabías que PR.',
    heroH2: 'Términos y Condiciones',
    heroP: 'Reglas de uso del sitio y de la tienda oficial.',
    heroButtons: `<a href="index.html" class="btn btn-alt">← Volver al inicio</a>`,
    hideRefs: true,
    mainContent: `
      <section class="box box-blog contact-box">
        <p><em>Última actualización: ${new Date().toLocaleDateString('es-PR', { year: 'numeric', month: 'long', day: 'numeric' })}</em></p>

        <h3>1. Aceptación de los términos</h3>
        <p>Al usar este sitio aceptas estos términos. Si no estás de acuerdo, te pedimos no utilizar el sitio.</p>

        <h3>2. Uso del contenido</h3>
        <p>Los artículos, imágenes y análisis publicados son propiedad de Sabías que PR o de sus fuentes originales (NASA, Reuters y otras fuentes públicas citadas). Parte del código y las imágenes del sitio fueron generados con asistencia de Inteligencia Artificial. Puedes compartir enlaces a nuestro contenido, pero no reproducirlo comercialmente sin permiso escrito.</p>

        <h3>3. Cuentas de usuario</h3>
        <p>Eres responsable de mantener la confidencialidad de tu contraseña y de toda actividad realizada en tu cuenta.</p>

        <h3>4. Tienda y pagos</h3>
        <p>Los pagos se procesan a través de Stripe. Los precios están en dólares estadounidenses. Para reclamos, cambios o reembolsos, escríbenos a <a href="mailto:${SITE.email}">${SITE.email}</a>.</p>

        <h3>5. Conducta del usuario</h3>
        <p>No está permitido usar el sitio para difundir contenido difamatorio, ilegal o que infrinja derechos de terceros.</p>

        <h3>6. Limitación de responsabilidad</h3>
        <p>El contenido informativo se ofrece "tal cual", con fines educativos y de divulgación. Sabías que PR no garantiza la exactitud absoluta de análisis u opiniones y no se hace responsable por decisiones tomadas con base en el contenido del sitio.</p>

        <h3>7. Cambios a estos términos</h3>
        <p>Podemos actualizar estos términos ocasionalmente. La fecha de "última actualización" indica la versión vigente.</p>

        <h3>8. Ley aplicable</h3>
        <p>Estos términos se rigen por las leyes de Puerto Rico.</p>
      </section>`,
  },

  {
    file: '404.html',
    title: 'Sabías que PR — Página no encontrada',
    description: 'La página que buscas no existe. Explora el resto del sitio.',
    heroH2: '¡Oops! Página no encontrada',
    heroP: 'La URL que buscas no existe o fue movida.',
    heroButtons: `<a href="index.html" class="btn btn-alt">← Volver al inicio</a>`,
    mainContent: `
      <section class="box box-blog error-page">
        <h3>Error 404</h3>
        <img class="error-mark" src="images/Coqui-sm.webp" alt="" width="96" height="96">
        <p>No encontramos lo que buscabas. El coquí tampoco lo vio por aquí.</p>
        <p class="box-link">
          <a class="link-arrow" href="index.html">← Regresar al inicio</a>
          &nbsp;·&nbsp;
          <a class="link-arrow" href="contacto.html">Reportar enlace roto</a>
        </p>
      </section>`,
    hideRefs: true,
  },
];

// ── GENERACIÓN DE SITEMAP.XML ───────────────────────────────

function generateSitemap() {
  const today = new Date().toISOString().split('T')[0];
  // 404, admin y la plantilla de artículo (necesita ?id=) no van en el sitemap
  const urls = PAGES.filter(p => !['404.html', 'admin.html', 'articulo.html', 'recurso.html', 'reset-password.html'].includes(p.file)).map(p => `  <url>
    <loc>${SITE.url}/${p.file}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.file === 'index.html' ? 'daily' : 'weekly'}</changefreq>
    <priority>${p.file === 'index.html' ? '1.0' : '0.8'}</priority>
  </url>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

// ── RSS FEED ────────────────────────────────────────────────

function generateRSS() {
  const items = noticias.map(art => `  <item>
    <title><![CDATA[${art.titulo}]]></title>
    <link>${SITE.url}/articulo.html?id=${encodeURIComponent(art.id)}</link>
    <guid isPermaLink="false">${SITE.url}/articulo.html?id=${encodeURIComponent(art.id)}</guid>
    <pubDate>${new Date(art.fecha).toUTCString()}</pubDate>
    <description><![CDATA[${art.parrafos[0]}]]></description>
    <enclosure url="${SITE.url}/${art.imagen}" type="image/webp"/>
  </item>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${SITE.name}</title>
    <link>${SITE.url}</link>
    <description>Noticias, educación e información para quienes creen en un mundo mejor.</description>
    <language>es-pr</language>
    <atom:link href="${SITE.url}/rss.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>${SITE.url}/images/Coqui.webp</url>
      <title>${SITE.name}</title>
      <link>${SITE.url}</link>
    </image>
${items}
  </channel>
</rss>`;
}

// ── MANIFIESTO DE IMÁGENES ───────────────────────────────────
// Lista todo lo que hay en images/ (incluidas fotos que ya no se usan en
// ningún producto/categoría) para el selector visual del panel de admin
// (ac-elegir-imagen). Se regenera en cada build — cualquier imagen nueva
// que se agregue a la carpeta aparece sola la próxima vez que se corra
// `node build.js`. El picker solo puede elegir entre lo que ya está aquí;
// que esas imágenes sean originales o libres de derechos sigue siendo
// responsabilidad manual de quien las agrega a la carpeta.
const path = require('path');
function generateImagesManifest() {
  const exts = new Set(['.webp', '.png', '.jpg', '.jpeg', '.svg', '.gif']);
  const files = fs.readdirSync('images')
    .filter(f => exts.has(path.extname(f).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, 'es'))
    .map(f => `images/${f}`);
  return JSON.stringify(files, null, 2);
}

// ── ROBOTS.TXT ──────────────────────────────────────────────

const ROBOTS = `User-agent: *
Allow: /
Disallow: /_content/
Disallow: /node_modules/

Sitemap: ${SITE.url}/sitemap.xml
`;

// ── EJECUCIÓN ───────────────────────────────────────────────

console.log('\n🔨 Sabías que PR — Build v2 iniciado\n');

PAGES.forEach(page => {
  fs.writeFileSync(page.file, buildPage(page), 'utf8');
  console.log(`  ✓ ${page.file}`);
});

fs.writeFileSync('sitemap.xml', generateSitemap(), 'utf8');
console.log('  ✓ sitemap.xml');

fs.writeFileSync('robots.txt', ROBOTS, 'utf8');
console.log('  ✓ robots.txt');

fs.writeFileSync('rss.xml', generateRSS(), 'utf8');
console.log('  ✓ rss.xml');

fs.writeFileSync('images-manifest.json', generateImagesManifest(), 'utf8');
console.log('  ✓ images-manifest.json');

console.log(`\n✅ Build completo — ${PAGES.length} páginas generadas.`);
console.log('   Configurar en SITE: formspreeId · ga4Id · supabaseUrl · supabaseKey · mcUser · mcList\n');
