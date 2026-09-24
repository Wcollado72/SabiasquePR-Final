// ============================================================
// auth.js — Sabías que PR · Autenticación con Supabase
// ============================================================
// ACTIVAR:
// 1. Crear proyecto en https://supabase.com (gratis)
// 2. Settings → API → copiar Project URL y anon public key
// 3. Pegar en build.js → SITE.supabaseUrl y SITE.supabaseKey
// 4. Ejecutar: node build.js
// ============================================================

const cfg = window.SITE_CONFIG || {};
const SUPABASE_URL = cfg.supabaseUrl || '';
const SUPABASE_KEY = cfg.supabaseKey || '';
const API_URL = cfg.apiUrl || 'http://localhost:3000';
const isConfigured = SUPABASE_URL && !SUPABASE_URL.includes('YOUR_SUPABASE');

let supabase = null;

// ── INICIALIZACIÓN ──────────────────────────────────────────
async function initAuth() {
  if (!isConfigured) {
    setupDemoMode();
    return;
  }

  try {
    const { createClient } = await import(
      'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'
    );
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    window.supabase = supabase; // permite que otros scripts (p.ej. foro.js) reutilicen la sesión
    await checkSession();

    supabase.auth.onAuthStateChange((_event, session) => {
      updateLoginUI(session);
    });
  } catch (err) {
    console.warn('[Auth] Error al inicializar Supabase:', err.message);
    setupDemoMode();
  }
}

// ── SESIÓN ──────────────────────────────────────────────────
async function checkSession() {
  const { data: { session } } = await supabase.auth.getSession();
  updateLoginUI(session);
}

const ESTADO_LABEL = { admin: 'Administrador', premium: 'Premium activo', usuario: 'Cuenta gratuita' };
const ESTADO_CLASE = { admin: 'foro-badge-admin', premium: 'foro-badge-premium', usuario: '' };

// ── UI — actualizar login box según estado ──────────────────
async function updateLoginUI(session) {
  const user = session?.user ?? null;
  const loggedOut    = document.getElementById('auth-logged-out');
  const loggedIn     = document.getElementById('auth-logged-in');
  const emailEl      = document.getElementById('user-email-display');
  const triggerLabel = document.getElementById('login-trigger-label');
  const statusEl     = document.getElementById('user-status-badge');
  const adminLink    = document.getElementById('link-admin-shortcut');

  if (loggedOut && loggedIn) {
    if (user) {
      loggedOut.style.display = 'none';
      loggedIn.style.display  = 'block';
      if (emailEl) emailEl.textContent = user.email;
    } else {
      loggedOut.style.display = 'block';
      loggedIn.style.display  = 'none';
    }
  }

  // Botón del header: muestra el correo cuando hay sesión activa.
  if (triggerLabel) {
    triggerLabel.textContent = user
      ? (user.email.length > 18 ? user.email.slice(0, 16) + '…' : user.email)
      : 'Iniciar sesión';
  }

  if (statusEl) statusEl.textContent = '';
  if (adminLink) adminLink.style.display = 'none';
  if (!user || !session?.access_token) return;

  // El rol (premium/admin) vive en `perfiles`, no en el JWT de Supabase,
  // asi que hace falta esta llamada aparte para saber que mostrar.
  try {
    const res = await fetch(API_URL + '/api/me', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await res.json();
    if (!data.ok) return;
    if (statusEl) {
      statusEl.textContent = ESTADO_LABEL[data.user.rol] || ESTADO_LABEL.usuario;
      statusEl.className = 'foro-badge ' + (ESTADO_CLASE[data.user.rol] || '');
    }
    if (adminLink && data.user.rol === 'admin') adminLink.style.display = '';
  } catch (err) {
    console.warn('[Auth] No se pudo obtener el rol del usuario:', err.message);
  }
}

function setAuthStatus(msg, type = 'info') {
  const el = document.getElementById('auth-status');
  if (!el) return;
  el.textContent  = msg;
  el.className    = `auth-status ${type}`;
}

// ── ACCIONES DE AUTH ────────────────────────────────────────
async function signIn(email, password) {
  setAuthStatus('Entrando...', 'info');
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) { setAuthStatus('' + error.message, 'error'); return; }
  setAuthStatus('¡Bienvenido!', 'ok');
  setTimeout(() => window.closeLoginModal?.(), 900);
}

