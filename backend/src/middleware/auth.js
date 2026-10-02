const { createRemoteJWKSet, jwtVerify } = require('jose');
const { pool } = require('../db');

// Este proyecto de Supabase usa llaves de firma asimetricas (ECC P-256 / ES256),
// no el secreto compartido HS256 clasico. Se verifica contra el JWKS publico
// del proyecto -- no hace falta guardar ningun secreto en .env.
let jwks = null;
function getJWKS() {
  if (!jwks) {
    if (!process.env.SUPABASE_URL) {
      throw new Error('SUPABASE_URL no esta configurado en .env');
    }
    const jwksUrl = new URL('/auth/v1/.well-known/jwks.json', process.env.SUPABASE_URL);
    jwks = createRemoteJWKSet(jwksUrl);
  }
  return jwks;
}

// ── MFA del admin (AUDITORIA-SEGURIDAD.md, debilidad #2) ─────────────────
// Los roles con poder (admin y moderador) solo pueden usar ese poder si la
// sesion paso la verificacion en dos pasos: el JWT de Supabase trae `aal`
// ("aal1" = solo contrasena, "aal2" = contrasena + codigo TOTP). Mientras
// sea aal1, el rol EFECTIVO se degrada a "usuario" en toda la API -- asi
// tambien quedan cubiertas las comprobaciones de rol que algunas rutas hacen
// por dentro (foro, comentarios, borradores de noticias) sin tocar cada una.
// El rol real se conserva en `rolReal` solo para que /api/me le diga al panel
// que paso falta (y poder mostrarle el paso de verificacion).
// Interruptor de emergencia: ADMIN_MFA_REQUIRED=false en Render (por ejemplo
// si se pierde el telefono con el autenticador y no hay otra via).
const ROLES_CON_PODER = ['admin', 'moderador'];
function mfaExigido() {
  return process.env.ADMIN_MFA_REQUIRED !== 'false';
}
function aplicarMfa(user, payload) {
  if (user && mfaExigido() && ROLES_CON_PODER.includes(user.rol) && payload?.aal !== 'aal2') {
    user.rolReal = user.rol;
    user.rol = 'usuario';
    user.mfaPendiente = true;
  }
  return user;
}
function rechazarPorMfa(res) {
  return res.status(403).json({
    ok: false,
    code: 'mfa_required',
    error: 'Se requiere verificacion en dos pasos (MFA) para usar este panel.',
  });
}

// Verificacion del JWT con emisor y audiencia (AUDITORIA-SEGURIDAD.md,
// debilidad #8). Segun la documentacion oficial de Supabase, los tokens de
// usuario traen `iss` = <URL del proyecto>/auth/v1 y `aud` = "authenticated";
// los de la llave anon/service_role traen iss "supabase" y quedan rechazados.
function verificarJwt(token) {
  return jwtVerify(token, getJWKS(), {
    issuer: new URL('/auth/v1', process.env.SUPABASE_URL).href,
    audience: 'authenticated',
  });
}

// Cuenta suspendida (ban) desde el panel de Supabase: sin esto su token seguia
// valiendo hasta una hora mas. `banned_until` viaja en la misma consulta.
const BANNED_SQL = '(SELECT banned_until FROM auth.users WHERE id = perfiles.id) AS banned_until';
function estaSuspendido(row) {
  return Boolean(row?.banned_until) && new Date(row.banned_until) > new Date();
}

// Verifica el JWT de Supabase, hace upsert defensivo en `perfiles`
// (por si no existe un trigger de auth.users -> perfiles) y expone req.user.
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false, error: 'Falta token de autenticacion.' });

  try {
    const { payload } = await verificarJwt(token);
    if (!payload.sub) return res.status(401).json({ ok: false, error: 'Token invalido.' });

    // fecha_nacimiento viaja en el user_metadata del JWT (se paso como
    // options.data al hacer signUp) -- solo se guarda en el INSERT inicial,
    // nunca se sobreescribe despues, para que una cuenta ya creada no pueda
    // "editar" su fecha de nacimiento via un token nuevo.
    const fechaNacimiento = payload.user_metadata?.fecha_nacimiento || null;
    const { rows } = await pool.query(
      `INSERT INTO perfiles (id, email, fecha_nacimiento)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email
       RETURNING id, email, rol, nombre, edad_confirmada, logica_humana_terminos_ok, fecha_nacimiento, creado_en, ${BANNED_SQL}`,
      [payload.sub, payload.email || null, fechaNacimiento]
    );
    if (estaSuspendido(rows[0])) {
      return res.status(401).json({ ok: false, error: 'Cuenta suspendida.' });
    }
    delete rows[0].banned_until;
    req.user = aplicarMfa(rows[0], payload); // { id, email, rol, nombre, edad_confirmada, logica_humana_terminos_ok, fecha_nacimiento, creado_en }
    req.auth = { aal: payload.aal || 'aal1' };
    next();
  } catch (err) {
    res.status(401).json({ ok: false, error: 'Token invalido o expirado.' });
  }
}

// Debe usarse despues de requireAuth (necesita req.user ya poblado).
function requireAdmin(req, res, next) {
  if (req.user?.mfaPendiente) return rechazarPorMfa(res);
  if (req.user?.rol !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Requiere rol de administrador.' });
  }
  next();
}

// Moderacion (reportes, borrar contenido reportado del debate): admin y
// moderador pasan. Gestion de contenido editorial sigue usando requireAdmin
// a secas -- el moderador no tiene acceso ahi.
function requireModerador(req, res, next) {
  if (req.user?.mfaPendiente) return rechazarPorMfa(res);
  if (req.user?.rol !== 'admin' && req.user?.rol !== 'moderador') {
    return res.status(403).json({ ok: false, error: 'Requiere rol de administrador o moderador.' });
  }
  next();
}

// Version "suave": intenta identificar al usuario si manda un token valido,
// pero NUNCA rechaza la peticion (sin token, o token invalido, simplemente
// sigue con req.user = null). Para rutas publicas que quieren mostrar mas
// informacion cuando quien pregunta es admin (ej. incluir borradores en
// noticias), sin exigir login a los visitantes normales.
async function tryAuth(req, _res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) { req.user = null; return next(); }
  try {
    const { payload } = await verificarJwt(token);
    if (!payload.sub) { req.user = null; return next(); }
    const { rows } = await pool.query(`SELECT id, email, rol, edad_confirmada, logica_humana_terminos_ok, fecha_nacimiento, creado_en, ${BANNED_SQL} FROM perfiles WHERE id = $1`, [payload.sub]);
    if (rows[0] && !estaSuspendido(rows[0])) {
      delete rows[0].banned_until;
      req.user = aplicarMfa(rows[0], payload);
    } else {
      req.user = null;
    }
  } catch {
    req.user = null;
  }
  next();
}

module.exports = { requireAuth, requireAdmin, requireModerador, tryAuth };
