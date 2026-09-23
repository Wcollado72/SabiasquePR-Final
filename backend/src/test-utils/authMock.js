// Sustituto de prueba para backend/src/middleware/auth.js.
// En vez de verificar un JWT real contra Supabase, confia en un
// encabezado de prueba (x-test-user) para fijar req.user, de modo
// que las pruebas de integracion de las rutas puedan simular
// distintos usuarios/roles sin depender de la red.

function requireAuth(req, res, next) {
  const raw = req.headers['x-test-user'];
  if (!raw) return res.status(401).json({ ok: false, error: 'Falta token de autenticacion.' });
  try {
    req.user = JSON.parse(raw);
  } catch {
    return res.status(401).json({ ok: false, error: 'Token invalido o expirado.' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (req.user?.rol !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Requiere rol de administrador.' });
  }
  next();
}

// Version "suave" para pruebas: igual que requireAuth pero nunca rechaza --
// sin x-test-user o con uno invalido, sigue con req.user = null.
function tryAuth(req, _res, next) {
  const raw = req.headers['x-test-user'];
  if (!raw) { req.user = null; return next(); }
  try {
    req.user = JSON.parse(raw);
  } catch {
    req.user = null;
  }
  next();
}

module.exports = { requireAuth, requireAdmin, tryAuth };
