jest.mock('../middleware/auth', () => require('../test-utils/authMock'));
jest.mock('../db', () => ({ pool: { query: jest.fn(), connect: jest.fn() } }));

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
  pool.connect.mockReset();
});

// Cliente de transaccion falso: BEGIN, limpiar la destacada anterior, guardar, COMMIT
function mockClient(saveStep) {
  const client = {
    query: jest.fn()
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({}) // limpiar
      .mockImplementationOnce(saveStep) // guardar
      .mockResolvedValue({}), // COMMIT / ROLLBACK
    release: jest.fn(),
  };
  pool.connect.mockResolvedValueOnce(client);
  return client;
}

describe('GET /api/noticias', () => {
  test('devuelve la lista de noticias', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'a', titulo: 'A' }] });
    const res = await request(app).get('/api/noticias');
    expect(res.status).toBe(200);
    expect(res.body.noticias).toHaveLength(1);
  });

  test('filtra por categoria cuando se pasa ?categoria=', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'a', categoria: 'salud' }] });
    const res = await request(app).get('/api/noticias?categoria=salud');
    expect(res.status).toBe(200);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE categoria = \$1/);
    expect(params).toEqual(['salud']);
  });

  test('sin autenticacion, solo pide publicadas', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    await request(app).get('/api/noticias');
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/publicado = true/);
  });

  test('como admin, tambien incluye borradores', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    await request(app).get('/api/noticias').set('x-test-user', ADMIN);
    const [sql] = pool.query.mock.calls[0];
    expect(sql).not.toMatch(/publicado/);
  });
});

describe('GET /api/noticias/:id', () => {
  test('404 si no existe', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/noticias/no-existe');
    expect(res.status).toBe(404);
  });

  test('200 con la noticia si existe y esta publicada', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'a', titulo: 'A', publicado: true }] });
    const res = await request(app).get('/api/noticias/a');
    expect(res.status).toBe(200);
    expect(res.body.noticia.id).toBe('a');
  });

  test('404 si la noticia es un borrador y quien pregunta no es admin', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'a', titulo: 'A', publicado: false }] });
    const res = await request(app).get('/api/noticias/a');
    expect(res.status).toBe(404);
  });

  test('200 si la noticia es un borrador pero quien pregunta es admin', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'a', titulo: 'A', publicado: false }] });
    const res = await request(app).get('/api/noticias/a').set('x-test-user', ADMIN);
    expect(res.status).toBe(200);
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

  test('403 si el usuario es moderador (no tiene acceso a gestion de contenido)', async () => {
    const res = await request(app)
      .post('/api/noticias')
      .set('x-test-user', JSON.stringify({ id: 'mod-1', rol: 'moderador' }))
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

  test('201 persiste divulgacionIa en el INSERT', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'un-titulo-cualquiera' }] });
    const res = await request(app)
      .post('/api/noticias')
      .set('x-test-user', ADMIN)
      .send({ ...NOTICIA_VALIDA, divulgacionIa: 'parcial' });
    expect(res.status).toBe(201);
    const [sql, values] = pool.query.mock.calls[1];
    expect(sql).toMatch(/divulgacion_ia/);
    expect(values[values.length - 2]).toBe('parcial');
  });

  test('201 con publicado=false lo persiste como borrador (por defecto es true)', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'un-titulo-cualquiera' }] });
    const res = await request(app)
      .post('/api/noticias')
      .set('x-test-user', ADMIN)
      .send({ ...NOTICIA_VALIDA, publicado: false });
    expect(res.status).toBe(201);
    const [sql, values] = pool.query.mock.calls[1];
    expect(sql).toMatch(/publicado/);
    expect(values[values.length - 1]).toBe(false);
  });
});

describe('noticia destacada', () => {
  test('400 si destacado no es booleano', async () => {
    const res = await request(app)
      .post('/api/noticias')
      .set('x-test-user', ADMIN)
      .send({ ...NOTICIA_VALIDA, destacado: 'si' });
    expect(res.status).toBe(400);
  });

  test('POST con destacado=true limpia la anterior dentro de una transaccion', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // chequeo de id duplicado
    const client = mockClient(async () => ({ rows: [{ id: 'un-titulo-cualquiera', destacado: true }] }));
    const res = await request(app)
      .post('/api/noticias')
      .set('x-test-user', ADMIN)
      .send({ ...NOTICIA_VALIDA, destacado: true });
    expect(res.status).toBe(201);
    expect(res.body.noticia.destacado).toBe(true);
    const sqls = client.query.mock.calls.map((c) => c[0]);
    expect(sqls[0]).toBe('BEGIN');
    expect(sqls[1]).toMatch(/SET destacado = false/);
    expect(sqls[3]).toBe('COMMIT');
    expect(client.release).toHaveBeenCalled();
  });

  test('PUT con destacado=true hace ROLLBACK y libera el cliente si falla', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'a', ...NOTICIA_VALIDA }] }); // existente
    const client = mockClient(async () => { throw new Error('fallo'); });
    const res = await request(app)
      .put('/api/noticias/a')
      .set('x-test-user', ADMIN)
      .send({ destacado: true });
    expect(res.status).toBe(500);
    expect(client.query.mock.calls.map((c) => c[0])).toContain('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });

  test('PUT con destacado=false no abre transaccion', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'a', ...NOTICIA_VALIDA, destacado: true }] })
      .mockResolvedValueOnce({ rows: [{ id: 'a', destacado: false }] });
    const res = await request(app)
      .put('/api/noticias/a')
      .set('x-test-user', ADMIN)
      .send({ destacado: false });
    expect(res.status).toBe(200);
    expect(pool.connect).not.toHaveBeenCalled();
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
