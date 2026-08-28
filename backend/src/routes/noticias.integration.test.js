jest.mock('../middleware/auth', () => require('../test-utils/authMock'));
jest.mock('../db', () => ({ pool: { query: jest.fn() } }));

const request = require('supertest');
const { buildApp } = require('../app');
const { pool } = require('../db');

const app = buildApp();

const ADMIN = JSON.stringify({ id: 'admin-1', rol: 'admin' });
const USUARIO = JSON.stringify({ id: 'user-1', rol: 'usuario' });

const NOTICIA_VALIDA = {
  titulo: 'Un titulo cualquiera',
  fecha: '2026-01-15',
  imagen: 'images/foto.webp',
  imagenAlt: 'Descripcion',
  fuenteUrl: 'https://ejemplo.com',
  fuenteTexto: 'Ejemplo News',
  parrafos: ['Primer parrafo.'],
};

beforeEach(() => {
  pool.query.mockReset();
});

describe('GET /api/noticias', () => {
  test('devuelve la lista de noticias', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'a', titulo: 'A' }] });
    const res = await request(app).get('/api/noticias');
    expect(res.status).toBe(200);
    expect(res.body.noticias).toHaveLength(1);
  });
});

describe('GET /api/noticias/:id', () => {
  test('404 si no existe', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/noticias/no-existe');
    expect(res.status).toBe(404);
  });

  test('200 con la noticia si existe', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'a', titulo: 'A' }] });
    const res = await request(app).get('/api/noticias/a');
    expect(res.status).toBe(200);
    expect(res.body.noticia.id).toBe('a');
  });
});

describe('POST /api/noticias', () => {
  test('401 sin autenticacion', async () => {
    const res = await request(app).post('/api/noticias').send(NOTICIA_VALIDA);
    expect(res.status).toBe(401);
  });

  test('403 si el usuario no es admin', async () => {
    const res = await request(app)
      .post('/api/noticias')
      .set('x-test-user', USUARIO)
      .send(NOTICIA_VALIDA);
    expect(res.status).toBe(403);
  });

  test('400 si el cuerpo es invalido', async () => {
    const res = await request(app)
      .post('/api/noticias')
      .set('x-test-user', ADMIN)
      .send({ titulo: 'Hi' });
    expect(res.status).toBe(400);
  });

  test('201 al crear una noticia valida como admin', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] }) // chequeo de id duplicado
      .mockResolvedValueOnce({ rows: [{ id: 'un-titulo-cualquiera', ...NOTICIA_VALIDA }] }); // insert
    const res = await request(app)
      .post('/api/noticias')
      .set('x-test-user', ADMIN)
      .send(NOTICIA_VALIDA);
    expect(res.status).toBe(201);
    expect(res.body.noticia.id).toBe('un-titulo-cualquiera');
  });
});

describe('PUT /api/noticias/:id', () => {
  test('401 sin autenticacion', async () => {
    const res = await request(app).put('/api/noticias/a').send({ titulo: 'Nuevo' });
    expect(res.status).toBe(401);
  });

  test('404 si la noticia no existe', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .put('/api/noticias/no-existe')
      .set('x-test-user', ADMIN)
      .send({ titulo: 'Nuevo titulo' });
    expect(res.status).toBe(404);
  });

  test('200 al editar una noticia existente', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'a', ...NOTICIA_VALIDA }] }) // existente
      .mockResolvedValueOnce({ rows: [{ id: 'a', titulo: 'Titulo editado' }] }); // update
    const res = await request(app)
      .put('/api/noticias/a')
      .set('x-test-user', ADMIN)
      .send({ titulo: 'Titulo editado' });
    expect(res.status).toBe(200);
    expect(res.body.noticia.titulo).toBe('Titulo editado');
  });
});

describe('DELETE /api/noticias/:id', () => {
  test('403 si el usuario no es admin', async () => {
    const res = await request(app).delete('/api/noticias/a').set('x-test-user', USUARIO);
    expect(res.status).toBe(403);
  });

  test('404 si no existe', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0 });
    const res = await request(app).delete('/api/noticias/no-existe').set('x-test-user', ADMIN);
    expect(res.status).toBe(404);
  });

  test('200 al eliminar una noticia existente', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });
    const res = await request(app).delete('/api/noticias/a').set('x-test-user', ADMIN);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
