// ============================================================
// home.js — Sabías que PR · Portada editorial
// ============================================================
// Pide las noticias a la API y pinta el artículo destacado
// (el marcado como `destacado`, o el más reciente) y las tarjetas.
// ============================================================

(function () {
  const cfg = window.SITE_CONFIG || {};
  const API_URL = cfg.apiUrl || 'http://localhost:3000';
  const LATEST_MAX = 6;
  const SLOW_MS = 6000; // el plan gratuito de Render puede tardar en despertar

  document.addEventListener('DOMContentLoaded', load);

  async function load() {
    const featuredEl = document.getElementById('home-featured');
    const latestEl = document.getElementById('home-latest');
    const hintEl = document.getElementById('home-hint');
    if (!featuredEl || !latestEl) return;

    const slowTimer = setTimeout(() => {
      if (hintEl) hintEl.textContent = 'Cargando… el servidor puede tardar unos segundos en despertar.';
    }, SLOW_MS);

    try {
      const res = await fetch(window.SQPR.withLang(API_URL + '/api/noticias'));
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error ' + res.status);
      render(data.noticias || [], featuredEl, latestEl);
    } catch (err) {
      showEmpty(featuredEl, latestEl, 'No se pudieron cargar las noticias por ahora. Inténtalo de nuevo en unos minutos.');
    } finally {
      clearTimeout(slowTimer);
      featuredEl.setAttribute('aria-busy', 'false');
      if (hintEl) hintEl.textContent = '';
    }
  }

  function render(noticias, featuredEl, latestEl) {
    if (!noticias.length) {
      showEmpty(featuredEl, latestEl, 'Aún no hay noticias publicadas.');
      return;
    }
    const pinned = noticias.find((n) => n.destacado);
    const featured = pinned || noticias[0];
    const rest = noticias.filter((n) => n !== featured).slice(0, LATEST_MAX);

    featuredEl.innerHTML = window.SQPR.cardHtml(featured, { featured: true });

    const head = document.getElementById('home-latest-head');
    if (!rest.length) {
      if (head) head.hidden = true;
      latestEl.hidden = true;
      return;
    }
    latestEl.innerHTML = rest.map((n) => window.SQPR.cardHtml(n)).join('');
  }

  function showEmpty(featuredEl, latestEl, msg) {
    featuredEl.innerHTML = '<p class="empty-state">' + window.SQPR.escapeHtml(msg) + '</p>';
    const head = document.getElementById('home-latest-head');
    if (head) head.hidden = true;
    latestEl.hidden = true;
  }
})();
