// ============================================================
// productos.js — Sabías que PR · Tienda
// ============================================================
// Consume la API REST del backend (backend/src/routes/productos.js)
// en vez de depender del HTML pre-generado por build.js. El botón
// "Añadir al carrito" conserva los mismos data-atributos que
// script.js espera, así que el carrito sigue funcionando igual.
// ============================================================

(function () {
  const cfg = window.SITE_CONFIG || {};
  const API_URL = cfg.apiUrl || 'http://localhost:3000';

  document.addEventListener('DOMContentLoaded', loadProductos);

  async function loadProductos() {
    const el = document.getElementById('productos');
    if (!el) return;
    try {
      const res = await fetch(withLang(API_URL + '/api/productos'));
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      const disponibles = data.productos.filter((p) => p.disponible);
      el.innerHTML = disponibles.length
        ? disponibles.map(renderProducto).join('\n')
        : '<p class="foro-empty">Aún no hay productos disponibles.</p>';
    } catch (err) {
      el.innerHTML = `<p class="foro-error">No se pudo cargar la tienda: ${escapeHtml(err.message)}</p>`;
    }
  }

  // ?lang=en cuando el visitante eligio ingles (ver i18n.js / editorial.js
  // withLang -- productos.js no carga editorial.js, asi que se duplica aqui,
  // mismo patron del sitio: cada script mantiene sus propias utilidades).
  function withLang(url) {
    return window.SQPR_LANG === 'en' ? url + (url.includes('?') ? '&' : '?') + 'lang=en' : url;
  }

  function renderProducto(p) {
    const isReal = p.stripe_link && !p.stripe_link.startsWith('YOUR_');
    const avisoIdioma = p.sin_traduccion ? '<span class="badge-idioma">Solo en español</span>' : '';
    return `
      <section class="box product-card">
        <figure>
          <img src="${p.imagen}" alt="${p.imagen_alt}" loading="lazy" width="250" height="180">
        </figure>
        <h3>${escapeHtml(p.nombre)}</h3>
        <p>${escapeHtml(p.descripcion)}</p>
        ${avisoIdioma}
        <p class="price">$${Number(p.precio).toFixed(2)}</p>
        <button type="button"
          data-product-id="${p.id}"
          data-product-name="${escapeAttr(p.nombre)}"
          data-product-price="${p.precio}"
          data-stripe-link="${isReal ? p.stripe_link : ''}"
          onclick="addToCart(this)">
          Añadir al carrito
        </button>
      </section>`;
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
  }

  function escapeAttr(str) {
    return (str ?? '').replace(/"/g, '&quot;');
  }
})();
