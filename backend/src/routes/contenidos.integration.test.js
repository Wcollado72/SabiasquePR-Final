jest.mock('../middleware/auth', () => require('../test-utils/authMock'));
jest.mock('../db', () => ({ pool: { query: jest.fn(), connect: jest.fn() } }));

const request = require('supertest');
const { buildApp } = require('../app');
const { pool } = require('../db');

const app = buildApp();

const ADMIN = JSON.stringify({ id: 'admin-1', rol: 'admin' });
const USUARIO = JSON.stringify({ id: 'user-1', rol: 'usuario' });

const CONTENIDO_VALIDO = {
  seccion: 'educacion',
  tipoFormato: 'lectura_corta',
  titulo: 'Un titulo cualquiera',
  subtituloResumen: 'Un resumen de al menos diez caracteres.',
  urlPortada: 'images/educacion.webp',
  portadaAlt: 'Descripcion',
  fechaPublicacion: '2026-01-15',
};

beforeEach(() => {
  pool.query.mockReset();
  pool.connect.mockReset();
});

function mockClient(saveStep) {
  const client = {
    query: jest.fn()
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({}) // limpiar la destacada de la misma seccion
      .mockImplementationOnce(saveStep) // guardar
      .mockResolvedValue({}), // COMMIT / ROLLBACK
    release: jest.fn(),
  };
  pool.connect.mockResolvedValueOnce(client);
  return client;
}

describe('GET /api/contenidos', () => {
  test('devuelve la lista', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'a', titulo: 'A' }] });
    const res = await request(app).get('/api/contenidos');
    expect(res.status).toBe(200);
    expect(res.body.contenidos).toHaveLength(1);
  });

  test('filtra por seccion, categoria y tipoFormato combinados', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/contenidos?seccion=educacion&categoria=descubrimientos&tipoFormato=video');
    expect(res.status).toBe(200);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE seccion = \$1 AND categoria = \$2 AND tipo_formato = \$3/);
    expect(params).toEqual(['educacion', 'descubrimientos', 'video']);
  });
});

describe('GET /api/contenidos/:id', () => {
  test('404 si no existe', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/contenidos/no-existe');
    expect(res.status).toBe(404);
  });

  test('200 con el contenido si existe', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'a', titulo: 'A' }] });
    const res = await request(app).get('/api/contenidos/a');
    expect(res.status).toBe(200);
    expect(res.body.contenido.id).toBe('a');
  });
});

describe('POST /api/contenidos', () => {
  test('401 sin autenticacion', async () => {
    const res = await request(app).post('/api/contenidos').send(CONTENIDO_VALIDO);
    expect(res.status).toBe(401);
  });

  test('403 si el usuario no es admin', async () => {
    const res = await request(app).post('/api/contenidos').set('x-test-user', USUARIO).send(CONTENIDO_VALIDO);
    expect(res.status).toBe(403);
  });

  test('400 si el cuerpo es invalido', async () => {
    const res = await request(app).post('/api/contenidos').set('x-test-user', ADMIN).send({ titulo: 'Hi' });
    expect(res.status).toBe(400);
  });

  test('400 si es video sin urlMedia', async () => {
    const res = await request(app).post('/api/contenidos').set('x-test-user', ADMIN)
      .send({ ...CONTENIDO_VALIDO, tipoFormato: 'video' });
    expect(res.status).toBe(400);
  });

  test('201 al crear sin destacar (sin abrir transaccion)', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] }) // chequeo de id duplicado
      .mockResolvedValueOnce({ rows: [{ id: 'un-titulo-cualquiera', ...CONTENIDO_VALIDO }] }); // insert
    const res = await request(app).post('/api/contenidos').set('x-test-user', ADMIN).send(CONTENIDO_VALIDO);
    expect(res.status).toBe(201);
    expect(res.body.contenido.id).toBe('un-titulo-cualquiera');
    expect(pool.connect).not.toHaveBeenCalled();
  });

  test('201 con destacado=true limpia el destacado anterior de la MISMA seccion', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // chequeo de id duplicado
    const client = mockClient(async () => ({ rows: [{ id: 'un-titulo-cualquiera', destacado: true }] }));
    const res = await request(app).post('/api/contenidos').set('x-test-user', ADMIN)
      .send({ ...CONTENIDO_VALIDO, destacado: true });
    expect(res.status).toBe(201);
    const [sql, params] = client.query.mock.calls[1];
    expect(sql).toMatch(/SET destacado = false WHERE destacado AND seccion = \$1/);
    expect(params[0]).toBe('educacion');
  });
});

describe('PUT /api/contenidos/:id', () => {
  test('404 si no existe', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).put('/api/contenidos/no-existe').set('x-test-user', ADMIN).send({ titulo: 'Nuevo' });
    expect(res.status).toBe(404);
  });

  test('200 al editar un contenido existente', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'a', ...CONTENIDO_VALIDO }] })
      .mockResolvedValueOnce({ rows: [{ id: 'a', titulo: 'Titulo editado' }] });
    const res = await request(app).put('/api/contenidos/a').set('x-test-user', ADMIN).send({ titulo: 'Titulo editado' });
    expect(res.status).toBe(200);
    expect(res.body.contenido.titulo).toBe('Titulo editado');
  });
});

describe('DELETE /api/contenidos/:id', () => {
  test('403 si el usuario no es admin', async () => {
    const res = await request(app).delete('/api/contenidos/a').set('x-test-user', USUARIO);
    expect(res.status).toBe(403);
  });

  test('200 al eliminar', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });
    const res = await request(app).delete('/api/contenidos/a').set('x-test-user', ADMIN);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
