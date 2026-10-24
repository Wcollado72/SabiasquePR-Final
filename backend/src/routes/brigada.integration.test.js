jest.mock('../middleware/auth', () => require('../test-utils/authMock'));
jest.mock('../services/clasificadora');
jest.mock('../db', () => ({ pool: { query: jest.fn() } }));

const request = require('supertest');
const { buildApp } = require('../app');
const { clasificarUrl } = require('../services/clasificadora');
const { pool } = require('../db');

const app = buildApp();
const ADMIN = JSON.stringify({ id: 'admin-1', rol: 'admin' });
const USUARIO = JSON.stringify({ id: 'user-1', rol: 'usuario' });
const MODERADOR = JSON.stringify({ id: 'mod-1', rol: 'moderador' });
const URL_RUTA = '/api/admin/brigada/clasificar';
const USAGE = { tokensEntrada: 800, tokensSalida: 150, costoEstimadoUsd: 0.0015 };

beforeEach(() => {
  pool.query.mockReset();
  pool.query.mockResolvedValue({ rows: [] });
  clasificarUrl.mockReset();
});

describe('POST /api/admin/brigada/clasificar', () => {
  test('401 sin sesión; 403 para usuario y moderador (solo admin)', async () => {
    expect((await request(app).post(URL_RUTA).send({ url: 'https://a.com' })).status).toBe(401);
    for (const quien of [USUARIO, MODERADOR]) {
      expect((await request(app).post(URL_RUTA).set('x-test-user', quien).send({ url: 'https://a.com' })).status).toBe(403);
    }
    expect(clasificarUrl).not.toHaveBeenCalled();
  });

  test.each([
    [{}, /URL/],
    [{ url: '   ' }, /URL/],
    [{ url: 'https://a.com', destino: 'otro' }, /Destino/],
  ])('400 con datos inválidos %#', async (body, patron) => {
    const res = await request(app).post(URL_RUTA).set('x-test-user', ADMIN).send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(patron);
    expect(clasificarUrl).not.toHaveBeenCalled();
  });

  test('200 devuelve las sugerencias y registra el costo', async () => {
    clasificarUrl.mockResolvedValue({
      sugerencias: { idioma: { valor: 'es', motivo: 'm', confianza: 'alta' } }, formatoOriginal: 'video', url: 'https://a.com/', usage: USAGE,
    });
    const res = await request(app).post(URL_RUTA).set('x-test-user', ADMIN).send({ url: ' https://a.com/x ', destino: 'noticia' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true, sugerencias: { idioma: { valor: 'es', motivo: 'm', confianza: 'alta' } }, formatoOriginal: 'video', url: 'https://a.com/',
    });
    expect(clasificarUrl).toHaveBeenCalledWith({ url: 'https://a.com/x', destino: 'noticia' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO ia_generaciones/);
    expect(params).toEqual([800, 150, 0.0015, 'admin-1']);
  });

  test('el destino por defecto es contenido', async () => {
    clasificarUrl.mockResolvedValue({ sugerencias: {}, formatoOriginal: null, url: 'https://a.com/', usage: USAGE });
    await request(app).post(URL_RUTA).set('x-test-user', ADMIN).send({ url: 'https://a.com' });
    expect(clasificarUrl).toHaveBeenCalledWith({ url: 'https://a.com', destino: 'contenido' });
  });

  test('si la página no se puede leer, 400 con el motivo y sin costo', async () => {
    clasificarUrl.mockRejectedValue(new Error('Esa direccion no esta permitida.'));
    const res = await request(app).post(URL_RUTA).set('x-test-user', ADMIN).send({ url: 'http://127.0.0.1/' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no esta permitida/);
    expect(pool.query).not.toHaveBeenCalled();
  });
});
