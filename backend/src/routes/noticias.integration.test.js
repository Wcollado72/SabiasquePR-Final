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
  categoria: 'salud',
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

  test('la lista y el detalle publicos devuelven ia_herramientas', async () => {
    const fila = { id: 'a', titulo: 'A', publicado: true, divulgacion_ia: 'parcial', ia_herramientas: ['claude', 'Otra IA'] };
    pool.query.mockResolvedValueOnce({ rows: [fila] });
    const lista = await request(app).get('/api/noticias');
    expect(lista.body.noticias[0].ia_herramientas).toEqual(['claude', 'Otra IA']);
    pool.query.mockResolvedValueOnce({ rows: [fila] });
    const detalle = await request(app).get('/api/noticias/a');
    expect(detalle.body.noticia.ia_herramientas).toEqual(['claude', 'Otra IA']);
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
    expect(values[13]).toBe('parcial'); // divulgacion_ia
    expect(values[15]).toBe('es'); // idioma_original por defecto
  });

  test('201 persiste iaHerramientas (claves conocidas y nombre libre) en el INSERT', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'un-titulo-cualquiera' }] });
    const res = await request(app)
      .post('/api/noticias')
      .set('x-test-user', ADMIN)
      .send({ ...NOTICIA_VALIDA, divulgacionIa: 'parcial', iaHerramientas: ['Claude', 'Perplexity', 'Mi IA local'] });
    expect(res.status).toBe(201);
    const [sql, values] = pool.query.mock.calls[1];
    expect(sql).toMatch(/idioma_original, ia_herramientas/);
    expect(values[16]).toEqual(['claude', 'perplexity', 'Mi IA local']);
  });

  test('201 sin iaHerramientas guarda una lista vacia', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'un-titulo-cualquiera' }] });
    await request(app).post('/api/noticias').set('x-test-user', ADMIN).send(NOTICIA_VALIDA);
    expect(pool.query.mock.calls[1][1][16]).toEqual([]);
  });

  test('400 con 9 herramientas, <script> o divulgacionIa "no" junto a una lista con elementos', async () => {
    const enviar = (extra) => request(app).post('/api/noticias').set('x-test-user', ADMIN)
      .send({ ...NOTICIA_VALIDA, ...extra });
    const nueve = Array.from({ length: 9 }, (_, i) => `IA ${i}`);
    expect((await enviar({ divulgacionIa: 'parcial', iaHerramientas: nueve })).status).toBe(400);
    expect((await enviar({ divulgacionIa: 'parcial', iaHerramientas: ['<script>'] })).status).toBe(400);
    const res = await enviar({ divulgacionIa: 'no', iaHerramientas: ['claude'] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Si indicas qué IA usaste, la divulgación no puede ser “No se usó IA”.');
  });

  test('400 al crear con iaHerramientas y sin divulgacionIa (se asume "no")', async () => {
    const res = await request(app).post('/api/noticias').set('x-test-user', ADMIN)
      .send({ ...NOTICIA_VALIDA, iaHerramientas: ['claude'] });
    expect(res.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
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
    expect(values[14]).toBe(false); // publicado
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

  test('PUT sin iaHerramientas conserva las guardadas', async () => {
    const existente = { id: 'a', ...NOTICIA_VALIDA, divulgacion_ia: 'parcial', ia_herramientas: ['claude', 'Otra IA'] };
    pool.query
      .mockResolvedValueOnce({ rows: [existente] })
      .mockResolvedValueOnce({ rows: [existente] });
    const res = await request(app).put('/api/noticias/a').set('x-test-user', ADMIN).send({ titulo: 'Titulo editado' });
    expect(res.status).toBe(200);
    const [sql, values] = pool.query.mock.calls[1];
    expect(sql).toMatch(/ia_herramientas=\$17::text\[\]/);
    expect(values[16]).toEqual(['claude', 'Otra IA']);
  });

  test('PUT con iaHerramientas las normaliza y las guarda', async () => {
    const existente = { id: 'a', ...NOTICIA_VALIDA, divulgacion_ia: 'no', ia_herramientas: [] };
    pool.query
      .mockResolvedValueOnce({ rows: [existente] })
      .mockResolvedValueOnce({ rows: [{ id: 'a', ia_herramientas: ['gemini', 'Mi IA'] }] });
    const res = await request(app).put('/api/noticias/a').set('x-test-user', ADMIN)
      .send({ divulgacionIa: 'generado', iaHerramientas: ['Gemini', ' Mi IA '] });
    expect(res.status).toBe(200);
    expect(pool.query.mock.calls[1][1][16]).toEqual(['gemini', 'Mi IA']);
  });

  test('400 si iaHerramientas llega sin divulgacionIa y la noticia tiene divulgacion "no"', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'a', ...NOTICIA_VALIDA, divulgacion_ia: 'no', ia_herramientas: [] }] });
    const res = await request(app).put('/api/noticias/a').set('x-test-user', ADMIN).send({ iaHerramientas: ['claude'] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/divulgación no puede ser/);
    expect(pool.query).toHaveBeenCalledTimes(1); // no llego al UPDATE
  });

  test('PUT que cambia la divulgacion a "no" vacia las herramientas guardadas', async () => {
    const existente = { id: 'a', ...NOTICIA_VALIDA, divulgacion_ia: 'parcial', ia_herramientas: ['claude'] };
    pool.query
      .mockResolvedValueOnce({ rows: [existente] })
      .mockResolvedValueOnce({ rows: [existente] });
    const res = await request(app).put('/api/noticias/a').set('x-test-user', ADMIN).send({ divulgacionIa: 'no' });
    expect(res.status).toBe(200);
    expect(pool.query.mock.calls[1][1][16]).toEqual([]);
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

  test('borra en una sola sentencia la noticia, sus comentarios y sus traducciones (T-4)', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });
    const res = await request(app).delete('/api/noticias/a').set('x-test-user', ADMIN);
    expect(res.status).toBe(200);
    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/^\s*WITH /);
    expect(sql).toMatch(/DELETE FROM noticias WHERE id = \$1/);
    expect(sql).toMatch(/DELETE FROM comentarios WHERE tipo = 'noticia' AND item_id = \$1/);
    expect(sql).toMatch(/DELETE FROM traducciones WHERE tipo = 'noticia' AND item_id = \$1/);
    expect(params).toEqual(['a']);
  });

  test('200 al eliminar una noticia existente', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });
    const res = await request(app).delete('/api/noticias/a').set('x-test-user', ADMIN);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('GET /api/noticias?lang= (Fase C2)', () => {
  test('con ?lang=en superpone la traduccion y marca sin_traduccion en lo que no tiene', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'a', titulo: 'Hola', parrafos: ['Uno'] }, { id: 'b', titulo: 'Adios', parrafos: ['Dos'] }] })
      .mockResolvedValueOnce({ rows: [{ item_id: 'a', campos: { titulo: 'Hello', parrafos: ['One'] } }] });
    const res = await request(app).get('/api/noticias?lang=en');
    expect(res.status).toBe(200);
    expect(res.body.noticias[0]).toMatchObject({ titulo: 'Hello', parrafos: ['One'], idioma_mostrado: 'en', sin_traduccion: false });
    expect(res.body.noticias[1]).toMatchObject({ titulo: 'Adios', idioma_mostrado: 'es', sin_traduccion: true });
    expect(pool.query.mock.calls[1][1]).toEqual(['noticia', 'en', ['a', 'b']]);
  });

  test('sin ?lang= no consulta traducciones ni agrega banderas', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'a', titulo: 'Hola' }] });
    const res = await request(app).get('/api/noticias');
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(res.body.noticias[0]).toEqual({ id: 'a', titulo: 'Hola' });
  });

  test('?lang=en en el detalle traduce, y un idioma invalido se ignora', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'a', titulo: 'Hola', publicado: true }] })
      .mockResolvedValueOnce({ rows: [{ item_id: 'a', campos: { titulo: 'Hello' } }] });
    const en = await request(app).get('/api/noticias/a?lang=en');
    expect(en.body.noticia.titulo).toBe('Hello');

    pool.query.mockResolvedValueOnce({ rows: [{ id: 'a', titulo: 'Hola', publicado: true }] });
    const raro = await request(app).get('/api/noticias/a?lang=fr');
    expect(raro.body.noticia.titulo).toBe('Hola');
  });

  test('POST persiste idiomaOriginal cuando se envia', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id: 'x' }] });
    const res = await request(app).post('/api/noticias').set('x-test-user', ADMIN).send({ ...NOTICIA_VALIDA, idiomaOriginal: 'en' });
    expect(res.status).toBe(201);
    expect(pool.query.mock.calls[1][1][15]).toBe('en');
  });

  test('POST rechaza un idiomaOriginal invalido', async () => {
    const res = await request(app).post('/api/noticias').set('x-test-user', ADMIN).send({ ...NOTICIA_VALIDA, idiomaOriginal: 'fr' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Idioma original/);
  });
});

