// Compatibilidad con Express 5 (AUDITORIA-SEGURIDAD.md, saltos mayores).
// En Express 5 `req.body` es `undefined` (no `{}`) cuando la peticion no trae
// cuerpo o no es JSON; varias rutas leen `req.body.campo` directamente, asi que
// app.js lo normaliza a `{}` como en Express 4. Sin eso, una peticion vacia
// terminaria en un TypeError -> 500 en vez de un 400 de validacion.
jest.mock('./middleware/auth', () => require('./test-utils/authMock'));
jest.mock('./db', () => ({ pool: { query: jest.fn() } }));

const request = require('supertest');
const { buildApp } = require('./app');

const app = buildApp();
const admin = JSON.stringify({ id: 'a1', email: 'a@b.com', rol: 'admin' });
const usuario = JSON.stringify({ id: 'u1', email: 'u@b.com', rol: 'usuario', fecha_nacimiento: '1990-01-01' });

describe('peticiones sin cuerpo (Express 5: req.body undefined)', () => {
  test.each([
    ['POST /api/comentarios', 'post', '/api/comentarios', usuario],
    ['POST /api/foro/posts', 'post', '/api/foro/posts', usuario],
    ['POST /api/reportes', 'post', '/api/reportes', usuario],
    ['POST /api/noticias', 'post', '/api/noticias', admin],
    ['POST /api/contenidos', 'post', '/api/contenidos', admin],
    ['POST /api/productos', 'post', '/api/productos', admin],
  ])('%s sin cuerpo responde 400 de validacion, no 500', async (_n, metodo, ruta, quien) => {
    const res = await request(app)[metodo](ruta).set('x-test-user', quien);
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  test('PUT /api/perfil sin cuerpo es una actualizacion valida sin cambios (200, no TypeError)', async () => {
    const { pool } = require('./db');
    pool.query.mockResolvedValue({ rows: [{ id: 'u1', email: 'u@b.com', rol: 'usuario', nombre: null }] });
    const res = await request(app).put('/api/perfil').set('x-test-user', usuario);
    expect(res.status).toBe(200);
  });

  test('cuerpo con Content-Type equivocado tambien llega como {} y valida', async () => {
    const res = await request(app)
      .post('/api/comentarios')
      .set('x-test-user', usuario)
      .set('Content-Type', 'text/plain')
      .send('hola');
    expect(res.status).toBe(400);
  });
});

describe('rutas con parametros siguen resolviendo igual', () => {
  test('GET /api/noticias/:id inexistente -> 404 (no 500)', async () => {
    const { pool } = require('./db');
    pool.query.mockResolvedValue({ rows: [] });
    const res = await request(app).get('/api/noticias/no-existe');
    expect(res.status).toBe(404);
  });

  test('una ruta que no existe -> 404 de Express (no se cae)', async () => {
    const res = await request(app).get('/api/esto-no-existe');
    expect(res.status).toBe(404);
  });
});
