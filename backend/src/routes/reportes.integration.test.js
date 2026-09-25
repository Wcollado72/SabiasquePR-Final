jest.mock('../middleware/auth', () => require('../test-utils/authMock'));
jest.mock('../db', () => ({ pool: { query: jest.fn() } }));

const request = require('supertest');
const { buildApp } = require('../app');
const { pool } = require('../db');

const app = buildApp();

const USUARIO = JSON.stringify({ id: 'user-1', email: 'a@ejemplo.com', rol: 'usuario' });
const ADMIN = JSON.stringify({ id: 'admin-1', email: 'admin@ejemplo.com', rol: 'admin' });

beforeEach(() => {
  pool.query.mockReset();
});

describe('POST /api/reportes', () => {
  test('401 sin autenticacion', async () => {
    const res = await request(app).post('/api/reportes').send({ tipo: 'debate_post', itemId: 'p1', motivo: 'Amenaza directa.' });
    expect(res.status).toBe(401);
  });

  test('400 si el body es invalido', async () => {
    const res = await request(app).post('/api/reportes')
      .set('x-test-user', USUARIO).send({ tipo: 'otro', itemId: 'p1', motivo: 'x' });
    expect(res.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('404 si el elemento reportado no existe', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post('/api/reportes')
      .set('x-test-user', USUARIO).send({ tipo: 'debate_post', itemId: 'no-existe', motivo: 'Amenaza directa.' });
    expect(res.status).toBe(404);
  });

  test('201 al reportar un post existente (no exige edad_confirmada)', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'p1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'r1', tipo: 'debate_post', item_id: 'p1', estado: 'pendiente' }] });
    const res = await request(app).post('/api/reportes')
      .set('x-test-user', JSON.stringify({ id: 'user-1', rol: 'usuario', edad_confirmada: false }))
      .send({ tipo: 'debate_post', itemId: 'p1', motivo: 'Amenaza directa.' });
    expect(res.status).toBe(201);
    const [existsSql] = pool.query.mock.calls[0];
    expect(existsSql).toMatch(/FROM foro_posts WHERE id/);
  });

  test('201 al reportar un comentario existente', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'c1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'r2', tipo: 'debate_comentario', item_id: 'c1', estado: 'pendiente' }] });
    const res = await request(app).post('/api/reportes')
      .set('x-test-user', USUARIO).send({ tipo: 'debate_comentario', itemId: 'c1', motivo: 'Acoso directo.' });
    expect(res.status).toBe(201);
    const [existsSql] = pool.query.mock.calls[0];
    expect(existsSql).toMatch(/FROM foro_comentarios WHERE id/);
  });
});

describe('GET /api/reportes', () => {
  test('401 sin autenticacion', async () => {
    const res = await request(app).get('/api/reportes');
    expect(res.status).toBe(401);
  });

  test('403 si no es admin', async () => {
    const res = await request(app).get('/api/reportes').set('x-test-user', USUARIO);
    expect(res.status).toBe(403);
  });

  test('200 con la lista para un admin', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'r1', estado: 'pendiente' }] });
    const res = await request(app).get('/api/reportes').set('x-test-user', ADMIN);
    expect(res.status).toBe(200);
    expect(res.body.reportes).toHaveLength(1);
  });
});

describe('PATCH /api/reportes/:id', () => {
  test('403 si no es admin', async () => {
    const res = await request(app).patch('/api/reportes/r1').set('x-test-user', USUARIO).send({ estado: 'revisado' });
    expect(res.status).toBe(403);
  });

  test('400 si el estado no es valido', async () => {
    const res = await request(app).patch('/api/reportes/r1').set('x-test-user', ADMIN).send({ estado: 'otro' });
    expect(res.status).toBe(400);
  });

  test('404 si el reporte no existe', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).patch('/api/reportes/no-existe').set('x-test-user', ADMIN).send({ estado: 'revisado' });
    expect(res.status).toBe(404);
  });

  test('200 al marcar un reporte como revisado', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'r1', estado: 'revisado' }] });
    const res = await request(app).patch('/api/reportes/r1').set('x-test-user', ADMIN).send({ estado: 'revisado' });
    expect(res.status).toBe(200);
    expect(res.body.reporte.estado).toBe('revisado');
  });
});
