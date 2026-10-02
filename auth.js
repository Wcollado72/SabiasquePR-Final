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
const TURNSTILE_SITE_KEY = cfg.turnstileSiteKey || '';
const isConfigured = SUPABASE_URL && !SUPABASE_URL.includes('YOUR_SUPABASE');

let supabase = null;

// ── CLOUDFLARE TURNSTILE (CAPTCHA del modal de login/registro) ──────
// Mismo sitio de Turnstile que usa el foro (ver debate.js), pero aqui
// protege los propios endpoints de Supabase Auth (signup/login/recuperar
// contrasena), que Supabase valida del lado del servidor via el campo
// `captchaToken`. El script de la API solo se carga la primera vez que se
// abre el modal -- no en cada pagina -- para no pedirle a Cloudflare algo
// que la mayoria de las visitas nunca necesita.
let turnstileWidgetId = null;
let turnstileScriptPromise = null;
function cargarTurnstileScript() {
  if (turnstileScriptPromise) return turnstileScriptPromise;
  turnstileScriptPromise = new Promise((resolve) => {
    if (window.turnstile) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    document.head.appendChild(s);
  });
  return turnstileScriptPromise;
}
async function renderAuthTurnstile() {
  if (!TURNSTILE_SITE_KEY || turnstileWidgetId !== null) return;
  const el = document.getElementById('auth-turnstile');
  if (!el) return;
  await cargarTurnstileScript();
  turnstileWidgetId = window.turnstile.render('#auth-turnstile', { sitekey: TURNSTILE_SITE_KEY });
}
function authTurnstileToken() {
  if (!TURNSTILE_SITE_KEY || !window.turnstile || turnstileWidgetId === null) return undefined;
  return window.turnstile.getResponse(turnstileWidgetId) || undefined;
}
function resetAuthTurnstile() {
  if (window.turnstile && turnstileWidgetId !== null) window.turnstile.reset(turnstileWidgetId);
}
// Si Turnstile esta configurado pero el widget todavia no entrego un token
// (script lento, usuario muy rapido), mejor avisar que intentar un envio
// que el servidor va a rechazar de todas formas -- mismo patron que ya usa
// debate.js para el foro.
function turnstilePendiente() {
  return Boolean(TURNSTILE_SITE_KEY) && !authTurnstileToken();
}
window.onLoginModalOpen = renderAuthTurnstile;

