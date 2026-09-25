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

  test('filtra por tipoFormato=audio y por subformato', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/contenidos?tipoFormato=audio&subformato=podcast');
    expect(res.status).toBe(200);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE tipo_formato = \$1 AND subformato = \$2/);
    expect(params).toEqual(['audio', 'podcast']);
  });

  test('la lista tambien oculta url_media de un video premium bloqueado', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'p1', es_premium: true, url_media: 'https://youtube.com/embed/x', cuerpo: 'x'.repeat(400) }],
    });
    const res = await request(app).get('/api/contenidos');
    expect(res.body.contenidos[0].bloqueado).toBe(true);
    expect(res.body.contenidos[0].url_media).toBeNull();
  });

  test('filtra por subseccion', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/contenidos?seccion=revolucion-humana&subseccion=logica-humana');
    expect(res.status).toBe(200);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE seccion = \$1 AND subseccion = \$2/);
    expect(params).toEqual(['revolucion-humana', 'logica-humana']);
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

  const PREMIUM_ROW = { id: 'p1', titulo: 'Ensayo premium', cuerpo: 'x'.repeat(500), url_media: 'https://youtube.com/embed/x', es_premium: true };

  test('un contenido no-premium nunca esta bloqueado', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'a', titulo: 'A', cuerpo: 'texto completo', es_premium: false }] });
    const res = await request(app).get('/api/contenidos/a');
    expect(res.body.contenido.bloqueado).toBe(false);
    expect(res.body.contenido.cuerpo).toBe('texto completo');
  });

  test('un contenido premium se trunca y oculta url_media sin sesion', async () => {
    pool.query.mockResolvedValueOnce({ rows: [PREMIUM_ROW] });
    const res = await request(app).get('/api/contenidos/p1');
    expect(res.body.contenido.bloqueado).toBe(true);
    expect(res.body.contenido.cuerpo.length).toBeLessThan(310);
    expect(res.body.contenido.cuerpo.endsWith('…')).toBe(true);
    expect(res.body.contenido.url_media).toBeNull();
  });

  test('un contenido premium se trunca para un usuario regular (no premium)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [PREMIUM_ROW] });
    const res = await request(app).get('/api/contenidos/p1').set('x-test-user', USUARIO);
    expect(res.body.contenido.bloqueado).toBe(true);
  });

  test('un contenido premium se ve completo para un usuario premium', async () => {
    pool.query.mockResolvedValueOnce({ rows: [PREMIUM_ROW] });
    const PREMIUM_USER = JSON.stringify({ id: 'user-2', rol: 'premium' });
    const res = await request(app).get('/api/contenidos/p1').set('x-test-user', PREMIUM_USER);
    expect(res.body.contenido.bloqueado).toBe(false);
    expect(res.body.contenido.cuerpo).toBe(PREMIUM_ROW.cuerpo);
    expect(res.body.contenido.url_media).toBe(PREMIUM_ROW.url_media);
  });

  test('un contenido premium se ve completo para un admin', async () => {
    pool.query.mockResolvedValueOnce({ rows: [PREMIUM_ROW] });
    const res = await request(app).get('/api/contenidos/p1').set('x-test-user', ADMIN);
    expect(res.body.contenido.bloqueado).toBe(false);
  });

  const LOGICA_ROW = { id: 'lh1', titulo: 'Idea', cuerpo: 'x'.repeat(500), url_media: null, es_premium: false, subseccion: 'logica-humana' };

  test('un contenido de logica-humana se trunca aunque es_premium sea false', async () => {
    pool.query.mockResolvedValueOnce({ rows: [LOGICA_ROW] });
    const res = await request(app).get('/api/contenidos/lh1');
    expect(res.body.contenido.bloqueado).toBe(true);
    expect(res.body.contenido.cuerpo.length).toBeLessThan(310);
  });

  test('un contenido de logica-humana se ve completo para un usuario premium', async () => {
    pool.query.mockResolvedValueOnce({ rows: [LOGICA_ROW] });
    const PREMIUM_USER = JSON.stringify({ id: 'user-2', rol: 'premium' });
    const res = await request(app).get('/api/contenidos/lh1').set('x-test-user', PREMIUM_USER);
    expect(res.body.contenido.bloqueado).toBe(false);
    expect(res.body.contenido.cuerpo).toBe(LOGICA_ROW.cuerpo);
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

  test('201 persiste subformato, divulgacionIa y los campos de cita en el INSERT', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] }) // chequeo de id duplicado
      .mockResolvedValueOnce({ rows: [{ id: 'un-titulo-cualquiera' }] }); // insert
    const body = {
      ...CONTENIDO_VALIDO,
      subformato: 'entrevista',
      divulgacionIa: 'parcial',
      citaEstilo: 'apa',
      citaAutor: 'Jane Doe',
      citaAnio: '2026',
      citaTituloOriginal: 'Titulo original',
      citaFechaAcceso: '2026-09-23',
      citaSinFuenteExterna: false,
    };
    const res = await request(app).post('/api/contenidos').set('x-test-user', ADMIN).send(body);
    expect(res.status).toBe(201);
    const [sql, values] = pool.query.mock.calls[1];
    expect(sql).toMatch(/subformato, divulgacion_ia, cita_estilo, cita_autor,\s*cita_anio, cita_titulo_original, cita_fecha_acceso, cita_sin_fuente_externa/);
    // Posiciones 17-27 del array toRow(): subformato..citaSinFuenteExterna, subseccion, esPremium, enfoque
    expect(values.slice(16)).toEqual([
      'entrevista', 'parcial', 'apa', 'Jane Doe', '2026', 'Titulo original', '2026-09-23', false, null, false, null,
    ]);
  });

  test('201 con tipoFormato "audio" y urlMedia', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'un-podcast' }] });
    const res = await request(app).post('/api/contenidos').set('x-test-user', ADMIN)
      .send({ ...CONTENIDO_VALIDO, tipoFormato: 'audio', urlMedia: 'https://example.com/audio.mp3' });
    expect(res.status).toBe(201);
  });

  test('201 con tipoFormato "foto" sin urlMedia', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'una-foto' }] });
    const res = await request(app).post('/api/contenidos').set('x-test-user', ADMIN)
      .send({ ...CONTENIDO_VALIDO, tipoFormato: 'foto' });
    expect(res.status).toBe(201);
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

  test('PUT parcial que solo cambia subformato no toca los demas campos nuevos', async () => {
    const existente = {
      id: 'a',
      seccion: 'educacion',
      tipo_formato: 'ensayo',
      categoria: 'general',
      titulo: 'Titulo',
      subtitulo_resumen: 'Resumen de diez caracteres.',
      duracion_min: 5,
      url_portada: 'images/educacion.webp',
      portada_alt: 'Alt',
      fecha_publicacion: '2026-01-15',
      destacado: false,
      subformato: null,
      divulgacion_ia: 'parcial',
      cita_estilo: 'apa',
      cita_autor: 'Jane Doe',
      cita_anio: '2026',
      cita_titulo_original: 'Original',
      cita_fecha_acceso: '2026-09-20',
      cita_sin_fuente_externa: false,
    };
    pool.query
      .mockResolvedValueOnce({ rows: [existente] })
      .mockResolvedValueOnce({ rows: [{ ...existente, subformato: 'reportaje' }] });
    const res = await request(app).put('/api/contenidos/a').set('x-test-user', ADMIN).send({ subformato: 'reportaje' });
    expect(res.status).toBe(200);
    const [, values] = pool.query.mock.calls[1];
    // subformato..citaSinFuenteExterna, subseccion, esPremium, enfoque son las ultimas 11 posiciones de toRow()
    expect(values.slice(-11)).toEqual([
      'reportaje', 'parcial', 'apa', 'Jane Doe', '2026', 'Original', '2026-09-20', false, null, false, null,
    ]);
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
