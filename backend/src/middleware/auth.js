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

// Verifica el JWT de Supabase, hace upsert defensivo en `perfiles`
// (por si no existe un trigger de auth.users -> perfiles) y expone req.user.
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false, error: 'Falta token de autenticacion.' });

  try {
    const { payload } = await jwtVerify(token, getJWKS());
    if (!payload.sub) return res.status(401).json({ ok: false, error: 'Token invalido.' });

    const { rows } = await pool.query(
      `INSERT INTO perfiles (id, email)
       VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email
       RETURNING id, email, rol, nombre, edad_confirmada, logica_humana_terminos_ok, creado_en`,
      [payload.sub, payload.email || null]
    );
    req.user = rows[0]; // { id, email, rol, nombre, edad_confirmada, logica_humana_terminos_ok, creado_en }
    next();
  } catch (err) {
    res.status(401).json({ ok: false, error: 'Token invalido o expirado.' });
  }
}

// Debe usarse despues de requireAuth (necesita req.user ya poblado).
function requireAdmin(req, res, next) {
  if (req.user?.rol !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Requiere rol de administrador.' });
  }
  next();
}

// Moderacion (reportes, borrar contenido reportado del debate): admin y
// moderador pasan. Gestion de contenido editorial sigue usando requireAdmin
// a secas -- el moderador no tiene acceso ahi.
function requireModerador(req, res, next) {
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
    const { payload } = await jwtVerify(token, getJWKS());
    if (!payload.sub) { req.user = null; return next(); }
    const { rows } = await pool.query('SELECT id, email, rol, edad_confirmada, logica_humana_terminos_ok, creado_en FROM perfiles WHERE id = $1', [payload.sub]);
    req.user = rows[0] || null;
  } catch {
    req.user = null;
  }
  next();
}

module.exports = { requireAuth, requireAdmin, requireModerador, tryAuth };
