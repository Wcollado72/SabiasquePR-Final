// ============================================================
// recurso.js — Sabías que PR · Detalle de un contenido (video/ensayo/noticia/lectura corta)
// ============================================================
// Lee ?id=... de la URL, pide GET /api/contenidos/:id y lo pinta.
// Si es video, embebe el reproductor arriba del texto en vez de una imagen.
// Requiere editorial.js (window.SQPR).
// ============================================================

(function () {
  const cfg = window.SITE_CONFIG || {};
  const API_URL = cfg.apiUrl || 'http://localhost:3000';
  const SITE_NAME = 'Sabías que PR';
  const SLOW_MS = 6000;
  const S = window.SQPR;

  const FORMATO_LABEL = {
    video: 'Video',
    audio: 'Audio',
    foto: 'Foto',
    ensayo: 'Ensayo',
    noticia: 'Noticia',
    lectura_corta: 'Lectura corta',
  };
  const SECCION_LABEL = {
    'revolucion-humana': 'Revolución Humana',
    'educacion': 'Educación',
  };
  const SECCION_HREF = {
    'revolucion-humana': 'nuevos-humanos.html',
    'educacion': 'educacion.html',
  };

  document.addEventListener('DOMContentLoaded', load);

  async function load() {
    const root = document.getElementById('recurso');
    if (!root) return;
    const id = new URLSearchParams(location.search).get('id');
    if (!id) return showError(root, 'No encontramos este contenido.');

    const slowTimer = setTimeout(() => {
      const st = document.getElementById('recurso-state');
      if (st) st.textContent = 'Cargando… el servidor puede tardar unos segundos en despertar.';
    }, SLOW_MS);

    try {
      const res = await fetch(API_URL + '/api/contenidos/' + encodeURIComponent(id));
      const data = await res.json().catch(() => ({}));
      if (res.status === 404) return showError(root, 'No encontramos este contenido.');
      if (!res.ok) throw new Error(data.error || 'Error ' + res.status);
      render(root, data.contenido);
    } catch (err) {
      showError(root, 'No se pudo cargar el contenido: ' + err.message);
    } finally {
      clearTimeout(slowTimer);
      root.setAttribute('aria-busy', 'false');
    }
  }

  function showError(root, msg) {
    root.innerHTML = '<div class="article-state">' + S.escapeHtml(msg)
      + '<br><br><a class="btn" href="index.html">Volver al inicio</a></div>';
  }

  function render(root, item) {
    const seccionHref = SECCION_HREF[item.seccion] || 'index.html';
    const seccionLabel = SECCION_LABEL[item.seccion] || item.seccion;
    const categoriaLabel = (S.CATEGORIAS && S.CATEGORIAS[item.categoria]) || item.categoria;
    const subformatoLabel = item.subformato && S.SUBFORMATO_LABEL && S.SUBFORMATO_LABEL[item.subformato];
    const formatoLabel = (FORMATO_LABEL[item.tipo_formato] || item.tipo_formato) + (subformatoLabel ? ' · ' + subformatoLabel : '');
    const iaLabel = item.divulgacion_ia && S.DIVULGACION_IA_LABEL && S.DIVULGACION_IA_LABEL[item.divulgacion_ia];
    const iaBadge = iaLabel
      ? '<span class="badge-ia ' + S.DIVULGACION_IA_CLASS[item.divulgacion_ia] + '">' + S.escapeHtml(iaLabel) + '</span>'
      : '';

    const media = item.tipo_formato === 'video' && item.url_media
      ? '<figure class="article-figure"><div class="video-embed">'
        + '<iframe src="' + S.escapeHtml(item.url_media) + '" title="' + S.escapeHtml(item.titulo) + '"'
        + ' allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>'
        + (item.portada_alt ? '<figcaption>' + S.escapeHtml(item.portada_alt) + '</figcaption>' : '') + '</figure>'
      : (item.url_portada
        ? '<figure class="article-figure"><img src="' + S.escapeHtml(item.url_portada) + '" alt="' + S.escapeHtml(item.portada_alt || '') + '" width="1200" height="675" fetchpriority="high"></figure>'
        : '');

    // El audio conserva la imagen de portada arriba (rama "media" de arriba)
    // y agrega el reproductor de ancho completo aparte, en vez de forzarlo
    // dentro de la caja 16:9 de .video-embed (pensada para iframes de video).
    const audioEmbed = item.tipo_formato === 'audio' && item.url_media
      ? '<div class="audio-embed"><audio controls src="' + S.escapeHtml(item.url_media) + '"></audio></div>'
      : '';

    const cuerpo = item.cuerpo
      ? '<div class="article-body">' + S.sanitizeHtml(item.cuerpo).split(/\n{2,}/).map((p) => '<p>' + p + '</p>').join('') + '</div>'
      : '<div class="article-body"><p>' + S.escapeHtml(item.subtitulo_resumen) + '</p></div>';

    const sourceUrl = S.safeUrl(item.fuente_url);
    const fuente = item.fuente_texto
      ? '<p class="article-source">Fuente: '
        + (sourceUrl ? '<a href="' + S.escapeHtml(sourceUrl) + '" target="_blank" rel="noopener noreferrer">' + S.escapeHtml(item.fuente_texto) + '</a>' : S.escapeHtml(item.fuente_texto))
        + '</p>'
      : '';
    const citaTexto = (item.cita_estilo && !item.cita_sin_fuente_externa && S.formatCitation)
      ? S.formatCitation(item.cita_estilo, {
          autor: item.cita_autor,
          anio: item.cita_anio,
          tituloOriginal: item.cita_titulo_original,
          publicacion: item.fuente_texto,
          url: item.fuente_url,
          fechaAcceso: item.cita_fecha_acceso,
        })
      : '';
    const cita = citaTexto ? '<p class="article-citation">Cómo citar esta fuente: <em>' + S.escapeHtml(citaTexto) + '</em></p>' : '';
    const autor = item.autor ? '<p class="article-meta article-author">Por ' + S.escapeHtml(item.autor) + '</p>' : '';

    root.innerHTML =
      '<header class="article-head">'
      + '<p class="eyebrow-trail"><a class="eyebrow" href="' + seccionHref + '">' + S.escapeHtml(seccionLabel) + '</a>'
      + ' <span aria-hidden="true">·</span> <span class="eyebrow">' + S.escapeHtml(formatoLabel) + '</span>'
      + ' <span aria-hidden="true">·</span> <span class="eyebrow">' + S.escapeHtml(categoriaLabel) + '</span></p>'
      + '<h1 class="article-title">' + S.escapeHtml(item.titulo) + '</h1>'
      + '<p class="article-meta">' + S.escapeHtml(String(item.fecha_publicacion).slice(0, 10)) + ' · ' + (item.duracion_min || 1) + (item.tipo_formato === 'video' ? ' min de video' : item.tipo_formato === 'audio' ? ' min de audio' : ' min de lectura') + '</p>'
      + autor
      + iaBadge
      + '</header>'
      + media
      + audioEmbed
      + cuerpo
      + fuente
      + cita;

    updateMeta(item);
    document.title = item.titulo + ' — ' + SITE_NAME;
  }

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

  function updateMeta(item) {
    const url = location.origin + location.pathname + '?id=' + encodeURIComponent(item.id);
    const description = item.subtitulo_resumen;
    const image = item.url_portada ? new URL(item.url_portada, location.href).href : '';
    setMeta('meta[name="description"]', 'content', description);
    setMeta('link[rel="canonical"]', 'href', url);
    setMeta('meta[property="og:type"]', 'content', 'article');
    setMeta('meta[property="og:title"]', 'content', item.titulo);
    setMeta('meta[property="og:description"]', 'content', description);
    setMeta('meta[property="og:url"]', 'content', url);
    setMeta('meta[name="twitter:title"]', 'content', item.titulo);
    setMeta('meta[name="twitter:description"]', 'content', description);
    if (image) {
      setMeta('meta[property="og:image"]', 'content', image);
      setMeta('meta[name="twitter:image"]', 'content', image);
    }
  }
})();
