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
  phone:           '(787) 555-0199',    // TODO: reemplazar con el número real antes de publicar (555 es un prefijo ficticio)
  location:        'San Juan, Puerto Rico',
  ogImage:         'https://sabiasquepr.com/images/nuevoshumanos.webp',

  // ── Backend API (foro) ───────────────────────────────────
  // URL del servidor Express. En local: http://localhost:3000
  // Tras desplegar en Render, actualizar con la URL real.
  apiUrl:          'http://localhost:3000',

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

  // ── Stripe (tienda) ──────────────────────────────────────
  // 1. En Stripe dashboard: Products → Payment Links
  // 2. Crear un link por producto y pegarlo en _content/productos.json
};

// ── CONTENIDO DESDE CMS JSON ────────────────────────────────
const noticias  = JSON.parse(fs.readFileSync('_content/noticias.json',  'utf8'));
const productos = JSON.parse(fs.readFileSync('_content/productos.json', 'utf8'));

// ── HELPERS DE RENDERIZADO ──────────────────────────────────

function renderArticulo(art) {
  return `
      <div class="box box-blog ${art.clase}">
        <article>
          <h3>${art.titulo}</h3>
          <time datetime="${art.fecha}">${art.fechaDisplay}</time>
          <figure class="${art.clase}-figure">
            <a href="${art.fuenteUrl}" target="_blank" rel="noopener noreferrer">
              <img src="${art.imagen}" alt="${art.imagenAlt}" loading="lazy" width="600" height="340">
            </a>
            <figcaption>${art.imagenCaption}</figcaption>
          </figure>
          ${art.parrafos.map(p => `          <p>${p}</p>`).join('\n')}
          <p class="fuente-link">
            Fuente: <a href="${art.fuenteUrl}" target="_blank" rel="noopener noreferrer">${art.fuenteTexto}</a>
          </p>
        </article>
      </div>`;
}

function renderProducto(p) {
  const isReal = p.stripeLink && !p.stripeLink.startsWith('YOUR_');
  return `
      <section class="box product-card">
        <figure>
          <img src="${p.imagen}" alt="${p.imagenAlt}" loading="lazy" width="250" height="180">
        </figure>
        <h3>${p.nombre}</h3>
        <p>${p.descripcion}</p>
        <p class="price">$${p.precio.toFixed(2)}</p>
        <button type="button"
          data-product-id="${p.id}"
          data-product-name="${p.nombre.replace(/"/g, '&quot;')}"
          data-product-price="${p.precio}"
          data-stripe-link="${isReal ? p.stripeLink : ''}"
          onclick="addToCart(this)">
          Añadir al carrito
        </button>
      </section>`;
}

// ── COMPONENTES COMPARTIDOS ─────────────────────────────────

const SOCIAL_ICONS = `
        <div class="social-links">
          <a href="https://x.com/SabiasquePR" target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)">
            <img src="images/Xlogo.webp" alt="X" width="40" height="40" loading="lazy">
          </a>
          <a href="https://www.facebook.com/SabiasquePR" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
            <img src="images/Facebook.webp" alt="Facebook" width="40" height="40" loading="lazy">
          </a>
          <a href="https://www.instagram.com/SabiasquePR" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
            <img src="images/instagram.webp" alt="Instagram" width="40" height="40" loading="lazy">
          </a>
        </div>`;

const LOGIN_BOX = `
      <div class="login-box" id="login-box">
        <div id="auth-logged-out">
          <label for="login-email">Usuario o correo</label>
          <input type="email" id="login-email" placeholder="tucorreo@example.com" autocomplete="email">
          <label for="login-pass">Contraseña</label>
          <input type="password" id="login-pass" placeholder="••••••••" autocomplete="current-password">
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
          <button type="button" id="btn-logout">Cerrar sesión</button>
        </div>
      </div>`;

