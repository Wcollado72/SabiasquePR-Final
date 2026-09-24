// ============================================================
// mi-cuenta.js — Sabías que PR · Pagina "Mi cuenta"
// ============================================================
// Pagina protegida: exige sesion (cualquier rol, no solo admin).
// Reutiliza el mismo cliente de Supabase que auth.js/admin.js/foro.js.
// ============================================================

(function () {
  const cfg = window.SITE_CONFIG || {};
  const API_URL = cfg.apiUrl || 'http://localhost:3000';
  let supabase = null;

  document.addEventListener('DOMContentLoaded', init);

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
    supabase = await waitForSharedSupabase();
    if (!supabase) { showGate('⚠️ No se pudo verificar tu sesión.'); return; }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      showGate('<a href="#" class="login-modal-trigger">Inicia sesión</a> para ver tu cuenta.');
      return;
    }

    try {
      const data = await apiFetch('/api/me');
      renderPerfil(data.user);
      bindForm();
      loadPedidos();
    } catch (err) {
      showGate('⚠️ ' + err.message);
    }
  }

  const ESTADO_PEDIDO_LABEL = { pendiente: 'Pendiente', pagada: 'Pagada', cancelada: 'Cancelada' };

  async function loadPedidos() {
    const box = document.getElementById('cuenta-pedidos');
    const list = document.getElementById('cuenta-pedidos-list');
    if (!box || !list) return;
    box.style.display = 'block';
    try {
      const data = await apiFetch('/api/ordenes');
      if (data.ordenes.length === 0) {
        list.innerHTML = '<p class="admin-hint">Todavía no tienes pedidos.</p>';
        return;
      }
      list.innerHTML = `<div class="admin-list">${data.ordenes.map((o) => {
        const fecha = new Date(o.creado_en).toLocaleDateString('es-PR', { year: 'numeric', month: 'long', day: 'numeric' });
        const items = (o.items || []).map((i) => `${i.cantidad}× ${i.nombre}`).join(', ');
        return `<div class="admin-item">
          <div class="admin-item-info">
            <p><strong>$${Number(o.total).toFixed(2)}</strong> — ${ESTADO_PEDIDO_LABEL[o.estado] || o.estado}</p>
            <p class="admin-hint">${fecha} · ${items}</p>
          </div>
        </div>`;
      }).join('')}</div>`;
    } catch (err) {
      list.innerHTML = `<p class="form-status error">${err.message}</p>`;
    }
  }

  function showGate(msg) {
    const el = document.getElementById('cuenta-gate');
    if (el) el.innerHTML = `<p>${msg}</p>`;
  }

  async function getToken() {
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

  const ESTADO_LABEL = { admin: 'Administrador', premium: 'Premium activo', usuario: 'Cuenta gratuita' };
  const ESTADO_CLASE = { admin: 'foro-badge-admin', premium: 'foro-badge-premium', usuario: '' };

  function renderPerfil(user) {
    document.getElementById('cuenta-gate').style.display = 'none';
    document.getElementById('cuenta-panel').style.display = 'block';
    document.getElementById('cuenta-email').textContent = user.email;
    document.getElementById('cuenta-nombre').value = user.nombre || '';

    const badge = document.getElementById('cuenta-estado');
    badge.textContent = ESTADO_LABEL[user.rol] || ESTADO_LABEL.usuario;
    badge.className = 'foro-badge ' + (ESTADO_CLASE[user.rol] || '');

    document.getElementById('cuenta-link-admin').style.display = user.rol === 'admin' ? '' : 'none';
  }

  function bindForm() {
    const form = document.getElementById('cuenta-form');
    const status = document.getElementById('cuenta-status');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      status.textContent = 'Guardando...';
      status.className = 'form-status info';
      try {
        const nombre = document.getElementById('cuenta-nombre').value.trim();
        const data = await apiFetch('/api/perfil', { method: 'PUT', body: JSON.stringify({ nombre }) });
        renderPerfil(data.user);
        status.textContent = 'Guardado.';
        status.className = 'form-status ok';
      } catch (err) {
        status.textContent = err.message;
        status.className = 'form-status error';
      }
    });
  }
})();
