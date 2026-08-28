jest.mock('../middleware/auth', () => require('../test-utils/authMock'));
jest.mock('../db', () => ({ pool: { query: jest.fn() } }));

const request = require('supertest');
const { buildApp } = require('../app');
const { pool } = require('../db');

const app = buildApp();

const AUTOR = JSON.stringify({ id: 'user-autor', rol: 'usuario' });
const OTRO_USUARIO = JSON.stringify({ id: 'user-otro', rol: 'usuario' });
const ADMIN = JSON.stringify({ id: 'admin-1', rol: 'admin' });

const POST_VALIDO = { titulo: 'Un titulo valido', cuerpo: 'Un mensaje suficientemente largo.' };

beforeEach(() => {
  pool.query.mockReset();
});

describe('GET /api/foro/posts', () => {
  test('devuelve la lista de publicaciones', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'p1', titulo: 'Hola' }] });
    const res = await request(app).get('/api/foro/posts');
    expect(res.status).toBe(200);
    expect(res.body.posts).toHaveLength(1);
  });
});

describe('POST /api/foro/posts', () => {
  test('401 sin autenticacion', async () => {
    const res = await request(app).post('/api/foro/posts').send(POST_VALIDO);
    expect(res.status).toBe(401);
  });

  test('400 si el cuerpo es invalido', async () => {
    const res = await request(app).post('/api/foro/posts').set('x-test-user', AUTOR).send({ titulo: 'Hi' });
    expect(res.status).toBe(400);
  });

  test('201 al crear una publicacion valida', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'p1', autor_id: 'user-autor', ...POST_VALIDO }] });
    const res = await request(app).post('/api/foro/posts').set('x-test-user', AUTOR).send(POST_VALIDO);
    expect(res.status).toBe(201);
    expect(res.body.post.id).toBe('p1');
  });
});

describe('PATCH /api/foro/posts/:id (permisos)', () => {
  test('404 si la publicacion no existe', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .patch('/api/foro/posts/no-existe')
      .set('x-test-user', AUTOR)
      .send(POST_VALIDO);
    expect(res.status).toBe(404);
  });

  test('403 si el usuario no es el autor ni admin', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ autor_id: 'user-autor' }] });
    const res = await request(app)
      .patch('/api/foro/posts/p1')
      .set('x-test-user', OTRO_USUARIO)
      .send(POST_VALIDO);
    expect(res.status).toBe(403);
  });

  test('200 si el usuario es el autor', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ autor_id: 'user-autor' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'p1', autor_id: 'user-autor', titulo: 'Editado', cuerpo: POST_VALIDO.cuerpo }] });
    const res = await request(app)
      .patch('/api/foro/posts/p1')
      .set('x-test-user', AUTOR)
      .send({ titulo: 'Editado', cuerpo: POST_VALIDO.cuerpo });
    expect(res.status).toBe(200);
  });

  test('200 si el usuario es admin aunque no sea el autor', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ autor_id: 'user-autor' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'p1', autor_id: 'user-autor', titulo: 'Editado por admin', cuerpo: POST_VALIDO.cuerpo }] });
    const res = await request(app)
      .patch('/api/foro/posts/p1')
      .set('x-test-user', ADMIN)
      .send({ titulo: 'Editado por admin', cuerpo: POST_VALIDO.cuerpo });
    expect(res.status).toBe(200);
  });
});

describe('DELETE /api/foro/posts/:id (permisos)', () => {
  test('403 si el usuario no es el autor ni admin', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ autor_id: 'user-autor' }] });
    const res = await request(app).delete('/api/foro/posts/p1').set('x-test-user', OTRO_USUARIO);
    expect(res.status).toBe(403);
  });

  test('200 si el usuario es el autor', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ autor_id: 'user-autor' }] })
      .mockResolvedValueOnce({});
    const res = await request(app).delete('/api/foro/posts/p1').set('x-test-user', AUTOR);
    expect(res.status).toBe(200);
  });
});

describe('GET /api/foro/posts/:id', () => {
  test('404 si la publicacion no existe', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/foro/posts/no-existe');
    expect(res.status).toBe(404);
  });

  test('200 con la publicacion y sus comentarios', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'p1', titulo: 'Hola', autor_id: 'user-autor' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'c1', cuerpo: 'Un comentario' }] });
    const res = await request(app).get('/api/foro/posts/p1');
    expect(res.status).toBe(200);
    expect(res.body.post.id).toBe('p1');
    expect(res.body.comentarios).toHaveLength(1);
  });
});

describe('DELETE /api/foro/comentarios/:id (permisos)', () => {
  test('403 si el usuario no es el autor ni admin', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ autor_id: 'user-autor' }] });
    const res = await request(app).delete('/api/foro/comentarios/c1').set('x-test-user', OTRO_USUARIO);
    expect(res.status).toBe(403);
  });

  test('200 si el usuario es el autor del comentario', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ autor_id: 'user-autor' }] })
      .mockResolvedValueOnce({});
    const res = await request(app).delete('/api/foro/comentarios/c1').set('x-test-user', AUTOR);
    expect(res.status).toBe(200);
  });
});

describe('POST /api/foro/posts/:postId/comentarios', () => {
  test('404 si la publicacion no existe', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .post('/api/foro/posts/no-existe/comentarios')
      .set('x-test-user', AUTOR)
      .send({ cuerpo: 'Un comentario' });
    expect(res.status).toBe(404);
  });

  test('400 si el comentario es muy corto', async () => {
    const res = await request(app)
      .post('/api/foro/posts/p1/comentarios')
      .set('x-test-user', AUTOR)
      .send({ cuerpo: 'x' });
    expect(res.status).toBe(400);
  });

  test('201 al comentar una publicacion existente', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'p1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'c1', post_id: 'p1', cuerpo: 'Un comentario' }] });
    const res = await request(app)
      .post('/api/foro/posts/p1/comentarios')
      .set('x-test-user', AUTOR)
      .send({ cuerpo: 'Un comentario' });
    expect(res.status).toBe(201);
  });
});