const REFERENCES_BOX = `
      <section class="references-box">
        <hr>
        <h3>Referencias y Créditos</h3>
        <ul>
          <li><strong>Concepto y contenido original:</strong> Aliado Imperfekto (Proyecto ideado y desarrollado 2023–2025).</li>
          <li><strong>Herramientas de apoyo:</strong> Código e imágenes generadas con asistencia de Inteligencia Artificial.</li>
          <li><strong>Fuentes externas:</strong> Datos consultados de NASA, Reuters y fuentes de dominio público.</li>
        </ul>
      </section>`;

const FOOTER = `
    <footer class="footer">
      <p>
        <strong>Contacto:</strong>
        <a href="mailto:${SITE.email}">${SITE.email}</a>
        · ${SITE.phone} · ${SITE.location}
      </p>
      <p>Universidad Interamericana de Puerto Rico, Recinto de Fajardo</p>
      <p>
        © ${new Date().getFullYear()} Sabias que PR. Todos los derechos reservados.
        <a href="privacidad.html">Política de privacidad</a> | <a href="terminos.html">Términos</a>
      </p>
      <p style="margin-top:10px;">
        <a href="#arriba" style="color:var(--brand);font-weight:bold;text-decoration:none;">↑ Volver arriba</a>
      </p>
    </footer>`;

// ── LAYOUT BASE ─────────────────────────────────────────────

