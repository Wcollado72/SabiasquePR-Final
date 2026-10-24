// Emisor/audiencia del JWT y cuentas suspendidas (auditoría de seguridad del proyecto, #8).
jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(() => 'jwks'),
  jwtVerify: jest.fn(),
}));
jest.mock('../db', () => ({ pool: { query: jest.fn() } }));

const { jwtVerify } = require('jose');
const { pool } = require('../db');
const { requireAuth, tryAuth } = require('./auth');

beforeEach(() => {
  process.env.SUPABASE_URL = 'https://proyecto.supabase.co';
  delete process.env.ADMIN_MFA_REQUIRED;
  jest.clearAllMocks();
});

const mockRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });
const reqConToken = () => ({ headers: { authorization: 'Bearer token-falso' } });

function simular(row) {
  jwtVerify.mockResolvedValue({ payload: { sub: 'u1', email: 'a@b.com', aal: 'aal1' } });
  pool.query.mockResolvedValue({ rows: [{ id: 'u1', email: 'a@b.com', rol: 'usuario', ...row }] });
}

describe('verificacion del JWT con emisor y audiencia', () => {
  test('requireAuth exige iss = <proyecto>/auth/v1 y aud = authenticated', async () => {
    simular({});
    await requireAuth(reqConToken(), mockRes(), jest.fn());
    expect(jwtVerify).toHaveBeenCalledWith('token-falso', 'jwks', {
      issuer: 'https://proyecto.supabase.co/auth/v1',
      audience: 'authenticated',
    });
  });

  test('tryAuth usa las mismas exigencias', async () => {
    simular({});
    await tryAuth(reqConToken(), {}, jest.fn());
    expect(jwtVerify).toHaveBeenCalledWith('token-falso', 'jwks', expect.objectContaining({
      issuer: 'https://proyecto.supabase.co/auth/v1', audience: 'authenticated',
    }));
  });

  test('un token con emisor/audiencia equivocados (jose lo rechaza) responde 401', async () => {
    jwtVerify.mockRejectedValue(new Error('unexpected "iss" claim value'));
    const res = mockRes();
    const next = jest.fn();
    await requireAuth(reqConToken(), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('cuentas suspendidas (ban en Supabase)', () => {
  const futuro = () => new Date(Date.now() + 3600 * 1000).toISOString();
  const pasado = () => new Date(Date.now() - 3600 * 1000).toISOString();

  test('requireAuth responde 401 "Cuenta suspendida." si banned_until esta en el futuro', async () => {
    simular({ banned_until: futuro() });
    const res = mockRes();
    const next = jest.fn();
    await requireAuth(reqConToken(), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ ok: false, error: 'Cuenta suspendida.' });
    expect(next).not.toHaveBeenCalled();
  });

  test('un ban ya vencido no bloquea, y banned_until no llega a req.user', async () => {
    simular({ banned_until: pasado() });
    const req = reqConToken();
    const next = jest.fn();
    await requireAuth(req, mockRes(), next);
    expect(next).toHaveBeenCalled();
    expect(req.user).not.toHaveProperty('banned_until');
  });

  test('sin ban (null) pasa normal', async () => {
    simular({ banned_until: null });
    const next = jest.fn();
    await requireAuth(reqConToken(), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('tryAuth trata a un suspendido como visitante anonimo', async () => {
    simular({ banned_until: futuro(), rol: 'premium' });
    const req = reqConToken();
    await tryAuth(req, {}, jest.fn());
    expect(req.user).toBeNull();
  });

  test('la consulta pide banned_until a auth.users (no se puede olvidar por accidente)', async () => {
    simular({});
    await requireAuth(reqConToken(), mockRes(), jest.fn());
    expect(pool.query.mock.calls[0][0]).toMatch(/auth\.users/);
    expect(pool.query.mock.calls[0][0]).toMatch(/banned_until/);
  });
});
