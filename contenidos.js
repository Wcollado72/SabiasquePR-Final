// ============================================================
// contenidos.js — Sabías que PR · Grillas de "Revolución Humana" y "Educación"
// ============================================================
// Un solo script para ambas páginas: el contenedor de la grilla trae
// data-seccion="revolucion-humana" | "educacion" y este script pide
// GET /api/contenidos?seccion=...&categoria=... y pinta las tarjetas.
//
// Consumo dual (tarjetas de video): el botón "reproducir" cambia la imagen
// por un <iframe> DENTRO de la tarjeta sin navegar (delegación de eventos,
// preventDefault). El título, la categoría o "Leer más" sí navegan a
// recurso.html?id=... En video, el área de medios queda FUERA del <a> para
// no anidar <button> dentro de <a> (inválido en HTML, confuso para lectores
// de pantalla) — ver comentario en styles.css junto a .card-media.
// Requiere editorial.js (window.SQPR) cargado antes que este script.
// ============================================================

(function () {
  const cfg = window.SITE_CONFIG || {};
  const API_URL = cfg.apiUrl || 'http://localhost:3000';
  const SLOW_MS = 6000; // el plan gratuito de Render puede tardar en despertar
  const S = window.SQPR;

  const FORMATO_LABEL = {
    video: 'Video',
    ensayo: 'Ensayo',
    noticia: 'Noticia',
    lectura_corta: 'Lectura corta',
  };

  const PLAY_ICON = '<span class="card-play-icon" aria-hidden="true">'
    + '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>';

  let activeCategoria = '';

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.contenidos-grid[data-seccion]').forEach(initGrid);
  });

  function initGrid(grid) {
    const seccion = grid.dataset.seccion;
    const filtersId = grid.dataset.filters;
    const filtersEl = filtersId ? document.getElementById(filtersId) : null;

    if (filtersEl) {
      filtersEl.addEventListener('click', (e) => {
        const btn = e.target.closest('.foro-filter-btn');
        if (!btn) return;
        filtersEl.querySelectorAll('.foro-filter-btn').forEach((b) => {
          b.classList.toggle('active', b === btn);
          b.setAttribute('aria-pressed', String(b === btn));
        });
        activeCategoria = btn.dataset.categoria || '';
        load(grid, seccion);
      });
    }

    // Reproducir video inline, sin navegar. Delegado: las tarjetas se repintan.
    grid.addEventListener('click', (e) => {
      const btn = e.target.closest('.card-play');
      if (!btn) return;
      e.preventDefault();
      const media = btn.closest('.card-media');
      const url = btn.dataset.url;
      if (!media || !url) return;
      media.innerHTML = '<iframe class="card-media-frame" src="' + S.escapeHtml(url) + '?autoplay=1"'
        + ' title="Reproductor de video" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe>';
    });

    load(grid, seccion);
  }

  async function load(grid, seccion) {
    grid.setAttribute('aria-busy', 'true');
    grid.innerHTML = [0, 1, 2].map(() => S.skeletonCard()).join('');
    const hint = document.getElementById(grid.dataset.hint || '');
    const slowTimer = setTimeout(() => {
      if (hint) hint.textContent = 'Cargando… el servidor puede tardar unos segundos en despertar.';
    }, SLOW_MS);
    try {
      const params = new URLSearchParams({ seccion });
      if (activeCategoria) params.set('categoria', activeCategoria);
      const res = await fetch(API_URL + '/api/contenidos?' + params.toString());
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error ' + res.status);
      const items = data.contenidos || [];
      grid.innerHTML = items.length
        ? items.map(cardHtml).join('')
        : `<p class="empty-state">Aún no hay contenido${activeCategoria ? ' en esta categoría' : ''} en esta sección.</p>`;
    } catch (err) {
      grid.innerHTML = '<p class="empty-state">No se pudo cargar el contenido: ' + S.escapeHtml(err.message) + '</p>';
    } finally {
      clearTimeout(slowTimer);
      if (hint) hint.textContent = '';
      grid.setAttribute('aria-busy', 'false');
    }
  }

  function href(item) {
    return 'recurso.html?id=' + encodeURIComponent(item.id);
  }

  function metaLine(item) {
    const parts = [];
    if (item.fecha_publicacion) parts.push(S.escapeHtml(String(item.fecha_publicacion).slice(0, 10)));
    parts.push((item.duracion_min || 1) + (item.tipo_formato === 'video' ? ' min de video' : ' min de lectura'));
    return parts.join(' · ');
  }

  function cardHtml(item) {
    const formatoLabel = FORMATO_LABEL[item.tipo_formato] || item.tipo_formato;
    const categoriaLabel = (S.CATEGORIAS && S.CATEGORIAS[item.categoria]) || item.categoria;
    const img = '<img src="' + S.escapeHtml(item.url_portada) + '" alt="' + S.escapeHtml(item.portada_alt || '') + '" width="600" height="400" loading="lazy">';
    const badge = '<span class="card-format">' + S.escapeHtml(formatoLabel) + '</span>';

    const body = '<div class="card-body">'
      + '<span class="eyebrow">' + S.escapeHtml(categoriaLabel) + '</span>'
      + '<h3 class="card-title">' + S.escapeHtml(item.titulo) + '</h3>'
      + '<p class="card-dek">' + S.escapeHtml(item.subtitulo_resumen) + '</p>'
      + '<p class="card-meta">' + metaLine(item) + '</p>'
      + '</div>';

    if (item.tipo_formato === 'video' && item.url_media) {
      // Medios fuera del <a>: el botón de reproducir no debe estar dentro de un enlace.
      return '<article class="card">'
        + '<div class="card-media">' + badge + img
        + '<button type="button" class="card-play" data-url="' + S.escapeHtml(item.url_media) + '" aria-label="Reproducir video: ' + S.escapeHtml(item.titulo) + '">' + PLAY_ICON + '</button>'
        + '</div>'
        + '<a class="card-title-link" href="' + href(item) + '">' + body + '</a>'
        + '</article>';
    }

    return '<article class="card">'
      + '<a class="card-link" href="' + href(item) + '">'
      + '<div class="card-media">' + badge + img + '</div>'
      + body
      + '</a></article>';
  }
})();
