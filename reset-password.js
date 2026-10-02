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

    const mfaForm = document.getElementById('reset-mfa-form');

    // Si la cuenta tiene verificacion en dos pasos (MFA), Supabase NO deja cambiar
    // la contrasena con una sesion de recuperacion normal (aal1): exige antes el
    // codigo del autenticador (aal2), si no el correo saltaria el MFA. Se pide el
    // codigo ANTES de mostrar el formulario de contrasena nueva.
    async function faltaCodigoMfa() {
      try {
        const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        return !error && data?.nextLevel === 'aal2' && data?.currentLevel !== 'aal2';
      } catch { return false; }
    }

    function mostrarFormularioDeContrasena() {
      intro.textContent = 'Escribe tu nueva contraseña.';
      if (mfaForm) mfaForm.style.display = 'none';
      form.style.display = 'flex';
    }

    function mostrarPasoMfa() {
      intro.textContent = 'Tu cuenta tiene verificación en dos pasos. Escribe el código de 6 dígitos que muestra tu app de autenticación para continuar.';
      mfaForm.style.display = 'flex';
      document.getElementById('reset-mfa-codigo')?.focus();
    }

    mfaForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const codigo = document.getElementById('reset-mfa-codigo').value.replace(/\s+/g, '');
      if (!/^\d{6}$/.test(codigo)) { setStatus(statusEl, 'error', 'Escribe los 6 dígitos que muestra tu app.'); return; }
      setStatus(statusEl, 'info', 'Verificando...');
      try {
        const { data: lista, error: eLista } = await supabase.auth.mfa.listFactors();
        if (eLista) throw eLista;
        const factor = (lista?.totp || [])[0];
        if (!factor) throw new Error('No encontramos un autenticador activo en tu cuenta.');
        const { data: reto, error: eReto } = await supabase.auth.mfa.challenge({ factorId: factor.id });
        if (eReto) throw eReto;
        const { error: eVer } = await supabase.auth.mfa.verify({ factorId: factor.id, challengeId: reto.id, code: codigo });
        if (eVer) throw eVer;
        setStatus(statusEl, 'ok', '');
        mostrarFormularioDeContrasena();
      } catch (err) {
        setStatus(statusEl, 'error', 'No se pudo verificar: ' + err.message);
        document.getElementById('reset-mfa-codigo').value = '';
      }
    });

    let handled = false;
    async function showForm() {
      if (handled) return;
      handled = true;
      if (mfaForm && await faltaCodigoMfa()) mostrarPasoMfa();
      else mostrarFormularioDeContrasena();
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
      if (pass1.length < 8) { setStatus(statusEl, 'error', 'La contraseña debe tener al menos 8 caracteres.'); return; }
      if (pass1 !== pass2) { setStatus(statusEl, 'error', 'Las contraseñas no coinciden.'); return; }
      if (window.sqprVecesFiltrada && await window.sqprVecesFiltrada(pass1) > 0) {
        setStatus(statusEl, 'error', 'Esa contraseña aparece en filtraciones de datos conocidas. Elige otra.');
        return;
      }
      setStatus(statusEl, 'info', 'Guardando...');
      const { error } = await supabase.auth.updateUser({ password: pass1 });
      if (error) { setStatus(statusEl, 'error', error.message); return; }
      setStatus(statusEl, 'ok', '¡Listo! Tu contraseña se actualizó. Ya puedes iniciar sesión.');
      form.style.display = 'none';
    });
  });
})();
