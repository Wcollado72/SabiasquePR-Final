// ============================================================
// admin.js — Sabías que PR · Panel de administración
// ============================================================
// Página protegida: solo usuarios con rol "admin" (tabla perfiles)
// pueden ver el panel. Verifica sesión con Supabase y rol con
// GET /api/me, luego hace CRUD sobre /api/noticias y /api/productos.
// ============================================================

(function () {
  const cfg = window.SITE_CONFIG || {};
  const API_URL = cfg.apiUrl || 'http://localhost:3000';
  const isSupabaseConfigured = cfg.supabaseUrl && !cfg.supabaseUrl.includes('YOUR_SUPABASE');
  let supabase = null;
  let currentUser = null;

  let noticiasCache = [];
  let productosCache = [];
  let contenidosCache = [];

  document.addEventListener('DOMContentLoaded', init);

  // Igual que en foro.js: espera a que auth.js termine de inicializar
  // su propio cliente de Supabase para reutilizarlo (una sola sesión).
  function waitForSharedSupabase(timeoutMs = 1500, intervalMs = 50) {
    return new Promise((resolve) => {
      const start = Date.now();
      (function check() {
        if (window.supabase) return resolve(window.supabase);
        if (Date.now() - start >= timeoutMs) return resolve(null);
        setTimeout(check, intervalMs);
      })();
    });
  }

  async function init() {
    if (!isSupabaseConfigured) {
      showGate('⚠️ La autenticación no está configurada en este sitio.');
      return;
    }
    try {
      const shared = await waitForSharedSupabase();
      supabase = shared || (await (async () => {
        const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
        return createClient(cfg.supabaseUrl, cfg.supabaseKey);
      })());
      const { data: { session } } = await supabase.auth.getSession();
      currentUser = session?.user ?? null;
    } catch (err) {
      showGate('⚠️ No se pudo verificar tu sesión: ' + err.message);
      return;
    }

    if (!currentUser) {
      showGate('<a href="#" class="login-modal-trigger">Inicia sesión</a> para acceder al panel de administración.');
      return;
    }

    try {
      const data = await apiFetch('/api/me');
      if (data.user.rol !== 'admin') {
        showGate('⛔ Tu cuenta no tiene permisos de administrador.');
        return;
      }
    } catch (err) {
      showGate('⚠️ ' + err.message);
      return;
    }

    document.getElementById('admin-gate').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'block';
    bindTabs();
    bindNoticias();
    bindContenidos();
    bindProductos();
    loadNoticias();
    loadContenidos();
    loadProductos();
  }

  function showGate(msg) {
    const el = document.getElementById('admin-gate');
    if (el) el.innerHTML = `<p>${msg}</p>`;
  }

  async function getToken() {
    if (!supabase) return null;
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  }

  async function apiFetch(path, options = {}) {
    const token = await getToken();
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(API_URL + path, Object.assign({}, options, { headers }));
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
  }

  // ── PESTAÑAS ─────────────────────────────────────────────
  function bindTabs() {
    document.querySelectorAll('.admin-tabs .foro-filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.admin-tabs .foro-filter-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        document.getElementById('admin-panel-noticias').style.display = tab === 'noticias' ? '' : 'none';
        document.getElementById('admin-panel-contenidos').style.display = tab === 'contenidos' ? '' : 'none';
        document.getElementById('admin-panel-productos').style.display = tab === 'productos' ? '' : 'none';
      });
    });
  }

  // ── NOTICIAS ─────────────────────────────────────────────
  function bindNoticias() {
    document.getElementById('admin-noticias-new').addEventListener('click', () => openNoticiaForm());
    document.getElementById('an-cancel').addEventListener('click', closeNoticiaForm);
    document.getElementById('admin-noticias-search').addEventListener('input', renderNoticiasList);
    document.getElementById('admin-noticias-form').addEventListener('submit', submitNoticia);
  }

  async function loadNoticias() {
    const el = document.getElementById('admin-noticias-list');
    el.innerHTML = '<p class="foro-loading">Cargando...</p>';
    try {
      const data = await apiFetch('/api/noticias');
      noticiasCache = data.noticias;
      renderNoticiasList();
    } catch (err) {
      el.innerHTML = `<p class="foro-error">${escapeHtml(err.message)}</p>`;
    }
  }

  function renderNoticiasList() {
    const el = document.getElementById('admin-noticias-list');
    const q = (document.getElementById('admin-noticias-search').value || '').toLowerCase();
    const items = noticiasCache.filter((n) => n.titulo.toLowerCase().includes(q));
    el.innerHTML = items.length ? items.map((n) => `
      <div class="admin-item">
        <div class="admin-item-info">
          <strong>${escapeHtml(n.titulo)}${n.destacado ? ' <span class="foro-badge">★ Destacada</span>' : ''}</strong>
          <span class="foro-meta">${escapeHtml(n.fecha_display)}</span>
        </div>
        <div class="admin-item-actions">
          <button type="button" class="admin-btn-edit" data-id="${n.id}">Editar</button>
          <button type="button" class="admin-btn-delete foro-danger" data-id="${n.id}">Eliminar</button>
        </div>
      </div>`).join('') : '<p class="foro-empty">Sin resultados.</p>';

    el.querySelectorAll('.admin-btn-edit').forEach((btn) => btn.addEventListener('click', () => {
      const item = noticiasCache.find((n) => n.id === btn.dataset.id);
      if (item) openNoticiaForm(item);
    }));
    el.querySelectorAll('.admin-btn-delete').forEach((btn) => btn.addEventListener('click', () => deleteNoticia(btn.dataset.id)));
  }

  function openNoticiaForm(item) {
    document.getElementById('admin-noticias-form-title').textContent = item ? 'Editar noticia' : 'Nueva noticia';
    document.getElementById('an-id').value = item?.id || '';
    document.getElementById('an-titulo').value = item?.titulo || '';
    document.getElementById('an-categoria').value = item?.categoria || 'general';
    document.getElementById('an-fecha').value = item?.fecha ? String(item.fecha).slice(0, 10) : '';
    document.getElementById('an-imagen').value = item?.imagen || '';
    document.getElementById('an-imagen-alt').value = item?.imagen_alt || '';
    document.getElementById('an-imagen-caption').value = item?.imagen_caption || '';
    document.getElementById('an-fuente-url').value = item?.fuente_url || '';
    document.getElementById('an-fuente-texto').value = item?.fuente_texto || '';
    document.getElementById('an-parrafos').value = (item?.parrafos || []).join('\n');
    document.getElementById('an-destacado').checked = Boolean(item?.destacado);
    setStatus(document.getElementById('an-status'), '', '');
    document.getElementById('admin-noticias-form-box').style.display = 'block';
    document.getElementById('admin-noticias-form-box').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function closeNoticiaForm() {
    document.getElementById('admin-noticias-form-box').style.display = 'none';
    document.getElementById('admin-noticias-form').reset();
  }

  async function submitNoticia(e) {
    e.preventDefault();
    const statusEl = document.getElementById('an-status');
    const id = document.getElementById('an-id').value;
    const body = {
      titulo: document.getElementById('an-titulo').value.trim(),
      categoria: document.getElementById('an-categoria').value,
      fecha: document.getElementById('an-fecha').value,
      imagen: document.getElementById('an-imagen').value.trim(),
      imagenAlt: document.getElementById('an-imagen-alt').value.trim(),
      imagenCaption: document.getElementById('an-imagen-caption').value.trim() || undefined,
      fuenteUrl: document.getElementById('an-fuente-url').value.trim(),
      fuenteTexto: document.getElementById('an-fuente-texto').value.trim(),
      parrafos: document.getElementById('an-parrafos').value.split('\n').map((p) => p.trim()).filter(Boolean),
      destacado: document.getElementById('an-destacado').checked,
    };
    setStatus(statusEl, 'info', 'Guardando...');
    try {
      if (id) {
        await apiFetch(`/api/noticias/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await apiFetch('/api/noticias', { method: 'POST', body: JSON.stringify(body) });
      }
      closeNoticiaForm();
      loadNoticias();
    } catch (err) {
      setStatus(statusEl, 'error', '' + err.message);
    }
  }

  async function deleteNoticia(id) {
    if (!confirm('¿Eliminar esta noticia? Esta acción no se puede deshacer.')) return;
    try {
      await apiFetch(`/api/noticias/${encodeURIComponent(id)}`, { method: 'DELETE' });
      loadNoticias();
    } catch (err) {
      alert('' + err.message);
    }
  }

  // ── CONTENIDOS (video/ensayo/noticia/lectura_corta) ──────
  const SECCION_LABEL = { noticias: 'Noticias', 'revolucion-humana': 'Revolución Humana', educacion: 'Educación' };
  const TIPO_LABEL = { video: 'Video', ensayo: 'Ensayo', noticia: 'Noticia', lectura_corta: 'Lectura corta' };

  function bindContenidos() {
    document.getElementById('admin-contenidos-new').addEventListener('click', () => openContenidoForm());
    document.getElementById('ac-cancel').addEventListener('click', closeContenidoForm);
    document.getElementById('admin-contenidos-search').addEventListener('input', renderContenidosList);
    document.getElementById('admin-contenidos-form').addEventListener('submit', submitContenido);
    document.getElementById('ac-usar-imagen-categoria').addEventListener('click', () => {
      const categoria = document.getElementById('ac-categoria').value;
      const img = window.SQPR && window.SQPR.CATEGORIA_IMAGEN && window.SQPR.CATEGORIA_IMAGEN[categoria];
      if (!img) {
        alert('Todavía no hay una imagen genérica para esta categoría.');
        return;
      }
      document.getElementById('ac-url-portada').value = img.src;
      document.getElementById('ac-portada-alt').value = img.alt;
      updateImagePreview();
    });
    document.getElementById('ac-url-portada').addEventListener('input', updateImagePreview);
    document.getElementById('ac-elegir-imagen').addEventListener('click', openImagePicker);
    document.getElementById('image-picker-close').addEventListener('click', closeImagePicker);
    document.getElementById('image-picker-modal').addEventListener('click', (e) => {
      if (e.target.id === 'image-picker-modal') closeImagePicker();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !document.getElementById('image-picker-modal').hidden) closeImagePicker();
    });

    document.getElementById('ac-cita-sin-fuente').addEventListener('change', () => { toggleCitationFields(); updateCitationPreview(); });
    ['ac-cita-estilo', 'ac-cita-autor', 'ac-cita-anio', 'ac-cita-titulo-original', 'ac-cita-fecha-acceso', 'ac-fuente-texto', 'ac-fuente-url']
      .forEach((id) => document.getElementById(id).addEventListener('input', updateCitationPreview));
  }

  function toggleCitationFields() {
    const sinFuente = document.getElementById('ac-cita-sin-fuente').checked;
    ['ac-cita-estilo', 'ac-cita-autor', 'ac-cita-anio', 'ac-cita-titulo-original', 'ac-cita-fecha-acceso']
      .forEach((id) => { document.getElementById(id).disabled = sinFuente; });
  }

  function updateCitationPreview() {
    const preview = document.getElementById('ac-cita-preview');
    const sinFuente = document.getElementById('ac-cita-sin-fuente').checked;
    const estilo = document.getElementById('ac-cita-estilo').value;
    if (sinFuente || !estilo || !window.SQPR || !window.SQPR.formatCitation) { preview.textContent = ''; return; }
    preview.textContent = window.SQPR.formatCitation(estilo, {
      autor: document.getElementById('ac-cita-autor').value.trim(),
      anio: document.getElementById('ac-cita-anio').value.trim(),
      tituloOriginal: document.getElementById('ac-cita-titulo-original').value.trim(),
      publicacion: document.getElementById('ac-fuente-texto').value.trim(),
      url: document.getElementById('ac-fuente-url').value.trim(),
      fechaAcceso: document.getElementById('ac-cita-fecha-acceso').value,
    });
  }

  function updateImagePreview() {
    const src = document.getElementById('ac-url-portada').value.trim();
    const preview = document.getElementById('ac-url-portada-preview');
    if (src) { preview.src = src; preview.hidden = false; } else { preview.hidden = true; preview.src = ''; }
  }

  let imagesManifestCache = null;
  async function openImagePicker() {
    const grid = document.getElementById('image-picker-grid');
    document.getElementById('image-picker-modal').hidden = false;
    if (!imagesManifestCache) {
      grid.innerHTML = '<p class="foro-loading">Cargando...</p>';
      try {
        imagesManifestCache = await fetch('images-manifest.json').then((r) => r.json());
      } catch (err) {
        grid.innerHTML = `<p class="foro-error">No se pudo cargar la galería: ${escapeHtml(err.message)}</p>`;
        return;
      }
    }
    grid.innerHTML = imagesManifestCache.map((src) =>
      `<button type="button" class="image-picker-item" data-src="${src}"><img src="${src}" alt="" loading="lazy"></button>`
    ).join('');
    grid.querySelectorAll('.image-picker-item').forEach((btn) => btn.addEventListener('click', () => {
      document.getElementById('ac-url-portada').value = btn.dataset.src;
      updateImagePreview();
      closeImagePicker();
    }));
  }

  function closeImagePicker() {
    document.getElementById('image-picker-modal').hidden = true;
  }

  async function loadContenidos() {
    const el = document.getElementById('admin-contenidos-list');
    el.innerHTML = '<p class="foro-loading">Cargando...</p>';
    try {
      const data = await apiFetch('/api/contenidos');
      contenidosCache = data.contenidos;
      renderContenidosList();
    } catch (err) {
      el.innerHTML = `<p class="foro-error">${escapeHtml(err.message)}</p>`;
    }
  }

  function renderContenidosList() {
    const el = document.getElementById('admin-contenidos-list');
    const q = (document.getElementById('admin-contenidos-search').value || '').toLowerCase();
    const items = contenidosCache.filter((c) => c.titulo.toLowerCase().includes(q));
    el.innerHTML = items.length ? items.map((c) => `
      <div class="admin-item">
        <div class="admin-item-info">
          <strong>${escapeHtml(c.titulo)}${c.destacado ? ' <span class="foro-badge">★ Destacado</span>' : ''}</strong>
          <span class="foro-meta">${SECCION_LABEL[c.seccion] || c.seccion} · ${TIPO_LABEL[c.tipo_formato] || c.tipo_formato} · ${escapeHtml(String(c.fecha_publicacion).slice(0, 10))}</span>
        </div>
        <div class="admin-item-actions">
          <button type="button" class="admin-btn-edit" data-id="${c.id}">Editar</button>
          <button type="button" class="admin-btn-delete foro-danger" data-id="${c.id}">Eliminar</button>
        </div>
      </div>`).join('') : '<p class="foro-empty">Sin resultados.</p>';

    el.querySelectorAll('.admin-btn-edit').forEach((btn) => btn.addEventListener('click', () => {
      const item = contenidosCache.find((c) => c.id === btn.dataset.id);
      if (item) openContenidoForm(item);
    }));
    el.querySelectorAll('.admin-btn-delete').forEach((btn) => btn.addEventListener('click', () => deleteContenido(btn.dataset.id)));
  }

  function openContenidoForm(item) {
    document.getElementById('admin-contenidos-form-title').textContent = item ? 'Editar contenido' : 'Nuevo contenido';
    document.getElementById('ac-id').value = item?.id || '';
    document.getElementById('ac-seccion').value = item?.seccion || 'noticias';
    document.getElementById('ac-tipo-formato').value = item?.tipo_formato || 'noticia';
    document.getElementById('ac-categoria').value = item?.categoria || 'general';
    document.getElementById('ac-titulo').value = item?.titulo || '';
    document.getElementById('ac-subtitulo').value = item?.subtitulo_resumen || '';
    document.getElementById('ac-cuerpo').value = item?.cuerpo || '';
    document.getElementById('ac-autor').value = item?.autor || '';
    document.getElementById('ac-subformato').value = item?.subformato || '';
    document.getElementById('ac-divulgacion-ia').value = item?.divulgacion_ia || 'no';
    document.getElementById('ac-url-media').value = item?.url_media || '';
    document.getElementById('ac-fuente-url').value = item?.fuente_url || '';
    document.getElementById('ac-fuente-texto').value = item?.fuente_texto || '';
    document.getElementById('ac-duracion').value = item?.duracion_min || 1;
    document.getElementById('ac-url-portada').value = item?.url_portada || '';
    document.getElementById('ac-portada-alt').value = item?.portada_alt || '';
    document.getElementById('ac-fecha').value = item?.fecha_publicacion ? String(item.fecha_publicacion).slice(0, 10) : '';
    document.getElementById('ac-destacado').checked = Boolean(item?.destacado);
    document.getElementById('ac-cita-sin-fuente').checked = Boolean(item?.cita_sin_fuente_externa);
    document.getElementById('ac-cita-estilo').value = item?.cita_estilo || '';
    document.getElementById('ac-cita-autor').value = item?.cita_autor || '';
    document.getElementById('ac-cita-anio').value = item?.cita_anio || '';
    document.getElementById('ac-cita-titulo-original').value = item?.cita_titulo_original || '';
    document.getElementById('ac-cita-fecha-acceso').value = item?.cita_fecha_acceso
      ? String(item.cita_fecha_acceso).slice(0, 10)
      : (item ? '' : new Date().toISOString().slice(0, 10));
    toggleCitationFields();
    updateCitationPreview();
    updateImagePreview();
    setStatus(document.getElementById('ac-status'), '', '');
    document.getElementById('admin-contenidos-form-box').style.display = 'block';
    document.getElementById('admin-contenidos-form-box').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function closeContenidoForm() {
    document.getElementById('admin-contenidos-form-box').style.display = 'none';
    document.getElementById('admin-contenidos-form').reset();
    updateImagePreview();
  }

  async function submitContenido(e) {
    e.preventDefault();
    const statusEl = document.getElementById('ac-status');
    const id = document.getElementById('ac-id').value;
    const sinFuente = document.getElementById('ac-cita-sin-fuente').checked;
    const body = {
      seccion: document.getElementById('ac-seccion').value,
      tipoFormato: document.getElementById('ac-tipo-formato').value,
      categoria: document.getElementById('ac-categoria').value,
      titulo: document.getElementById('ac-titulo').value.trim(),
      subtituloResumen: document.getElementById('ac-subtitulo').value.trim(),
      cuerpo: document.getElementById('ac-cuerpo').value.trim() || null,
      autor: document.getElementById('ac-autor').value.trim() || null,
      subformato: document.getElementById('ac-subformato').value || null,
      divulgacionIa: document.getElementById('ac-divulgacion-ia').value,
      urlMedia: document.getElementById('ac-url-media').value.trim() || null,
      fuenteUrl: document.getElementById('ac-fuente-url').value.trim() || null,
      fuenteTexto: document.getElementById('ac-fuente-texto').value.trim() || null,
      duracionMin: Number(document.getElementById('ac-duracion').value),
      urlPortada: document.getElementById('ac-url-portada').value.trim(),
      portadaAlt: document.getElementById('ac-portada-alt').value.trim(),
      fechaPublicacion: document.getElementById('ac-fecha').value,
      destacado: document.getElementById('ac-destacado').checked,
      citaSinFuenteExterna: sinFuente,
      citaEstilo: sinFuente ? null : (document.getElementById('ac-cita-estilo').value || null),
      citaAutor: sinFuente ? null : (document.getElementById('ac-cita-autor').value.trim() || null),
      citaAnio: sinFuente ? null : (document.getElementById('ac-cita-anio').value.trim() || null),
      citaTituloOriginal: sinFuente ? null : (document.getElementById('ac-cita-titulo-original').value.trim() || null),
      citaFechaAcceso: sinFuente ? null : (document.getElementById('ac-cita-fecha-acceso').value || null),
    };
    setStatus(statusEl, 'info', 'Guardando...');
    try {
      if (id) {
        await apiFetch(`/api/contenidos/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await apiFetch('/api/contenidos', { method: 'POST', body: JSON.stringify(body) });
      }
      closeContenidoForm();
      loadContenidos();
    } catch (err) {
      setStatus(statusEl, 'error', '' + err.message);
    }
  }

  async function deleteContenido(id) {
    if (!confirm('¿Eliminar este contenido? Esta acción no se puede deshacer.')) return;
    try {
      await apiFetch(`/api/contenidos/${encodeURIComponent(id)}`, { method: 'DELETE' });
      loadContenidos();
    } catch (err) {
      alert('' + err.message);
    }
  }

  // ── PRODUCTOS ────────────────────────────────────────────
  function bindProductos() {
    document.getElementById('admin-productos-new').addEventListener('click', () => openProductoForm());
    document.getElementById('ap-cancel').addEventListener('click', closeProductoForm);
    document.getElementById('admin-productos-search').addEventListener('input', renderProductosList);
    document.getElementById('admin-productos-form').addEventListener('submit', submitProducto);
  }

  async function loadProductos() {
    const el = document.getElementById('admin-productos-list');
    el.innerHTML = '<p class="foro-loading">Cargando...</p>';
    try {
      const data = await apiFetch('/api/productos');
      productosCache = data.productos;
      renderProductosList();
    } catch (err) {
      el.innerHTML = `<p class="foro-error">${escapeHtml(err.message)}</p>`;
    }
  }

  function renderProductosList() {
    const el = document.getElementById('admin-productos-list');
    const q = (document.getElementById('admin-productos-search').value || '').toLowerCase();
    const items = productosCache.filter((p) => p.nombre.toLowerCase().includes(q));
    el.innerHTML = items.length ? items.map((p) => `
      <div class="admin-item">
        <div class="admin-item-info">
          <strong>${escapeHtml(p.nombre)}</strong>
          <span class="foro-meta">$${Number(p.precio).toFixed(2)} · ${p.disponible ? 'disponible' : 'oculto'}</span>
        </div>
        <div class="admin-item-actions">
          <button type="button" class="admin-btn-edit" data-id="${p.id}">Editar</button>
          <button type="button" class="admin-btn-delete foro-danger" data-id="${p.id}">Eliminar</button>
        </div>
      </div>`).join('') : '<p class="foro-empty">Sin resultados.</p>';

    el.querySelectorAll('.admin-btn-edit').forEach((btn) => btn.addEventListener('click', () => {
      const item = productosCache.find((p) => p.id === btn.dataset.id);
      if (item) openProductoForm(item);
    }));
    el.querySelectorAll('.admin-btn-delete').forEach((btn) => btn.addEventListener('click', () => deleteProducto(btn.dataset.id)));
  }

  function openProductoForm(item) {
    document.getElementById('admin-productos-form-title').textContent = item ? 'Editar producto' : 'Nuevo producto';
    document.getElementById('ap-id').value = item?.id || '';
    document.getElementById('ap-nombre').value = item?.nombre || '';
    document.getElementById('ap-descripcion').value = item?.descripcion || '';
    document.getElementById('ap-precio').value = item?.precio ?? '';
    document.getElementById('ap-imagen').value = item?.imagen || '';
    document.getElementById('ap-imagen-alt').value = item?.imagen_alt || '';
    document.getElementById('ap-stripe-link').value = item?.stripe_link || '';
    document.getElementById('ap-disponible').checked = item ? !!item.disponible : true;
    setStatus(document.getElementById('ap-status'), '', '');
    document.getElementById('admin-productos-form-box').style.display = 'block';
    document.getElementById('admin-productos-form-box').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function closeProductoForm() {
    document.getElementById('admin-productos-form-box').style.display = 'none';
    document.getElementById('admin-productos-form').reset();
  }

  async function submitProducto(e) {
    e.preventDefault();
    const statusEl = document.getElementById('ap-status');
    const id = document.getElementById('ap-id').value;
    const body = {
      nombre: document.getElementById('ap-nombre').value.trim(),
      descripcion: document.getElementById('ap-descripcion').value.trim(),
      precio: Number(document.getElementById('ap-precio').value),
      imagen: document.getElementById('ap-imagen').value.trim(),
      imagenAlt: document.getElementById('ap-imagen-alt').value.trim(),
      stripeLink: document.getElementById('ap-stripe-link').value.trim() || null,
      disponible: document.getElementById('ap-disponible').checked,
    };
    setStatus(statusEl, 'info', 'Guardando...');
    try {
      if (id) {
        await apiFetch(`/api/productos/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await apiFetch('/api/productos', { method: 'POST', body: JSON.stringify(body) });
      }
      closeProductoForm();
      loadProductos();
    } catch (err) {
      setStatus(statusEl, 'error', '' + err.message);
    }
  }

  async function deleteProducto(id) {
    if (!confirm('¿Eliminar este producto? Esta acción no se puede deshacer.')) return;
    try {
      await apiFetch(`/api/productos/${encodeURIComponent(id)}`, { method: 'DELETE' });
      loadProductos();
    } catch (err) {
      alert('' + err.message);
    }
  }

  // ── UTILIDADES ───────────────────────────────────────────
  function setStatus(el, type, msg) {
    if (!el) return;
    el.textContent = msg;
    el.className = 'form-status ' + type;
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
  }
})();
