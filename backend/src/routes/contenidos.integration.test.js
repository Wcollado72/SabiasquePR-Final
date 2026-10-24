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
  categoria: 'leyes-educativas',
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

  test('la lista y el detalle publicos devuelven ia_herramientas (tambien en contenido premium bloqueado)', async () => {
    const fila = { id: 'a', titulo: 'A', es_premium: true, cuerpo: 'Texto', url_media: 'https://x.com/v', divulgacion_ia: 'parcial', ia_herramientas: ['gemini'] };
    pool.query.mockResolvedValueOnce({ rows: [fila] });
    const lista = await request(app).get('/api/contenidos');
    expect(lista.body.contenidos[0].ia_herramientas).toEqual(['gemini']);
    pool.query.mockResolvedValueOnce({ rows: [fila] });
    const detalle = await request(app).get('/api/contenidos/a');
    expect(detalle.body.contenido.ia_herramientas).toEqual(['gemini']);
  });

  test('filtra por seccion, categoria y tipoFormato combinados', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/contenidos?seccion=educacion&categoria=descubrimientos&tipoFormato=video');
    expect(res.status).toBe(200);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE publicado = true AND seccion = \$1 AND categoria = \$2 AND tipo_formato = \$3/);
    expect(params).toEqual(['educacion', 'descubrimientos', 'video']);
  });

  test('filtra por tipoFormato=audio y por subformato', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/contenidos?tipoFormato=audio&subformato=podcast');
    expect(res.status).toBe(200);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE publicado = true AND tipo_formato = \$1 AND subformato = \$2/);
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
    expect(sql).toMatch(/WHERE publicado = true AND seccion = \$1 AND subseccion = \$2/);
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

  // 2026-09-27: se elimino el premium ligado a la seccion completa de
  // Logica Humana -- ver el sitio es gratis para cualquiera. El muro de
  // pago ahora depende solo de es_premium, sin importar la subseccion.
  test('un contenido de logica-humana con es_premium=false se ve completo para cualquiera', async () => {
    pool.query.mockResolvedValueOnce({ rows: [LOGICA_ROW] });
    const res = await request(app).get('/api/contenidos/lh1');
    expect(res.body.contenido.bloqueado).toBe(false);
    expect(res.body.contenido.cuerpo).toBe(LOGICA_ROW.cuerpo);
  });

  test('un contenido de logica-humana con es_premium=true SI se trunca para un usuario regular', async () => {
    const row = { ...LOGICA_ROW, id: 'lh2', es_premium: true };
    pool.query.mockResolvedValueOnce({ rows: [row] });
    const res = await request(app).get('/api/contenidos/lh2');
    expect(res.body.contenido.bloqueado).toBe(true);
    expect(res.body.contenido.cuerpo.length).toBeLessThan(310);
  });

  test('un contenido con es_premium=true se ve completo para un usuario premium', async () => {
    const row = { ...LOGICA_ROW, id: 'lh2', es_premium: true };
    pool.query.mockResolvedValueOnce({ rows: [row] });
    const PREMIUM_USER = JSON.stringify({ id: 'user-2', rol: 'premium' });
    const res = await request(app).get('/api/contenidos/lh2').set('x-test-user', PREMIUM_USER);
    expect(res.body.contenido.bloqueado).toBe(false);
    expect(res.body.contenido.cuerpo).toBe(row.cuerpo);
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
    expect(values.slice(16, 27)).toEqual([
      'entrevista', 'parcial', 'apa', 'Jane Doe', '2026', 'Titulo original', '2026-09-23', false, null, false, null,
    ]);
    expect(values[27]).toBe('es'); // idioma_original por defecto
  });

  test('201 persiste iaHerramientas (claves conocidas y nombre libre) en el INSERT', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'un-titulo-cualquiera' }] });
    const res = await request(app).post('/api/contenidos').set('x-test-user', ADMIN)
      .send({ ...CONTENIDO_VALIDO, divulgacionIa: 'parcial', iaHerramientas: ['Claude', 'Mi IA local'] });
    expect(res.status).toBe(201);
    const [sql, values] = pool.query.mock.calls[1];
    expect(sql).toMatch(/idioma_original, ia_herramientas/);
    expect(values[28]).toEqual(['claude', 'Mi IA local']);
  });

  test('201 sin iaHerramientas guarda una lista vacia', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'un-titulo-cualquiera' }] });
    await request(app).post('/api/contenidos').set('x-test-user', ADMIN).send(CONTENIDO_VALIDO);
    expect(pool.query.mock.calls[1][1][28]).toEqual([]);
  });

  test('400 con 9 herramientas, <script> o divulgacionIa "no" junto a una lista con elementos', async () => {
    const enviar = (extra) => request(app).post('/api/contenidos').set('x-test-user', ADMIN)
      .send({ ...CONTENIDO_VALIDO, ...extra });
    const nueve = Array.from({ length: 9 }, (_, i) => `IA ${i}`);
    expect((await enviar({ divulgacionIa: 'parcial', iaHerramientas: nueve })).status).toBe(400);
    expect((await enviar({ divulgacionIa: 'parcial', iaHerramientas: ['<script>'] })).status).toBe(400);
    const res = await enviar({ divulgacionIa: 'no', iaHerramientas: ['claude'] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Si indicas qué IA usaste, la divulgación no puede ser “No se usó IA”.');
  });

  test('400 al crear con iaHerramientas y sin divulgacionIa (se asume "no")', async () => {
    const res = await request(app).post('/api/contenidos').set('x-test-user', ADMIN)
      .send({ ...CONTENIDO_VALIDO, iaHerramientas: ['claude'] });
    expect(res.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
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
      categoria: 'cultura',
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
    // subformato..citaSinFuenteExterna, subseccion, esPremium, enfoque van antes de idioma_original e ia_herramientas
    expect(values.slice(-15, -4)).toEqual([
      'reportaje', 'parcial', 'apa', 'Jane Doe', '2026', 'Original', '2026-09-20', false, null, false, null,
    ]);
    expect(values[values.length - 4]).toBe('es');
    expect(values[values.length - 3]).toEqual([]);
    expect(values[values.length - 2]).toBe(true); // publicado se conserva
  });

  test('PUT sin iaHerramientas conserva las guardadas', async () => {
    const existente = { id: 'a', ...CONTENIDO_VALIDO, tipo_formato: 'ensayo', divulgacion_ia: 'parcial', ia_herramientas: ['claude', 'Otra IA'] };
    pool.query
      .mockResolvedValueOnce({ rows: [existente] })
      .mockResolvedValueOnce({ rows: [existente] });
    const res = await request(app).put('/api/contenidos/a').set('x-test-user', ADMIN).send({ titulo: 'Titulo editado' });
    expect(res.status).toBe(200);
    const [sql, values] = pool.query.mock.calls[1];
    expect(sql).toMatch(/ia_herramientas=\$29::text\[\]/);
    expect(values[values.length - 3]).toEqual(['claude', 'Otra IA']);
  });

  test('PUT con iaHerramientas las normaliza y las guarda', async () => {
    const existente = { id: 'a', ...CONTENIDO_VALIDO, tipo_formato: 'ensayo', divulgacion_ia: 'no', ia_herramientas: [] };
    pool.query
      .mockResolvedValueOnce({ rows: [existente] })
      .mockResolvedValueOnce({ rows: [{ id: 'a', ia_herramientas: ['gemini', 'Mi IA'] }] });
    const res = await request(app).put('/api/contenidos/a').set('x-test-user', ADMIN)
      .send({ divulgacionIa: 'generado', iaHerramientas: ['Gemini', ' Mi IA '] });
    expect(res.status).toBe(200);
    const [, values] = pool.query.mock.calls[1];
    expect(values[values.length - 3]).toEqual(['gemini', 'Mi IA']);
  });

  test('400 si iaHerramientas llega sin divulgacionIa y la pieza tiene divulgacion "no"', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'a', ...CONTENIDO_VALIDO, divulgacion_ia: 'no', ia_herramientas: [] }] });
    const res = await request(app).put('/api/contenidos/a').set('x-test-user', ADMIN).send({ iaHerramientas: ['claude'] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/divulgación no puede ser/);
    expect(pool.query).toHaveBeenCalledTimes(1); // no llego al UPDATE
  });

  test('PUT que cambia la divulgacion a "no" vacia las herramientas guardadas', async () => {
    const existente = { id: 'a', ...CONTENIDO_VALIDO, divulgacion_ia: 'parcial', ia_herramientas: ['claude'] };
    pool.query
      .mockResolvedValueOnce({ rows: [existente] })
      .mockResolvedValueOnce({ rows: [existente] });
    const res = await request(app).put('/api/contenidos/a').set('x-test-user', ADMIN).send({ divulgacionIa: 'no' });
    expect(res.status).toBe(200);
    const [, values] = pool.query.mock.calls[1];
    expect(values[values.length - 3]).toEqual([]);
  });
});

