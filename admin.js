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
  let reportesCache = [];

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
    bindUrlNormalizer();
    loadNoticias();
    loadContenidos();
    loadProductos();
    loadReportes();
  }

  // Los campos type="url" exigen un esquema completo (https://...) para que
  // el navegador deje enviar el formulario. En vez de que el admin tenga que
  // recordar escribirlo siempre, al salir del campo se le agrega solo si
  // falta — así "sabiasquepr.com" se completa a "https://sabiasquepr.com".
  function bindUrlNormalizer() {
    document.querySelectorAll('#admin-panel input[type="url"]').forEach((input) => {
      input.addEventListener('blur', () => {
        const v = input.value.trim();
        if (v && !/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) input.value = 'https://' + v;
      });
    });
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
        document.getElementById('admin-panel-reportes').style.display = tab === 'reportes' ? '' : 'none';
      });
    });
  }

  // ── NOTICIAS ─────────────────────────────────────────────
  function bindNoticias() {
    document.getElementById('admin-noticias-new').addEventListener('click', () => openNoticiaForm());
    document.getElementById('an-cancel').addEventListener('click', closeNoticiaForm);
    document.getElementById('admin-noticias-search').addEventListener('input', renderNoticiasList);
    document.getElementById('admin-noticias-form').addEventListener('submit', submitNoticia);
    bindImagePicker('an-imagen', 'an-imagen-preview', 'an-elegir-imagen');
    document.getElementById('an-autocompletar-ia').addEventListener('click', autocompletarNoticiaConIA);
  }

  // Pide al backend que descargue el articulo de la URL y lo redacte con
  // Claude (endpoint protegido, la llave nunca llega al navegador). Nunca
  // guarda nada solo -- rellena el formulario para que el admin revise.
  async function autocompletarNoticiaConIA() {
    const statusEl = document.getElementById('an-autocompletar-status');
    const url = document.getElementById('an-autocompletar-url').value.trim();
    if (!url) { statusEl.textContent = 'Pega primero la URL del artículo original.'; return; }
    statusEl.textContent = 'Leyendo el artículo y redactando con IA... (puede tardar unos segundos)';
    try {
      const data = await apiFetch('/api/admin/autocompletar-ia', { method: 'POST', body: JSON.stringify({ url }) });
      document.getElementById('an-titulo').value = data.titulo || '';
      document.getElementById('an-parrafos').value = [data.subtituloResumen, ...(data.parrafos || [])].filter(Boolean).join('\n');
      document.getElementById('an-fuente-url').value = url;
      document.getElementById('an-fuente-texto').value = data.fuenteTexto || '';
      document.getElementById('an-divulgacion-ia').value = 'parcial';
      document.getElementById('an-publicado').checked = false;
      statusEl.textContent = 'Listo — se guardó como borrador (sin publicar). Revisa el texto, elige categoría, fecha e imagen, y marca "Publicado" cuando esté listo.';
    } catch (err) {
      statusEl.textContent = 'No se pudo autocompletar: ' + err.message;
    }
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
          <strong>${escapeHtml(n.titulo)}${n.destacado ? ' <span class="foro-badge">★ Destacada</span>' : ''}${n.publicado === false ? ' <span class="foro-badge foro-badge-borrador">Borrador</span>' : ''}</strong>
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
    document.getElementById('an-divulgacion-ia').value = item?.divulgacion_ia || 'no';
    document.getElementById('an-destacado').checked = Boolean(item?.destacado);
    document.getElementById('an-publicado').checked = item ? Boolean(item.publicado) : true;
    document.getElementById('an-autocompletar-url').value = '';
    updateImagePreview('an-imagen', 'an-imagen-preview');
    setStatus(document.getElementById('an-status'), '', '');
    document.getElementById('admin-noticias-form-box').style.display = 'block';
    document.getElementById('admin-noticias-form-box').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function closeNoticiaForm() {
    document.getElementById('admin-noticias-form-box').style.display = 'none';
    document.getElementById('admin-noticias-form').reset();
    updateImagePreview('an-imagen', 'an-imagen-preview');
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
      divulgacionIa: document.getElementById('an-divulgacion-ia').value,
      destacado: document.getElementById('an-destacado').checked,
      publicado: document.getElementById('an-publicado').checked,
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
  const TIPO_LABEL = { video: 'Video', audio: 'Audio', foto: 'Foto', ensayo: 'Ensayo', noticia: 'Noticia', lectura_corta: 'Lectura corta' };

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
      updateImagePreview('ac-url-portada', 'ac-url-portada-preview');
    });
    bindImagePicker('ac-url-portada', 'ac-url-portada-preview', 'ac-elegir-imagen');
    document.getElementById('ac-autocompletar-youtube').addEventListener('click', autocompletarYoutube);
    document.getElementById('ac-elegir-video-canal').addEventListener('click', abrirSelectorCanalYoutube);
    document.getElementById('youtube-picker-close').addEventListener('click', cerrarSelectorCanalYoutube);
    document.getElementById('youtube-picker-modal').addEventListener('click', (e) => {
      if (e.target.id === 'youtube-picker-modal') cerrarSelectorCanalYoutube();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !document.getElementById('youtube-picker-modal').hidden) cerrarSelectorCanalYoutube();
    });

    document.getElementById('ac-cita-sin-fuente').addEventListener('change', () => { toggleCitationFields(); updateCitationPreview(); });
    ['ac-cita-estilo', 'ac-cita-autor', 'ac-cita-anio', 'ac-cita-titulo-original', 'ac-cita-fecha-acceso', 'ac-fuente-texto', 'ac-fuente-url']
      .forEach((id) => document.getElementById(id).addEventListener('input', updateCitationPreview));

    document.querySelectorAll('[data-revisar]').forEach((btn) => btn.addEventListener('click', () => {
      revisarTexto(btn.dataset.revisar, btn.dataset.revisar + '-suggestions');
    }));
  }

  // Revisión ortográfica/gramatical con LanguageTool (API pública gratuita,
  // detecta idioma automáticamente). El corrector nativo del navegador
  // (spellcheck="true") queda siempre activo aparte, sin necesidad de JS.
  async function revisarTexto(textareaId, resultsId) {
    const ta = document.getElementById(textareaId);
    const ul = document.getElementById(resultsId);
    ul.innerHTML = '<li class="foro-loading">Revisando...</li>';
    try {
      const res = await fetch('https://api.languagetool.org/v2/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ text: ta.value, language: 'auto' }),
      });
      const data = await res.json();
      const matches = data.matches || [];
      if (!matches.length) { ul.innerHTML = '<li class="foro-empty">Sin sugerencias.</li>'; return; }
      ul.innerHTML = matches.map((m) => {
        const snippet = ta.value.slice(m.offset, m.offset + m.length);
        const repl = (m.replacements || [])[0] && m.replacements[0].value;
        const btn = repl
          ? `<button type="button" data-offset="${m.offset}" data-length="${m.length}" data-replacement="${escapeHtml(repl)}" data-target="${textareaId}" data-results="${resultsId}">Usar "${escapeHtml(repl)}"</button>`
          : '';
        return `<li class="suggestion-item">"<mark>${escapeHtml(snippet)}</mark>" — ${escapeHtml(m.message)}${btn}</li>`;
      }).join('');
      ul.querySelectorAll('button[data-offset]').forEach((b) => b.addEventListener('click', () => {
        const input = document.getElementById(b.dataset.target);
        const offset = Number(b.dataset.offset);
        const length = Number(b.dataset.length);
        input.value = input.value.slice(0, offset) + b.dataset.replacement + input.value.slice(offset + length);
        // Los demas offsets de esta lista quedan invalidos tras editar el texto.
        document.getElementById(b.dataset.results).innerHTML = '<li class="foro-empty">Texto actualizado — vuelve a revisar si quieres seguir corrigiendo.</li>';
      }));
    } catch (err) {
      ul.innerHTML = `<li class="foro-error">No se pudo revisar: ${escapeHtml(err.message)}</li>`;
    }
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

  // Selector visual de imágenes, compartido entre Noticias y Contenidos:
  // cada formulario llama bindImagePicker(inputId, previewId, botonId) una
  // vez; el modal (uno solo en la página) recuerda a qué campo debe escribir
  // el resultado mientras esté abierto.
  let currentImageTarget = null;
  let imagesManifestCache = null;
  let imagePickerModalBound = false;

  function bindImagePicker(inputId, previewId, buttonId) {
    document.getElementById(inputId).addEventListener('input', () => updateImagePreview(inputId, previewId));
    document.getElementById(buttonId).addEventListener('click', () => openImagePicker(inputId, previewId));
    if (!imagePickerModalBound) {
      imagePickerModalBound = true;
      document.getElementById('image-picker-close').addEventListener('click', closeImagePicker);
      document.getElementById('image-picker-modal').addEventListener('click', (e) => {
        if (e.target.id === 'image-picker-modal') closeImagePicker();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !document.getElementById('image-picker-modal').hidden) closeImagePicker();
      });
    }
  }

  function updateImagePreview(inputId, previewId) {
    const src = document.getElementById(inputId).value.trim();
    const preview = document.getElementById(previewId);
    if (src) { preview.src = src; preview.hidden = false; } else { preview.hidden = true; preview.src = ''; }
  }

  async function openImagePicker(inputId, previewId) {
    currentImageTarget = { inputId, previewId };
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
      if (!currentImageTarget) return;
      document.getElementById(currentImageTarget.inputId).value = btn.dataset.src;
      updateImagePreview(currentImageTarget.inputId, currentImageTarget.previewId);
      closeImagePicker();
    }));
  }

  function closeImagePicker() {
    document.getElementById('image-picker-modal').hidden = true;
  }

  // Extrae el ID de video de cualquier formato de enlace de YouTube
  // (watch?v=, youtu.be/, embed/, shorts/) para poder normalizar a la URL
  // embebible que usa el reproductor en linea (.card-play).
  function extraerYoutubeId(url) {
    const patrones = [
      /youtube\.com\/watch\?v=([\w-]{11})/,
      /youtu\.be\/([\w-]{11})/,
      /youtube\.com\/embed\/([\w-]{11})/,
      /youtube\.com\/shorts\/([\w-]{11})/,
    ];
    for (const p of patrones) {
      const m = url.match(p);
      if (m) return m[1];
    }
    return null;
  }

  // Rellena titulo/portada/fuente desde el oembed publico de YouTube (sin
  // llave de API, gratis). NO toca el resumen (ac-subtitulo) a proposito --
  // esa redaccion original la escribe el admin, incluso cuando el video es
  // de otro canal (ver ac-fuente-texto/ac-fuente-url, que si se rellenan
  // con el canal real para dar credito correcto).
  async function autocompletarYoutube() {
    const statusEl = document.getElementById('ac-youtube-status');
    const raw = document.getElementById('ac-url-media').value.trim();
    const id = extraerYoutubeId(raw);
    if (!id) {
      statusEl.textContent = 'Pega un enlace valido de YouTube primero (watch, youtu.be, embed o shorts).';
      return;
    }
    statusEl.textContent = 'Buscando datos del video...';
    try {
      const watchUrl = `https://www.youtube.com/watch?v=${id}`;
      const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`);
      if (!res.ok) throw new Error('No se encontro ese video (¿es privado o fue eliminado?).');
      const data = await res.json();

      document.getElementById('ac-url-media').value = `https://www.youtube.com/embed/${id}`;
      document.getElementById('ac-tipo-formato').value = 'video';
      if (!document.getElementById('ac-titulo').value.trim()) document.getElementById('ac-titulo').value = data.title || '';
      if (!document.getElementById('ac-fuente-texto').value.trim()) document.getElementById('ac-fuente-texto').value = data.author_name || '';
      if (!document.getElementById('ac-fuente-url').value.trim()) document.getElementById('ac-fuente-url').value = data.author_url || watchUrl;
      if (!document.getElementById('ac-url-portada').value.trim() && data.thumbnail_url) {
        document.getElementById('ac-url-portada').value = data.thumbnail_url;
        updateImagePreview('ac-url-portada', 'ac-url-portada-preview');
      }
      if (!document.getElementById('ac-portada-alt').value.trim()) document.getElementById('ac-portada-alt').value = data.title || '';
      statusEl.textContent = `Listo: "${data.title}" — canal ${data.author_name}. Revisa los campos y escribe tu resumen antes de guardar.`;
    } catch (err) {
      statusEl.textContent = 'No se pudo autocompletar: ' + err.message;
    }
  }

  // ── Selector del canal propio de YouTube (@sabiasquePR) ──────
  // Usa una llave de API de Google restringida por dominio (segura para
  // exponer en el navegador). No requiere que el admin inicie sesion en
  // YouTube -- solo lee datos publicos del canal.
  const YOUTUBE_HANDLE = 'sabiasquePR';
  let youtubeVideosCache = null;

  async function abrirSelectorCanalYoutube() {
    const grid = document.getElementById('youtube-picker-grid');
    document.getElementById('youtube-picker-modal').hidden = false;
    const apiKey = window.SITE_CONFIG && window.SITE_CONFIG.youtubeApiKey;
    if (!apiKey) {
      grid.innerHTML = '<p class="foro-error">No hay una llave de YouTube configurada (YOUTUBE_API_KEY). Pídele a tu administrador de infraestructura que la agregue.</p>';
      return;
    }
    if (!youtubeVideosCache) {
      grid.innerHTML = '<p class="foro-loading">Cargando videos del canal...</p>';
      try {
        youtubeVideosCache = await cargarVideosDelCanal(apiKey);
      } catch (err) {
        grid.innerHTML = `<p class="foro-error">No se pudo cargar el canal: ${escapeHtml(err.message)}</p>`;
        return;
      }
    }
    if (!youtubeVideosCache.length) {
      grid.innerHTML = '<p class="foro-empty">El canal no tiene videos públicos.</p>';
      return;
    }
    grid.innerHTML = youtubeVideosCache.map((v) => `
      <button type="button" class="image-picker-item" data-id="${v.id}" data-titulo="${escapeHtml(v.titulo)}" data-thumb="${v.miniatura}">
        <img src="${v.miniatura}" alt="" loading="lazy">
        <span class="image-picker-item-title">${escapeHtml(v.titulo)}</span>
      </button>`).join('');
    grid.querySelectorAll('.image-picker-item').forEach((btn) => btn.addEventListener('click', () => {
      document.getElementById('ac-url-media').value = `https://www.youtube.com/embed/${btn.dataset.id}`;
      document.getElementById('ac-tipo-formato').value = 'video';
      if (!document.getElementById('ac-titulo').value.trim()) document.getElementById('ac-titulo').value = btn.dataset.titulo;
      if (!document.getElementById('ac-fuente-texto').value.trim()) document.getElementById('ac-fuente-texto').value = 'Did U Know? PR';
      if (!document.getElementById('ac-fuente-url').value.trim()) document.getElementById('ac-fuente-url').value = `https://www.youtube.com/@${YOUTUBE_HANDLE}`;
      if (!document.getElementById('ac-url-portada').value.trim()) {
        document.getElementById('ac-url-portada').value = btn.dataset.thumb;
        updateImagePreview('ac-url-portada', 'ac-url-portada-preview');
      }
      if (!document.getElementById('ac-portada-alt').value.trim()) document.getElementById('ac-portada-alt').value = btn.dataset.titulo;
      cerrarSelectorCanalYoutube();
    }));
  }

  async function cargarVideosDelCanal(apiKey) {
    const canalRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails&forHandle=${YOUTUBE_HANDLE}&key=${apiKey}`);
    const canalData = await canalRes.json();
    if (!canalRes.ok) throw new Error(canalData.error?.message || `Error de YouTube (HTTP ${canalRes.status}).`);
    const uploadsId = canalData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsId) throw new Error('No se encontró el canal.');

    const videosRes = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${uploadsId}&key=${apiKey}`);
    const videosData = await videosRes.json();
    if (!videosRes.ok) throw new Error(videosData.error?.message || `Error de YouTube (HTTP ${videosRes.status}).`);

    return (videosData.items || []).map((item) => ({
      id: item.snippet.resourceId.videoId,
      titulo: item.snippet.title,
      miniatura: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
    }));
  }

  function cerrarSelectorCanalYoutube() {
    document.getElementById('youtube-picker-modal').hidden = true;
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
    document.getElementById('ac-subseccion').value = item?.subseccion || '';
    document.getElementById('ac-enfoque').value = item?.enfoque || '';
    document.getElementById('ac-premium').checked = Boolean(item?.es_premium);
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
    updateImagePreview('ac-url-portada', 'ac-url-portada-preview');
    setStatus(document.getElementById('ac-status'), '', '');
    document.getElementById('admin-contenidos-form-box').style.display = 'block';
    document.getElementById('admin-contenidos-form-box').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function closeContenidoForm() {
    document.getElementById('admin-contenidos-form-box').style.display = 'none';
    document.getElementById('admin-contenidos-form').reset();
    updateImagePreview('ac-url-portada', 'ac-url-portada-preview');
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
      subseccion: document.getElementById('ac-subseccion').value || null,
      enfoque: document.getElementById('ac-enfoque').value || null,
      esPremium: document.getElementById('ac-premium').checked,
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
    document.getElementById('ap-stripe-price-id').value = item?.stripe_price_id || '';
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
      stripePriceId: document.getElementById('ap-stripe-price-id').value.trim() || null,
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

  // ── REPORTES (debate de Corrupción Humana) ────────────────
  const REPORTE_TIPO_LABEL = { debate_post: 'Publicación', debate_comentario: 'Comentario' };
  const REPORTE_ESTADO_LABEL = { pendiente: 'Pendiente', revisado: 'Revisado', descartado: 'Descartado' };

  async function loadReportes() {
    const el = document.getElementById('admin-reportes-list');
    el.innerHTML = '<p class="foro-loading">Cargando...</p>';
    try {
      const data = await apiFetch('/api/reportes');
      reportesCache = data.reportes;
      renderReportesList();
    } catch (err) {
      el.innerHTML = `<p class="foro-error">${escapeHtml(err.message)}</p>`;
    }
  }

  function renderReportesList() {
    const el = document.getElementById('admin-reportes-list');
    el.innerHTML = reportesCache.length ? reportesCache.map((r) => `
      <div class="admin-item">
        <div class="admin-item-info">
          <strong>${REPORTE_TIPO_LABEL[r.tipo] || r.tipo} reportada por ${escapeHtml(r.reportado_por_email)}</strong>
          <span class="foro-badge${r.estado === 'pendiente' ? '' : ' foro-badge-borrador'}">${REPORTE_ESTADO_LABEL[r.estado] || r.estado}</span>
          <span class="foro-meta">${escapeHtml(r.motivo)}</span>
        </div>
        <div class="admin-item-actions">
          <button type="button" class="admin-btn-edit" data-accion="revisado" data-id="${r.id}">Marcar revisado</button>
          <button type="button" class="admin-btn-edit" data-accion="descartado" data-id="${r.id}">Descartar</button>
          <button type="button" class="admin-btn-delete foro-danger" data-tipo="${r.tipo}" data-item="${r.item_id}" data-reporte="${r.id}">Eliminar contenido</button>
        </div>
      </div>`).join('') : '<p class="foro-empty">Sin reportes.</p>';

    el.querySelectorAll('[data-accion]').forEach((btn) => btn.addEventListener('click', () => {
      actualizarEstadoReporte(btn.dataset.id, btn.dataset.accion);
    }));
    el.querySelectorAll('.admin-btn-delete[data-tipo]').forEach((btn) => btn.addEventListener('click', () => {
      eliminarContenidoReportado(btn.dataset.tipo, btn.dataset.item, btn.dataset.reporte);
    }));
  }

  async function actualizarEstadoReporte(id, estado) {
    try {
      await apiFetch(`/api/reportes/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ estado }) });
      loadReportes();
    } catch (err) {
      alert('' + err.message);
    }
  }

  async function eliminarContenidoReportado(tipo, itemId, reporteId) {
    if (!confirm('¿Eliminar esta publicación/comentario del debate? Esta acción no se puede deshacer.')) return;
    const endpoint = tipo === 'debate_post'
      ? `/api/foro/posts/${encodeURIComponent(itemId)}`
      : `/api/foro/comentarios/${encodeURIComponent(itemId)}`;
    try {
      await apiFetch(endpoint, { method: 'DELETE' });
      await apiFetch(`/api/reportes/${encodeURIComponent(reporteId)}`, { method: 'PATCH', body: JSON.stringify({ estado: 'revisado' }) });
      loadReportes();
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
