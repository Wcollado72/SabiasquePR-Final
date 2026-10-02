jest.mock('../middleware/auth', () => require('../test-utils/authMock'));
jest.mock('../db', () => ({ pool: { query: jest.fn(), connect: jest.fn() } }));

const request = require('supertest');
const { buildApp } = require('../app');
const { pool } = require('../db');

const app = buildApp();

const USUARIO = JSON.stringify({ id: 'user-1', email: 'a@ejemplo.com', rol: 'usuario', nombre: null });

beforeEach(() => {
  pool.query.mockReset();
});

describe('PUT /api/perfil', () => {
  test('401 sin autenticacion', async () => {
    const res = await request(app).put('/api/perfil').send({ nombre: 'Ana' });
    expect(res.status).toBe(401);
  });

  test('400 si el nombre es demasiado largo', async () => {
    const res = await request(app).put('/api/perfil')
      .set('x-test-user', USUARIO).send({ nombre: 'a'.repeat(81) });
    expect(res.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('200 actualiza el nombre del usuario autenticado', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'user-1', email: 'a@ejemplo.com', rol: 'usuario', nombre: 'Ana' }],
    });
    const res = await request(app).put('/api/perfil')
      .set('x-test-user', USUARIO).send({ nombre: '  Ana  ' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      user: { id: 'user-1', email: 'a@ejemplo.com', rol: 'usuario', nombre: 'Ana' },
    });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/UPDATE perfiles/);
    expect(params).toEqual(['user-1', 'Ana']);
  });

  test('un usuario no puede editar el perfil de otro (usa siempre req.user.id)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'user-1', nombre: 'Ana' }] });
    await request(app).put('/api/perfil').set('x-test-user', USUARIO).send({ nombre: 'Ana', id: 'otro-id' });
    const [, params] = pool.query.mock.calls[0];
    expect(params[0]).toBe('user-1');
  });
});

describe('POST /api/perfil/confirmar-edad', () => {
  test('401 sin autenticacion', async () => {
    const res = await request(app).post('/api/perfil/confirmar-edad');
    expect(res.status).toBe(401);
  });

  test('200 confirma la edad del usuario autenticado', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'user-1', email: 'a@ejemplo.com', rol: 'usuario', nombre: null, edad_confirmada: true }],
    });
    const res = await request(app).post('/api/perfil/confirmar-edad').set('x-test-user', USUARIO);
    expect(res.status).toBe(200);
    expect(res.body.user.edad_confirmada).toBe(true);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/UPDATE perfiles SET edad_confirmada = true/);
    expect(params).toEqual(['user-1']);
  });
});

describe('POST /api/perfil/confirmar-terminos-logica-humana', () => {
  test('401 sin autenticacion', async () => {
    const res = await request(app).post('/api/perfil/confirmar-terminos-logica-humana');
    expect(res.status).toBe(401);
  });

  test('200 confirma los terminos del usuario autenticado', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'user-1', email: 'a@ejemplo.com', rol: 'usuario', nombre: null, edad_confirmada: true, logica_humana_terminos_ok: true }],
    });
    const res = await request(app).post('/api/perfil/confirmar-terminos-logica-humana').set('x-test-user', USUARIO);
    expect(res.status).toBe(200);
    expect(res.body.user.logica_humana_terminos_ok).toBe(true);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/UPDATE perfiles SET logica_humana_terminos_ok = true/);
    expect(params).toEqual(['user-1']);
  });
});

describe('POST /api/perfil/fecha-nacimiento (Completa tu perfil)', () => {
  const FILA = { id: 'user-1', email: 'a@ejemplo.com', rol: 'usuario', nombre: null, edad_confirmada: false, fecha_nacimiento: '1990-05-17' };

  test('401 sin autenticacion', async () => {
    const res = await request(app).post('/api/perfil/fecha-nacimiento').send({ fechaNacimiento: '1990-05-17' });
    expect(res.status).toBe(401);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test.each([
    ['sin cuerpo', undefined],
    ['formato incorrecto', { fechaNacimiento: '17/05/1990' }],
    ['fecha inexistente', { fechaNacimiento: '2025-02-30' }],
    ['en el futuro', { fechaNacimiento: '2999-01-01' }],
    ['no plausible', { fechaNacimiento: '1850-01-01' }],
  ])('400 %s, sin tocar la base', async (_n, cuerpo) => {
    const req = request(app).post('/api/perfil/fecha-nacimiento').set('x-test-user', USUARIO);
    const res = cuerpo === undefined ? await req : await req.send(cuerpo);
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('200 guarda la fecha cuando el perfil no tenia una', async () => {
    pool.query.mockResolvedValueOnce({ rows: [FILA] });
    const res = await request(app).post('/api/perfil/fecha-nacimiento')
      .set('x-test-user', USUARIO).send({ fechaNacimiento: '1990-05-17' });
    expect(res.status).toBe(200);
    expect(res.body.user.fecha_nacimiento).toBe('1990-05-17');
    const [sql, params] = pool.query.mock.calls[0];
    expect(params).toEqual(['user-1', '1990-05-17']);
    // La regla de "una sola vez" vive en el SQL: nunca se pisa una fecha ya registrada.
    expect(sql).toMatch(/fecha_nacimiento IS NULL/);
  });

  test('409 si el perfil ya tenia fecha (no se puede cambiar)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post('/api/perfil/fecha-nacimiento')
      .set('x-test-user', USUARIO).send({ fechaNacimiento: '1980-01-01' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/ya está registrada/);
  });

  test('un menor tambien puede completar su perfil (no se rechaza por edad)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ ...FILA, fecha_nacimiento: '2015-03-01' }] });
    const res = await request(app).post('/api/perfil/fecha-nacimiento')
      .set('x-test-user', USUARIO).send({ fechaNacimiento: '2015-03-01' });
    expect(res.status).toBe(200);
  });

  test('un fallo inesperado de la base da un 500 generico', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    pool.query.mockRejectedValueOnce(new Error('connection terminated: password authentication failed'));
    const res = await request(app).post('/api/perfil/fecha-nacimiento')
      .set('x-test-user', USUARIO).send({ fechaNacimiento: '1990-05-17' });
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/password|connection/i);
  });
});