async function signUp(email, password) {
  setAuthStatus('Registrando...', 'info');
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) { setAuthStatus('' + error.message, 'error'); return; }
  setAuthStatus('Revisa tu correo para confirmar tu cuenta.', 'ok');
}

async function signOut() {
  await supabase?.auth.signOut();
  setAuthStatus('', '');
}

async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.href },
  });
  if (error) setAuthStatus('' + error.message, 'error');
}

async function resetPassword(email) {
  setAuthStatus('Enviando correo...', 'info');
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password.html`,
  });
  if (error) { setAuthStatus('' + error.message, 'error'); return; }
  setAuthStatus('Revisa tu correo para restablecer la contraseña.', 'ok');
}

// ── MODO DEMO (sin Supabase configurado) ────────────────────
function setupDemoMode() {
  const statusEl = document.getElementById('auth-status');
  if (statusEl) {
    statusEl.innerHTML =
      '🔐 Login disponible pronto. ' +
      '<a href="https://supabase.com" target="_blank" rel="noopener" style="color:#fef9c3;">Configura Supabase</a>';
    statusEl.className = 'auth-status info';
  }
}

// ── EVENTOS DE BOTONES ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  let registerMode = false;
  const btnLogin = document.getElementById('btn-login');
  const linkRegister = document.getElementById('link-register');

  // Un solo handler que decide segun el modo actual, para no ir
  // agregando/quitando listeners distintos (eso dejaba el de login
  // pegado incluso en modo registro).
  function submitAuth() {
    if (registerMode) handleRegister(); else handleLogin();
  }

  btnLogin?.addEventListener('click', submitAuth);

  // Enviar con Enter desde los campos de correo/contraseña
  ['login-email', 'login-pass'].forEach((id) => {
    document.getElementById(id)?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); submitAuth(); }
    });
  });

  // Botón Google
  document.getElementById('btn-google')?.addEventListener('click', signInWithGoogle);

  // Botón Cerrar sesión
  document.getElementById('btn-logout')?.addEventListener('click', signOut);

  // Registrar (toggle modo registro)
  linkRegister?.addEventListener('click', (e) => {
    e.preventDefault();
    registerMode = !registerMode;
    if (btnLogin)     btnLogin.textContent     = registerMode ? 'Crear cuenta' : 'Entrar';
    if (linkRegister) linkRegister.textContent = registerMode ? '← Tengo cuenta' : 'Registrar';
  });

  // Recuperar contraseña
  document.getElementById('link-forgot')?.addEventListener('click', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email')?.value.trim();
    if (!email) { setAuthStatus('Escribe tu correo primero.', 'error'); return; }
    if (isConfigured) resetPassword(email);
    else setAuthStatus('Configura Supabase para activar esta función.', 'info');
  });

  // Mostrar/ocultar contraseña (login, registro y restablecer contraseña)
  document.querySelectorAll('.pass-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.classList.toggle('is-visible', show);
      btn.setAttribute('aria-pressed', String(show));
      btn.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
    });
  });
});

function handleLogin() {
  const email = document.getElementById('login-email')?.value.trim();
  const pass  = document.getElementById('login-pass')?.value;
  if (!email || !pass) { setAuthStatus('Completa todos los campos.', 'error'); return; }
  signIn(email, pass);
}

function handleRegister() {
  const email = document.getElementById('login-email')?.value.trim();
  const pass  = document.getElementById('login-pass')?.value;
  if (!email || !pass) { setAuthStatus('Completa todos los campos.', 'error'); return; }
  if (pass.length < 6)  { setAuthStatus('La contraseña debe tener al menos 6 caracteres.', 'error'); return; }
  signUp(email, pass);
}

// ── ARRANQUE ────────────────────────────────────────────────
initAuth();
