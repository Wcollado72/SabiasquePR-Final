// ============================================================
// debate.js — Sabías que PR · Debate semanal 18+ (Corrupción Humana)
// ============================================================
// Motor de discusión embebido dentro de una sub-sección de Revolución
// Humana (no es su propia página, a diferencia del extinto Foro general).
// Reutiliza el mismo backend CRUD+JWT de siempre (backend/src/routes/foro.js)
// ahora acotado por subseccion, con limites de palabras por rol y un
// interstitial 18+ obligatorio antes de leer o escribir.
// Mismo patrón getToken/apiFetch duplicado que ya es el estándar del sitio
// (ver foro.js, comentarios.js).
// ============================================================

(function () {
  const cfg = window.SITE_CONFIG || {};
  const API_URL = cfg.apiUrl || 'http://localhost:3000';
  const TURNSTILE_SITE_KEY = cfg.turnstileSiteKey || '';
  const isSupabaseConfigured = cfg.supabaseUrl && !cfg.supabaseUrl.includes('YOUR_SUPABASE');
  let supabase = null;
  let currentUser = null;
  let currentUserRol = 'usuario';
  let currentUserEdadConfirmada = false;

  const WORD_LIMITS = { usuario: 500, premium: 1500, admin: 1500 };
  function countWords(text) {
    return (text || '').trim().split(/\s+/).filter(Boolean).length;
  }

  const ENFOQUE_LABEL = {
    institucional: 'Institucional', individual: 'Individual (Humanos Inhumanos)',
    'puerto-rico': 'Puerto Rico', 'estados-unidos': 'Estados Unidos',
    hispanoamerica: 'Hispanoamérica', internacionales: 'Internacionales',
  };
  // Solo las sub-secciones de tono fuerte/moderacion minima piden el
  // interstitial 18+ -- Nuevos Humanos (contenido positivo) no lo necesita.
  const SUBSECCIONES_18_MAS = ['corrupcion-humana'];
  // Opciones del select "Enfoque" del formulario de nueva publicacion,
  // segun la sub-seccion activa.
  const ENFOQUE_OPCIONES = {
    'corrupcion-humana': [['institucional', 'Institucional'], ['individual', 'Individual (Humanos Inhumanos)']],
    'nuevos-humanos': [
      ['puerto-rico', 'Puerto Rico'], ['estados-unidos', 'Estados Unidos'],
      ['hispanoamerica', 'Hispanoamérica'], ['internacionales', 'Internacionales'],
    ],
  };

  const DISCLAIMER_HTML = `
    <div class="debate-disclaimer box box-blog">
      <h3>⚠️ Sección para mayores de 18 años</h3>
      <p>Esta sección trata temas de corrupción, fallos institucionales y conducta individual con un enfoque de moderación mínima. La base de esta sección es la libertad de expresión: no se censura una opinión por ser incómoda o impopular.</p>
      <p>Legalmente, lo que protege a este sitio de responsabilidad por lo que publican los usuarios es la <strong>Sección 230 de la Communications Decency Act</strong> de EE. UU. — no significa que "todo vale": casos extremos (amenazas de daño corporal u otro contenido ilegal similar) se reportan y se revisan.</p>
      <p>Al continuar, confirmas bajo tu propia responsabilidad que eres mayor de 18 años. No se realiza ninguna verificación de identidad — esta responsabilidad es tuya.</p>
      <label class="admin-checkbox"><input type="checkbox" id="debate-confirmar-edad-check"> Confirmo que soy mayor de 18 años y acepto los términos de esta sección.</label>
      <button type="button" id="debate-confirmar-edad-btn" class="btn btn-alt" disabled>Entrar</button>
    </div>`;

  async function waitForSharedSupabase(timeoutMs = 1500, intervalMs = 50) {
    return new Promise((resolve) => {
      const start = Date.now();
      (function check() {
        if (window.supabase) return resolve(window.supabase);
        if (Date.now() - start >= timeoutMs) return resolve(null);
        setTimeout(check, intervalMs);
      })();
    });
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

  function setStatus(el, type, msg) {
    if (!el) return;
    el.textContent = msg;
    el.className = 'form-status ' + type;
  }

  // Widgets de Cloudflare Turnstile por id de contenedor -- se guarda el
  // widgetId que devuelve turnstile.render() para poder leer el token y
  // reiniciarlo despues de cada envio (un token solo sirve una vez).
  const turnstileWidgets = {};
  function renderTurnstile(containerId) {
    if (!TURNSTILE_SITE_KEY) return;
    const el = document.getElementById(containerId);
    if (!el) return;
    const intentar = () => {
      if (!window.turnstile) { setTimeout(intentar, 200); return; }
      turnstileWidgets[containerId] = window.turnstile.render('#' + containerId, { sitekey: TURNSTILE_SITE_KEY });
    };
    intentar();
  }
  function turnstileToken(containerId) {
    if (!TURNSTILE_SITE_KEY || !window.turnstile) return '';
    const widgetId = turnstileWidgets[containerId];
    return widgetId !== undefined ? (window.turnstile.getResponse(widgetId) || '') : '';
  }
  function turnstileReset(containerId) {
    const widgetId = turnstileWidgets[containerId];
    if (window.turnstile && widgetId !== undefined) window.turnstile.reset(widgetId);
  }

  function formatDate(iso) {
    try { return new Date(iso).toLocaleDateString('es-PR', { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch { return iso; }
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
  }

  function sessionEdadKey(subseccion) {
    return `sqpr_edad_confirmada_${subseccion}`;
  }

  // API pública: se llama desde revolucion-humana.html cuando la pestaña de
  // una sub-seccion con debate habilitado esta activa.
  async function initDebate({ subseccion, containerId }) {
    const root = document.getElementById(containerId);
    if (!root) return;

    if (isSupabaseConfigured) {
      try {
        const shared = await waitForSharedSupabase();
        supabase = shared || (await (async () => {
          const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
          return createClient(cfg.supabaseUrl, cfg.supabaseKey);
        })());
        const { data: { session } } = await supabase.auth.getSession();
        currentUser = session?.user ?? null;
        if (currentUser) {
          try {
            const me = await apiFetch('/api/me');
            currentUserRol = me.user?.rol || 'usuario';
            currentUserEdadConfirmada = Boolean(me.user?.edad_confirmada);
          } catch { /* sesion invalida o backend caido -- se trata como anonimo */ }
        }
      } catch (err) {
        console.warn('[Debate] Supabase no disponible:', err.message);
      }
    }

    const requiereEdad = SUBSECCIONES_18_MAS.includes(subseccion);
    const edadConfirmada = !requiereEdad || (currentUser
      ? currentUserEdadConfirmada
      : sessionStorage.getItem(sessionEdadKey(subseccion)) === '1');

    if (!edadConfirmada) {
      renderDisclaimer(root, subseccion, containerId);
      return;
    }

    renderDebate(root, subseccion);
  }

  function renderDisclaimer(root, subseccion, containerId) {
    root.innerHTML = DISCLAIMER_HTML;
    const check = document.getElementById('debate-confirmar-edad-check');
    const btn = document.getElementById('debate-confirmar-edad-btn');
    check.addEventListener('change', () => { btn.disabled = !check.checked; });
    btn.addEventListener('click', async () => {
      if (currentUser) {
        try {
          await apiFetch('/api/perfil/confirmar-edad', { method: 'POST' });
          currentUserEdadConfirmada = true;
        } catch (err) { alert('' + err.message); return; }
      } else {
        sessionStorage.setItem(sessionEdadKey(subseccion), '1');
      }
      renderDebate(root, subseccion);
    });
  }

  async function renderDebate(root, subseccion) {
    root.innerHTML = `
      <div id="debate-form-box"></div>
      <p class="home-hint" id="debate-hint" aria-live="polite"></p>
      <div id="debate-list"></div>`;
    renderNewPostForm(root, subseccion);
    await loadPosts(root, subseccion);
  }

  function renderNewPostForm(root, subseccion) {
    const box = root.querySelector('#debate-form-box');
    if (!currentUser) {
      box.innerHTML = '<p class="foro-login-hint"><a href="#" class="login-modal-trigger">Inicia sesión</a> para participar en el debate.</p>';
      return;
    }
    const limit = WORD_LIMITS[currentUserRol] || WORD_LIMITS.usuario;
    const esPremium = currentUserRol === 'premium' || currentUserRol === 'admin';
    const esAdmin = currentUserRol === 'admin';
    box.innerHTML = `
      <section class="box box-blog contact-box">
        <h3>Nueva publicación</h3>
        <form id="debate-post-form">
          <div class="hp-field" aria-hidden="true">
            <label for="debate-sitio-web">Sitio web</label>
            <input type="text" id="debate-sitio-web" name="sitioWeb" tabindex="-1" autocomplete="off">
          </div>
          <label for="debate-titulo">Título</label>
          <input type="text" id="debate-titulo" required maxlength="140" placeholder="Ej.: tema de esta semana">
          <label for="debate-enfoque">Enfoque</label>
          <select id="debate-enfoque">
            <option value="">Sin especificar</option>
            ${(ENFOQUE_OPCIONES[subseccion] || []).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
          </select>
          <label for="debate-cuerpo">Tu opinión</label>
          <textarea id="debate-cuerpo" rows="5" required minlength="10"></textarea>
          <p id="debate-cuerpo-counter" class="foro-word-counter">0/${limit} palabras</p>
          ${esPremium ? `
          <label for="debate-enlace-media">Enlace multimedia (opcional — imagen, audio o video)</label>
          <input type="url" id="debate-enlace-media" placeholder="https://...">
          <select id="debate-enlace-media-tipo">
            <option value="">Tipo de enlace</option>
            <option value="imagen">Imagen</option>
            <option value="audio">Audio</option>
            <option value="video">Video</option>
          </select>` : ''}
          ${esAdmin ? `
          <label class="admin-checkbox"><input type="checkbox" id="debate-destacado"> Fijar como tema oficial de la semana</label>
          <label for="debate-tema-contenido">ID del contenido relacionado (opcional)</label>
          <input type="text" id="debate-tema-contenido" placeholder="slug del contenido en Revolución Humana">` : ''}
          ${TURNSTILE_SITE_KEY ? '<div id="debate-turnstile" class="cf-turnstile-box"></div>' : ''}
          <button type="submit">Publicar</button>
          <p id="debate-form-status" class="form-status" aria-live="polite"></p>
        </form>
      </section>`;

    renderTurnstile('debate-turnstile');
    const cuerpoTa = document.getElementById('debate-cuerpo');
    const counter = document.getElementById('debate-cuerpo-counter');
    cuerpoTa.addEventListener('input', () => {
      const n = countWords(cuerpoTa.value);
      counter.textContent = `${n}/${limit} palabras`;
      counter.classList.toggle('over-limit', n > limit);
    });

    document.getElementById('debate-post-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const statusEl = document.getElementById('debate-form-status');
      const titulo = document.getElementById('debate-titulo').value.trim();
      const cuerpo = cuerpoTa.value.trim();
      const enfoque = document.getElementById('debate-enfoque').value || undefined;
      const sitioWeb = document.getElementById('debate-sitio-web').value;
      const body = { titulo, cuerpo, subseccion, enfoque, sitioWeb, turnstileToken: turnstileToken('debate-turnstile') };
      if (esPremium) {
        const enlaceMedia = document.getElementById('debate-enlace-media').value.trim();
        const enlaceMediaTipo = document.getElementById('debate-enlace-media-tipo').value;
        if (enlaceMedia) { body.enlaceMedia = enlaceMedia; body.enlaceMediaTipo = enlaceMediaTipo; }
      }
      if (esAdmin) {
        body.destacado = document.getElementById('debate-destacado').checked;
        const temaContenidoId = document.getElementById('debate-tema-contenido').value.trim();
        if (temaContenidoId) body.temaContenidoId = temaContenidoId;
      }
      if (TURNSTILE_SITE_KEY && !body.turnstileToken) {
        setStatus(statusEl, 'error', 'Completa la verificación antes de publicar.');
        return;
      }
      setStatus(statusEl, 'info', 'Publicando...');
      try {
        await apiFetch('/api/foro/posts', { method: 'POST', body: JSON.stringify(body) });
        document.getElementById('debate-post-form').reset();
        turnstileReset('debate-turnstile');
        setStatus(statusEl, 'ok', '¡Publicado!');
        await loadPosts(root, subseccion);
      } catch (err) {
        turnstileReset('debate-turnstile');
        setStatus(statusEl, 'error', '' + err.message);
      }
    });
  }

  async function loadPosts(root, subseccion) {
    const listEl = root.querySelector('#debate-list');
    const hint = root.querySelector('#debate-hint');
    listEl.innerHTML = '<p class="foro-loading">Cargando publicaciones...</p>';
    try {
      const data = await apiFetch(`/api/foro/posts?subseccion=${encodeURIComponent(subseccion)}`);
      listEl.innerHTML = data.posts.length
        ? data.posts.map((p) => postCardHtml(p)).join('')
        : '<p class="foro-empty">Aún no hay publicaciones esta semana. ¡Sé el primero!</p>';
      bindPostCards(root, subseccion);
    } catch (err) {
      listEl.innerHTML = `<p class="foro-error">${escapeHtml(err.message)}</p>`;
    } finally {
      if (hint) hint.textContent = '';
    }
  }

  function postCardHtml(p) {
    const media = p.enlace_media
      ? `<p class="foro-meta">📎 <a href="${escapeHtml(p.enlace_media)}" target="_blank" rel="noopener noreferrer">Enlace (${escapeHtml(p.enlace_media_tipo || 'media')})</a></p>`
      : '';
    return `
      <article class="box box-blog foro-post-card" data-post-id="${p.id}">
        ${p.destacado ? '<span class="foro-badge foro-badge-premium">★ Tema oficial de la semana</span>' : ''}
        ${p.enfoque ? `<span class="foro-badge">${escapeHtml(ENFOQUE_LABEL[p.enfoque] || p.enfoque)}</span>` : ''}
        <h3 class="debate-post-toggle" data-id="${p.id}">${escapeHtml(p.titulo)}</h3>
        <p class="foro-meta">Por ${escapeHtml(p.autor_email || 'anónimo')} · ${formatDate(p.creado_en)} · ${p.comentarios_count} ${p.comentarios_count === 1 ? 'comentario' : 'comentarios'}</p>
        ${media}
        <div class="debate-post-body" id="debate-post-body-${p.id}" hidden></div>
      </article>`;
  }

  function bindPostCards(root, subseccion) {
    root.querySelectorAll('.debate-post-toggle').forEach((el) => {
      el.addEventListener('click', () => togglePost(root, subseccion, el.dataset.id));
    });
  }

  async function togglePost(root, subseccion, postId) {
    const body = root.querySelector(`#debate-post-body-${postId}`);
    if (!body) return;
    if (!body.hidden) { body.hidden = true; return; }
    body.hidden = false;
    body.innerHTML = '<p class="foro-loading">Cargando...</p>';
    try {
      const data = await apiFetch(`/api/foro/posts/${encodeURIComponent(postId)}`);
      renderPostDetail(body, data.post, data.comentarios, root, subseccion);
    } catch (err) {
      body.innerHTML = `<p class="foro-error">${escapeHtml(err.message)}</p>`;
    }
  }

  function renderPostDetail(body, post, comentarios, root, subseccion) {
    const isOwner = currentUser && currentUser.id === post.autor_id;
    const isAdmin = currentUserRol === 'admin';
    body.innerHTML = `
      <p class="foro-body">${escapeHtml(post.cuerpo)}</p>
      <div class="foro-actions">
        <button type="button" class="btn-alt foro-danger debate-reportar" data-tipo="debate_post" data-id="${post.id}">Reportar</button>
        ${isOwner || isAdmin ? `<button type="button" class="btn-alt foro-danger debate-borrar-post" data-id="${post.id}">Eliminar</button>` : ''}
      </div>
      ${currentUser ? `
      <form class="debate-comment-form" data-post-id="${post.id}">
        <div class="hp-field" aria-hidden="true">
          <label for="debate-comment-sitio-web-${post.id}">Sitio web</label>
          <input type="text" id="debate-comment-sitio-web-${post.id}" name="sitioWeb" tabindex="-1" autocomplete="off">
        </div>
        <textarea rows="2" required minlength="2" placeholder="Comentar..."></textarea>
        ${TURNSTILE_SITE_KEY ? `<div id="debate-turnstile-c-${post.id}" class="cf-turnstile-box"></div>` : ''}
        <button type="submit">Comentar</button>
        <p class="form-status" aria-live="polite"></p>
      </form>` : '<p class="foro-login-hint"><a href="#" class="login-modal-trigger">Inicia sesión</a> para comentar.</p>'}
      <div class="foro-comments">${comentarios.length
        ? comentarios.map((c) => `
        <div class="foro-comment">
          <p class="foro-meta">${escapeHtml(c.autor_email || 'anónimo')} · ${formatDate(c.creado_en)}</p>
          <p>${escapeHtml(c.cuerpo)}</p>
          <div class="foro-actions">
            <button type="button" class="foro-comment-delete btn-alt foro-danger debate-reportar" data-tipo="debate_comentario" data-id="${c.id}">Reportar</button>
            ${currentUser && (currentUser.id === c.autor_id || isAdmin) ? `<button type="button" class="foro-comment-delete btn-alt foro-danger debate-borrar-comentario" data-id="${c.id}">Eliminar</button>` : ''}
          </div>
        </div>`).join('')
        : '<p class="foro-empty">Sé el primero en comentar.</p>'}</div>`;

    const tsCommentId = 'debate-turnstile-c-' + post.id;
    renderTurnstile(tsCommentId);

    body.querySelector('.debate-comment-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const ta = form.querySelector('textarea');
      const statusEl = form.querySelector('.form-status');
      const cuerpo = ta.value.trim();
      const sitioWeb = form.querySelector('input[name="sitioWeb"]').value;
      const token = turnstileToken(tsCommentId);
      if (TURNSTILE_SITE_KEY && !token) {
        setStatus(statusEl, 'error', 'Completa la verificación antes de comentar.');
        return;
      }
      try {
        await apiFetch(`/api/foro/posts/${post.id}/comentarios`, { method: 'POST', body: JSON.stringify({ cuerpo, sitioWeb, turnstileToken: token }) });
        const data = await apiFetch(`/api/foro/posts/${encodeURIComponent(post.id)}`);
        renderPostDetail(body, data.post, data.comentarios, root, subseccion);
      } catch (err) {
        turnstileReset(tsCommentId);
        setStatus(statusEl, 'error', '' + err.message);
      }
    });

    body.querySelectorAll('.debate-borrar-comentario').forEach((btn) => btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar este comentario?')) return;
      try {
        await apiFetch(`/api/foro/comentarios/${btn.dataset.id}`, { method: 'DELETE' });
        const data = await apiFetch(`/api/foro/posts/${encodeURIComponent(post.id)}`);
        renderPostDetail(body, data.post, data.comentarios, root, subseccion);
      } catch (err) { alert('' + err.message); }
    }));

    body.querySelector('.debate-borrar-post')?.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta publicación? Esta acción no se puede deshacer.')) return;
      try {
        await apiFetch(`/api/foro/posts/${post.id}`, { method: 'DELETE' });
        await loadPosts(root, subseccion);
      } catch (err) { alert('' + err.message); }
    });

    body.querySelectorAll('.debate-reportar').forEach((btn) => btn.addEventListener('click', async () => {
      if (!currentUser) { alert('Inicia sesión para reportar.'); return; }
      const motivo = prompt('¿Por qué reportas esto? (mínimo 5 caracteres)');
      if (!motivo || motivo.trim().length < 5) return;
      try {
        await apiFetch('/api/reportes', {
          method: 'POST',
          body: JSON.stringify({ tipo: btn.dataset.tipo, itemId: btn.dataset.id, motivo: motivo.trim() }),
        });
        alert('Gracias, tu reporte fue enviado para revisión.');
      } catch (err) { alert('' + err.message); }
    }));
  }

  // Auto-wiring para revolucion-humana.html: el bloque de debate solo se
  // muestra/inicializa cuando una pestaña con debate habilitado del sub-nav
  // de Revolución Humana está activa; el filtro de "enfoque" (region) solo
  // aplica visualmente a Nuevos Humanos -- las demas sub-secciones no
  // tienen un eje de enfoque publico todavia.
  const DEBATE_SUBSECCIONES = ['corrupcion-humana', 'nuevos-humanos'];
  const ENFOQUE_FILTRO_SUBSECCIONES = ['nuevos-humanos'];
  document.addEventListener('DOMContentLoaded', () => {
    const subnav = document.getElementById('rh-subnav');
    const container = document.getElementById('rh-debate');
    const enfoqueFiltro = document.getElementById('rh-enfoque-filter');
    if (!subnav || !container) return;

    function activar(subseccion) {
      if (DEBATE_SUBSECCIONES.includes(subseccion)) {
        container.hidden = false;
        initDebate({ subseccion, containerId: 'rh-debate' });
      } else {
        container.hidden = true;
        container.innerHTML = '';
      }
      if (enfoqueFiltro) enfoqueFiltro.hidden = !ENFOQUE_FILTRO_SUBSECCIONES.includes(subseccion);
    }

    subnav.addEventListener('click', (e) => {
      const btn = e.target.closest('.foro-filter-btn');
      if (btn) activar(btn.dataset.subseccion || '');
    });

    const activeBtn = subnav.querySelector('.foro-filter-btn.active');
    if (activeBtn) activar(activeBtn.dataset.subseccion || '');
  });

  // Auto-wiring para educacion.html: pagina de una sola sub-seccion, sin
  // tabs -- el foro se inicializa directo al cargar, sin logica de cambio
  // de pestana ni filtro de enfoque (esta pagina no los tiene).
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('rh-subnav')) return; // ya lo maneja el bloque de arriba
    const container = document.getElementById('edu-debate');
    if (!container) return;
    initDebate({ subseccion: 'educacion', containerId: 'edu-debate' });
  });

  window.SQPR = window.SQPR || {};
  window.SQPR.initDebate = initDebate;
})();
