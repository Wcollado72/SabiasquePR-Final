// ============================================================
// comentarios.js — Sabías que PR · Comentarios en noticias/contenidos
// ============================================================
// Version generalizada del sistema de comentarios del foro (mismas reglas
// de propiedad: cualquiera con sesion comenta, dueño o admin borran), pero
// aplicable a `noticias` y `contenidos` via /api/comentarios. Se llama
// desde recurso.js (tipo:'contenido') y articulo.js (tipo:'noticia').
// Requiere window.SQPR (editorial.js) cargado antes que este script.
// ============================================================

(function () {
  const cfg = window.SITE_CONFIG || {};
  const API_URL = cfg.apiUrl || 'http://localhost:3000';
  let supabase = null;
  let currentUser = null;
  let currentUserRol = 'usuario';

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

  function escapeHtml(str) {
    return window.SQPR && window.SQPR.escapeHtml ? window.SQPR.escapeHtml(str) : String(str == null ? '' : str);
  }

  function formatDate(iso) {
    try { return new Date(iso).toLocaleDateString(window.SQPR_LOCALE || 'es-PR', { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch { return ''; }
  }

  function setStatus(el, type, msg) {
    if (!el) return;
    el.textContent = msg;
    el.className = 'form-status ' + type;
  }

  async function initComentarios({ tipo, itemId, containerId }) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const shared = await waitForSharedSupabase();
    if (shared) {
      supabase = shared;
      const { data: { session } } = await supabase.auth.getSession();
      currentUser = session?.user ?? null;
      if (currentUser) {
        try {
          const data = await apiFetch('/api/me');
          currentUserRol = data.user?.rol || 'usuario';
        } catch { currentUserRol = 'usuario'; }
      }
    }

    await render(container, tipo, itemId);
  }

  async function render(container, tipo, itemId) {
    container.innerHTML = '<p class="foro-loading">Cargando comentarios...</p>';
    let comentarios = [];
    try {
      const data = await apiFetch(`/api/comentarios?tipo=${encodeURIComponent(tipo)}&itemId=${encodeURIComponent(itemId)}`);
      comentarios = data.comentarios || [];
    } catch (err) {
      container.innerHTML = '<p class="empty-state">No se pudieron cargar los comentarios.</p>';
      return;
    }

    container.innerHTML = `
      <h3>Comentarios</h3>
      <section class="box box-blog contact-box" style="display:${currentUser ? 'block' : 'none'};">
        <form id="comentario-form">
          <textarea id="comentario-cuerpo" rows="3" required minlength="2" spellcheck="true" lang="es" placeholder="Escribe un comentario..."></textarea>
          <button type="submit">Comentar</button>
          <p id="comentario-status" class="form-status" aria-live="polite"></p>
        </form>
      </section>
      <p class="foro-login-hint" style="display:${currentUser ? 'none' : 'block'};"><a href="#" class="login-modal-trigger">Inicia sesión</a> para comentar.</p>
      <div class="foro-comments">${comentarios.length
        ? comentarios.map((c) => `
        <div class="foro-comment">
          <p class="foro-meta">${escapeHtml(c.autor_email || 'anónimo')} · ${formatDate(c.creado_en)}</p>
          <p>${escapeHtml(c.cuerpo)}</p>
          ${(currentUser && (currentUser.id === c.autor_id || currentUserRol === 'admin'))
            ? `<button type="button" class="foro-comment-delete btn-alt foro-danger" data-id="${c.id}">Eliminar</button>` : ''}
        </div>`).join('')
        : '<p class="foro-empty">Sé el primero en comentar.</p>'}</div>`;

    container.querySelector('#comentario-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const cuerpo = container.querySelector('#comentario-cuerpo').value.trim();
      const statusEl = container.querySelector('#comentario-status');
      if (cuerpo.length < 2) { setStatus(statusEl, 'error', 'Comentario muy corto.'); return; }
      try {
        await apiFetch('/api/comentarios', { method: 'POST', body: JSON.stringify({ tipo, itemId, cuerpo }) });
        render(container, tipo, itemId);
      } catch (err) { setStatus(statusEl, 'error', '' + err.message); }
    });

    container.querySelectorAll('.foro-comment-delete').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('¿Eliminar este comentario?')) return;
        try {
          await apiFetch(`/api/comentarios/${btn.dataset.id}`, { method: 'DELETE' });
          render(container, tipo, itemId);
        } catch (err) { window.showToast?.('' + err.message); }
      });
    });
  }

  window.SQPR = window.SQPR || {};
  window.SQPR.initComentarios = initComentarios;
})();
