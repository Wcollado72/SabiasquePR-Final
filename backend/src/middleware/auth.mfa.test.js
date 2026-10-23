// MFA del admin (docs/interno/AUDITORIA-SEGURIDAD.md, debilidad #2). Se prueba el middleware
// REAL (no el authMock) con jose y la base simulados: lo unico que cambia entre
// casos es el rol del perfil y el claim `aal` del JWT.
jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(() => 'jwks'),
  jwtVerify: jest.fn(),
}));
jest.mock('../db', () => ({ pool: { query: jest.fn() } }));

const request = require('supertest');
const { jwtVerify } = require('jose');
const { pool } = require('../db');
const { requireAuth, requireAdmin, requireModerador, tryAuth } = require('./auth');

const ENV = { ...process.env };
beforeEach(() => {
  process.env.SUPABASE_URL = 'https://proyecto.supabase.co';
  delete process.env.ADMIN_MFA_REQUIRED;
  jest.clearAllMocks();
});
afterAll(() => { process.env = { ...ENV }; });

function simular({ rol, aal }) {
  const payload = { sub: 'u1', email: 'a@b.com' };
  if (aal !== undefined) payload.aal = aal;
  jwtVerify.mockResolvedValue({ payload });
  pool.query.mockResolvedValue({ rows: [{ id: 'u1', email: 'a@b.com', rol }] });
}

async function autenticar({ rol, aal }) {
  simular({ rol, aal });
  const req = { headers: { authorization: 'Bearer token-falso' } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  const next = jest.fn();
  await requireAuth(req, res, next);
  expect(next).toHaveBeenCalled();
  return req;
}

function pasar(guardia, req) {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  const next = jest.fn();
  guardia(req, res, next);
  return { res, next };
}

describe('admin con sesion aal1 (solo contrasena)', () => {
  test('pierde el poder: rol efectivo "usuario" y requireAdmin responde 403 mfa_required', async () => {
    const req = await autenticar({ rol: 'admin', aal: 'aal1' });
    expect(req.user.rol).toBe('usuario');
    expect(req.user.rolReal).toBe('admin');
    expect(req.user.mfaPendiente).toBe(true);

    const { res, next } = pasar(requireAdmin, req);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false, code: 'mfa_required' }));
  });

  test('un JWT sin claim aal se trata como aal1 (nunca se asume MFA)', async () => {
    const req = await autenticar({ rol: 'admin', aal: undefined });
    expect(req.user.mfaPendiente).toBe(true);
    expect(pasar(requireAdmin, req).next).not.toHaveBeenCalled();
  });

  test('las comprobaciones de rol dentro de las rutas tambien lo ven como usuario', async () => {
    const req = await autenticar({ rol: 'admin', aal: 'aal1' });
    // mismo patron que comentarios.js / foro.js (esModeracion)
    expect(req.user.rol === 'admin' || req.user.rol === 'moderador').toBe(false);
  });
});

describe('admin con sesion aal2 (contrasena + codigo)', () => {
  test('conserva el poder y requireAdmin deja pasar', async () => {
    const req = await autenticar({ rol: 'admin', aal: 'aal2' });
    expect(req.user.rol).toBe('admin');
    expect(req.user.mfaPendiente).toBeUndefined();
    expect(pasar(requireAdmin, req).next).toHaveBeenCalled();
  });
});

describe('moderador', () => {
  test('aal1: requireModerador responde 403 mfa_required', async () => {
    const req = await autenticar({ rol: 'moderador', aal: 'aal1' });
    const { res, next } = pasar(requireModerador, req);
    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'mfa_required' }));
  });

  test('aal2: pasa', async () => {
    const req = await autenticar({ rol: 'moderador', aal: 'aal2' });
    expect(pasar(requireModerador, req).next).toHaveBeenCalled();
  });
});

describe('usuarios sin poder no se ven afectados', () => {
  test.each(['usuario', 'premium'])('%s con aal1 conserva su rol y no recibe mfaPendiente', async (rol) => {
    const req = await autenticar({ rol, aal: 'aal1' });
    expect(req.user.rol).toBe(rol);
    expect(req.user.mfaPendiente).toBeUndefined();
  });

  test('un usuario normal en requireAdmin recibe el 403 de siempre (no el de MFA)', async () => {
    const req = await autenticar({ rol: 'usuario', aal: 'aal2' });
    const { res } = pasar(requireAdmin, req);
    expect(res.json).toHaveBeenCalledWith({ ok: false, error: 'Requiere rol de administrador.' });
  });
});

describe('interruptor de emergencia ADMIN_MFA_REQUIRED=false', () => {
  test('desactiva la exigencia (admin con aal1 mantiene el poder)', async () => {
    process.env.ADMIN_MFA_REQUIRED = 'false';
    const req = await autenticar({ rol: 'admin', aal: 'aal1' });
    expect(req.user.rol).toBe('admin');
    expect(pasar(requireAdmin, req).next).toHaveBeenCalled();
  });

  test('cualquier otro valor (o ausente) sigue exigiendo MFA', async () => {
    process.env.ADMIN_MFA_REQUIRED = 'true';
    const req = await autenticar({ rol: 'admin', aal: 'aal1' });
    expect(req.user.mfaPendiente).toBe(true);
  });
});

describe('tryAuth (rutas publicas que muestran mas al admin, ej. borradores)', () => {
  async function conTryAuth({ rol, aal }) {
    simular({ rol, aal });
    const req = { headers: { authorization: 'Bearer token-falso' } };
    const next = jest.fn();
    await tryAuth(req, {}, next);
    expect(next).toHaveBeenCalled();
    return req;
  }

  test('admin aal1 NO ve los borradores: rol efectivo usuario', async () => {
    const req = await conTryAuth({ rol: 'admin', aal: 'aal1' });
    expect(req.user.rol).toBe('usuario');
  });

  test('admin aal2 si conserva el rol', async () => {
    const req = await conTryAuth({ rol: 'admin', aal: 'aal2' });
    expect(req.user.rol).toBe('admin');
  });
});

describe('GET /api/me (lo que lee el panel para decidir si pide el codigo)', () => {
  const { buildApp } = require('../app');
  const app = buildApp();

  test('admin aal1: devuelve el rol REAL y mfaPendiente=true', async () => {
    simular({ rol: 'admin', aal: 'aal1' });
    const res = await request(app).get('/api/me').set('Authorization', 'Bearer x');
    expect(res.status).toBe(200);
    expect(res.body.user.rol).toBe('admin');
    expect(res.body.mfaPendiente).toBe(true);
    expect(res.body.aal).toBe('aal1');
    expect(res.body.user.rolReal).toBeUndefined();
  });

  test('admin aal2: mfaPendiente=false', async () => {
    simular({ rol: 'admin', aal: 'aal2' });
    const res = await request(app).get('/api/me').set('Authorization', 'Bearer x');
    expect(res.body.user.rol).toBe('admin');
    expect(res.body.mfaPendiente).toBe(false);
    expect(res.body.aal).toBe('aal2');
  });

  test('usuario normal: sin cambios', async () => {
    simular({ rol: 'usuario', aal: 'aal1' });
    const res = await request(app).get('/api/me').set('Authorization', 'Bearer x');
    expect(res.body.user.rol).toBe('usuario');
    expect(res.body.mfaPendiente).toBe(false);
  });
});
