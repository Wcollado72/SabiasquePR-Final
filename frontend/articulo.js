// ============================================================
// articulo.js — Sabías que PR · Página de lectura de un artículo
// ============================================================
// Lee ?id=... de la URL, pide GET /api/noticias/:id y pinta el artículo.
// También actualiza título, metadatos y JSON-LD, y muestra "Sigue leyendo".
// Requiere editorial.js (window.SQPR).
// ============================================================

(function () {
  const cfg = window.SITE_CONFIG || {};
  const API_URL = cfg.apiUrl || 'http://localhost:3000';
  const SITE_NAME = 'Sabías que PR';
  const MORE_MAX = 3;
  const SLOW_MS = 6000; // el plan gratuito de Render puede tardar en despertar

  const S = window.SQPR;

  document.addEventListener('DOMContentLoaded', load);

  async function load() {
    const root = document.getElementById('article');
    if (!root) return;
    const id = new URLSearchParams(location.search).get('id');
    if (!id) return showError(root, 'No encontramos este artículo.');

    const slowTimer = setTimeout(() => {
      const st = document.getElementById('article-state');
      if (st) st.textContent = 'Cargando… el servidor puede tardar unos segundos en despertar.';
    }, SLOW_MS);

    try {
      const res = await fetch(S.withLang(API_URL + '/api/noticias/' + encodeURIComponent(id)));
      const data = await res.json().catch(() => ({}));
      if (res.status === 404) return showError(root, 'No encontramos este artículo.');
      if (!res.ok) throw new Error(data.error || 'Error ' + res.status);
      render(root, data.noticia);
      loadMore(data.noticia);
    } catch (err) {
      showError(root, 'No se pudo cargar el artículo: ' + err.message);
    } finally {
      clearTimeout(slowTimer);
      root.setAttribute('aria-busy', 'false');
    }
  }

  function showError(root, msg) {
    root.innerHTML = '<div class="article-state">' + S.escapeHtml(msg)
      + '<br><br><a class="btn" href="noticias.html">Ver todas las noticias</a></div>';
  }

  function render(root, art) {
    const paragraphs = (art.parrafos || []).map((p) => '<p>' + S.sanitizeHtml(p) + '</p>').join('');
    const sourceUrl = S.safeUrl(art.fuente_url);
    const source = art.fuente_texto
      ? '<p class="article-source">Fuente: '
        + (sourceUrl ? '<a href="' + S.escapeHtml(sourceUrl) + '" target="_blank" rel="noopener noreferrer">' + S.escapeHtml(art.fuente_texto) + '</a>' : S.escapeHtml(art.fuente_texto))
        + '</p>'
      : '';
    const avisoIdioma = art.sin_traduccion
      ? '<p class="idioma-aviso">Este artículo todavía no está traducido al inglés — se muestra en español.</p>'
      : '';
    const img = art.imagen
      ? '<img src="' + S.escapeHtml(art.imagen) + '" alt="' + S.escapeHtml(art.imagen_alt || '') + '" width="1200" height="675" fetchpriority="high">'
      : '';
    const figure = art.imagen
      ? '<figure class="article-figure">'
        + (sourceUrl ? '<a href="' + S.escapeHtml(sourceUrl) + '" target="_blank" rel="noopener noreferrer">' + img + '</a>' : img)
        + (art.imagen_caption ? '<figcaption>' + S.escapeHtml(art.imagen_caption) + '</figcaption>' : '') + '</figure>'
      : '';

    root.innerHTML =
      '<header class="article-head">'
      + '<a class="eyebrow" href="noticias.html?categoria=' + encodeURIComponent(art.categoria || '') + '">' + S.escapeHtml(S.categoriaLabel(art)) + '</a>'
      + '<h1 class="article-title">' + S.escapeHtml(art.titulo) + '</h1>'
      + '<p class="article-meta"><time datetime="' + S.escapeHtml(String(art.fecha).slice(0, 10)) + '">' + S.escapeHtml(art.fecha_display || '') + '</time> · ' + S.readingMinutes(art) + ' min de lectura</p>'
      + (S.iaBadgesHtml(art) ? '<p class="article-ia">' + S.iaBadgesHtml(art) + '</p>' : '')
      + '</header>'
      + avisoIdioma
      + figure
      + '<div class="article-body">' + paragraphs + '</div>'
      + source
      + S.otrasFuentesHtml(art.fuentes);

    root.insertAdjacentHTML('afterend', '<div id="articulo-comentarios"></div>');

    updateMeta(art);
    trackProgress(root);
    document.title = art.titulo + ' — ' + SITE_NAME;
    window.SQPR.initComentarios?.({ tipo: 'noticia', itemId: art.id, containerId: 'articulo-comentarios' });
  }

  // ── Metadatos (SEO / redes) ─────────────────────────────────
  function setMeta(selector, attr, value) {
    let el = document.head.querySelector(selector);
    if (!el) {
      el = document.createElement(selector.startsWith('link') ? 'link' : 'meta');
      const m = selector.match(/\[(.+?)="(.+?)"\]/);
      if (m) el.setAttribute(m[1], m[2]);
      document.head.appendChild(el);
    }
    el.setAttribute(attr, value);
  }

  function updateMeta(art) {
    const url = location.origin + location.pathname + '?id=' + encodeURIComponent(art.id);
    const description = S.dek(art, 200);
    const image = art.imagen ? new URL(art.imagen, location.href).href : '';
    setMeta('meta[name="description"]', 'content', description);
    setMeta('link[rel="canonical"]', 'href', url);
    setMeta('meta[property="og:type"]', 'content', 'article');
    setMeta('meta[property="og:title"]', 'content', art.titulo);
    setMeta('meta[property="og:description"]', 'content', description);
    setMeta('meta[property="og:url"]', 'content', url);
    setMeta('meta[name="twitter:title"]', 'content', art.titulo);
    setMeta('meta[name="twitter:description"]', 'content', description);
    if (image) {
      setMeta('meta[property="og:image"]', 'content', image);
      setMeta('meta[name="twitter:image"]', 'content', image);
    }

    const ld = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: art.titulo,
      description: description,
      datePublished: String(art.fecha).slice(0, 10),
      inLanguage: art.idioma_mostrado || 'es',
      mainEntityOfPage: url,
      publisher: { '@type': 'Organization', name: SITE_NAME },
    };
    if (image) ld.image = image;
    const old = document.getElementById('article-jsonld');
    if (old) old.remove();
    const tag = document.createElement('script');
    tag.type = 'application/ld+json';
    tag.id = 'article-jsonld';
    tag.textContent = JSON.stringify(ld);
    document.head.appendChild(tag);
  }

  // ── Barra de progreso de lectura ────────────────────────────
  function trackProgress(article) {
    const bar = document.getElementById('reading-progress');
    if (!bar) return;
    let ticking = false;
    function update() {
      const rect = article.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const done = Math.min(Math.max(-rect.top, 0), Math.max(total, 1));
      bar.style.width = (total > 0 ? (done / total) * 100 : 100) + '%';
      ticking = false;
    }
    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  // ── Sigue leyendo ───────────────────────────────────────────
  async function loadMore(current) {
    const section = document.getElementById('article-more');
    const grid = document.getElementById('article-more-grid');
    if (!section || !grid) return;
    try {
      const res = await fetch(S.withLang(API_URL + '/api/noticias'));
      const data = await res.json();
      if (!res.ok) return;
      const others = (data.noticias || []).filter((n) => n.id !== current.id);
      const sameCat = others.filter((n) => n.categoria === current.categoria);
      const picks = sameCat.concat(others.filter((n) => n.categoria !== current.categoria)).slice(0, MORE_MAX);
      if (!picks.length) return;
      grid.innerHTML = picks.map((n) => S.cardHtml(n)).join('');
      section.hidden = false;
    } catch (err) {
      /* "Sigue leyendo" es opcional: si falla, no se muestra */
    }
  }
})();
