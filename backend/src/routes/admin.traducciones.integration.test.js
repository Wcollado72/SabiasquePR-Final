jest.mock('../middleware/auth', () => require('../test-utils/authMock'));
jest.mock('../services/traductor');
jest.mock('../db', () => ({ pool: { query: jest.fn() } }));

const request = require('supertest');
const { buildApp } = require('../app');
const { traducirCampos } = require('../services/traductor');
const { pool } = require('../db');

const app = buildApp();

const ADMIN = JSON.stringify({ id: 'admin-1', rol: 'admin' });
const USUARIO = JSON.stringify({ id: 'user-1', rol: 'usuario' });
const MODERADOR = JSON.stringify({ id: 'mod-1', rol: 'moderador' });
const USAGE = { tokensEntrada: 500, tokensSalida: 300, costoEstimadoUsd: 0.004 };

beforeEach(() => {
  pool.query.mockReset();
  traducirCampos.mockReset();
});

describe('acceso a /api/admin/traducciones y /traducir', () => {
  const rutas = [
    ['get', '/api/admin/traducciones/noticia/a'],
    ['put', '/api/admin/traducciones/noticia/a/en'],
    ['delete', '/api/admin/traducciones/noticia/a/en'],
    ['post', '/api/admin/traducir'],
  ];

  test.each(rutas)('%s %s: 401 sin sesion', async (metodo, url) => {
    const res = await request(app)[metodo](url).send({});
    expect(res.status).toBe(401);
  });

  test.each(rutas)('%s %s: 403 para usuario y moderador (solo admin)', async (metodo, url) => {
    for (const quien of [USUARIO, MODERADOR]) {
      const res = await request(app)[metodo](url).set('x-test-user', quien).send({});
      expect(res.status).toBe(403);
    }
    expect(pool.query).not.toHaveBeenCalled();
  });
});

describe('GET /api/admin/traducciones/:tipo/:id', () => {
  test('400 con tipo invalido (no toca la base de datos)', async () => {
    const res = await request(app).get('/api/admin/traducciones/usuarios/a').set('x-test-user', ADMIN);
    expect(res.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('404 si la pieza no existe', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/admin/traducciones/noticia/nada').set('x-test-user', ADMIN);
    expect(res.status).toBe(404);
  });

  test('200 devuelve idioma original y las traducciones por idioma', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'a', idioma_original: 'es' }] })
      .mockResolvedValueOnce({ rows: [{ idioma: 'en', campos: { titulo: 'Hello' }, actualizado_en: '2026-09-28T00:00:00Z' }] });
    const res = await request(app).get('/api/admin/traducciones/contenido/a').set('x-test-user', ADMIN);
    expect(res.status).toBe(200);
    expect(res.body.idiomaOriginal).toBe('es');
    expect(res.body.traducciones.en.campos).toEqual({ titulo: 'Hello' });
    expect(pool.query.mock.calls[0][0]).toMatch(/FROM contenidos WHERE id = \$1/);
  });
});

describe('PUT /api/admin/traducciones/:tipo/:id/:idioma', () => {
  test('400 con campos invalidos o vacios', async () => {
    const r1 = await request(app).put('/api/admin/traducciones/noticia/a/en').set('x-test-user', ADMIN)
      .send({ campos: { precio: 5 } });
    expect(r1.status).toBe(400);
    const r2 = await request(app).put('/api/admin/traducciones/noticia/a/fr').set('x-test-user', ADMIN)
      .send({ campos: { titulo: 'x' } });
    expect(r2.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('404 si la pieza no existe', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).put('/api/admin/traducciones/producto/x/en').set('x-test-user', ADMIN)
      .send({ campos: { nombre: 'Mug' } });
    expect(res.status).toBe(404);
  });

  test('400 si se traduce al idioma en que la pieza ya esta escrita', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'a', idioma_original: 'en' }] });
    const res = await request(app).put('/api/admin/traducciones/noticia/a/en').set('x-test-user', ADMIN)
      .send({ campos: { titulo: 'Same' } });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/idioma original/);
  });

  test('200 hace upsert con los campos saneados y el admin que lo guardo', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'a', idioma_original: 'es' }] }).mockResolvedValueOnce({});
    const res = await request(app).put('/api/admin/traducciones/noticia/a/en').set('x-test-user', ADMIN)
      .send({ campos: { titulo: '  Hello  ', parrafos: ['One', ' '] } });
    expect(res.status).toBe(200);
    expect(res.body.campos).toEqual({ titulo: 'Hello', parrafos: ['One'] });
    const [sql, params] = pool.query.mock.calls[1];
    expect(sql).toMatch(/ON CONFLICT \(tipo, item_id, idioma\)/);
    expect(params).toEqual(['noticia', 'a', 'en', JSON.stringify({ titulo: 'Hello', parrafos: ['One'] }), 'admin-1']);
  });
});

