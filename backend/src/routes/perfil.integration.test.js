jest.mock('../middleware/auth', () => require('../test-utils/authMock'));
jest.mock('../db', () => ({ pool: { query: jest.fn(), connect: jest.fn() } }));

const request = require('supertest');
const { buildApp } = require('../app');
const { pool } = require('../db');

const app = buildApp();

const USUARIO = JSON.stringify({ id: 'user-1', email: 'a@ejemplo.com', rol: 'usuario', nombre: null });

beforeEach(() => {
  pool.query.mockReset();
});

describe('PUT /api/perfil', () => {
  test('401 sin autenticacion', async () => {
    const res = await request(app).put('/api/perfil').send({ nombre: 'Ana' });
    expect(res.status).toBe(401);
  });

  test('400 si el nombre es demasiado largo', async () => {
    const res = await request(app).put('/api/perfil')
      .set('x-test-user', USUARIO).send({ nombre: 'a'.repeat(81) });
    expect(res.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('200 actualiza el nombre del usuario autenticado', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'user-1', email: 'a@ejemplo.com', rol: 'usuario', nombre: 'Ana' }],
    });
    const res = await request(app).put('/api/perfil')
      .set('x-test-user', USUARIO).send({ nombre: '  Ana  ' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      user: { id: 'user-1', email: 'a@ejemplo.com', rol: 'usuario', nombre: 'Ana' },
    });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/UPDATE perfiles/);
    expect(params).toEqual(['user-1', 'Ana']);
  });

  test('un usuario no puede editar el perfil de otro (usa siempre req.user.id)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'user-1', nombre: 'Ana' }] });
    await request(app).put('/api/perfil').set('x-test-user', USUARIO).send({ nombre: 'Ana', id: 'otro-id' });
    const [, params] = pool.query.mock.calls[0];
    expect(params[0]).toBe('user-1');
  });
});
