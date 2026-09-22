// ============================================================
// reset-password.js — Sabías que PR · Restablecer contraseña
// ============================================================
// Página a la que Supabase redirige el enlace del correo de
// "recuperar contraseña" (ver resetPassword() en auth.js). Supabase-js
// procesa el token de recuperación que viene en la URL automáticamente
// al crear el cliente (detectSessionInUrl, activo por defecto) y dispara
// el evento 'PASSWORD_RECOVERY'. Aquí solo esperamos esa sesión temporal
// y, si existe, dejamos guardar la contraseña nueva con updateUser().
// ============================================================

(function () {
  function waitForSharedSupabase(timeoutMs = 3000, intervalMs = 50) {
    return new Promise((resolve) => {
      const start = Date.now();
      (function check() {
        if (window.supabase) return resolve(window.supabase);
        if (Date.now() - start >= timeoutMs) return resolve(null);
        setTimeout(check, intervalMs);
      })();
    });
  }

  function setStatus(el, type, msg) {
    if (!el) return;
    el.textContent = msg;
    el.className = 'form-status ' + type;
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const intro = document.getElementById('reset-intro');
    const form = document.getElementById('reset-form');
    const statusEl = document.getElementById('reset-status');
    if (!intro || !form) return;

    const supabase = await waitForSharedSupabase();
    if (!supabase) {
      intro.textContent = 'No se pudo conectar con el sistema de autenticación. Inténtalo de nuevo en unos segundos.';
      return;
    }

    let handled = false;
    function showForm() {
      if (handled) return;
      handled = true;
      intro.textContent = 'Escribe tu nueva contraseña.';
      form.style.display = 'flex';
    }

    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) showForm();
    });

    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      showForm();
    } else {
      // El evento PASSWORD_RECOVERY puede tardar un instante en procesarse.
      setTimeout(async () => {
        if (handled) return;
        const { data: { session: later } } = await supabase.auth.getSession();
        if (later) showForm();
        else intro.textContent = 'Este enlace no es válido o ya expiró. Solicita uno nuevo desde "¿Olvidaste tu contraseña?" en el inicio de sesión.';
      }, 1500);
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pass1 = document.getElementById('reset-pass').value;
      const pass2 = document.getElementById('reset-pass2').value;
      if (pass1.length < 6) { setStatus(statusEl, 'error', 'La contraseña debe tener al menos 6 caracteres.'); return; }
      if (pass1 !== pass2) { setStatus(statusEl, 'error', 'Las contraseñas no coinciden.'); return; }
      setStatus(statusEl, 'info', 'Guardando...');
      const { error } = await supabase.auth.updateUser({ password: pass1 });
      if (error) { setStatus(statusEl, 'error', error.message); return; }
      setStatus(statusEl, 'ok', '¡Listo! Tu contraseña se actualizó. Ya puedes iniciar sesión.');
      form.style.display = 'none';
    });
  });
})();
