jest.mock('../middleware/auth', () => require('../test-utils/authMock'));
jest.mock('../db', () => ({ pool: { query: jest.fn() } }));

const request = require('supertest');
const { buildApp } = require('../app');
const { pool } = require('../db');

const app = buildApp();

const USUARIO = JSON.stringify({ id: 'user-1', email: 'a@ejemplo.com', rol: 'usuario' });
const OTRO_USUARIO = JSON.stringify({ id: 'user-2', email: 'b@ejemplo.com', rol: 'usuario' });
const ADMIN = JSON.stringify({ id: 'admin-1', email: 'admin@ejemplo.com', rol: 'admin' });

beforeEach(() => {
  pool.query.mockReset();
});

describe('GET /api/comentarios', () => {
  test('400 si faltan tipo o itemId', async () => {
    const res = await request(app).get('/api/comentarios?tipo=contenido');
    expect(res.status).toBe(400);
  });

  test('200 con la lista de comentarios de un item', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'c1', cuerpo: 'Hola', autor_nombre: 'Participante-ab12' }] });
    const res = await request(app).get('/api/comentarios?tipo=contenido&itemId=un-articulo');
    expect(res.status).toBe(200);
    expect(res.body.comentarios).toHaveLength(1);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE c.tipo = \$1 AND c.item_id = \$2/);
    expect(sql).toMatch(/AS autor_nombre/);
    expect(sql).not.toMatch(/email/i); // el correo del autor nunca sale en la API publica
    expect(JSON.stringify(res.body)).not.toMatch(/@/);
    expect(params).toEqual(['contenido', 'un-articulo']);
  });
});

describe('POST /api/comentarios', () => {
  test('401 sin autenticacion', async () => {
    const res = await request(app).post('/api/comentarios').send({ tipo: 'contenido', itemId: 'x', cuerpo: 'Hola' });
    expect(res.status).toBe(401);
  });

  test('400 si el cuerpo es muy corto', async () => {
    const res = await request(app).post('/api/comentarios')
      .set('x-test-user', USUARIO).send({ tipo: 'contenido', itemId: 'x', cuerpo: 'x' });
    expect(res.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('404 si el contenido/noticia referido no existe', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post('/api/comentarios')
      .set('x-test-user', USUARIO).send({ tipo: 'contenido', itemId: 'no-existe', cuerpo: 'Hola' });
    expect(res.status).toBe(404);
  });

  test('201 crea el comentario contra "contenidos" cuando tipo=contenido', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'un-articulo' }] }) // existe en contenidos
      .mockResolvedValueOnce({ rows: [{ id: 'c1', cuerpo: 'Hola', autor_id: 'user-1', creado_en: '2026-01-01', autor_nombre: 'Participante-ab12' }] });
    const res = await request(app).post('/api/comentarios')
      .set('x-test-user', USUARIO).send({ tipo: 'contenido', itemId: 'un-articulo', cuerpo: 'Hola' });
    expect(res.status).toBe(201);
    expect(res.body.comentario.autor_nombre).toBe('Participante-ab12');
    expect(res.body.comentario.autor_email).toBeUndefined();
    const [existsSql] = pool.query.mock.calls[0];
    expect(existsSql).toMatch(/FROM contenidos WHERE id/);
  });

  test('201 crea el comentario contra "noticias" cuando tipo=noticia', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'una-noticia' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'c2', cuerpo: 'Hola', autor_id: 'user-1', creado_en: '2026-01-01' }] });
    await request(app).post('/api/comentarios')
      .set('x-test-user', USUARIO).send({ tipo: 'noticia', itemId: 'una-noticia', cuerpo: 'Hola' });
    const [existsSql] = pool.query.mock.calls[0];
    expect(existsSql).toMatch(/FROM noticias WHERE id/);
  });
});

describe('DELETE /api/comentarios/:id', () => {
  test('401 sin autenticacion', async () => {
    const res = await request(app).delete('/api/comentarios/c1');
    expect(res.status).toBe(401);
  });

  test('404 si el comentario no existe', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).delete('/api/comentarios/no-existe').set('x-test-user', USUARIO);
    expect(res.status).toBe(404);
  });

  test('403 si no es el dueño ni admin', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ autor_id: 'user-1' }] });
    const res = await request(app).delete('/api/comentarios/c1').set('x-test-user', OTRO_USUARIO);
    expect(res.status).toBe(403);
  });

  test('200 si es el dueño', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ autor_id: 'user-1' }] })
      .mockResolvedValueOnce({});
    const res = await request(app).delete('/api/comentarios/c1').set('x-test-user', USUARIO);
    expect(res.status).toBe(200);
  });

  test('200 si es admin borrando el comentario de otro', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ autor_id: 'user-1' }] })
      .mockResolvedValueOnce({});
    const res = await request(app).delete('/api/comentarios/c1').set('x-test-user', ADMIN);
    expect(res.status).toBe(200);
  });

  test('200 si es moderador borrando el comentario de otro', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ autor_id: 'user-1' }] })
      .mockResolvedValueOnce({});
    const res = await request(app).delete('/api/comentarios/c1')
      .set('x-test-user', JSON.stringify({ id: 'mod-1', rol: 'moderador' }));
    expect(res.status).toBe(200);
  });
});
