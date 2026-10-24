// Endurecimiento del API (auditoría de seguridad del proyecto, debilidades #7 y #9).
jest.mock('./db', () => ({ pool: { query: jest.fn() } }));

const request = require('supertest');
const { pool } = require('./db');
const { buildApp } = require('./app');

const app = buildApp();

beforeEach(() => {
  pool.query.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('cabeceras de seguridad del API (#7)', () => {
  test('no anuncia Express y manda las cabeceras de endurecimiento', async () => {
    pool.query.mockResolvedValue({ rows: [{ hora_servidor: 'ahora' }] });
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toMatch(/max-age=/);
    expect(res.headers['content-security-policy']).toMatch(/default-src 'none'/);
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  test('CORP cross-origin: el frontend de otro origen puede leer las respuestas', async () => {
    pool.query.mockResolvedValue({ rows: [{ hora_servidor: 'ahora' }] });
    const res = await request(app).get('/api/health');
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });
});

describe('errores que no filtran detalles internos (#9)', () => {
  test('/api/health con la base caida responde generico, sin el mensaje de Postgres', async () => {
    pool.query.mockRejectedValue(new Error('password authentication failed for user "postgres"'));
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ ok: false, error: 'Base de datos no disponible.' });
    expect(JSON.stringify(res.body)).not.toMatch(/password|postgres/i);
  });

  test('JSON malformado: 400 con mensaje propio, no el de la libreria', async () => {
    const res = await request(app)
      .post('/api/newsletter/subscribe')
      .set('Content-Type', 'application/json')
      .send('{"email": ');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('El cuerpo de la peticion no es un JSON valido.');
    expect(res.body.error).not.toMatch(/Unexpected|position|token/i);
  });

  test('cuerpo demasiado grande: 413', async () => {
    const res = await request(app)
      .post('/api/newsletter/subscribe')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'a@b.com', relleno: 'x'.repeat(200 * 1024) }));
    expect(res.status).toBe(413);
  });

  test('origen no permitido por CORS: 403 con mensaje propio', async () => {
    const res = await request(app).get('/api/noticias').set('Origin', 'https://evil.example');
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ ok: false, error: 'Origen no permitido por CORS.' });
  });
});
