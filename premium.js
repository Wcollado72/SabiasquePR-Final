// ============================================================
// premium.js — Sabías que PR · Suscripción premium
// ============================================================
// Inicia el checkout de Stripe (POST /api/stripe/create-checkout-session)
// y muestra el resultado al volver de Stripe (?success=1 / ?canceled=1).
// ============================================================

(function () {
  const cfg = window.SITE_CONFIG || {};
  const API_URL = cfg.apiUrl || 'http://localhost:3000';
  const isSupabaseConfigured = cfg.supabaseUrl && !cfg.supabaseUrl.includes('YOUR_SUPABASE');
  let supabase = null;
  let currentUser = null;

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

        supabase.auth.onAuthStateChange((_event, session) => {
          currentUser = session?.user ?? null;
          updateAuthUI();
        });
      } catch (err) {
        console.warn('[Premium] Supabase no disponible:', err.message);
      }
    }
    updateAuthUI();
    bindSubscribeButton();
    showRedirectStatus();
  }

  function updateAuthUI() {
    const btn = document.getElementById('premium-subscribe-btn');
    const hint = document.getElementById('premium-login-hint');
    if (btn) btn.style.display = currentUser ? '' : 'none';
    if (hint) hint.style.display = currentUser ? 'none' : 'block';
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

  function bindSubscribeButton() {
    document.getElementById('premium-subscribe-btn')?.addEventListener('click', async () => {
      const statusEl = document.getElementById('premium-status');
      setStatus(statusEl, 'info', 'Redirigiendo a Stripe...');
      try {
        const data = await apiFetch('/api/stripe/create-checkout-session', { method: 'POST' });
        location.href = data.url;
      } catch (err) {
        setStatus(statusEl, 'error', '' + err.message);
      }
    });
  }

  function showRedirectStatus() {
    const params = new URLSearchParams(location.search);
    const statusEl = document.getElementById('premium-status');
    if (params.get('success')) {
      setStatus(statusEl, 'info', '¡Gracias! Tu cuenta se está actualizando, esto puede tardar unos segundos.');
    } else if (params.get('canceled')) {
      setStatus(statusEl, 'error', 'Suscripción cancelada. Puedes intentarlo de nuevo cuando quieras.');
    }
  }

  function setStatus(el, type, msg) {
    if (!el) return;
    el.textContent = msg;
    el.className = 'form-status ' + type;
  }
})();