function buildPage(p) {
  const heroButtons = p.heroButtons || `
          <a href="about.html" class="btn btn-alt">Conócenos</a>
          <a href="details.html" class="btn btn-alt">Servicios</a>`;

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
<html lang="es" data-theme="dark">
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
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Fraunces:opsz,wght@9..144,500;9..144,600&display=swap" rel="stylesheet">
  <link rel="alternate" type="application/rss+xml" title="${SITE.name} — Noticias" href="${SITE.url}/rss.xml">
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="images/Coqui.webp">
  <link rel="stylesheet" href="styles.css">
  <script type="application/ld+json">${jsonLdStr}</script>${ga4Script}
</head>
<body>
  <a href="#main-content" class="skip-nav">Saltar al contenido principal</a>
  <div class="page">

    <header class="header" id="arriba">
      <div class="brand">
        <img src="images/Coqui.webp" alt="Logo Sabias que PR" width="110" height="110" class="logo">
        <div class="brand-text">
          <h1>Sabias que PR</h1>
          <p class="tagline">Noticias · Educación · Información</p>
        </div>
      </div>
      <div class="header-controls">
        <button class="theme-toggle" id="theme-toggle" aria-label="Alternar modo oscuro">
          <span class="theme-icon">🌙</span>
          <span class="theme-label">Oscuro</span>
        </button>
        <button class="cart-btn" id="cart-btn" aria-label="Ver carrito" title="Ver carrito de compras">
          🛒 <span class="cart-count" id="cart-count">0</span>
        </button>
      </div>
    </header>

    <nav class="nav" aria-label="Principal">
      <button class="nav-toggle" aria-expanded="false" aria-controls="nav-menu" aria-label="Abrir menú">
        <span class="hamburger-bar"></span>
        <span class="hamburger-bar"></span>
        <span class="hamburger-bar"></span>
      </button>
      <ul id="nav-menu" role="list">
        <li><a href="index.html">Inicio</a></li>
        <li><a href="about.html">Sobre el proyecto</a></li>
        <li><a href="noticias.html">Noticias</a></li>
        <li><a href="critica-internacional.html">Crítica Internacional</a></li>
        <li><a href="nuevos-humanos.html">Nuevos Humanos</a></li>
        <li><a href="tecnologia.html">Tecnología</a></li>
        <li><a href="educacion.html">Educación</a></li>
        <li><a href="foro.html">Foro</a></li>
        <li><a href="tienda.html">Tienda</a></li>
        <li><a href="contacto.html">Contacto</a></li>
        <li><a href="#" class="nav-premium" onclick="window.showToast&amp;&amp;window.showToast('🔒 Suscripción premium — próximamente');return false;">Hazte premium</a></li>
      </ul>
    </nav>

    <section class="hero${p.heroClass ? ' ' + p.heroClass : ''}">
      <div class="hero-content">
        ${p.heroEyebrow ? `<span class="hero-eyebrow">${p.heroEyebrow}</span>` : ''}
        <h2>${p.heroH2}</h2>
        <p>${p.heroP}</p>
        <div class="hero-buttons">${heroButtons}</div>
      </div>
    </section>

    <aside class="sidebar-top">
      ${LOGIN_BOX}
      <div class="sidebar-top-content">${SOCIAL_ICONS}</div>
    </aside>

    <main class="main${p.mainClass ? ' ' + p.mainClass : ''}" id="main-content" tabindex="-1">
      ${p.mainContent}
      ${p.hideRefs ? '' : REFERENCES_BOX}
    </main>

    <aside class="sidebar-bottom">
      <a href="educacion.html" class="enlaces-btn">Enlaces</a>
      <img src="images/enlaces.webp"
           alt="Enlaces: Curiosidades, Historia, Derechos Humanos, Lógica Humana y Cero Pobreza"
           class="Enlaces-img" loading="lazy" width="300" height="400">
    </aside>

    ${FOOTER}

  </div>

  <!-- Carrito lateral -->
  <div class="cart-drawer" id="cart-drawer" aria-hidden="true">
    <div class="cart-drawer-header">
      <h2>🛒 Tu carrito</h2>
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
      mcServer:    '${SITE.mcServer}'
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
    title: 'Sabías que PR — Inicio',
    description: 'Sabías que PR: La nueva forma de despertar conciencias. Noticias, educación e información para Puerto Rico y el mundo.',
    heroH2: 'Nuevos Humanos',
    heroP: 'Conocimiento, ciencia, tecnología y cooperación para un futuro mejor.',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      'name': 'Sabías que PR',
      'url': 'https://sabiasquepr.com',
      'logo': 'https://sabiasquepr.com/images/Coqui.webp',
      'sameAs': [
        'https://x.com/SabiasquePR',
        'https://www.facebook.com/SabiasquePR',
        'https://www.instagram.com/SabiasquePR'
      ],
      'contactPoint': { '@type': 'ContactPoint', 'email': 'sabiasquepr@yahoo.com', 'contactType': 'customer service' }
    },
    mainContent: `
      <section class="box noticias"><a href="noticias.html"><h3>Noticias Internacionales</h3></a></section>
      <section class="box descubrimientos"><a href="nuevos-humanos.html"><h3>Descubrimientos</h3></a></section>
      <section class="box educacion"><a href="educacion.html"><h3>Educación</h3></a></section>
      <section class="box religion"><h3>Religión <span class="soon-badge">Próximamente</span></h3></section>`,
  },

  {
    file: 'about.html',
    title: 'Sabías que PR — Sobre el proyecto',
    description: 'Conoce la visión, misión y datos del proyecto Sabías que PR: despertar conciencias en Puerto Rico y el mundo.',
    heroH2: 'Sobre Sabías que PR',
    heroP: 'Un proyecto para entender, cuestionar y mejorar la sociedad en la que vivimos.',
    mainContent: `
      <section class="box box-blog vision-box">
        <h3>Visión del proyecto</h3>
        <p>Sabías que PR... es una iniciativa social dedicada al despertar de la conciencia humana. Mediante herramientas creativas y accesibles, buscamos comprender el entorno actual para formar individuos comprometidos con la construcción de una sociedad futura mejor.</p>
        <p>Este proyecto está dirigido a personas de Puerto Rico y del mundo dispuestas a expandir sus horizontes. Fomentamos la evolución integral —mental, física y espiritual— promoviendo un ambiente de inclusión libre de distinciones por raza, género, credo, ideología o condición social.</p>
        <p>A través de la lógica, la ingeniería inversa y el pensamiento crítico, facilitamos los recursos necesarios para cuestionar el entorno y mejorar la toma de decisiones diaria. Nuestro objetivo final es que más seres humanos se reconozcan como agentes de cambio capaces de construir un Borikén y un planeta más justos, solidarios y conscientes.</p>
      </section>
      <section class="box box-blog datos-box">
        <h3>Datos del proyecto</h3>
        <p><strong>Nombre:</strong> Sabías que PR</p>
        <p><strong>Año de inicio:</strong> 2025</p>
        <p><strong>Origen:</strong> Proyecto independiente creado en Puerto Rico, inspirado en la necesidad de entender mejor la realidad social, política y económica de la isla y del mundo.</p>
        <p><strong>Enfoques principales:</strong></p>
        <ul>
          <li>Noticias y reportajes con contexto histórico y social.</li>
          <li>Educación y recursos para el pensamiento crítico.</li>
          <li>Investigación, datos y análisis de largo plazo.</li>
          <li>Espacios para la participación y la reflexión comunitaria.</li>
        </ul>
        <p><strong>Público al que se dirige:</strong> personas de Puerto Rico, la diáspora y cualquier lector interesado en comprender la realidad desde una perspectiva humana, crítica y solidaria.</p>
      </section>`,
  },

  {
    file: 'noticias.html',
    title: 'Sabías que PR — Noticias',
    description: 'Noticias internacionales con contexto y análisis: descubrimientos, ciencia, política y sociedad.',
    heroH2: 'Noticias',
    heroP: 'Una selección de historias que nos ayudan a entender el mundo de hoy.',
    mainContent:
      noticias.map(renderArticulo).join('\n') + `
      <section class="box box-blog">
        <h3>Noticias destacadas</h3>
        <ul>
          <li>"Descubren nueva especie marina en el Pacífico Sur."</li>
          <li>"Inteligencia Artificial y en qué mercados está adentrándose."</li>
          <li>"Nuevas estructuras detectadas debajo de las pirámides en Egipto."</li>
        </ul>
      </section>`,
  },

  {
    file: 'critica-internacional.html',
    title: 'Sabías que PR — Crítica Internacional',
    description: 'Análisis crítico de instituciones, gobiernos y poder en Puerto Rico, Estados Unidos y el mundo.',
    heroEyebrow: 'Crítica social · PR / EE.UU.',
    heroH2: 'Crítica Internacional',
    heroP: 'Cuestionamos el poder, sin importar de qué país venga.',
    heroClass: 'hero-critica',
    mainContent: `
      <section class="box box-blog box-critica">
        <h3>Corrupción y abuso de poder</h3>
        <p>Contratos, licitaciones amañadas y el manejo del dinero público en gobiernos de PR, EE.UU. y otras naciones.</p>
      </section>
      <section class="box box-blog box-critica">
        <h3>Derechos humanos y represión</h3>
        <p>Casos de abuso estatal, censura policial y violaciones documentadas alrededor del mundo.</p>
      </section>
      <section class="box box-blog box-critica">
        <h3>Desigualdad económica y explotación laboral</h3>
        <p>Cómo las políticas económicas afectan al trabajador promedio frente a las grandes corporaciones.</p>
      </section>
      <section class="box box-blog box-critica">
        <h3>Censura y control de la información</h3>
        <p>Medios, algoritmos y gobiernos que deciden qué narrativa llega al público.</p>
      </section>
      <section class="box box-blog box-critica">
        <h3>Medio ambiente y extractivismo corporativo</h3>
        <p>Explotación de recursos naturales y su impacto real en comunidades vulnerables.</p>
      </section>`,
  },

  {
    file: 'nuevos-humanos.html',
    title: 'Sabías que PR — Nuevos Humanos',
    description: 'Descubrimientos, avances científicos y noticias positivas para la humanidad.',
    heroH2: 'Nuevos Humanos',
    heroP: 'Lo que la humanidad está logrando, descubriendo y sanando.',
    heroClass: 'hero-positivo',
    mainContent: `
      <section class="box box-blog box-positivo">
        <h3>Ciencia y salud</h3>
        <p>Curas, tratamientos y avances médicos que están cambiando vidas.</p>
      </section>
      <section class="box box-blog box-positivo">
        <h3>Tecnología al servicio de la gente</h3>
        <p>Energía limpia, accesibilidad e innovación que no busca controlar, sino ayudar.</p>
      </section>
      <section class="box box-blog box-positivo">
        <h3>Justicia social en acción</h3>
        <p>Movimientos comunitarios que lograron cambios reales y medibles.</p>
      </section>
      <section class="box box-blog box-positivo">
        <h3>Educación e innovación comunitaria</h3>
        <p>Proyectos educativos que están cerrando brechas de oportunidad.</p>
      </section>
      <section class="box box-blog box-positivo">
        <h3>Espacio y exploración</h3>
        <p>Descubrimientos astronómicos y avances en la exploración del cosmos.</p>
      </section>
      <section class="box box-blog box-positivo">
        <h3>Conservación y medio ambiente</h3>
        <p>Esfuerzos de restauración ecológica y protección de especies alrededor del mundo.</p>
      </section>`,
  },

  {
    file: 'tecnologia.html',
    title: 'Sabías que PR — Tecnología',
    description: 'Inteligencia Artificial, robótica, blockchain y los últimos avances tecnológicos con contexto y análisis.',
    heroH2: 'Tecnología',
    heroP: 'Inteligencias Artificiales, autonomía robótica y mucho más.',
    mainContent: `
      <section class="box box-blog">
        <h3>Trayectorias de Exploración Tecnológica</h3>
        <p>Rutas de estudio sobre temas clave:</p>
        <ul>
          <li>Fundamentos de la Inteligencia Artificial (IA) y su impacto ético.</li>
          <li>Ciberseguridad para la vida diaria y la protección de datos personales.</li>
          <li>Programación y Lógica Computacional.</li>
          <li>Análisis de Datos, Hardware y Redes.</li>
          <li>Desarrollo Web Full-Stack (React/Vue y Node.js/Django).</li>
          <li>Computación en la Nube: AWS, Azure y Google Cloud.</li>
        </ul>
      </section>
      <section class="box box-blog">
        <h3>Tendencias y Avances Recientes</h3>
        <ul>
          <li><strong>LLMs:</strong> Avances en arquitecturas multimodales e IA generativa aplicada a imágenes, video y código.</li>
          <li><strong>Interfaces Cerebro-Máquina (BCI):</strong> Neurotecnología no invasiva para comunicación y rehabilitación.</li>
          <li><strong>Web3 y Blockchain:</strong> DeFi, smart contracts y estándares de identidad digital soberana.</li>
        </ul>
      </section>
      <section class="newsletter">
        <h3>Recibe nuevo contenido tecnológico</h3>
        <p>Déjanos tu correo para avisarte cuando publiquemos nuevos artículos y análisis.</p>
        <form class="newsletter-form">
          <label for="tec-email" class="visually-hidden">Correo electrónico</label>
          <input id="tec-email" type="email" placeholder="tucorreo@example.com" required autocomplete="email">
          <button type="submit">Suscribirme</button>
        </form>
        <p class="newsletter-status" aria-live="polite"></p>
      </section>
      <section class="box box-blog contact-box">
        <h3>¿Tienes ideas o sugerencias?</h3>
        <p>Escríbenos: <a href="mailto:${SITE.email}">${SITE.email}</a></p>
      </section>`,
  },

  {
    file: 'educacion.html',
    title: 'Sabías que PR — Educación',
    description: 'Recursos educativos, rutas de aprendizaje y pensamiento crítico para personas de Puerto Rico y el mundo.',
    heroH2: 'Educación',
    heroP: 'Recursos, lecturas y proyectos para aprender, cuestionar y transformar nuestra realidad.',
    mainContent: `
      <section class="box box-blog">
        <h3>Rutas de aprendizaje</h3>
        <ul>
          <li>Historia de Borikén y el Caribe.</li>
          <li>Derechos humanos y justicia social.</li>
          <li>Educación financiera básica.</li>
          <li>Alfabetización mediática y pensamiento crítico.</li>
        </ul>
      </section>
      <section class="box box-blog">
        <h3>Material descargable (próximamente)</h3>
        <ul>
          <li>Guías en PDF para estudiantes y docentes.</li>
          <li>Infografías sobre datos importantes de Puerto Rico.</li>
          <li>Plantillas para proyectos escolares y comunitarios.</li>
        </ul>
      </section>
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
  },

  {
    file: 'foro.html',
    title: 'Sabías que PR — Foro de la comunidad',
    description: 'Foro de la comunidad de Sabías que PR: comparte ideas, preguntas y descubrimientos sobre tecnología, crítica internacional, nuevos humanos y educación.',
    heroH2: 'Foro de la Comunidad',
    heroP: 'Comparte, pregunta y debate con otros lectores de Sabías que PR.',
    mainContent: `
      <section class="box box-blog foro-intro">
        <h3>💬 Foro de la comunidad</h3>
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
            <option value="critica-internacional">Crítica Internacional</option>
            <option value="nuevos-humanos">Nuevos Humanos</option>
            <option value="educacion">Educación</option>
          </select>
          <label for="foro-cuerpo">Mensaje</label>
          <textarea id="foro-cuerpo" rows="4" required minlength="10"></textarea>
          <button type="submit" id="foro-submit-btn">Publicar</button>
          <p id="foro-form-status" class="form-status" aria-live="polite"></p>
        </form>
      </section>
      <p id="foro-login-hint" class="foro-login-hint">🔒 <a href="#login-box">Inicia sesión</a> para publicar en el foro.</p>

      <section class="foro-filters" id="foro-filters">
        <button type="button" class="foro-filter-btn active" data-categoria="">Todos</button>
        <button type="button" class="foro-filter-btn" data-categoria="tecnologia">Tecnología</button>
        <button type="button" class="foro-filter-btn" data-categoria="critica-internacional">Crítica Internacional</button>
        <button type="button" class="foro-filter-btn" data-categoria="nuevos-humanos">Nuevos Humanos</button>
        <button type="button" class="foro-filter-btn" data-categoria="educacion">Educación</button>
      </section>

      <div id="foro-post-list" class="foro-post-list"><p class="foro-loading">Cargando publicaciones...</p></div>
      <div id="foro-post-detail" class="foro-post-detail" style="display:none;"></div>`,
    extraScript: `<script src="foro.js"></script>`,
  },

  {
    file: 'tienda.html',
    title: 'Sabías que PR — Tienda',
    description: 'Apoya el proyecto Sabías que PR con artículos únicos: camisetas, tazas, gorras y más.',
    heroH2: 'Tienda Sabías que PR',
    heroP: 'Artículos para apoyar el proyecto y llevar el mensaje a todas partes.',
    heroButtons: `
          <a href="#productos" class="btn btn-alt">Ver productos</a>
          <a href="about.html" class="btn btn-alt">Sobre el proyecto</a>`,
    mainClass: 'tienda-main',
    mainContent: productos.map(renderProducto).join('\n'),
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
        <h3>📰 Noticias con Contexto</h3>
        <p>No publicamos solo titulares. Cada noticia viene acompañada de contexto histórico, análisis crítico y fuentes verificables.</p>
        <ul>
          <li>Noticias internacionales relevantes para la vida cotidiana.</li>
          <li>Descubrimientos científicos y tecnológicos.</li>
          <li>Temas de política, economía y sociedad con perspectiva puertorriqueña.</li>
        </ul>
      </section>
      <section class="box box-blog">
        <h3>🎓 Educación y Rutas de Aprendizaje</h3>
        <ul>
          <li>Guías descargables en PDF para estudiantes y educadores.</li>
          <li>Rutas de estudio en historia, derechos humanos y tecnología.</li>
          <li>Próximamente: podcasts y videos educativos.</li>
        </ul>
      </section>
      <section class="box box-blog">
        <h3>🛒 Tienda Oficial</h3>
        <p>Apoya el proyecto llevando el mensaje contigo. Cada compra contribuye al sostenimiento del proyecto.</p>
        <p style="margin-top:10px;"><a href="tienda.html" style="color:var(--brand);font-weight:700;">→ Ver la tienda</a></p>
      </section>
      <section class="box box-blog">
        <h3>📬 Boletín Informativo</h3>
        <p>Resumen semanal de noticias, nuevos recursos educativos y novedades del proyecto.</p>
        <form class="newsletter-form" style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;">
          <label for="srv-email" class="visually-hidden">Correo electrónico</label>
          <input id="srv-email" type="email" placeholder="tucorreo@example.com" required autocomplete="email" style="padding:6px 10px;border-radius:4px;border:1px solid #d1d5db;flex:1;min-width:180px;">
          <button type="submit" style="padding:6px 14px;border-radius:999px;border:none;background:linear-gradient(90deg,var(--brand),var(--accent));color:#fff;font-weight:600;cursor:pointer;">Suscribirme</button>
        </form>
        <p class="newsletter-status" aria-live="polite"></p>
      </section>
      <section class="box box-blog">
        <h3>🤝 Colaboraciones</h3>
        <ul>
          <li>Investigadores, periodistas y educadores independientes.</li>
          <li>Organizaciones comunitarias y grupos de base.</li>
          <li>Artistas y creadores comprometidos con el cambio social.</li>
        </ul>
        <p style="margin-top:10px;"><a href="contacto.html" style="color:var(--brand);font-weight:700;">→ Escríbenos para colaborar</a></p>
      </section>
      <section class="box box-blog">
        <h3>🌐 Comunidad (Próximamente)</h3>
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
      <section class="box box-blog contact-box" style="text-align:center;">
        <h3>Error 404</h3>
        <p style="font-size:4rem;margin:16px 0;">🐸</p>
        <p>No encontramos lo que buscabas. El coquí tampoco lo vio por aquí.</p>
        <p style="margin-top:16px;">
          <a href="index.html" style="color:var(--brand);font-weight:700;">← Regresar al inicio</a>
          &nbsp;·&nbsp;
          <a href="contacto.html" style="color:var(--brand);font-weight:700;">Reportar enlace roto</a>
        </p>
      </section>`,
    hideRefs: true,
  },
];

// ── GENERACIÓN DE SITEMAP.XML ───────────────────────────────

function generateSitemap() {
  const today = new Date().toISOString().split('T')[0];
  const urls = PAGES.filter(p => p.file !== '404.html').map(p => `  <url>
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
    <link>${SITE.url}/noticias.html#${art.id}</link>
    <guid isPermaLink="false">${SITE.url}/noticias.html#${art.id}</guid>
    <pubDate>${new Date(art.fecha).toUTCString()}</pubDate>
    <description><![CDATA[${art.parrafos[0]}]]></description>
    <enclosure url="${SITE.url}/${art.imagen}" type="image/webp"/>
  </item>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${SITE.name}</title>
    <link>${SITE.url}</link>
    <description>Noticias, educación e información para Puerto Rico y el mundo.</description>
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

console.log(`\n✅ Build completo — ${PAGES.length} páginas generadas.`);
console.log('   Configurar en SITE: formspreeId · ga4Id · supabaseUrl · supabaseKey · mcUser · mcList\n');