describe('DELETE /api/contenidos/:id', () => {
  test('403 si el usuario no es admin', async () => {
    const res = await request(app).delete('/api/contenidos/a').set('x-test-user', USUARIO);
    expect(res.status).toBe(403);
  });

  test('404 si el contenido no existe', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0 });
    const res = await request(app).delete('/api/contenidos/no-existe').set('x-test-user', ADMIN);
    expect(res.status).toBe(404);
  });

  test('borra en una sola sentencia el contenido, sus comentarios y sus traducciones (T-4)', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });
    const res = await request(app).delete('/api/contenidos/a').set('x-test-user', ADMIN);
    expect(res.status).toBe(200);
    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/^\s*WITH /);
    expect(sql).toMatch(/DELETE FROM contenidos WHERE id = \$1/);
    expect(sql).toMatch(/DELETE FROM comentarios WHERE tipo = 'contenido' AND item_id = \$1/);
    expect(sql).toMatch(/DELETE FROM traducciones WHERE tipo = 'contenido' AND item_id = \$1/);
    expect(params).toEqual(['a']);
  });

  test('200 al eliminar', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });
    const res = await request(app).delete('/api/contenidos/a').set('x-test-user', ADMIN);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('GET /api/contenidos?lang= (Fase C2)', () => {
  test('con ?lang=en superpone la traduccion y marca lo que no tiene', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'a', titulo: 'Hola', cuerpo: 'Cuerpo' }, { id: 'b', titulo: 'Adios', cuerpo: 'Otro' }] })
      .mockResolvedValueOnce({ rows: [{ item_id: 'a', campos: { titulo: 'Hello', cuerpo: 'Body' } }] });
    const res = await request(app).get('/api/contenidos?lang=en');
    expect(res.body.contenidos[0]).toMatchObject({ titulo: 'Hello', cuerpo: 'Body', sin_traduccion: false });
    expect(res.body.contenidos[1]).toMatchObject({ titulo: 'Adios', sin_traduccion: true });
  });

  test('el muro premium recorta el texto YA traducido, no el original', async () => {
    const largoEn = 'word '.repeat(200);
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'p', titulo: 'Premium', es_premium: true, cuerpo: 'palabra '.repeat(200), url_media: 'https://v.com/x' }] })
      .mockResolvedValueOnce({ rows: [{ item_id: 'p', campos: { cuerpo: largoEn } }] });
    const res = await request(app).get('/api/contenidos?lang=en');
    const c = res.body.contenidos[0];
    expect(c.bloqueado).toBe(true);
    expect(c.url_media).toBeNull();
    expect(c.cuerpo.startsWith('word')).toBe(true);
    expect(c.cuerpo.length).toBeLessThanOrEqual(301);
  });

  test('una pieza escrita en ingles se muestra tal cual con ?lang=en', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'e', titulo: 'Original', idioma_original: 'en' }] });
    const res = await request(app).get('/api/contenidos?lang=en');
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(res.body.contenidos[0]).toMatchObject({ titulo: 'Original', sin_traduccion: false, idioma_mostrado: 'en' });
  });

  test('el detalle acepta ?lang=en', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'a', titulo: 'Hola', es_premium: false }] })
      .mockResolvedValueOnce({ rows: [{ item_id: 'a', campos: { titulo: 'Hello' } }] });
    const res = await request(app).get('/api/contenidos/a?lang=en');
    expect(res.body.contenido.titulo).toBe('Hello');
  });
});

