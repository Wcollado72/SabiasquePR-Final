// ============================================================
// noticias.js — Sabías que PR · Lista de noticias (tarjetas)
// ============================================================
// Noticias combina dos fuentes: artículos propios de /api/noticias y
// video/ensayo/lectura_corta curados en /api/contenidos?seccion=noticias
// (la tabla `contenidos` sí soporta video con reproducción en línea, cosa
// que `noticias` no hace). Ambas se normalizan a la misma forma y se pintan
// con SQPR.contenidoCardHtml — ver editorial.js.
// Requiere editorial.js (window.SQPR) cargado antes que este script.
// ============================================================

(function () {
  const cfg = window.SITE_CONFIG || {};
  const API_URL = cfg.apiUrl || 'http://localhost:3000';
  const SLOW_MS = 6000; // el plan gratuito de Render puede tardar en despertar
  const S = window.SQPR;
  let activeCategoria = '';

  document.addEventListener('DOMContentLoaded', () => {
    const fromUrl = new URLSearchParams(location.search).get('categoria');
    if (fromUrl && S.CATEGORIAS[fromUrl]) activeCategoria = fromUrl;
    bindFilters();
    const list = document.getElementById('noticias-list');
    if (list) S.bindCardPlayDelegation(list);
    loadNoticias();
  });

  function setActiveButton() {
    document.querySelectorAll('#noticias-filters .foro-filter-btn').forEach((b) => {
      const on = (b.dataset.categoria || '') === activeCategoria;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }

  function bindFilters() {
    setActiveButton();
    document.querySelectorAll('#noticias-filters .foro-filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeCategoria = btn.dataset.categoria || '';
        setActiveButton();
        loadNoticias();
      });
    });
  }

  async function loadNoticias() {
    const el = document.getElementById('noticias-list');
    const hint = document.getElementById('noticias-hint');
    if (!el) return;
    el.setAttribute('aria-busy', 'true');
    el.innerHTML = [0, 1, 2].map(() => S.skeletonCard()).join('');
    const slowTimer = setTimeout(() => {
      if (hint) hint.textContent = 'Cargando… el servidor puede tardar unos segundos en despertar.';
    }, SLOW_MS);
    try {
      const qs = activeCategoria ? `?categoria=${encodeURIComponent(activeCategoria)}` : '';
      const [noticiasRes, contenidosRes] = await Promise.all([
        fetch(API_URL + '/api/noticias' + qs),
        fetch(API_URL + '/api/contenidos?seccion=noticias' + (activeCategoria ? `&categoria=${encodeURIComponent(activeCategoria)}` : '')),
      ]);
      const noticiasData = await noticiasRes.json();
      const contenidosData = await contenidosRes.json();
      if (!noticiasRes.ok) throw new Error(noticiasData.error || `Error ${noticiasRes.status}`);
      if (!contenidosRes.ok) throw new Error(contenidosData.error || `Error ${contenidosRes.status}`);

      const items = (noticiasData.noticias || []).map(S.noticiaComoContenido)
        .concat(contenidosData.contenidos || [])
        .sort((a, b) => (a.fecha_publicacion < b.fecha_publicacion ? 1 : -1));

      el.innerHTML = items.length
        ? items.map((item) => S.contenidoCardHtml(item)).join('')
        : '<p class="empty-state">Aún no hay noticias en esta categoría.</p>';
    } catch (err) {
      el.innerHTML = `<p class="empty-state">No se pudieron cargar las noticias: ${S.escapeHtml(err.message)}</p>`;
    } finally {
      clearTimeout(slowTimer);
      if (hint) hint.textContent = '';
      el.setAttribute('aria-busy', 'false');
    }
  }
})();