describe('Una noticia sin publicar nunca es la destacada (N-1)', () => {
  test('POST con publicado=false y destacado=true se guarda sin destacar y sin tocar la destacada actual', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] }) // id duplicado
      .mockResolvedValueOnce({ rows: [{ id: 'un-titulo-cualquiera', destacado: false, publicado: false }] });
    const res = await request(app).post('/api/noticias').set('x-test-user', ADMIN)
      .send({ ...NOTICIA_VALIDA, publicado: false, destacado: true });
    expect(res.status).toBe(201);
    expect(res.body.noticia.destacado).toBe(false);
    expect(pool.connect).not.toHaveBeenCalled(); // no hubo transaccion que limpie la destacada publica
    const values = pool.query.mock.calls[1][1];
    expect(values[12]).toBe(false); // destacado
    expect(values[14]).toBe(false); // publicado
  });

  test('PUT guardar un borrador con destacado=true no le quita el destacado a la noticia publica', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'b', ...NOTICIA_VALIDA, publicado: true, destacado: false }] })
      .mockResolvedValueOnce({ rows: [{ id: 'b', destacado: false, publicado: false }] });
    const res = await request(app).put('/api/noticias/b').set('x-test-user', ADMIN)
      .send({ publicado: false, destacado: true });
    expect(res.status).toBe(200);
    expect(pool.connect).not.toHaveBeenCalled();
    expect(pool.query.mock.calls[1][1][12]).toBe(false);
  });

  test('PUT despublicar una noticia destacada le quita el destacado', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'a', ...NOTICIA_VALIDA, publicado: true, destacado: true }] })
      .mockResolvedValueOnce({ rows: [{ id: 'a', destacado: false, publicado: false }] });
    const res = await request(app).put('/api/noticias/a').set('x-test-user', ADMIN).send({ publicado: false });
    expect(res.status).toBe(200);
    expect(pool.query.mock.calls[1][1][12]).toBe(false);
    expect(pool.query.mock.calls[1][1][14]).toBe(false);
  });

  test('PUT destacar un borrador existente no abre transaccion ni destaca', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'b', ...NOTICIA_VALIDA, publicado: false, destacado: false }] })
      .mockResolvedValueOnce({ rows: [{ id: 'b', destacado: false }] });
    const res = await request(app).put('/api/noticias/b').set('x-test-user', ADMIN).send({ destacado: true });
    expect(res.status).toBe(200);
    expect(pool.connect).not.toHaveBeenCalled();
    expect(pool.query.mock.calls[1][1][12]).toBe(false);
  });

  test('PUT destacar una noticia publicada sigue limpiando la anterior en una transaccion', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'a', ...NOTICIA_VALIDA, publicado: true, destacado: false }] });
    const client = mockClient(async () => ({ rows: [{ id: 'a', destacado: true }] }));
    const res = await request(app).put('/api/noticias/a').set('x-test-user', ADMIN).send({ destacado: true });
    expect(res.status).toBe(200);
    expect(client.query.mock.calls[1][0]).toMatch(/SET destacado = false/);
  });
});