// ── INICIALIZACIÓN ──────────────────────────────────────────
async function initAuth() {
  if (!isConfigured) {
    setupDemoMode();
    return;
  }

  try {
    const { createClient } = await import(
      './vendor/supabase-js.js'
    );
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    window.supabase = supabase; // permite que otros scripts (p.ej. foro.js) reutilicen la sesión
    await checkSession();

    supabase.auth.onAuthStateChange((event, session) => {
      updateLoginUI(session);
      // Idea del usuario (2026-09-27): si quien inicia sesion es admin o
      // moderador, lo lleva directo al panel en vez de dejarlo donde estaba
      // -- solo en el evento de login real (no en cada carga de pagina con
      // sesion ya activa, ni en logout/refresh de token).
      // supabase-js vuelve a emitir SIGNED_IN cada vez que la pestana recupera
      // el foco -- por eso solo se actua si el usuario acaba de iniciar sesion
      // a proposito (marca puesta en signIn/signInWithGoogle). Sin esto, al
      // volver a la pestana se recargaba el panel y se perdian los campos.
      if (event === 'SIGNED_IN' && consumirMarcaLoginManual()) redirigirAlPanelSiCorresponde(session);
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

  // Red de seguridad: en algunas cargas de pagina (ej. al volver de un
  // redirect externo como Stripe) la primera lectura de sesion puede
  // llegar vacia por una condicion de carrera del SDK, aunque el token
  // siga guardado. Se vuelve a revisar una vez mas poco despues para
  // corregir la UI si hacia falta, sin reintentar indefinidamente.
  if (!session) {
    setTimeout(async () => {
      const { data: { session: retry } } = await supabase.auth.getSession();
      if (retry) updateLoginUI(retry);
    }, 1000);
  }
}

const ESTADO_LABEL = { admin: 'Administrador', premium: 'Premium activo', usuario: 'Cuenta gratuita' };
const ESTADO_CLASE = { admin: 'foro-badge-admin', premium: 'foro-badge-premium', usuario: '' };

// ── UI — actualizar login box según estado ──────────────────
async function updateLoginUI(session) {
  const user = session?.user ?? null;
  if (user) armInactivityWatch(); else disarmInactivityWatch();

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
    // Recortado a 14 caracteres (mismo largo que "Iniciar sesión") para que el
    // boton del header nunca sea mas ancho logueado que deslogueado -- un
    // correo largo empujaba el menu por encima del icono de tema (bug real,
    // reportado por el usuario, solo visible con sesion iniciada).
    triggerLabel.textContent = user
      ? (user.email.length > 14 ? user.email.slice(0, 12) + '…' : user.email)
      : 'Iniciar sesión';
  }

  if (statusEl) statusEl.textContent = '';
  if (adminLink) adminLink.style.display = 'none';
  if (!user) quitarPerfilPendiente();
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
    // Cuentas sin fecha de nacimiento (creadas con Google, o anteriores al campo).
    if (!data.user.fecha_nacimiento) mostrarPerfilPendiente(); else quitarPerfilPendiente();
  } catch (err) {
    console.warn('[Auth] No se pudo obtener el rol del usuario:', err.message);
  }
}

// ── COMPLETA TU PERFIL (fecha de nacimiento) ───────────────
// Quien entra con Google no pasa por el formulario de registro, y las cuentas
// anteriores al campo tampoco la tienen: sin fecha, la regla de edad de las
// secciones 18+ dependeria solo de una casilla (ver AUDITORIA-LEGAL-MENORES.md).
// Se pide UNA vez, el servidor no deja cambiarla despues, y NO se rechaza a
// nadie por su edad (politica del sitio). No bloquea la lectura: es una capa
// encima de la pagina que solo se quita al guardar (o al cerrar sesion).
const PERFIL_OVERLAY_ID = 'perfil-pendiente-overlay';
function quitarPerfilPendiente() {
  document.getElementById(PERFIL_OVERLAY_ID)?.remove();
}
function mostrarPerfilPendiente() {
  if (document.getElementById(PERFIL_OVERLAY_ID)) return;
  // En la pagina de restablecer contrasena ya hay un formulario propio abierto.
  if (/(^|\/)reset-password(\.html)?$/.test(location.pathname)) return;

  const el = (tag, props = {}, hijos = []) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'texto') n.textContent = v;
      else if (k === 'clase') n.className = v;
      else n.setAttribute(k, v);
    }
    hijos.forEach((h) => n.appendChild(h));
    return n;
  };

  const estado = el('p', { clase: 'auth-status', role: 'status', 'aria-live': 'polite' });
  const input = el('input', {
    type: 'date', id: 'perfil-nacimiento', required: '', autocomplete: 'bday',
    min: '1900-01-01', max: new Date().toISOString().slice(0, 10),
  });
  const guardar = el('button', { type: 'submit', texto: 'Guardar' });
  const salir = el('button', { type: 'button', clase: 'perfil-pendiente-salir', texto: 'Cerrar sesión' });
  const form = el('form', {}, [
    el('label', { for: 'perfil-nacimiento', texto: 'Fecha de nacimiento' }),
    input, guardar, estado,
  ]);

  const caja = el('div', { clase: 'login-modal perfil-pendiente', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'perfil-pendiente-titulo' }, [
    el('div', { clase: 'login-box' }, [
      el('h2', { id: 'perfil-pendiente-titulo', texto: 'Completa tu perfil' }),
      el('p', { texto: 'Antes de seguir necesitamos tu fecha de nacimiento.' }),
      el('p', { clase: 'perfil-pendiente-nota', texto: 'La pedimos una sola vez y no se muestra a nadie. No se puede cambiar después. Nos sirve para aplicar nuestras reglas de edad (algunas secciones son solo para mayores de 18); no se rechaza a nadie por su edad.' }),
      form,
      salir,
    ]),
  ]);
  const overlay = el('div', { id: PERFIL_OVERLAY_ID, clase: 'login-modal-overlay open' }, [caja]);

  const poner = (msg, tipo) => { estado.textContent = msg; estado.className = 'auth-status ' + tipo; };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!input.value) { poner('Escribe tu fecha de nacimiento.', 'error'); return; }
    guardar.disabled = true;
    poner('Guardando...', 'info');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(API_URL + '/api/perfil/fecha-nacimiento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ fechaNacimiento: input.value }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) { quitarPerfilPendiente(); return; } // ya estaba registrada: nada mas que pedir
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo guardar. Intenta de nuevo.');
      quitarPerfilPendiente();
    } catch (err) {
      poner(err.message, 'error');
      guardar.disabled = false;
    }
  });
  salir.addEventListener('click', () => signOut());

  // Atrapa el foco dentro del cuadro y no se cierra con Escape (es obligatorio).
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); return; }
    if (e.key !== 'Tab') return;
    const foco = [input, guardar, salir].filter((n) => !n.disabled);
    const i = foco.indexOf(document.activeElement);
    const sig = e.shiftKey ? (i <= 0 ? foco.length - 1 : i - 1) : (i === foco.length - 1 ? 0 : i + 1);
    e.preventDefault();
    foco[sig].focus();
  });

  document.body.appendChild(overlay);
  input.focus();
}

