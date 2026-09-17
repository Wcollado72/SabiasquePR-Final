// ============================================================
// foro.js — Sabías que PR · Foro de la comunidad
// ============================================================
// Consume la API REST del backend (backend/src/routes/foro.js).
// Usa su propia instancia de Supabase (independiente de auth.js)
// solo para leer la sesión y obtener el access token.
// ============================================================

(function () {
  const cfg = window.SITE_CONFIG || {};
  const API_URL = cfg.apiUrl || 'http://localhost:3000';
  const isSupabaseConfigured = cfg.supabaseUrl && !cfg.supabaseUrl.includes('YOUR_SUPABASE');
  let supabase = null;
  let currentUser = null;
  let currentUserRol = 'usuario';

  const WORD_LIMITS = { usuario: 100, premium: 500, admin: 500 };
  function countWords(text) {
    return (text || '').trim().split(/\s+/).filter(Boolean).length;
  }

  const CATEGORIAS = {
    general: 'General',
    tecnologia: 'Tecnología',
    internacionales: 'Internacionales',
    'nuevos-humanos': 'Revolución Humana',
    educacion: 'Educación',
  };
  let activeCategoria = '';

  document.addEventListener('DOMContentLoaded', init);

  // auth.js se carga como módulo (diferido) e inicializa Supabase de forma
  // asíncrona (import dinámico desde el CDN), así que puede no haber
  // terminado cuando foro.js arranca en DOMContentLoaded. Se espera un poco
  // a que aparezca window.supabase antes de crear una instancia propia, para
  // evitar el aviso de Supabase por múltiples clientes con la misma sesión.
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
    if (isSupabaseConfigured) {
      try {
        const shared = await waitForSharedSupabase();
        if (shared) {
          supabase = shared;
        } else {
          const { createClient } = await import(
            'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'
          );
          supabase = createClient(cfg.supabaseUrl, cfg.supabaseKey);
        }
        const { data: { session } } = await supabase.auth.getSession();
        currentUser = session?.user ?? null;
        await refreshCurrentUserRol();

        supabase.auth.onAuthStateChange((_event, session) => {
          currentUser = session?.user ?? null;
          updateAuthUI();
          refreshCurrentUserRol();
          route();
        });
      } catch (err) {
        console.warn('[Foro] Supabase no disponible:', err.message);
      }
    }
    updateAuthUI();
    bindNewPostForm();
    bindFilters();
    route();
  }

  async function refreshCurrentUserRol() {
    if (!currentUser) { currentUserRol = 'usuario'; updateWordCounters(); return; }
    try {
      const data = await apiFetch('/api/me');
      currentUserRol = data.user?.rol || 'usuario';
    } catch {
      currentUserRol = 'usuario';
    }
    updateWordCounters();
  }

  function updateAuthUI() {
    const box = document.getElementById('foro-new-post');
    const hint = document.getElementById('foro-login-hint');
    if (box) box.style.display = currentUser ? 'block' : 'none';
    if (hint) hint.style.display = currentUser ? 'none' : 'block';
  }

  const WORD_COUNTER_PAIRS = [
    ['foro-cuerpo', 'foro-cuerpo-counter'],
    ['foro-edit-cuerpo', 'foro-edit-cuerpo-counter'],
  ];
  function updateWordCounter(textareaId, counterId) {
    const ta = document.getElementById(textareaId);
    const counter = document.getElementById(counterId);
    if (!ta || !counter) return;
    const limit = WORD_LIMITS[currentUserRol] || WORD_LIMITS.usuario;
    const n = countWords(ta.value);
    counter.textContent = `${n}/${limit} palabras${currentUserRol !== 'usuario' ? ' (premium)' : ''}`;
    counter.classList.toggle('over-limit', n > limit);
  }
  function bindWordCounter(textareaId, counterId) {
    const ta = document.getElementById(textareaId);
    if (!ta) return;
    ta.addEventListener('input', () => updateWordCounter(textareaId, counterId));
    updateWordCounter(textareaId, counterId);
  }
  function updateWordCounters() {
    WORD_COUNTER_PAIRS.forEach(([taId, counterId]) => updateWordCounter(taId, counterId));
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

  function route() {
    const postId = new URLSearchParams(location.search).get('post');
    postId ? showDetail(postId) : showList();
  }
  window.addEventListener('popstate', route);

  function bindFilters() {
    document.querySelectorAll('.foro-filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.foro-filter-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        activeCategoria = btn.dataset.categoria || '';
        showList();
      });
    });
  }

  async function showList() {
    const listEl = document.getElementById('foro-post-list');
    const detailEl = document.getElementById('foro-post-detail');
    const filtersEl = document.getElementById('foro-filters');
    if (detailEl) detailEl.style.display = 'none';
    if (filtersEl) filtersEl.style.display = '';
    if (!listEl) return;
    listEl.style.display = '';
    listEl.innerHTML = '<p class="foro-loading">Cargando publicaciones...</p>';
    try {
      const qs = activeCategoria ? `?categoria=${encodeURIComponent(activeCategoria)}` : '';
      const data = await apiFetch(`/api/foro/posts${qs}`);
      listEl.innerHTML = data.posts.length
        ? data.posts.map((p) => `
        <article class="box box-blog foro-post-card">
          <span class="foro-badge">${CATEGORIAS[p.categoria] || p.categoria}</span>
          <h3><a href="foro?post=${p.id}">${escapeHtml(p.titulo)}</a></h3>
          <p class="foro-meta">Por ${escapeHtml(p.autor_email || 'anónimo')} · ${formatDate(p.creado_en)} · 💬 ${p.comentarios_count}</p>
        </article>`).join('')
        : '<p class="foro-empty">Aún no hay publicaciones. ¡Sé el primero!</p>';
    } catch (err) {
      listEl.innerHTML = `<p class="foro-error">❌ ${escapeHtml(err.message)}</p>`;
    }
  }

  async function showDetail(postId) {
    const listEl = document.getElementById('foro-post-list');
    const detailEl = document.getElementById('foro-post-detail');
    const filtersEl = document.getElementById('foro-filters');
    if (listEl) listEl.style.display = 'none';
    if (filtersEl) filtersEl.style.display = 'none';
    if (!detailEl) return;
    detailEl.style.display = '';
    detailEl.innerHTML = '<p class="foro-loading">Cargando...</p>';
    try {
      const data = await apiFetch(`/api/foro/posts/${encodeURIComponent(postId)}`);
      renderDetail(data.post, data.comentarios);
    } catch (err) {
      detailEl.innerHTML = `<p class="foro-error">❌ ${escapeHtml(err.message)}</p><p><a href="foro.html">← Volver</a></p>`;
    }
  }

  function renderDetail(post, comentarios) {
    const isOwner = currentUser && currentUser.id === post.autor_id;
    document.getElementById('foro-post-detail').innerHTML = `
      <p><a href="foro.html">← Volver al foro</a></p>
      <article class="box box-blog foro-post-full" id="foro-post-full">
        <span class="foro-badge">${CATEGORIAS[post.categoria] || post.categoria}</span>
        <h3>${escapeHtml(post.titulo)}</h3>
        <p class="foro-meta">Por ${escapeHtml(post.autor_email || 'anónimo')} · ${formatDate(post.creado_en)}${post.editado_en ? ' · editado' : ''}</p>
        <p class="foro-body">${escapeHtml(post.cuerpo)}</p>
        ${isOwner ? `<div class="foro-actions">
          <button type="button" id="foro-edit-post-btn" class="btn-alt">Editar</button>
          <button type="button" id="foro-delete-post-btn" class="btn-alt foro-danger">Eliminar</button>
        </div>` : ''}
      </article>
      <section class="box box-blog contact-box" style="display:${currentUser ? 'block' : 'none'};">
        <h3>Añadir comentario</h3>
        <form id="foro-comment-form">
          <textarea id="foro-comentario-cuerpo" rows="3" required minlength="2" placeholder="Escribe un comentario..."></textarea>
          <button type="submit">Comentar</button>
          <p id="foro-comment-status" class="form-status" aria-live="polite"></p>
        </form>
      </section>
      <p class="foro-login-hint" style="display:${currentUser ? 'none' : 'block'};">🔒 <a href="#" class="login-modal-trigger">Inicia sesión</a> para comentar.</p>
      <div class="foro-comments">${comentarios.length
        ? comentarios.map((c) => `
        <div class="foro-comment">
          <p class="foro-meta">${escapeHtml(c.autor_email || 'anónimo')} · ${formatDate(c.creado_en)}</p>
          <p>${escapeHtml(c.cuerpo)}</p>
          ${currentUser && currentUser.id === c.autor_id ? `<button type="button" class="foro-comment-delete btn-alt foro-danger" data-id="${c.id}">Eliminar</button>` : ''}
        </div>`).join('')
        : '<p class="foro-empty">Sé el primero en comentar.</p>'}</div>`;

    document.getElementById('foro-comment-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const cuerpo = document.getElementById('foro-comentario-cuerpo').value.trim();
      const statusEl = document.getElementById('foro-comment-status');
      if (cuerpo.length < 2) { setStatus(statusEl, 'error', 'Comentario muy corto.'); return; }
      try {
        await apiFetch(`/api/foro/posts/${post.id}/comentarios`, { method: 'POST', body: JSON.stringify({ cuerpo }) });
        showDetail(post.id);
      } catch (err) { setStatus(statusEl, 'error', '❌ ' + err.message); }
    });

    document.querySelectorAll('.foro-comment-delete').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('¿Eliminar este comentario?')) return;
        try {
          await apiFetch(`/api/foro/comentarios/${btn.dataset.id}`, { method: 'DELETE' });
          showDetail(post.id);
        } catch (err) { window.showToast?.('❌ ' + err.message); }
      });
    });

    document.getElementById('foro-delete-post-btn')?.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta publicación?')) return;
      try {
        await apiFetch(`/api/foro/posts/${post.id}`, { method: 'DELETE' });
        location.href = 'foro.html';
      } catch (err) { window.showToast?.('❌ ' + err.message); }
    });

    document.getElementById('foro-edit-post-btn')?.addEventListener('click', () => {
      renderEditForm(post);
    });
  }

  function renderEditForm(post) {
    const article = document.getElementById('foro-post-full');
    if (!article) return;
    article.innerHTML = `
      <h3>Editar publicación</h3>
      <form id="foro-edit-form" class="foro-edit-form">
        <label for="foro-edit-titulo">Título</label>
        <input type="text" id="foro-edit-titulo" required maxlength="140" value="${escapeHtml(post.titulo)}">
        <label for="foro-edit-categoria">Categoría</label>
        <select id="foro-edit-categoria">
          ${Object.entries(CATEGORIAS).map(([value, label]) =>
            `<option value="${value}"${value === post.categoria ? ' selected' : ''}>${label}</option>`).join('')}
        </select>
        <label for="foro-edit-cuerpo">Mensaje</label>
        <textarea id="foro-edit-cuerpo" rows="4" required minlength="10">${escapeHtml(post.cuerpo)}</textarea>
        <p id="foro-edit-cuerpo-counter" class="foro-word-counter"></p>
        <div class="foro-actions">
          <button type="submit">Guardar cambios</button>
          <button type="button" id="foro-edit-cancel-btn" class="btn-alt">Cancelar</button>
        </div>
        <p id="foro-edit-status" class="form-status" aria-live="polite"></p>
      </form>`;

    document.getElementById('foro-edit-cancel-btn')?.addEventListener('click', () => showDetail(post.id));

    document.getElementById('foro-edit-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const statusEl = document.getElementById('foro-edit-status');
      const titulo = document.getElementById('foro-edit-titulo').value.trim();
      const categoria = document.getElementById('foro-edit-categoria').value;
      const cuerpo = document.getElementById('foro-edit-cuerpo').value.trim();
      if (titulo.length < 3) { setStatus(statusEl, 'error', 'Título muy corto.'); return; }
      if (cuerpo.length < 10) { setStatus(statusEl, 'error', 'Mensaje muy corto.'); return; }
      setStatus(statusEl, 'info', '⏳ Guardando...');
      try {
        await apiFetch(`/api/foro/posts/${post.id}`, { method: 'PATCH', body: JSON.stringify({ titulo, categoria, cuerpo }) });
        showDetail(post.id);
      } catch (err) { setStatus(statusEl, 'error', '❌ ' + err.message); }
    });

    bindWordCounter('foro-edit-cuerpo', 'foro-edit-cuerpo-counter');
  }

  function bindNewPostForm() {
    const form = document.getElementById('foro-post-form');
    if (!form) return;
    bindWordCounter('foro-cuerpo', 'foro-cuerpo-counter');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const statusEl = document.getElementById('foro-form-status');
      const titulo = document.getElementById('foro-titulo').value.trim();
      const categoria = document.getElementById('foro-categoria').value;
      const cuerpo = document.getElementById('foro-cuerpo').value.trim();
      if (titulo.length < 3) { setStatus(statusEl, 'error', 'Título muy corto.'); return; }
      if (cuerpo.length < 10) { setStatus(statusEl, 'error', 'Mensaje muy corto.'); return; }
      setStatus(statusEl, 'info', '⏳ Publicando...');
      try {
        const data = await apiFetch('/api/foro/posts', { method: 'POST', body: JSON.stringify({ titulo, categoria, cuerpo }) });
        location.href = `foro?post=${data.post.id}`;
      } catch (err) { setStatus(statusEl, 'error', '❌ ' + err.message); }
    });
  }

  function setStatus(el, type, msg) {
    if (!el) return;
    el.textContent = msg;
    el.className = 'form-status ' + type;
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
})();
