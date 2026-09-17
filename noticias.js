// ============================================================
// noticias.js — Sabías que PR · Noticias
// ============================================================
// Consume la API REST del backend (backend/src/routes/noticias.js)
// en vez de depender del HTML pre-generado por build.js.
// ============================================================

(function () {
  const cfg = window.SITE_CONFIG || {};
  const API_URL = cfg.apiUrl || 'http://localhost:3000';
  let activeCategoria = '';

  const CATEGORIAS = {
    general: 'General',
    internacionales: 'Internacionales',
    crimenes: 'Crímenes',
    salud: 'Salud',
    deportes: 'Deportes',
    finanzas: 'Finanzas',
    tecnologia: 'Tecnología',
    descubrimientos: 'Descubrimientos',
    politica: 'Política',
    clima: 'Clima y Medio Ambiente',
    cultura: 'Cultura',
  };

  document.addEventListener('DOMContentLoaded', () => {
    bindFilters();
    loadNoticias();
  });

  function bindFilters() {
    document.querySelectorAll('#noticias-filters .foro-filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#noticias-filters .foro-filter-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        activeCategoria = btn.dataset.categoria || '';
        loadNoticias();
      });
    });
  }

  async function loadNoticias() {
    const el = document.getElementById('noticias-list');
    if (!el) return;
    el.innerHTML = '<p class="foro-loading">Cargando noticias...</p>';
    try {
      const qs = activeCategoria ? `?categoria=${encodeURIComponent(activeCategoria)}` : '';
      const res = await fetch(API_URL + '/api/noticias' + qs);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      el.innerHTML = data.noticias.length
        ? data.noticias.map(renderArticulo).join('\n')
        : '<p class="foro-empty">Aún no hay noticias en esta categoría.</p>';
    } catch (err) {
      el.innerHTML = `<p class="foro-error">❌ No se pudieron cargar las noticias: ${escapeHtml(err.message)}</p>`;
    }
  }

  function renderArticulo(art) {
    return `
      <div class="box box-blog ${art.clase}">
        <article>
          <span class="foro-badge">${CATEGORIAS[art.categoria] || art.categoria}</span>
          <h3>${art.titulo}</h3>
          <time datetime="${art.fecha}">${art.fecha_display}</time>
          <figure class="${art.clase}-figure">
            <a href="${art.fuente_url}" target="_blank" rel="noopener noreferrer">
              <img src="${art.imagen}" alt="${art.imagen_alt}" loading="lazy" width="600" height="340">
            </a>
            <figcaption>${art.imagen_caption}</figcaption>
          </figure>
          ${(art.parrafos || []).map((p) => `          <p>${p}</p>`).join('\n')}
          <p class="fuente-link">
            Fuente: <a href="${art.fuente_url}" target="_blank" rel="noopener noreferrer">${art.fuente_texto}</a>
          </p>
        </article>
      </div>`;
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
  }
})();
