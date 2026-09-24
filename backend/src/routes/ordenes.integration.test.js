jest.mock('../middleware/auth', () => require('../test-utils/authMock'));
jest.mock('../db', () => ({ pool: { query: jest.fn() } }));

const request = require('supertest');
const { buildApp } = require('../app');
const { pool } = require('../db');

const app = buildApp();

const USUARIO = JSON.stringify({ id: 'user-1', rol: 'usuario' });

beforeEach(() => {
  pool.query.mockReset();
});

describe('GET /api/ordenes', () => {
  test('401 sin autenticacion', async () => {
    const res = await request(app).get('/api/ordenes');
    expect(res.status).toBe(401);
  });

  test('200 devuelve solo los pedidos del usuario autenticado', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'o1', items: [{ nombre: 'Taza', cantidad: 1, total: 12 }], total: 12, estado: 'pagada' }],
    });
    const res = await request(app).get('/api/ordenes').set('x-test-user', USUARIO);
    expect(res.status).toBe(200);
    expect(res.body.ordenes).toHaveLength(1);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE usuario_id = \$1/);
    expect(params).toEqual(['user-1']);
  });
});
