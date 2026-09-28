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
      // Si se cierra sesion (aqui o en otra pestana) mientras el panel esta
      // abierto, hay que volver a tapar el contenido -- init() solo corre
      // una vez al cargar la pagina, sin esto el admin-panel se queda
      // visible en el DOM (con datos ya cargados) despues del logout.
      supabase.auth.onAuthStateChange((_event, sesionActual) => {
        if (!sesionActual) cerrarPanelPorLogout();
      });
    } catch (err) {
      showGate('⚠️ No se pudo verificar tu sesión: ' + err.message);
      return;
    }

    if (!currentUser) {
      showGate('<a href="#" class="login-modal-trigger">Inicia sesión</a> para acceder al panel de administración.');
      return;
    }

    let rol;
    try {
      const data = await apiFetch('/api/me');
      rol = data.user.rol;
      if (!['admin', 'moderador'].includes(rol)) {
        showGate('⛔ Tu cuenta no tiene permisos de administrador ni de moderador.');
        return;
      }
    } catch (err) {
      showGate('⚠️ ' + err.message);
      return;
    }

    document.getElementById('admin-gate').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'block';
    bindTabs();
    bindAgentes();
    bindAyuda();
    loadReportes();
    loadEstadoSeguridad();
    loadUsoIa();

    if (rol === 'admin') {
      bindNoticias();
      bindContenidos();
      bindProductos();
      bindUrlNormalizer();
      loadNoticias();
      loadContenidos();
      loadProductos();
    } else {
      // Moderador: sin acceso a gestion de contenido editorial (el backend
      // ya lo rechaza igual, esto solo evita mostrar tabs que no puede usar).
      document.querySelectorAll('.admin-tabs [data-tab="noticias"], .admin-tabs [data-tab="contenidos"], .admin-tabs [data-tab="productos"]')
        .forEach((btn) => { btn.style.display = 'none'; });
      activarTab('reportes');
    }
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

  // Vuelve a tapar el panel cuando la sesion desaparece (logout, token
  // expirado, o sesion cerrada en otra pestana). Limpia las listas ya
  // cargadas -- no basta con ocultar el div, los datos de admin no deben
  // quedarse en el DOM despues de cerrar sesion.
  function cerrarPanelPorLogout() {
    currentUser = null;
    document.getElementById('admin-panel').style.display = 'none';
    const gate = document.getElementById('admin-gate');
    if (gate) gate.style.display = '';
    showGate('<a href="#" class="login-modal-trigger">Inicia sesión</a> para acceder al panel de administración.');
    ['admin-noticias-list', 'admin-contenidos-list', 'admin-productos-list', 'admin-reportes-list'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '';
    });
    noticiasCache = [];
    productosCache = [];
    contenidosCache = [];
    reportesCache = [];
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
  function activarTab(tab) {
    document.querySelectorAll('.admin-tabs .foro-filter-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    document.getElementById('admin-panel-noticias').style.display = tab === 'noticias' ? '' : 'none';
    document.getElementById('admin-panel-contenidos').style.display = tab === 'contenidos' ? '' : 'none';
    document.getElementById('admin-panel-productos').style.display = tab === 'productos' ? '' : 'none';
    document.getElementById('admin-panel-reportes').style.display = tab === 'reportes' ? '' : 'none';
    document.getElementById('admin-panel-agentes').style.display = tab === 'agentes' ? '' : 'none';
  }

  function bindTabs() {
    document.querySelectorAll('.admin-tabs .foro-filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => activarTab(btn.dataset.tab));
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
    bindNewsPanels();
  }

  // ── FORMULARIO DE NOTICIAS: NIVELES NEWSROOM ─────────────
  // Mismo patron que activarSynthPanel/bindSynthPanels en Contenidos --
  // acordeon puramente visual, no cambia validacion ni envio del formulario.
  function activarNewsPanel(nombre) {
    document.querySelectorAll('#news-levels .news-level-card').forEach((card) => {
      card.classList.toggle('active', card.dataset.panel === nombre);
    });
    document.querySelectorAll('.news-panel').forEach((panel) => {
      panel.hidden = panel.dataset.panel !== nombre;
    });
  }

  function bindNewsPanels() {
    document.querySelectorAll('#news-levels .news-level-card').forEach((card) => {
      card.addEventListener('click', () => activarNewsPanel(card.dataset.panel));
    });
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
      <div class="news-item">
        <div class="news-item-thumb" style="background-image:url('${escapeHtml(n.imagen || '')}')"></div>
        <div class="news-item-info">
          <strong>${escapeHtml(n.titulo)}</strong>
          <div class="news-item-badges">
            ${n.destacado ? '<span class="news-badge news-badge-destacada">★ Destacada</span>' : ''}
            ${n.publicado === false ? '<span class="news-badge news-badge-borrador">Borrador</span>' : ''}
            <span class="news-badge news-badge-cat">${escapeHtml(n.categoria)}</span>
          </div>
          <span class="news-item-meta">${escapeHtml(n.fecha_display)}</span>
        </div>
        <div class="news-item-actions">
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
    activarNewsPanel('clasificacion');
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
  const SUBSECCION_LABEL = { 'nuevos-humanos': 'Nuevos Humanos', 'revolucion-mundial': 'Revolución Mundial', 'logica-humana': 'Lógica Humana', 'corrupcion-humana': 'Corrupción Humana', 'ilogica-humana': 'Ilógica Humana' };
  // Orden alfabetico de las 4 secciones de Revolucion Humana (mismo criterio
  // usado en rh-subnav), mas Revolucion Mundial al final -- agrupa el acordeon
  // de la lista de Contenidos (ver renderContenidosList).
  const SUBSECCION_ORDEN = ['corrupcion-humana', 'ilogica-humana', 'logica-humana', 'nuevos-humanos', 'revolucion-mundial'];

  // ── "UN FORMULARIO, VARIAS PIELES" ────────────────────────
  // Nuevos Humanos, Corrupcion Humana y Logica Humana ya tienen tema propio
  // (Constelacion / paleta Newsroom / Kintsugi -- este ultimo inspirado en
  // la identidad de Aliado Imperfekto: grieta dorada, "el error se integra,
  // no se esconde"); Educacion tiene el suyo (Biblioteca). Revolucion
  // Mundial y cualquier categoria nueva se quedan en Synthwave (la paleta
  // original, el estandar por defecto). Mismo mapa lo usa el formulario
  // (data-tema en #admin-contenidos-form-box) y cada tarjeta de la lista
  // (.synth-item).
  const TEMA_POR_SUBSECCION = { 'nuevos-humanos': 'constelacion', 'corrupcion-humana': 'corrupcion', 'logica-humana': 'kintsugi' };
  function temaParaClasificacion(seccion, subseccion) {
    if (seccion === 'educacion') return 'biblioteca';
    if (seccion === 'revolucion-humana' && subseccion && TEMA_POR_SUBSECCION[subseccion]) return TEMA_POR_SUBSECCION[subseccion];
    return 'synthwave';
  }
  function actualizarTemaContenidos() {
    const seccion = document.getElementById('ac-seccion').value;
    const subseccion = document.getElementById('ac-subseccion').value;
    const tema = temaParaClasificacion(seccion, subseccion);
    const box = document.getElementById('admin-contenidos-form-box');
    if (tema === 'synthwave') box.removeAttribute('data-tema');
    else box.dataset.tema = tema;
  }

  function bindContenidos() {
    document.getElementById('admin-contenidos-new').addEventListener('click', () => openContenidoForm());
    document.getElementById('ac-cancel').addEventListener('click', closeContenidoForm);
    document.getElementById('admin-contenidos-search').addEventListener('input', renderContenidosList);
    document.getElementById('admin-contenidos-form').addEventListener('submit', submitContenido);
    document.getElementById('ac-seccion').addEventListener('change', actualizarTemaContenidos);
    document.getElementById('ac-subseccion').addEventListener('change', actualizarTemaContenidos);
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

    bindInvestigadorRedactor();
    bindSynthPanels();
  }

  // ── FORMULARIO DE CONTENIDOS: NIVELES SYNTHWAVE ──────────
  // Acordeon puramente visual -- reagrupa los mismos campos/ids de siempre
  // en 5 "niveles"; un panel abierto a la vez. No cambia validacion ni el
  // envio del formulario (submitContenido sigue leyendo los mismos ids).
  function activarSynthPanel(nombre) {
    document.querySelectorAll('#synth-levels .synth-level-card').forEach((card) => {
      card.classList.toggle('active', card.dataset.panel === nombre);
    });
    document.querySelectorAll('.synth-panel').forEach((panel) => {
      panel.hidden = panel.dataset.panel !== nombre;
    });
  }

  function bindSynthPanels() {
    document.querySelectorAll('#synth-levels .synth-level-card').forEach((card) => {
      card.addEventListener('click', () => activarSynthPanel(card.dataset.panel));
    });
  }

  // ── ASISTENTE DE REDACCIÓN: INVESTIGADOR + REDACTOR ──────
  // Mismo patrón de autofill que autocompletarNoticiaConIA, en dos pasos
  // con revisión humana en medio. Nunca guarda ni publica nada -- solo
  // llena los campos del formulario de Contenidos que el admin ya tiene
  // abierto (la clasificación -- sección/sub-sección/enfoque/categoría --
  // la elige el admin en los <select> de arriba, la IA no la adivina).
  function bindInvestigadorRedactor() {
    document.querySelectorAll('#ia-fuente-toggle .foro-filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#ia-fuente-toggle .foro-filter-btn').forEach((b) => b.classList.toggle('active', b === btn));
        const esUrl = btn.dataset.fuente === 'url';
        document.getElementById('ia-fuente-url-box').style.display = esUrl ? '' : 'none';
        document.getElementById('ia-fuente-texto-box').style.display = esUrl ? 'none' : '';
      });
    });

    document.getElementById('ia-investigar-btn').addEventListener('click', investigarFuente);
    document.getElementById('ia-redactar-btn').addEventListener('click', redactarConIA);
  }

  async function investigarFuente() {
    const statusEl = document.getElementById('ia-investigar-status');
    const esUrl = document.querySelector('#ia-fuente-toggle .foro-filter-btn.active').dataset.fuente === 'url';
    const usarBusquedaWeb = document.getElementById('ia-usar-busqueda').checked;
    const body = { usarBusquedaWeb };
    if (esUrl) {
      const url = document.getElementById('ia-url').value.trim();
      if (!url) { statusEl.textContent = 'Pega primero la URL de la fuente.'; return; }
      body.url = url;
    } else {
      const texto = document.getElementById('ia-texto').value.trim();
      if (!texto) { statusEl.textContent = 'Pega primero el texto o la transcripción.'; return; }
      body.texto = texto;
      body.tituloSugerido = document.getElementById('ia-titulo-sugerido').value.trim();
    }
    statusEl.textContent = 'Investigando' + (usarBusquedaWeb ? ' (con búsqueda web, puede tardar más)...' : '...');
    try {
      const data = await apiFetch('/api/admin/investigar', { method: 'POST', body: JSON.stringify(body) });
      document.getElementById('ia-notas').value = data.notas || '';
      document.getElementById('ia-notas-box').style.display = '';
      if (data.fuenteUrl) document.getElementById('ac-fuente-url').value = data.fuenteUrl;
      if (data.fuenteTexto) document.getElementById('ac-fuente-texto').value = data.fuenteTexto;
      // Datos de citacion: el Investigador solo los manda si tuvo confianza
      // razonable (nunca inventa autor/año/estilo) -- fecha de acceso queda
      // siempre para que el admin la ponga a mano.
      if (data.tituloOriginal) document.getElementById('ac-cita-titulo-original').value = data.tituloOriginal;
      if (data.citaAutor) document.getElementById('ac-cita-autor').value = data.citaAutor;
      if (data.citaAnio) document.getElementById('ac-cita-anio').value = data.citaAnio;
      if (data.citaEstiloSugerido) document.getElementById('ac-cita-estilo').value = data.citaEstiloSugerido;
      if (data.citaAutor || data.citaAnio || data.citaEstiloSugerido || data.fuenteUrl) {
        document.getElementById('ac-cita-sin-fuente').checked = false;
        toggleCitationFields();
        updateCitationPreview();
      }
      statusEl.textContent = 'Listo — revisa/edita las notas y la citación, luego dale a "Redactar con IA".';
    } catch (err) {
      statusEl.textContent = 'No se pudo investigar: ' + err.message;
    }
  }

  async function redactarConIA() {
    const statusEl = document.getElementById('ia-redactar-status');
    const notas = document.getElementById('ia-notas').value.trim();
    if (!notas) { statusEl.textContent = 'No hay notas para redactar.'; return; }
    statusEl.textContent = 'Redactando...';
    try {
      const data = await apiFetch('/api/admin/redactar', {
        method: 'POST',
        body: JSON.stringify({
          notas,
          seccion: document.getElementById('ac-seccion').value,
          subseccion: document.getElementById('ac-subseccion').value || null,
          categoria: document.getElementById('ac-categoria').value,
          tipoFormato: document.getElementById('ac-tipo-formato').value,
          estilo: document.getElementById('ia-estilo').value,
          tono: document.getElementById('ia-tono').value,
          fuenteTexto: document.getElementById('ac-fuente-texto').value,
          fuenteUrl: document.getElementById('ac-fuente-url').value,
        }),
      });
      document.getElementById('ac-titulo').value = data.titulo || '';
      document.getElementById('ac-subtitulo').value = data.subtituloResumen || '';
      document.getElementById('ac-cuerpo').value = (data.parrafos || []).join('\n\n');
      if (data.duracionMinEstimado) document.getElementById('ac-duracion').value = data.duracionMinEstimado;
      statusEl.textContent = 'Listo — revisa el título, el resumen y el cuerpo antes de guardar.';
    } catch (err) {
      statusEl.textContent = 'No se pudo redactar: ' + err.message;
    }
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
    if (!items.length) { el.innerHTML = '<p class="foro-empty">Sin resultados.</p>'; return; }

    // Acordeon por subseccion (orden alfabetico de las 4 secciones de
    // Revolucion Humana) -- agrupa visualmente sin tocar loadContenidos()
    // ni el formulario de crear/editar, que siguen igual. Lo que no tiene
    // subseccion se agrupa aparte por SECCION (Educacion, Noticias...) en
    // vez de mezclarse todo en un solo "otros" -- Educacion no usa
    // subseccion (ese campo es propio de Revolucion Humana), no es que le
    // falte clasificar.
    const gruposSubseccion = new Map();
    SUBSECCION_ORDEN.forEach((s) => gruposSubseccion.set(s, []));
    const gruposSeccion = new Map();
    items.forEach((c) => {
      if (c.subseccion && gruposSubseccion.has(c.subseccion)) {
        gruposSubseccion.get(c.subseccion).push(c);
        return;
      }
      const clave = c.seccion || '__sin_seccion';
      if (!gruposSeccion.has(clave)) gruposSeccion.set(clave, []);
      gruposSeccion.get(clave).push(c);
    });
    const seccionEntries = Array.from(gruposSeccion.entries())
      .sort((a, b) => (SECCION_LABEL[a[0]] || a[0]).localeCompare(SECCION_LABEL[b[0]] || b[0], 'es'));
    const grupos = new Map([
      ...gruposSubseccion,
      ...seccionEntries.map(([clave, lista]) => [`seccion:${clave}`, lista]),
    ]);

    const itemHtml = (c) => `
      <div class="synth-item" data-tema="${temaParaClasificacion(c.seccion, c.subseccion)}">
        <div class="synth-item-thumb" style="background-image:url('${escapeHtml(c.url_portada || '')}')"></div>
        <div class="synth-item-info">
          <strong>${escapeHtml(c.titulo)}</strong>
          <div class="synth-item-badges">
            ${c.destacado ? '<span class="synth-badge synth-badge-destacado">★ Destacado</span>' : ''}
            ${c.es_premium ? '<span class="synth-badge synth-badge-premium">💎 Premium</span>' : ''}
            <span class="synth-badge synth-badge-seccion">${SECCION_LABEL[c.seccion] || c.seccion}${c.subseccion ? ' · ' + (SUBSECCION_LABEL[c.subseccion] || c.subseccion) : ''}</span>
            <span class="synth-badge synth-badge-seccion">${TIPO_LABEL[c.tipo_formato] || c.tipo_formato}</span>
          </div>
          <span class="synth-item-meta">${escapeHtml(String(c.fecha_publicacion).slice(0, 10))}</span>
        </div>
        <div class="synth-item-actions">
          <button type="button" class="admin-btn-edit" data-id="${c.id}">Editar</button>
          <button type="button" class="admin-btn-delete foro-danger" data-id="${c.id}">Eliminar</button>
        </div>
      </div>`;

    el.innerHTML = Array.from(grupos.entries())
      .filter(([, lista]) => lista.length)
      .map(([clave, lista]) => {
        const titulo = clave.startsWith('seccion:')
          ? (SECCION_LABEL[clave.slice(8)] || clave.slice(8))
          : (SUBSECCION_LABEL[clave] || clave);
        return `
        <details class="synth-group" open>
          <summary class="synth-group-title">${escapeHtml(titulo)} <span class="synth-group-count">${lista.length}</span></summary>
          <div class="synth-group-items">${lista.map(itemHtml).join('')}</div>
        </details>`;
      }).join('');

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
    actualizarTemaContenidos();
    activarSynthPanel('clasificacion');
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
      <div class="synth-item">
        <div class="synth-item-thumb" style="background-image:url('${escapeHtml(p.imagen || '')}')"></div>
        <div class="synth-item-info">
          <strong>${escapeHtml(p.nombre)}</strong>
          <div class="synth-item-badges">
            <span class="synth-badge synth-badge-premium">$${Number(p.precio).toFixed(2)}</span>
            ${p.disponible ? '' : '<span class="synth-badge synth-badge-destacado">Oculto</span>'}
          </div>
        </div>
        <div class="synth-item-actions">
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
    const resumen = document.getElementById('ag-reportes-resumen');
    if (resumen) {
      const pendientes = reportesCache.filter((r) => r.estado === 'pendiente').length;
      resumen.textContent = pendientes === 0 ? 'Sin pendientes' : `${pendientes} pendiente${pendientes === 1 ? '' : 's'}`;
    }
    el.innerHTML = reportesCache.length ? reportesCache.map((r) => `
      <div class="synth-item">
        <div class="synth-item-info">
          <strong>${REPORTE_TIPO_LABEL[r.tipo] || r.tipo} ${r.automatico ? '— detección automática' : `reportada por ${escapeHtml(r.reportado_por_email)}`}</strong>
          <div class="synth-item-badges">
            <span class="synth-badge ${r.estado === 'pendiente' ? 'synth-badge-destacado' : 'synth-badge-seccion'}">${REPORTE_ESTADO_LABEL[r.estado] || r.estado}</span>
            ${r.automatico ? '<span class="synth-badge synth-badge-destacado">🤖 automático</span>' : ''}
          </div>
          <span class="synth-item-meta">${escapeHtml(r.motivo)}</span>
        </div>
        <div class="synth-item-actions">
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

  // ── AGENTES & MODERACIÓN ─────────────────────────────────
  function bindAgentes() {
    document.getElementById('ag-ir-reportes').addEventListener('click', () => activarTab('reportes'));
    const irAContenidos = () => {
      activarTab('contenidos');
      document.getElementById('admin-contenidos-new').click();
    };
    document.getElementById('ag-ir-contenidos-investigador').addEventListener('click', irAContenidos);
    document.getElementById('ag-ir-contenidos-redactor').addEventListener('click', irAContenidos);
  }

  async function loadUsoIa() {
    try {
      const data = await apiFetch('/api/admin/uso-ia');
      const porAgente = {};
      (data.porAgente || []).forEach((r) => { porAgente[r.agente] = r; });
      const linea = (agente) => {
        const r = porAgente[agente];
        if (!r || !r.llamadas) return 'Sin usos todavía';
        return `${r.llamadas} uso${r.llamadas === 1 ? '' : 's'} · $${r.costo_total.toFixed(3)} acumulado`;
      };
      document.getElementById('ag-ia-investigador-uso').textContent = linea('investigador');
      document.getElementById('ag-ia-redactor-uso').textContent = linea('redactor');
      document.getElementById('ag-ia-costo-mes').textContent = `$${data.costoMesActual.toFixed(3)} este mes`;
    } catch (err) {
      document.getElementById('ag-ia-costo-mes').textContent = 'Error al cargar gasto';
    }
  }

  async function loadEstadoSeguridad() {
    const grid = document.getElementById('ag-seguridad-grid');
    const resumen = document.getElementById('ag-estado-resumen');
    try {
      const data = await apiFetch('/api/admin/estado-seguridad');
      renderEstadoSeguridad(data);
      resumen.textContent = 'Actualizado';
    } catch (err) {
      grid.innerHTML = `<p class="admin-hint">No se pudo cargar el estado: ${escapeHtml(err.message)}</p>`;
      resumen.textContent = 'Error';
    }
  }

  function renderEstadoSeguridad(d) {
    const grid = document.getElementById('ag-seguridad-grid');
    const tile = (key, label, valor, claseValor, desc) => `
      <div class="ag-tile" data-help="${key}">
        <p class="ag-tile-label">${label}</p>
        <p class="ag-tile-valor ${claseValor}">${valor}</p>
        <p class="ag-tile-desc">${desc}</p>
      </div>`;
    grid.innerHTML = [
      tile('turnstile', 'Turnstile', d.turnstileActivo ? 'Activo' : 'Inactivo', d.turnstileActivo ? 'ok' : 'off', 'CAPTCHA invisible en el debate'),
      tile('honeypot', 'Honeypot', 'Activo', 'ok', 'Campo oculto en cada formulario'),
      tile('rate-limit', 'Rate limit', 'Activo', 'ok', `${d.rateLimitConfig.general}/${d.rateLimitConfig.escritura} cada ${d.rateLimitConfig.ventanaMin}min`),
      tile('cooldown', 'Cooldown', d.cooldownActivos, d.cooldownActivos > 0 ? 'warn' : 'ok', `cuentas &lt; ${d.cooldownHoras}h esperando`),
      tile('edad', 'Edad 18+', d.edadConfirmadasTotal, 'ok', 'confirmaciones totales'),
    ].join('');
  }

  // ── AYUDA: tooltips + manual integrado ───────────────────
  // Una sola fuente de datos alimenta el tooltip al pasar el cursor Y el
  // manual completo del boton "?" -- agregar un agente/panel nuevo mas
  // adelante solo necesita una entrada nueva aqui, nada mas se toca.
  const AYUDA = {
    clasificacion: { titulo: 'Clasificación', desc: 'Decide en qué parte del sitio vive este contenido.', incluir: 'Sección, sub-sección (si aplica), enfoque (solo Corrupción Humana), tipo de formato y categoría.', agentivo: false },
    contenido: { titulo: 'Contenido', desc: 'El texto que se publica tal cual, sin editar después.', incluir: 'Título, resumen de 2-3 oraciones, cuerpo (opcional), autor, y si se usó IA.', agentivo: false },
    multimedia: { titulo: 'Multimedia', desc: 'El video/audio embebido y la imagen de portada del contenido.', incluir: 'Enlace de video/audio (si el tipo lo requiere), imagen de portada y su texto alternativo.', agentivo: false },
    ia: { titulo: 'Investigador + Redactor', desc: 'Asistente opcional que organiza una fuente y redacta un primer borrador.', incluir: 'Pega una URL o un texto/transcripción — el resultado llena Título/Resumen/Cuerpo y, si puede, los datos de Citación.', agentivo: true },
    citacion: { titulo: 'Citación', desc: 'De dónde salió la información, para dar crédito correctamente.', incluir: 'URL y nombre de la fuente, autor, año, estilo de citación y fecha de acceso (esta última siempre la pones tú).', agentivo: false },
    turnstile: { titulo: 'Turnstile', desc: 'Verifica que quien publica en el debate es una persona, no un bot.', incluir: null, agentivo: false },
    honeypot: { titulo: 'Honeypot', desc: 'Campo oculto en los formularios que atrapa bots que los llenan automáticamente.', incluir: null, agentivo: false },
    'rate-limit': { titulo: 'Rate limit', desc: 'Evita que una sola cuenta inunde el sitio de solicitudes en poco tiempo.', incluir: null, agentivo: false },
    cooldown: { titulo: 'Cooldown', desc: 'Una cuenta recién creada no puede publicar ni comentar de inmediato.', incluir: null, agentivo: false },
    edad: { titulo: 'Edad 18+', desc: 'Verifica que el usuario autoafirma ser mayor de edad antes de entrar a Corrupción Humana.', incluir: null, agentivo: false },
    investigador: { titulo: 'Investigador', desc: 'Organiza una fuente (URL o texto pegado) en notas de investigación.', incluir: 'Se usa desde el Nivel 4 del formulario de Contenidos.', agentivo: true },
    redactor: { titulo: 'Redactor', desc: 'Escribe el borrador final con el tono propio de cada sección.', incluir: 'Se usa después del Investigador, en el mismo Nivel 4.', agentivo: true },
    reportes: { titulo: 'Moderación · Reportes', desc: 'Cola de publicaciones y comentarios del debate reportados por usuarios.', incluir: null, agentivo: false },
    'noticias-clasificacion': { titulo: 'Clasificación', desc: 'La categoría bajo la que aparece esta noticia.', incluir: 'Categoría (la fecha vive en la barra de publicación, abajo del todo).', agentivo: false },
    'noticias-contenido': { titulo: 'Contenido', desc: 'El texto que se publica tal cual, sin editar después.', incluir: 'Título, párrafos (uno por línea) y si se usó IA.', agentivo: false },
    'noticias-multimedia': { titulo: 'Multimedia', desc: 'La imagen que acompaña la noticia.', incluir: 'Imagen, texto alternativo y pie de imagen (opcional).', agentivo: false },
    'noticias-ia': { titulo: 'Autocompletar con IA', desc: 'Pega la URL del artículo original y la IA redacta un primer borrador completo de una sola vez.', incluir: 'Solo pide la URL — llena título, párrafos y fuente automáticamente; tú revisas antes de publicar.', agentivo: true },
    'noticias-fuente': { titulo: 'Fuente', desc: 'De dónde salió la información original.', incluir: 'URL y nombre de la fuente.', agentivo: false },
    productos: { titulo: 'Productos', desc: 'Artículos de la tienda — lo que aparece en /tienda con su botón de compra.', incluir: 'Nombre, descripción, precio, imagen y el Price ID de Stripe para que el checkout funcione.', agentivo: false },
  };

  function ayudaHtml(clave) {
    const a = AYUDA[clave];
    if (!a) return '';
    return `
      <p class="ayuda-titulo">${escapeHtml(a.titulo)}${a.agentivo ? ' <span class="ayuda-badge">🤖 AGENTIVO</span>' : ''}</p>
      <p class="ayuda-desc">${escapeHtml(a.desc)}</p>
      ${a.incluir ? `<p class="ayuda-incluir"><strong>Incluye:</strong> ${escapeHtml(a.incluir)}</p>` : ''}`;
  }

  function claveAyuda(el) {
    return el ? (el.dataset.help || el.dataset.panel) : null;
  }

  function mostrarAyudaTooltip(el) {
    const clave = claveAyuda(el);
    if (!clave || !AYUDA[clave]) return;
    const tooltip = document.getElementById('ayuda-tooltip');
    tooltip.innerHTML = ayudaHtml(clave);
    tooltip.hidden = false;
    const rect = el.getBoundingClientRect();
    tooltip.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 320)) + 'px';
    tooltip.style.top = (rect.bottom + window.scrollY + 8) + 'px';
  }

  function bindAyuda() {
    const panel = document.getElementById('admin-panel');
    const tooltip = document.getElementById('ayuda-tooltip');

    const AYUDA_HOVER_SELECTOR = '[data-help], .synth-level-card, .news-level-card';
    panel.addEventListener('mouseover', (e) => {
      const el = e.target.closest(AYUDA_HOVER_SELECTOR);
      if (el) mostrarAyudaTooltip(el);
    });
    panel.addEventListener('mouseout', (e) => {
      const el = e.target.closest(AYUDA_HOVER_SELECTOR);
      if (el && !el.contains(e.relatedTarget)) tooltip.hidden = true;
    });
    panel.addEventListener('focusin', (e) => {
      const el = e.target.closest(AYUDA_HOVER_SELECTOR);
      if (el) mostrarAyudaTooltip(el);
    });
    panel.addEventListener('focusout', (e) => {
      const el = e.target.closest(AYUDA_HOVER_SELECTOR);
      if (el) tooltip.hidden = true;
    });

    document.getElementById('ayuda-btn').addEventListener('click', () => {
      document.getElementById('ayuda-modal-body').innerHTML = Object.keys(AYUDA)
        .map((clave) => `<section class="ayuda-modal-item">${ayudaHtml(clave)}</section>`).join('');
      document.getElementById('ayuda-modal').hidden = false;
    });
    document.getElementById('ayuda-modal-close').addEventListener('click', () => {
      document.getElementById('ayuda-modal').hidden = true;
    });
    document.getElementById('ayuda-modal').addEventListener('click', (e) => {
      if (e.target.id === 'ayuda-modal') document.getElementById('ayuda-modal').hidden = true;
    });
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
