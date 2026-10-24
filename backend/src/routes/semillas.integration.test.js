jest.mock('../middleware/auth', () => require('../test-utils/authMock'));
jest.mock('../services/grieta');
jest.mock('../db', () => ({ pool: { query: jest.fn() } }));

const crypto = require('crypto');
const request = require('supertest');
const { buildApp } = require('../app');
const { analizarSemilla } = require('../services/grieta');
const { pool } = require('../db');

const app = buildApp();
const ADMIN = JSON.stringify({ id: 'admin-1', rol: 'admin' });
const USUARIO = JSON.stringify({ id: 'user-1', rol: 'usuario' });
const MODERADOR = JSON.stringify({ id: 'mod-1', rol: 'moderador' });
const ID = '11111111-1111-4111-8111-111111111111';
const hash = (t) => crypto.createHash('sha1').update(t).digest('hex').slice(0, 16);
const FILA = (extra = {}) => ({
  id: ID, titulo: 'Vergüenza', texto: 'La gente cambia por vergüenza.', etiquetas: ['cambio'], estado: 'semilla',
  analisis: {}, desarrollos: [], contenido_id: null, creado_en: '2026-10-23', actualizado_en: '2026-10-23', ...extra,
});

beforeEach(() => {
  pool.query.mockReset();
  analizarSemilla.mockReset();
});

describe('acceso (todo el Taller es solo de admin)', () => {
  test.each([
    ['get', '/api/semillas'],
    ['get', `/api/semillas/${ID}`],
    ['post', '/api/semillas'],
    ['put', `/api/semillas/${ID}`],
    ['delete', `/api/semillas/${ID}`],
    ['post', `/api/semillas/${ID}/agentes/grieta`],
  ])('%s %s: 401 sin sesión y 403 para usuario y moderador', async (metodo, ruta) => {
    expect((await request(app)[metodo](ruta).send({ texto: 'x' })).status).toBe(401);
    for (const quien of [USUARIO, MODERADOR]) {
      expect((await request(app)[metodo](ruta).set('x-test-user', quien).send({ texto: 'x' })).status).toBe(403);
    }
    expect(pool.query).not.toHaveBeenCalled();
  });
});

describe('GET /api/semillas', () => {
  test('lista solo las semillas de quien pregunta, con extracto y las agentes que ya las analizaron', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: ID, titulo: 'T', extracto: 'La gente...', etiquetas: [], estado: 'explorada', agentes_que_la_analizaron: ['grieta'] }] });
    const res = await request(app).get('/api/semillas').set('x-test-user', ADMIN);
    expect(res.status).toBe(200);
    expect(res.body.semillas[0].agentes_que_la_analizaron).toEqual(['grieta']);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE autor_id = \$1/);
    expect(params).toEqual(['admin-1']);
  });

  test('filtra por estado', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    await request(app).get('/api/semillas?estado=lista').set('x-test-user', ADMIN);
    expect(pool.query.mock.calls[0][0]).toMatch(/AND estado = \$2/);
    expect(pool.query.mock.calls[0][1]).toEqual(['admin-1', 'lista']);
  });
});

describe('GET /api/semillas/:id', () => {
  test('404 con un id que no es uuid (sin tocar la base) o que no existe', async () => {
    expect((await request(app).get('/api/semillas/no-es-uuid').set('x-test-user', ADMIN)).status).toBe(404);
    expect(pool.query).not.toHaveBeenCalled();
    pool.query.mockResolvedValue({ rows: [] });
    expect((await request(app).get(`/api/semillas/${ID}`).set('x-test-user', ADMIN)).status).toBe(404);
  });

  test('200 con la semilla, buscada por su dueño, y marca los análisis hechos sobre una versión anterior del texto', async () => {
    pool.query.mockResolvedValue({ rows: [FILA({ analisis: { grieta: { resultado: {}, texto_hash: 'viejo' } } })] });
    const res = await request(app).get(`/api/semillas/${ID}`).set('x-test-user', ADMIN);
    expect(res.status).toBe(200);
    expect(res.body.semilla.desactualizados).toEqual(['grieta']);
    expect(pool.query.mock.calls[0][1]).toEqual([ID, 'admin-1']);
  });

  test('un análisis hecho sobre el texto actual no se marca como desactualizado', async () => {
    const f = FILA();
    pool.query.mockResolvedValue({ rows: [{ ...f, analisis: { grieta: { resultado: {}, texto_hash: hash(f.texto) } } }] });
    const res = await request(app).get(`/api/semillas/${ID}`).set('x-test-user', ADMIN);
    expect(res.body.semilla.desactualizados).toEqual([]);
  });
});

