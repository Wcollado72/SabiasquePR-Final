// ============================================================
// contenidos.js — Sabías que PR · Grillas de "Revolución Humana" y "Educación"
// ============================================================
// Un solo script para ambas páginas: el contenedor de la grilla trae
// data-seccion="revolucion-humana" | "educacion" y este script pide
// GET /api/contenidos?seccion=...&categoria=...&subseccion=...&enfoque=...
// y pinta las tarjetas.
//
// Soporta uno o varios grupos de filtro por grilla (data-filters="id1 id2",
// separados por espacio) -- ej. Revolución Humana filtra primero por
// sub-sección y, dentro de Corrupción Humana / Nueva Humanidad, un segundo
// grupo filtra por "enfoque" (institucional/individual o la región). Cambiar
// un grupo reinicia los demás grupos de esa misma grilla a su botón por
// defecto, porque el segundo eje depende del primero (un enfoque de Nueva
// Humanidad no tiene sentido si se cambia a Lógica Humana).
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

  // Estado de filtros por grilla: { [filterParam]: valor }.
  const filtrosPorGrid = new WeakMap();
  // Grupos de filtro (elementos) registrados por grilla, para poder
  // reiniciar los que no cambiaron cuando otro grupo sí cambia.
  const gruposPorGrid = new WeakMap();

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.contenidos-grid[data-seccion]').forEach(initGrid);
  });

  function activeValue(filtersEl, filterParam) {
    const activeBtn = filtersEl.querySelector('.foro-filter-btn.active');
    return (activeBtn && activeBtn.dataset[filterParam]) || '';
  }

  function initGrid(grid) {
    const seccion = grid.dataset.seccion;
    const filtersIds = (grid.dataset.filters || '').split(/\s+/).filter(Boolean);
    const grupos = filtersIds
      .map((id) => document.getElementById(id))
      .filter(Boolean)
      .map((filtersEl) => ({ el: filtersEl, param: filtersEl.dataset.filterParam || 'categoria' }));
    gruposPorGrid.set(grid, grupos);

    const filtros = {};
    grupos.forEach(({ el, param }) => { filtros[param] = activeValue(el, param); });
    filtrosPorGrid.set(grid, filtros);

    grupos.forEach(({ el: filtersEl, param: filterParam }, indice) => {
      filtersEl.addEventListener('click', (e) => {
        const btn = e.target.closest('.foro-filter-btn');
        if (!btn) return;
        filtersEl.querySelectorAll('.foro-filter-btn').forEach((b) => {
          b.classList.toggle('active', b === btn);
          b.setAttribute('aria-pressed', String(b === btn));
        });
        const actuales = filtrosPorGrid.get(grid);
        actuales[filterParam] = btn.dataset[filterParam] || '';
        // El orden en data-filters es jerarquico: un grupo posterior depende
        // del anterior (ej. "enfoque" depende de la sub-seccion activa), asi
        // que cambiar un grupo reinicia solo los que vienen DESPUES de el a
        // su boton por defecto -- nunca los anteriores.
        grupos.slice(indice + 1).forEach(({ el: otroEl, param: otroParam }) => {
          otroEl.querySelectorAll('.foro-filter-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
          otroEl.querySelectorAll('.foro-filter-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.classList.contains('active'))));
          actuales[otroParam] = activeValue(otroEl, otroParam);
        });
        load(grid, seccion);
      });
    });

    S.bindCardPlayDelegation(grid);
    load(grid, seccion);
  }

  async function load(grid, seccion) {
    grid.setAttribute('aria-busy', 'true');
    grid.innerHTML = [0, 1, 2].map(() => S.skeletonCard()).join('');
    const hint = document.getElementById(grid.dataset.hint || '');
    const slowTimer = setTimeout(() => {
      if (hint) hint.textContent = 'Cargando… el servidor puede tardar unos segundos en despertar.';
    }, SLOW_MS);
    const filtros = filtrosPorGrid.get(grid) || {};
    try {
      const params = new URLSearchParams({ seccion });
      Object.entries(filtros).forEach(([param, valor]) => { if (valor) params.set(param, valor); });
      const res = await fetch(API_URL + '/api/contenidos?' + params.toString());
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error ' + res.status);
      const items = data.contenidos || [];
      const hayFiltro = Object.values(filtros).some(Boolean);
      grid.innerHTML = items.length
        ? items.map(S.contenidoCardHtml).join('')
        : `<p class="empty-state">Aún no hay contenido${hayFiltro ? ' en esta selección' : ''} en esta sección.</p>`;
    } catch (err) {
      grid.innerHTML = '<p class="empty-state">No se pudo cargar el contenido: ' + S.escapeHtml(err.message) + '</p>';
    } finally {
      clearTimeout(slowTimer);
      if (hint) hint.textContent = '';
      grid.setAttribute('aria-busy', 'false');
    }
  }
})();