// Mensaje en espanol para un error de Supabase Auth (ver auth-errores.js).
const errorAuth = (error) => (window.sqprErrorAuth ? window.sqprErrorAuth(error) : error.message);

const MARCA_LOGIN_MANUAL = 'sqpr_login_manual';
function marcarLoginManual() {
  try { sessionStorage.setItem(MARCA_LOGIN_MANUAL, String(Date.now())); } catch { /* sin storage: no se redirige */ }
}
// Devuelve true una sola vez, y solo si la marca es reciente (evita que una
// marca vieja de un login abandonado dispare una redireccion mas tarde).
function consumirMarcaLoginManual() {
  try {
    const t = Number(sessionStorage.getItem(MARCA_LOGIN_MANUAL));
    sessionStorage.removeItem(MARCA_LOGIN_MANUAL);
    return Number.isFinite(t) && t > 0 && Date.now() - t < 2 * 60 * 1000;
  } catch { return false; }
}

// Redirige al panel de administracion justo despues de iniciar sesion, si
// el rol lo permite -- evita el paso extra de ir a buscar el enlace del
// panel a mano cada vez. Si ya esta en admin.html (ej. volvio a iniciar
// sesion ahi tras un logout), recarga para que admin.js vuelva a correr su
// verificacion con la sesion nueva, en vez de dejar el panel tapado.
async function redirigirAlPanelSiCorresponde(session) {
  const token = session?.access_token;
  if (!token) return;
  try {
    const res = await fetch(API_URL + '/api/me', { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!data.ok || !['admin', 'moderador'].includes(data.user?.rol)) return;
    const yaEnAdmin = /(^|\/)admin(\.html)?$/.test(location.pathname);
    if (yaEnAdmin) location.reload();
    else location.href = 'admin.html';
  } catch {
    // Si falla la verificacion de rol, el usuario se queda donde estaba --
    // el login en si ya tuvo exito, esto nunca debe interrumpirlo.
  }
}

// ── CIERRE DE SESIÓN POR INACTIVIDAD (30 min) ───────────────
const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;
const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
let inactivityTimer = null;

function resetInactivityTimer() {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(async () => {
    await signOut();
    setAuthStatus('Tu sesión se cerró por inactividad.', 'info');
  }, INACTIVITY_LIMIT_MS);
}

function armInactivityWatch() {
  resetInactivityTimer();
  ACTIVITY_EVENTS.forEach((evt) => document.addEventListener(evt, resetInactivityTimer, { passive: true }));
}

function disarmInactivityWatch() {
  clearTimeout(inactivityTimer);
  inactivityTimer = null;
  ACTIVITY_EVENTS.forEach((evt) => document.removeEventListener(evt, resetInactivityTimer));
}

function setAuthStatus(msg, type = 'info') {
  const el = document.getElementById('auth-status');
  if (!el) return;
  el.textContent  = msg;
  el.className    = `auth-status ${type}`;
}

// ── CONTRASENAS FILTRADAS (HaveIBeenPwned, k-anonymity) ─────────────
// AUDITORIA-SEGURIDAD.md, debilidad #12. La proteccion nativa de Supabase es
// solo del plan Pro; esta usa la API publica y gratuita de rangos de
// Pwned Passwords: se calcula el SHA-1 de la contrasena EN EL NAVEGADOR y solo
// se envian sus primeros 5 caracteres (nunca la contrasena ni el hash completo);
// la API devuelve todos los sufijos que comparten ese prefijo y la comparacion
// se hace aqui. `Add-Padding` agrega entradas falsas (conteo 0) para que ni el
// tamano de la respuesta delate nada. Si la API no responde, NO se bloquea el
// registro (mejor una proteccion de menos que impedir crear cuentas).
// Es una capa del lado del cliente: no sustituye a la politica de Supabase
// (8+ caracteres con mayusculas, minusculas, digitos y simbolos).
async function vecesFiltrada(contrasena) {
  try {
    const bytes = new TextEncoder().encode(contrasena);
    const digest = await crypto.subtle.digest('SHA-1', bytes);
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    const prefijo = hex.slice(0, 5);
    const sufijo = hex.slice(5);
    const res = await fetch('https://api.pwnedpasswords.com/range/' + prefijo, {
      headers: { 'Add-Padding': 'true' },
      cache: 'no-store',
    });
    if (!res.ok) return 0;
    const texto = await res.text();
    for (const linea of texto.split('\n')) {
      const [h, n] = linea.trim().split(':');
      if (h === sufijo) return Number(n) || 0;
    }
    return 0;
  } catch {
    return 0;
  }
}
window.sqprVecesFiltrada = vecesFiltrada; // lo reutiliza reset-password.js
const MSG_FILTRADA = 'Esa contraseña aparece en filtraciones de datos conocidas. Elige otra.';

// ── ACCIONES DE AUTH ────────────────────────────────────────
async function signIn(email, password) {
  if (turnstilePendiente()) { setAuthStatus('Espera un segundo a que cargue la verificación y vuelve a intentar.', 'error'); return; }
  setAuthStatus('Entrando...', 'info');
  marcarLoginManual();
  const { error } = await supabase.auth.signInWithPassword({
    email, password,
    options: { captchaToken: authTurnstileToken() },
  });
  resetAuthTurnstile();
  if (error) { consumirMarcaLoginManual(); setAuthStatus(errorAuth(error), 'error'); return; }
  setAuthStatus('¡Bienvenido!', 'ok');
  setTimeout(() => window.closeLoginModal?.(), 900);
}

async function signUp(email, password, fechaNacimiento) {
  if (turnstilePendiente()) { setAuthStatus('Espera un segundo a que cargue la verificación y vuelve a intentar.', 'error'); return; }
  setAuthStatus('Registrando...', 'info');
  const { error } = await supabase.auth.signUp({
    email, password,
    options: { data: { fecha_nacimiento: fechaNacimiento }, captchaToken: authTurnstileToken() },
  });
  resetAuthTurnstile();
  if (error) { setAuthStatus(errorAuth(error), 'error'); return; }
  setAuthStatus('Revisa tu correo para confirmar tu cuenta.', 'ok');
}

async function signOut() {
  await supabase?.auth.signOut();
  setAuthStatus('', '');
}

async function signInWithGoogle() {
  marcarLoginManual();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.href },
  });
  if (error) setAuthStatus(errorAuth(error), 'error');
}