describe('borrador / AL AIRE (publicado)', () => {
  const FILA = { id: 'a', titulo: 'A', es_premium: false, cuerpo: 'x', divulgacion_ia: 'no', ia_herramientas: [] };

  test('el publico solo ve publicados; el admin ve tambien los borradores', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    await request(app).get('/api/contenidos');
    expect(pool.query.mock.calls[0][0]).toMatch(/WHERE publicado = true/);
    await request(app).get('/api/contenidos').set('x-test-user', USUARIO);
    expect(pool.query.mock.calls[1][0]).toMatch(/WHERE publicado = true/);
    await request(app).get('/api/contenidos').set('x-test-user', ADMIN);
    expect(pool.query.mock.calls[2][0]).not.toMatch(/publicado/);
  });

  test('el detalle de un borrador es 404 para el publico y 200 para el admin', async () => {
    pool.query.mockResolvedValue({ rows: [{ ...FILA, publicado: false }] });
    expect((await request(app).get('/api/contenidos/a')).status).toBe(404);
    expect((await request(app).get('/api/contenidos/a').set('x-test-user', USUARIO)).status).toBe(404);
    expect((await request(app).get('/api/contenidos/a').set('x-test-user', ADMIN)).status).toBe(200);
  });

  test('POST con publicado=false guarda el borrador sin destacar (aunque pidan destacado)', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'un-titulo-cualquiera' }] });
    const res = await request(app).post('/api/contenidos').set('x-test-user', ADMIN)
      .send({ ...CONTENIDO_VALIDO, publicado: false, destacado: true });
    expect(res.status).toBe(201);
    expect(pool.connect).not.toHaveBeenCalled(); // no abre la transaccion que limpia la destacada
    const [sql, values] = pool.query.mock.calls[1];
    expect(sql).toMatch(/ia_herramientas, publicado/);
    expect(values[15]).toBe(false); // destacado
    expect(values[29]).toBe(false); // publicado
  });

  test('POST sin publicado queda publicado (AL AIRE)', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'un-titulo-cualquiera' }] });
    await request(app).post('/api/contenidos').set('x-test-user', ADMIN).send(CONTENIDO_VALIDO);
    expect(pool.query.mock.calls[1][1][29]).toBe(true);
  });

  test('PUT puede pasar un contenido a borrador y le quita el destacado', async () => {
    const existente = { ...FILA, ...CONTENIDO_VALIDO, tipo_formato: 'ensayo', destacado: true, publicado: true };
    pool.query
      .mockResolvedValueOnce({ rows: [existente] })
      .mockResolvedValueOnce({ rows: [{ ...existente, publicado: false, destacado: false }] });
    const res = await request(app).put('/api/contenidos/a').set('x-test-user', ADMIN).send({ publicado: false });
    expect(res.status).toBe(200);
    const [, values] = pool.query.mock.calls[1];
    expect(values[15]).toBe(false);
    expect(values[29]).toBe(false);
  });

  test('400 si publicado no es booleano', async () => {
    const res = await request(app).post('/api/contenidos').set('x-test-user', ADMIN)
      .send({ ...CONTENIDO_VALIDO, publicado: 'si' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/publicado/);
  });
});
