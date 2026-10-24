jest.mock('../middleware/auth', () => require('../test-utils/authMock'));
jest.mock('../services/corrector');
jest.mock('../db', () => ({ pool: { query: jest.fn() } }));

const request = require('supertest');
const { buildApp } = require('../app');
const { corregirTexto } = require('../services/corrector');
const { pool } = require('../db');

const app = buildApp();
const ADMIN = JSON.stringify({ id: 'admin-1', rol: 'admin' });
const USUARIO = JSON.stringify({ id: 'user-1', rol: 'usuario' });
const MODERADOR = JSON.stringify({ id: 'mod-1', rol: 'moderador' });
const USAGE = { tokensEntrada: 100, tokensSalida: 50, costoEstimadoUsd: 0.0005 };

beforeEach(() => {
  pool.query.mockReset();
  pool.query.mockResolvedValue({ rows: [] });
  corregirTexto.mockReset();
});

describe('POST /api/admin/corregir', () => {
  test('401 sin sesión, 403 para usuario y moderador (solo admin)', async () => {
    expect((await request(app).post('/api/admin/corregir').send({ texto: 'hola', variante: 'es-PR' })).status).toBe(401);
    for (const quien of [USUARIO, MODERADOR]) {
      const res = await request(app).post('/api/admin/corregir').set('x-test-user', quien).send({ texto: 'hola', variante: 'es-PR' });
      expect(res.status).toBe(403);
    }
    expect(corregirTexto).not.toHaveBeenCalled();
  });

  test.each([
    [{ variante: 'es-PR' }, /texto/],
    [{ texto: '   ', variante: 'es-PR' }, /texto/],
    [{ texto: 'hola', variante: 'fr-FR' }, /variante/],
    [{ texto: 'x'.repeat(12001), variante: 'es-PR' }, /demasiado largo/],
  ])('400 con datos inválidos %#', async (body, patron) => {
    const res = await request(app).post('/api/admin/corregir').set('x-test-user', ADMIN).send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(patron);
    expect(corregirTexto).not.toHaveBeenCalled();
  });

  test('200 devuelve el texto corregido y los cambios, y registra el costo (agente correctora)', async () => {
    corregirTexto.mockResolvedValue({ textoCorregido: 'La guagua llegó.', cambios: [{ antes: 'llego', despues: 'llegó', motivo: 'tilde' }], usage: USAGE });
    const res = await request(app).post('/api/admin/corregir').set('x-test-user', ADMIN).send({ texto: 'La guagua llego.', variante: 'es-PR' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, textoCorregido: 'La guagua llegó.', cambios: [{ antes: 'llego', despues: 'llegó', motivo: 'tilde' }] });
    expect(corregirTexto).toHaveBeenCalledWith({ texto: 'La guagua llego.', variante: 'es-PR' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO ia_generaciones/);
    expect(params).toEqual(['correctora', 'texto', 100, 50, 0.0005, 'admin-1', 0]);
  });

  test('si la IA falla, 400 con el mensaje y sin registrar costo', async () => {
    corregirTexto.mockRejectedValue(new Error('ANTHROPIC_API_KEY no esta configurada en el servidor.'));
    const res = await request(app).post('/api/admin/corregir').set('x-test-user', ADMIN).send({ texto: 'hola', variante: 'en-US' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ANTHROPIC_API_KEY/);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('un fallo al registrar el costo no tumba la respuesta', async () => {
    corregirTexto.mockResolvedValue({ textoCorregido: 'ok', cambios: [], usage: USAGE });
    pool.query.mockRejectedValue(new Error('db caída'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).post('/api/admin/corregir').set('x-test-user', ADMIN).send({ texto: 'ok', variante: 'es-ES' });
    expect(res.status).toBe(200);
  });
});

describe('POST /api/admin/corregir/varios («Corregir todo», Doña Tilde)', () => {
  const RUTA = '/api/admin/corregir/varios';
  const ITEMS = [
    { id: 'ac-titulo', texto: 'La guagua llego', variante: 'es-PR' },
    { id: 'ac-cuerpo', texto: 'The bus arived late.', variante: 'en-US' },
  ];

  test('401 sin sesión; 403 para usuario y moderador (solo admin)', async () => {
    expect((await request(app).post(RUTA).send({ items: ITEMS })).status).toBe(401);
    for (const quien of [USUARIO, MODERADOR]) {
      expect((await request(app).post(RUTA).set('x-test-user', quien).send({ items: ITEMS })).status).toBe(403);
    }
    expect(corregirTexto).not.toHaveBeenCalled();
  });

  test.each([
    [{}, /No hay campos/],
    [{ items: [] }, /No hay campos/],
    [{ items: Array.from({ length: 9 }, (_, i) => ({ id: `c${i}`, texto: 'x', variante: 'es-PR' })) }, /demasiados campos/],
    [{ items: [{ id: 'a', texto: 'x', variante: 'es-PR' }, { id: 'a', texto: 'y', variante: 'es-PR' }] }, /distinto/],
    [{ items: [{ texto: 'x', variante: 'es-PR' }] }, /identificador/],
    [{ items: [{ id: 'a', texto: '   ', variante: 'es-PR' }] }, /texto/],
    [{ items: [{ id: 'a', texto: 'x', variante: 'fr-FR' }] }, /variante/],
    [{ items: Array.from({ length: 6 }, (_, i) => ({ id: `c${i}`, texto: 'x'.repeat(11000), variante: 'es-PR' })) }, /demasiado texto/],
  ])('400 con datos inválidos %#', async (body, patron) => {
    const res = await request(app).post(RUTA).set('x-test-user', ADMIN).send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(patron);
    expect(corregirTexto).not.toHaveBeenCalled();
  });

  test('200 corrige cada campo con SU variante, en el mismo orden, y registra un solo costo sumado', async () => {
    corregirTexto
      .mockResolvedValueOnce({ textoCorregido: 'La guagua llegó', cambios: [{ antes: 'llego', despues: 'llegó', motivo: 'tilde' }], usage: USAGE })
      .mockResolvedValueOnce({ textoCorregido: 'The bus arrived late.', cambios: [{ antes: 'arived', despues: 'arrived', motivo: 'ortografía' }], usage: USAGE });
    const res = await request(app).post(RUTA).set('x-test-user', ADMIN).send({ items: ITEMS });
    expect(res.status).toBe(200);
    expect(res.body.resultados.map((r) => [r.id, r.textoCorregido])).toEqual([['ac-titulo', 'La guagua llegó'], ['ac-cuerpo', 'The bus arrived late.']]);
    expect(corregirTexto).toHaveBeenNthCalledWith(1, { texto: 'La guagua llego', variante: 'es-PR' });
    expect(corregirTexto).toHaveBeenNthCalledWith(2, { texto: 'The bus arived late.', variante: 'en-US' });
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query.mock.calls[0][1]).toEqual(['correctora', 'texto', 200, 100, 0.001, 'admin-1', 0]);
  });

  test('si un campo falla, los demás siguen y el fallo se informa en su campo', async () => {
    corregirTexto
      .mockResolvedValueOnce({ textoCorregido: 'ok', cambios: [], usage: USAGE })
      .mockRejectedValueOnce(new Error('El texto es demasiado largo para procesar de una vez.'));
    const res = await request(app).post(RUTA).set('x-test-user', ADMIN).send({ items: ITEMS });
    expect(res.status).toBe(200);
    expect(res.body.resultados[0]).toMatchObject({ id: 'ac-titulo', textoCorregido: 'ok' });
    expect(res.body.resultados[1]).toEqual({ id: 'ac-cuerpo', error: 'El texto es demasiado largo para procesar de una vez.' });
    expect(pool.query.mock.calls[0][1]).toEqual(['correctora', 'texto', 100, 50, 0.0005, 'admin-1', 0]);
  });

  test('si TODOS fallan (p. ej. falta la llave de la IA), 400 con el motivo y sin costo', async () => {
    corregirTexto.mockRejectedValue(new Error('ANTHROPIC_API_KEY no esta configurada en el servidor.'));
    const res = await request(app).post(RUTA).set('x-test-user', ADMIN).send({ items: ITEMS });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ANTHROPIC_API_KEY/);
    expect(pool.query).not.toHaveBeenCalled();
  });
});
