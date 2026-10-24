jest.mock('../middleware/auth', () => require('../test-utils/authMock'));
jest.mock('../services/resumidor');
jest.mock('../services/metadatosFuente');
jest.mock('../db', () => ({ pool: { query: jest.fn() } }));

const request = require('supertest');
const { buildApp } = require('../app');
const { resumirTexto } = require('../services/resumidor');
const { leerMetadatosDeUrl } = require('../services/metadatosFuente');
const { pool } = require('../db');

const app = buildApp();
const ADMIN = JSON.stringify({ id: 'admin-1', rol: 'admin' });
const USUARIO = JSON.stringify({ id: 'user-1', rol: 'usuario' });
const MODERADOR = JSON.stringify({ id: 'mod-1', rol: 'moderador' });
const USAGE = { tokensEntrada: 100, tokensSalida: 50, costoEstimadoUsd: 0.0005 };

beforeEach(() => {
  pool.query.mockReset();
  pool.query.mockResolvedValue({ rows: [] });
  resumirTexto.mockReset();
  leerMetadatosDeUrl.mockReset();
});

describe('POST /api/admin/contenido-ia/resumir', () => {
  const url = '/api/admin/contenido-ia/resumir';

  test('401 sin sesión; 403 para usuario y moderador (solo admin)', async () => {
    expect((await request(app).post(url).send({ texto: 'hola' })).status).toBe(401);
    for (const quien of [USUARIO, MODERADOR]) {
      expect((await request(app).post(url).set('x-test-user', quien).send({ texto: 'hola' })).status).toBe(403);
    }
    expect(resumirTexto).not.toHaveBeenCalled();
  });

  test.each([
    [{}, /cuerpo/],
    [{ texto: '   ' }, /cuerpo/],
    [{ texto: 'x'.repeat(60001) }, /demasiado largo/],
  ])('400 con datos inválidos %#', async (body, patron) => {
    const res = await request(app).post(url).set('x-test-user', ADMIN).send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(patron);
    expect(resumirTexto).not.toHaveBeenCalled();
  });

  test('200 devuelve el resumen y registra el costo (agente resumidora)', async () => {
    resumirTexto.mockResolvedValue({ resumen: 'Un resumen.', usage: USAGE });
    const res = await request(app).post(url).set('x-test-user', ADMIN).send({ texto: 'Texto del cuerpo.' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, resumen: 'Un resumen.' });
    expect(resumirTexto).toHaveBeenCalledWith({ texto: 'Texto del cuerpo.' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO ia_generaciones/);
    expect(params).toEqual(['resumidora', 'texto', 100, 50, 0.0005, 'admin-1']);
  });

  test('si la IA falla, 400 con el mensaje y sin registrar costo', async () => {
    resumirTexto.mockRejectedValue(new Error('ANTHROPIC_API_KEY no esta configurada en el servidor.'));
    const res = await request(app).post(url).set('x-test-user', ADMIN).send({ texto: 'hola' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ANTHROPIC_API_KEY/);
    expect(pool.query).not.toHaveBeenCalled();
  });
});

describe('POST /api/admin/contenido-ia/metadatos-fuente', () => {
  const url = '/api/admin/contenido-ia/metadatos-fuente';

  test('401 sin sesión; 403 para usuario y moderador', async () => {
    expect((await request(app).post(url).send({ url: 'https://a.com' })).status).toBe(401);
    for (const quien of [USUARIO, MODERADOR]) {
      expect((await request(app).post(url).set('x-test-user', quien).send({ url: 'https://a.com' })).status).toBe(403);
    }
    expect(leerMetadatosDeUrl).not.toHaveBeenCalled();
  });

  test('400 si falta la URL', async () => {
    const res = await request(app).post(url).set('x-test-user', ADMIN).send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/URL/);
  });

  test('200 devuelve los cuatro datos y el estilo sugerido (sin IA ni costo)', async () => {
    leerMetadatosDeUrl.mockResolvedValue({ autorFuente: 'Ana', anio: '2025', tituloOriginal: 'T', nombreFuente: 'BBC', estiloSugerido: 'apa', motivoEstilo: 'APA es el estilo más usado.', url: 'https://a.com/' });
    const res = await request(app).post(url).set('x-test-user', ADMIN).send({ url: '  https://a.com/x  ' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, autorFuente: 'Ana', anio: '2025', tituloOriginal: 'T', nombreFuente: 'BBC', estiloSugerido: 'apa', motivoEstilo: 'APA es el estilo más usado.' });
    expect(leerMetadatosDeUrl).toHaveBeenCalledWith('https://a.com/x');
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('si la página no se puede leer (o la dirección no está permitida), 400 con el motivo', async () => {
    leerMetadatosDeUrl.mockRejectedValue(new Error('Esa direccion no esta permitida.'));
    const res = await request(app).post(url).set('x-test-user', ADMIN).send({ url: 'http://127.0.0.1/' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no esta permitida/);
  });
});