async function resetPassword(email) {
  if (turnstilePendiente()) { setAuthStatus('Espera un segundo a que cargue la verificación y vuelve a intentar.', 'error'); return; }
  setAuthStatus('Enviando correo...', 'info');
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password.html`,
    captchaToken: authTurnstileToken(),
  });
  resetAuthTurnstile();
  if (error) { setAuthStatus(errorAuth(error), 'error'); return; }
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
  const nacimientoWrap = document.getElementById('login-nacimiento-wrap');

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
    if (nacimientoWrap) nacimientoWrap.hidden = !registerMode;
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

async function handleRegister() {
  const email = document.getElementById('login-email')?.value.trim();
  const pass  = document.getElementById('login-pass')?.value;
  const fechaNacimiento = document.getElementById('login-nacimiento')?.value;
  if (!email || !pass || !fechaNacimiento) { setAuthStatus('Completa todos los campos.', 'error'); return; }
  if (pass.length < 8)  { setAuthStatus('La contraseña debe tener al menos 8 caracteres.', 'error'); return; }
  // No se rechaza a nadie por su fecha de nacimiento (un sitio de audiencia
  // mixta no puede bloquear a menores de 13 del sitio en general, ver
  // AUDITORIA-LEGAL-MENORES.md) -- solo se valida que la fecha sea real y no
  // este en el futuro. La edad real, una vez guardada, refuerza (nunca
  // reemplaza) el gate de las secciones 18+ del lado del servidor.
  const fecha = new Date(fechaNacimiento);
  if (Number.isNaN(fecha.getTime()) || fecha > new Date()) {
    setAuthStatus('La fecha de nacimiento no es válida.', 'error');
    return;
  }
  if (await vecesFiltrada(pass) > 0) { setAuthStatus(MSG_FILTRADA, 'error'); return; }
  signUp(email, pass, fechaNacimiento);
}

// ── ARRANQUE ────────────────────────────────────────────────
initAuth();
