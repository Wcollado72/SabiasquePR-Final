jest.mock('../middleware/auth', () => require('../test-utils/authMock'));
jest.mock('../db', () => ({ pool: { query: jest.fn(), connect: jest.fn() } }));

const request = require('supertest');
const { buildApp } = require('../app');
const { pool } = require('../db');

const app = buildApp();

const COLABORADOR = JSON.stringify({ id: 'u-1', email: 'a@ejemplo.com', rol: 'premium' });
const USUARIO = JSON.stringify({ id: 'u-2', email: 'b@ejemplo.com', rol: 'usuario' });
const ADMIN = JSON.stringify({ id: 'u-3', email: 'c@ejemplo.com', rol: 'admin' });

beforeEach(() => pool.query.mockReset());

describe('GET /api/agradecimientos (público)', () => {
  test('200 con la lista de nombres, sin pedir sesión', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ nombre: 'Ana' }, { nombre: 'María José' }] });
    const res = await request(app).get('/api/agradecimientos');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, nombres: ['Ana', 'María José'] });
  });

  test('solo consulta colaboradores activos con autorización, sin cuentas suspendidas, y devuelve solo el nombre', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    await request(app).get('/api/agradecimientos');
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/p\.rol = 'premium'/);
    expect(sql).toMatch(/agradecimiento_nombre IS NOT NULL/);
    expect(sql).toMatch(/banned_until/);
    expect(sql).toMatch(/LIMIT 200/);
    expect(sql).not.toMatch(/email/i);
  });

  test('lista vacía es válida', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/agradecimientos');
    expect(res.body).toEqual({ ok: true, nombres: [] });
  });

  test('un error de base de datos devuelve 500 genérico (sin filtrar detalles)', async () => {
    pool.query.mockRejectedValueOnce(new Error('relation "perfiles" secreto'));
    const res = await request(app).get('/api/agradecimientos');
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/secreto|perfiles/);
  });
});

describe('PUT /api/perfil/agradecimiento (autorizar)', () => {
  test('401 sin sesión', async () => {
    const res = await request(app).put('/api/perfil/agradecimiento').send({ nombre: 'Ana' });
    expect(res.status).toBe(401);
  });

  test('403 si la cuenta no apoya cada mes', async () => {
    const res = await request(app).put('/api/perfil/agradecimiento').set('x-test-user', USUARIO).send({ nombre: 'Ana' });
    expect(res.status).toBe(403);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test.each(['', 'A', '<b>x</b>', 'a@b.com', 'x'.repeat(41)])('400 con un nombre inválido (%s)', async (nombre) => {
    const res = await request(app).put('/api/perfil/agradecimiento').set('x-test-user', COLABORADOR).send({ nombre });
    expect(res.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('200 un colaborador autoriza su nombre; se limpia y se guarda solo para su propia cuenta', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ nombre: 'María José', autorizado_en: '2026-10-13T00:00:00Z' }] });
    const res = await request(app).put('/api/perfil/agradecimiento').set('x-test-user', COLABORADOR).send({ nombre: '  María   José ' });
    expect(res.status).toBe(200);
    expect(res.body.nombre).toBe('María José');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/UPDATE perfiles/);
    expect(sql).toMatch(/COALESCE\(agradecimiento_autorizado_en, now\(\)\)/); // conserva la fecha del primer consentimiento
    expect(params).toEqual(['u-1', 'María José']);
  });

  test('el admin también puede aparecer', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ nombre: 'Equipo', autorizado_en: '2026-10-13T00:00:00Z' }] });
    const res = await request(app).put('/api/perfil/agradecimiento').set('x-test-user', ADMIN).send({ nombre: 'Equipo' });
    expect(res.status).toBe(200);
  });
});

describe('GET y DELETE /api/perfil/agradecimiento', () => {
  test('GET devuelve el estado de la propia cuenta y si puede aparecer', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ nombre: 'Ana', autorizado_en: '2026-10-13T00:00:00Z' }] });
    const res = await request(app).get('/api/perfil/agradecimiento').set('x-test-user', COLABORADOR);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, puede: true, nombre: 'Ana' });
    expect(pool.query.mock.calls[0][1]).toEqual(['u-1']);
  });

  test('GET: una cuenta gratuita ve que no puede', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ nombre: null, autorizado_en: null }] });
    const res = await request(app).get('/api/perfil/agradecimiento').set('x-test-user', USUARIO);
    expect(res.body).toMatchObject({ ok: true, puede: false, nombre: null });
  });

  test('DELETE retira la autorización de la propia cuenta, incluso si ya no es colaborador', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).delete('/api/perfil/agradecimiento').set('x-test-user', USUARIO);
    expect(res.status).toBe(200);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/agradecimiento_nombre = NULL, agradecimiento_autorizado_en = NULL/);
    expect(params).toEqual(['u-2']);
  });

  test('DELETE sin sesión: 401', async () => {
    const res = await request(app).delete('/api/perfil/agradecimiento');
    expect(res.status).toBe(401);
  });
});
