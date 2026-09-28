jest.mock('../middleware/auth', () => require('../test-utils/authMock'));
jest.mock('../db', () => ({ pool: { query: jest.fn() } }));

const request = require('supertest');
const { buildApp } = require('../app');
const { pool } = require('../db');

const app = buildApp();

const ADMIN = JSON.stringify({ id: 'admin-1', rol: 'admin' });
const USUARIO = JSON.stringify({ id: 'user-1', rol: 'usuario' });
const MODERADOR = JSON.stringify({ id: 'mod-1', rol: 'moderador' });

const GASTO_VALIDO = { nombre: 'Claude Pro', estado: 'por_uso', costoMensualUsd: 20 };

beforeEach(() => pool.query.mockReset());

describe('acceso a /api/admin/gastos', () => {
  const rutas = [
    ['get', '/api/admin/gastos'],
    ['post', '/api/admin/gastos'],
    ['put', '/api/admin/gastos/x'],
    ['delete', '/api/admin/gastos/x'],
  ];

  test.each(rutas)('%s %s: 401 sin sesion', async (metodo, url) => {
    expect((await request(app)[metodo](url).send({})).status).toBe(401);
  });

  test.each(rutas)('%s %s: 403 para usuario y moderador -- es informacion financiera, mas estricto que Reportes', async (metodo, url) => {
    for (const quien of [USUARIO, MODERADOR]) {
      expect((await request(app)[metodo](url).set('x-test-user', quien).send({})).status).toBe(403);
    }
    expect(pool.query).not.toHaveBeenCalled();
  });
});

describe('GET /api/admin/gastos', () => {
  test('200 lista los servicios ordenados por nombre', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'claude-pro', nombre: 'Claude Pro' }] });
    const res = await request(app).get('/api/admin/gastos').set('x-test-user', ADMIN);
    expect(res.status).toBe(200);
    expect(res.body.servicios).toHaveLength(1);
    expect(pool.query.mock.calls[0][0]).toMatch(/ORDER BY nombre ASC/);
  });
});

describe('POST /api/admin/gastos', () => {
  test('400 con datos invalidos', async () => {
    const res = await request(app).post('/api/admin/gastos').set('x-test-user', ADMIN).send({ nombre: 'X' });
    expect(res.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('201 crea con id generado del nombre (slug)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // sin duplicado
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'claude-pro', ...GASTO_VALIDO }] });
    const res = await request(app).post('/api/admin/gastos').set('x-test-user', ADMIN).send(GASTO_VALIDO);
    expect(res.status).toBe(201);
    const [, params] = pool.query.mock.calls[1];
    expect(params[0]).toBe('claude-pro');
    expect(params).toEqual(['claude-pro', 'Claude Pro', 'por_uso', 20, null, null, null]);
  });

  test('si el slug ya existe, le agrega un sufijo', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'claude-pro' }] }); // duplicado
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'claude-pro-xyz' }] });
    const res = await request(app).post('/api/admin/gastos').set('x-test-user', ADMIN).send(GASTO_VALIDO);
    expect(res.status).toBe(201);
    expect(pool.query.mock.calls[1][1][0]).toMatch(/^claude-pro-/);
  });

  test('acepta un servicio gratis sin costo/fecha/enlace', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'github' }] });
    const res = await request(app).post('/api/admin/gastos').set('x-test-user', ADMIN).send({ nombre: 'GitHub', estado: 'gratis' });
    expect(res.status).toBe(201);
    expect(pool.query.mock.calls[1][1]).toEqual(['github', 'GitHub', 'gratis', null, null, null, null]);
  });
});

describe('PUT /api/admin/gastos/:id', () => {
  test('400 con estado invalido', async () => {
    const res = await request(app).put('/api/admin/gastos/claude-pro').set('x-test-user', ADMIN).send({ estado: 'inventado' });
    expect(res.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('404 si no existe', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).put('/api/admin/gastos/nada').set('x-test-user', ADMIN).send({ nombre: 'Nuevo nombre' });
    expect(res.status).toBe(404);
  });

  test('200 edita solo lo enviado, conserva el resto', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'claude-pro', nombre: 'Claude Pro', estado: 'por_uso', costo_mensual_usd: 20, fecha_renovacion: null, enlace_facturacion: null, notas: null }] });
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'claude-pro', estado: 'gratis_por_ahora' }] });
    const res = await request(app).put('/api/admin/gastos/claude-pro').set('x-test-user', ADMIN).send({ estado: 'gratis_por_ahora' });
    expect(res.status).toBe(200);
    const [sql, params] = pool.query.mock.calls[1];
    expect(sql).toMatch(/actualizado_en=now\(\)/);
    expect(params).toEqual(['claude-pro', 'Claude Pro', 'gratis_por_ahora', 20, null, null, null]);
  });
});

describe('DELETE /api/admin/gastos/:id', () => {
  test('200 borra, 404 si no existia', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });
    expect((await request(app).delete('/api/admin/gastos/claude-pro').set('x-test-user', ADMIN)).status).toBe(200);
    pool.query.mockResolvedValueOnce({ rowCount: 0 });
    expect((await request(app).delete('/api/admin/gastos/nada').set('x-test-user', ADMIN)).status).toBe(404);
  });
});
