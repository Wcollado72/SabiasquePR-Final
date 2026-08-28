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
       RETURNING id, email, rol`,
      [payload.sub, payload.email || null]
    );
    req.user = rows[0]; // { id, email, rol }
    next();
  } catch (err) {
    res.status(401).json({ ok: false, error: 'Token invalido o expirado.' });
  }
}

module.exports = { requireAuth };
