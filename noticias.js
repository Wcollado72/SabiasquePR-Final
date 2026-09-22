// ============================================================
// noticias.js — Sabías que PR · Lista de noticias (tarjetas)
// ============================================================
// Consume la API REST del backend (backend/src/routes/noticias.js).
// Cada tarjeta enlaza a articulo.html?id=... (ver articulo.js).
// Requiere editorial.js (window.SQPR).
// ============================================================

(function () {
  const cfg = window.SITE_CONFIG || {};
  const API_URL = cfg.apiUrl || 'http://localhost:3000';
  const SLOW_MS = 6000; // el plan gratuito de Render puede tardar en despertar
  let activeCategoria = '';

  document.addEventListener('DOMContentLoaded', () => {
    // Permite llegar desde un artículo con noticias.html?categoria=salud
    const fromUrl = new URLSearchParams(location.search).get('categoria');
    if (fromUrl && window.SQPR.CATEGORIAS[fromUrl]) activeCategoria = fromUrl;
    bindFilters();
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
    el.innerHTML = [0, 1, 2].map(() => window.SQPR.skeletonCard()).join('');
    const slowTimer = setTimeout(() => {
      if (hint) hint.textContent = 'Cargando… el servidor puede tardar unos segundos en despertar.';
    }, SLOW_MS);
    try {
      const qs = activeCategoria ? `?categoria=${encodeURIComponent(activeCategoria)}` : '';
      const res = await fetch(API_URL + '/api/noticias' + qs);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      el.innerHTML = data.noticias.length
        ? data.noticias.map((n) => window.SQPR.cardHtml(n)).join('')
        : '<p class="empty-state">Aún no hay noticias en esta categoría.</p>';
    } catch (err) {
      el.innerHTML = `<p class="empty-state">No se pudieron cargar las noticias: ${window.SQPR.escapeHtml(err.message)}</p>`;
    } finally {
      clearTimeout(slowTimer);
      if (hint) hint.textContent = '';
      el.setAttribute('aria-busy', 'false');
    }
  }
})();
