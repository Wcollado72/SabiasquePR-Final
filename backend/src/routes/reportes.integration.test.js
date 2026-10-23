jest.mock('../middleware/auth', () => require('../test-utils/authMock'));
jest.mock('../db', () => ({ pool: { query: jest.fn() } }));

const request = require('supertest');
const { buildApp } = require('../app');
const { pool } = require('../db');

const app = buildApp();

const USUARIO = JSON.stringify({ id: 'user-1', email: 'a@ejemplo.com', rol: 'usuario' });
const ADMIN = JSON.stringify({ id: 'admin-1', email: 'admin@ejemplo.com', rol: 'admin' });
const MODERADOR = JSON.stringify({ id: 'mod-1', email: 'mod@ejemplo.com', rol: 'moderador' });

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

describe('POST /api/reportes -- comentarios de articulos y duplicados (Fase 6)', () => {
  test('201 al reportar un comentario de noticia o contenido (articulo_comentario)', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'c9' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'r9', tipo: 'articulo_comentario', item_id: 'c9', estado: 'pendiente' }] });
    const res = await request(app).post('/api/reportes')
      .set('x-test-user', USUARIO).send({ tipo: 'articulo_comentario', itemId: 'c9', motivo: 'Insulta a otra persona.' });
    expect(res.status).toBe(201);
    expect(pool.query.mock.calls[0][0]).toMatch(/FROM comentarios WHERE id/);
  });

  test('409 si esa persona ya tiene un reporte pendiente del mismo elemento', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'p1' }] })
      .mockResolvedValueOnce({ rows: [] }); // ON CONFLICT DO NOTHING no devuelve fila
    const res = await request(app).post('/api/reportes')
      .set('x-test-user', USUARIO).send({ tipo: 'debate_post', itemId: 'p1', motivo: 'Otra vez lo mismo.' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/pendiente/);
    expect(pool.query.mock.calls[1][0]).toMatch(/ON CONFLICT \(tipo, item_id, reportado_por\)/);
  });

  test('GET une el comentario de articulo con su noticia o contenido', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    await request(app).get('/api/reportes').set('x-test-user', ADMIN);
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/LEFT JOIN comentarios ac ON r\.tipo = 'articulo_comentario'/);
    expect(sql).toMatch(/ac\.item_id AS contenido_articulo_id/);
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

  test('200 con la lista para un moderador', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'r1', estado: 'pendiente' }] });
    const res = await request(app).get('/api/reportes').set('x-test-user', MODERADOR);
    expect(res.status).toBe(200);
    expect(res.body.reportes).toHaveLength(1);
  });
});

describe('GET /api/reportes -- contenido reportado (R-1)', () => {
  test('la consulta une el texto reportado y usa el nombre visible, nunca el correo del autor', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{
      id: 'r1', tipo: 'debate_post', estado: 'pendiente', contenido_existe: true,
      contenido_titulo: 'Titulo', contenido_cuerpo: 'Texto reportado', contenido_autor_nombre: 'Participante-ab12',
    }] });
    const res = await request(app).get('/api/reportes').set('x-test-user', MODERADOR);
    expect(res.status).toBe(200);
    expect(res.body.reportes[0]).toMatchObject({ contenido_existe: true, contenido_titulo: 'Titulo', contenido_cuerpo: 'Texto reportado' });
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/LEFT JOIN foro_posts fp/);
    expect(sql).toMatch(/LEFT JOIN foro_comentarios fc/);
    expect(sql).toMatch(/AS contenido_autor_nombre/);
    expect(sql).toMatch(/AS contenido_existe/);
    expect(sql).toMatch(/r\.automatico/); // los reportes automaticos tambien traen el texto (mismos joins)
    expect(sql).not.toMatch(/au\.email/); // el correo del autor reportado nunca sale
  });

  test('filtra por estado con parametro', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    await request(app).get('/api/reportes?estado=pendiente').set('x-test-user', ADMIN);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE r\.estado = \$1/);
    expect(params).toEqual(['pendiente']);
  });
});

describe('PATCH /api/reportes/:id', () => {
  test('200 al reabrir un reporte (volver a pendiente)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'r1', estado: 'pendiente' }] });
    const res = await request(app).patch('/api/reportes/r1').set('x-test-user', MODERADOR).send({ estado: 'pendiente' });
    expect(res.status).toBe(200);
    expect(pool.query.mock.calls[0][1]).toEqual(['pendiente', 'r1']);
  });

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

  test('200 al marcar un reporte como revisado (moderador)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'r1', estado: 'revisado' }] });
    const res = await request(app).patch('/api/reportes/r1').set('x-test-user', MODERADOR).send({ estado: 'revisado' });
    expect(res.status).toBe(200);
  });
});