describe('POST /api/semillas', () => {
  test.each([
    [{}, /no puede estar vacía/],
    [{ texto: '   ' }, /no puede estar vacía/],
    [{ texto: 'x'.repeat(20001) }, /demasiado larga/],
    [{ texto: 'x', titulo: 5 }, /título/],
    [{ texto: 'x', etiquetas: 'a,b' }, /etiquetas/],
    [{ texto: 'x', etiquetas: Array.from({ length: 11 }, (_, i) => `e${i}`) }, /etiquetas/],
  ])('400 con datos inválidos %#', async (body, patron) => {
    const res = await request(app).post('/api/semillas').set('x-test-user', ADMIN).send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(patron);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('201 crea la semilla a nombre de quien escribe, con el texto y las etiquetas limpios', async () => {
    pool.query.mockResolvedValue({ rows: [FILA()] });
    const res = await request(app).post('/api/semillas').set('x-test-user', ADMIN)
      .send({ titulo: '  Vergüenza ', texto: '  La gente cambia por vergüenza.  ', etiquetas: [' Cambio ', 'cambio', 'EMPATÍA'] });
    expect(res.status).toBe(201);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO semillas/);
    expect(params).toEqual(['admin-1', 'Vergüenza', 'La gente cambia por vergüenza.', ['cambio', 'empatía']]);
  });
});

describe('PUT /api/semillas/:id', () => {
  test('404 si no existe; 400 si lo que se manda no es válido', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    expect((await request(app).put(`/api/semillas/${ID}`).set('x-test-user', ADMIN).send({ texto: 'x' })).status).toBe(404);
    const res = await request(app).put(`/api/semillas/${ID}`).set('x-test-user', ADMIN).send({ estado: 'inventado' });
    expect(res.status).toBe(400);
    expect((await request(app).put(`/api/semillas/${ID}`).set('x-test-user', ADMIN).send({ texto: '  ' })).status).toBe(400);
  });

  test('200 cambia solo lo que se manda y conserva lo demás', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ titulo: 'Viejo', texto: 'Texto viejo', etiquetas: ['a'], estado: 'explorada' }] })
      .mockResolvedValueOnce({ rows: [FILA({ estado: 'lista' })] });
    const res = await request(app).put(`/api/semillas/${ID}`).set('x-test-user', ADMIN).send({ estado: 'lista' });
    expect(res.status).toBe(200);
    expect(pool.query.mock.calls[1][1]).toEqual([ID, 'admin-1', 'Viejo', 'Texto viejo', ['a'], 'lista']);
  });
});

describe('DELETE /api/semillas/:id', () => {
  test('200 borra la semilla propia; 404 si no existe', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });
    expect((await request(app).delete(`/api/semillas/${ID}`).set('x-test-user', ADMIN)).status).toBe(200);
    expect(pool.query.mock.calls[0][1]).toEqual([ID, 'admin-1']);
    pool.query.mockResolvedValueOnce({ rowCount: 0 });
    expect((await request(app).delete(`/api/semillas/${ID}`).set('x-test-user', ADMIN)).status).toBe(404);
  });
});

describe('POST /api/semillas/:id/agentes/:agente (La Grieta)', () => {
  const URL = `/api/semillas/${ID}/agentes/grieta`;
  const RESULTADO = { resultado: { tesis: 'T', grietas: [] }, usage: { tokensEntrada: 900, tokensSalida: 400, costoEstimadoUsd: 0.006 } };

  test('404 si la agente todavía no trabaja en el Taller (sin gastar IA)', async () => {
    const res = await request(app).post(`/api/semillas/${ID}/agentes/farolera`).set('x-test-user', ADMIN);
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/todavía no trabaja/);
    expect(analizarSemilla).not.toHaveBeenCalled();
  });

  test('404 si la semilla no es de quien pregunta', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    expect((await request(app).post(URL).set('x-test-user', ADMIN)).status).toBe(404);
    expect(analizarSemilla).not.toHaveBeenCalled();
  });

  test('200 analiza el texto guardado, guarda el resultado con el hash del texto, pasa a «explorada» y registra el costo de «grieta»', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ titulo: 'Vergüenza', texto: 'La gente cambia por vergüenza.' }] })
      .mockResolvedValueOnce({ rows: [] }) // registro de uso
      .mockResolvedValueOnce({ rows: [{ estado: 'explorada' }] });
    analizarSemilla.mockResolvedValue(RESULTADO);
    const res = await request(app).post(URL).set('x-test-user', ADMIN);
    expect(res.status).toBe(200);
    expect(analizarSemilla).toHaveBeenCalledWith({ titulo: 'Vergüenza', texto: 'La gente cambia por vergüenza.' });
    expect(res.body.estado).toBe('explorada');
    expect(res.body.analisis.resultado).toEqual(RESULTADO.resultado);
    expect(res.body.analisis.texto_hash).toBe(hash('La gente cambia por vergüenza.'));
    expect(pool.query.mock.calls[1][1]).toEqual(['grieta', 'texto', 900, 400, 0.006, 'admin-1', 0]);
    const [sql, params] = pool.query.mock.calls[2];
    expect(sql).toMatch(/jsonb_set\(analisis/);
    expect(sql).toMatch(/WHEN estado = 'semilla' THEN 'explorada'/);
    expect(params.slice(0, 3)).toEqual([ID, 'admin-1', 'grieta']);
    expect(JSON.parse(params[3]).texto_hash).toBe(hash('La gente cambia por vergüenza.'));
  });

  test('si la IA falla, 400 con el motivo, sin guardar ni cobrar', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ titulo: '', texto: 'Idea.' }] });
    analizarSemilla.mockRejectedValue(new Error('La Grieta no devolvió el análisis. Intenta de nuevo.'));
    const res = await request(app).post(URL).set('x-test-user', ADMIN);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Intenta de nuevo/);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });
});