describe('DELETE /api/admin/traducciones/:tipo/:id/:idioma', () => {
  test('200 borra, 404 si no existia, 400 con idioma invalido', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });
    expect((await request(app).delete('/api/admin/traducciones/noticia/a/en').set('x-test-user', ADMIN)).status).toBe(200);
    pool.query.mockResolvedValueOnce({ rowCount: 0 });
    expect((await request(app).delete('/api/admin/traducciones/noticia/a/en').set('x-test-user', ADMIN)).status).toBe(404);
    expect((await request(app).delete('/api/admin/traducciones/noticia/a/xx').set('x-test-user', ADMIN)).status).toBe(400);
  });
});

describe('POST /api/admin/traducir', () => {
  test('400 con tipo, destino u origen invalidos o iguales', async () => {
    const post = (b) => request(app).post('/api/admin/traducir').set('x-test-user', ADMIN).send(b);
    expect((await post({ tipo: 'x', idiomaDestino: 'en' })).status).toBe(400);
    expect((await post({ tipo: 'noticia', idiomaDestino: 'fr', campos: { titulo: 'a' } })).status).toBe(400);
    expect((await post({ tipo: 'noticia', idiomaDestino: 'en', campos: { titulo: 'a' } })).status).toBe(400); // sin origen
    expect((await post({ tipo: 'noticia', idiomaDestino: 'en', idiomaOrigen: 'en', campos: { titulo: 'a' } })).status).toBe(400);
    expect(traducirCampos).not.toHaveBeenCalled();
  });

  test('200 traduce lo del formulario y registra el gasto del agente traductor', async () => {
    traducirCampos.mockResolvedValueOnce({ campos: { titulo: 'Hello' }, usage: USAGE });
    pool.query.mockResolvedValueOnce({}); // registrarUsoIa
    const res = await request(app).post('/api/admin/traducir').set('x-test-user', ADMIN)
      .send({ tipo: 'noticia', idiomaOrigen: 'es', idiomaDestino: 'en', campos: { titulo: 'Hola' } });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ campos: { titulo: 'Hello' }, idiomaOrigen: 'es', idiomaDestino: 'en' });
    expect(traducirCampos).toHaveBeenCalledWith({ tipo: 'noticia', campos: { titulo: 'Hola' }, idiomaOrigen: 'es', idiomaDestino: 'en' });
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO ia_generaciones'), expect.arrayContaining(['traductor', 'texto']));
  });

  test('con id toma origen y campos de la pieza guardada', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'a', idioma_original: 'en', titulo: 'Original', cuerpo: 'Body', precio: 5 }] })
      .mockResolvedValueOnce({});
    traducirCampos.mockResolvedValueOnce({ campos: { titulo: 'Original ES', cuerpo: 'Cuerpo' }, usage: USAGE });
    const res = await request(app).post('/api/admin/traducir').set('x-test-user', ADMIN)
      .send({ tipo: 'contenido', id: 'a', idiomaDestino: 'es' });
    expect(res.status).toBe(200);
    expect(traducirCampos).toHaveBeenCalledWith(expect.objectContaining({
      idiomaOrigen: 'en', idiomaDestino: 'es', campos: { titulo: 'Original', cuerpo: 'Body' },
    }));
  });

  test('400 con el mensaje del agente si falla (sin clave, sin texto...)', async () => {
    traducirCampos.mockRejectedValueOnce(new Error('ANTHROPIC_API_KEY no esta configurada en el servidor.'));
    const res = await request(app).post('/api/admin/traducir').set('x-test-user', ADMIN)
      .send({ tipo: 'noticia', idiomaOrigen: 'es', idiomaDestino: 'en', campos: { titulo: 'Hola' } });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ANTHROPIC_API_KEY/);
  });

  test('sigue devolviendo 200 aunque falle el registro del gasto', async () => {
    traducirCampos.mockResolvedValueOnce({ campos: { titulo: 'Hello' }, usage: USAGE });
    pool.query.mockRejectedValueOnce(new Error('DB caida'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).post('/api/admin/traducir').set('x-test-user', ADMIN)
      .send({ tipo: 'noticia', idiomaOrigen: 'es', idiomaDestino: 'en', campos: { titulo: 'Hola' } });
    expect(res.status).toBe(200);
    spy.mockRestore();
  });
});
