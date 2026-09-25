// ============================================================
// contenidos.js — Sabías que PR · Grillas de "Revolución Humana" y "Educación"
// ============================================================
// Un solo script para ambas páginas: el contenedor de la grilla trae
// data-seccion="revolucion-humana" | "educacion" y este script pide
// GET /api/contenidos?seccion=...&categoria=...&subseccion=... y pinta
// las tarjetas.
//
// El renderizado de tarjetas y la reproducción en línea (video/audio) viven
// en editorial.js (SQPR.contenidoCardHtml / SQPR.bindCardPlayDelegation) —
// las usa también noticias.js, así que este script solo se encarga de
// cargar los datos y los filtros de esta grilla.
// Requiere editorial.js (window.SQPR) cargado antes que este script.
// ============================================================

(function () {
  const cfg = window.SITE_CONFIG || {};
  const API_URL = cfg.apiUrl || 'http://localhost:3000';
  const SLOW_MS = 6000; // el plan gratuito de Render puede tardar en despertar
  const S = window.SQPR;

  // Estado de filtro por grilla (antes era una sola variable compartida a
  // nivel de modulo -- se rompia si alguna vez hay mas de una grilla
  // filtrada en la misma pagina, lo cual ya es el caso desde que
  // Revolucion Humana gano su propia pestaña de sub-seccion).
  const filtroPorGrid = new WeakMap();

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.contenidos-grid[data-seccion]').forEach(initGrid);
  });

  function initGrid(grid) {
    const seccion = grid.dataset.seccion;

    const filtersId = grid.dataset.filters;
    const filtersEl = filtersId ? document.getElementById(filtersId) : null;
    const filterParam = (filtersEl && filtersEl.dataset.filterParam) || 'categoria';

    // El filtro inicial es el del boton marcado "active" en el HTML (por
    // defecto es el de "reset" -- ej. "Todas" -- pero una grilla puede
    // arrancar en otra pestaña, como Revolucion Humana en "Logica Humana").
    const activeBtn = filtersEl && filtersEl.querySelector('.foro-filter-btn.active');
    filtroPorGrid.set(grid, (activeBtn && activeBtn.dataset[filterParam]) || '');

    if (filtersEl) {
      filtersEl.addEventListener('click', (e) => {
        const btn = e.target.closest('.foro-filter-btn');
        if (!btn) return;
        filtersEl.querySelectorAll('.foro-filter-btn').forEach((b) => {
          b.classList.toggle('active', b === btn);
          b.setAttribute('aria-pressed', String(b === btn));
        });
        filtroPorGrid.set(grid, btn.dataset[filterParam] || '');
        load(grid, seccion, filterParam);
      });
    }

    S.bindCardPlayDelegation(grid);
    load(grid, seccion, filterParam);
  }

  async function load(grid, seccion, filterParam) {
    grid.setAttribute('aria-busy', 'true');
    grid.innerHTML = [0, 1, 2].map(() => S.skeletonCard()).join('');
    const hint = document.getElementById(grid.dataset.hint || '');
    const slowTimer = setTimeout(() => {
      if (hint) hint.textContent = 'Cargando… el servidor puede tardar unos segundos en despertar.';
    }, SLOW_MS);
    const filtroActivo = filtroPorGrid.get(grid) || '';
    try {
      const params = new URLSearchParams({ seccion });
      if (filtroActivo) params.set(filterParam, filtroActivo);
      const res = await fetch(API_URL + '/api/contenidos?' + params.toString());
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error ' + res.status);
      const items = data.contenidos || [];
      grid.innerHTML = items.length
        ? items.map(S.contenidoCardHtml).join('')
        : `<p class="empty-state">Aún no hay contenido${filtroActivo ? ' en esta selección' : ''} en esta sección.</p>`;
    } catch (err) {
      grid.innerHTML = '<p class="empty-state">No se pudo cargar el contenido: ' + S.escapeHtml(err.message) + '</p>';
    } finally {
      clearTimeout(slowTimer);
      if (hint) hint.textContent = '';
      grid.setAttribute('aria-busy', 'false');
    }
  }
})();
