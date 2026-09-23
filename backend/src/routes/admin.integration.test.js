jest.mock('../middleware/auth', () => require('../test-utils/authMock'));
jest.mock('../services/articleExtractor');
jest.mock('../services/anthropic');

const request = require('supertest');
const { buildApp } = require('../app');
const { extraerArticulo } = require('../services/articleExtractor');
const { redactarDesdeArticulo } = require('../services/anthropic');

const app = buildApp();

const ADMIN = JSON.stringify({ id: 'admin-1', rol: 'admin' });
const USUARIO = JSON.stringify({ id: 'user-1', rol: 'usuario' });

beforeEach(() => {
  extraerArticulo.mockReset();
  redactarDesdeArticulo.mockReset();
});

describe('POST /api/admin/autocompletar-ia', () => {
  test('401 sin autenticacion', async () => {
    const res = await request(app).post('/api/admin/autocompletar-ia').send({ url: 'https://ejemplo.com/a' });
    expect(res.status).toBe(401);
  });

  test('403 si el usuario no es admin', async () => {
    const res = await request(app).post('/api/admin/autocompletar-ia')
      .set('x-test-user', USUARIO).send({ url: 'https://ejemplo.com/a' });
    expect(res.status).toBe(403);
  });

  test('400 si falta la URL', async () => {
    const res = await request(app).post('/api/admin/autocompletar-ia')
      .set('x-test-user', ADMIN).send({});
    expect(res.status).toBe(400);
    expect(extraerArticulo).not.toHaveBeenCalled();
  });

  test('200 con el articulo redactado', async () => {
    extraerArticulo.mockResolvedValueOnce({
      titulo: 'Titulo original', texto: 'Texto largo...', sitio: 'El Ejemplo', autor: '', url: 'https://ejemplo.com/a',
    });
    redactarDesdeArticulo.mockResolvedValueOnce({
      titulo: 'Titular redactado', resumen: 'Resumen de dos oraciones.',
      parrafos: ['Parrafo uno.', 'Parrafo dos.'], fuenteTexto: 'El Ejemplo',
    });
    const res = await request(app).post('/api/admin/autocompletar-ia')
      .set('x-test-user', ADMIN).send({ url: 'https://ejemplo.com/a' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      titulo: 'Titular redactado',
      subtituloResumen: 'Resumen de dos oraciones.',
      parrafos: ['Parrafo uno.', 'Parrafo dos.'],
      fuenteTexto: 'El Ejemplo',
      fuenteUrl: 'https://ejemplo.com/a',
    });
  });

  test('400 si la extraccion del articulo falla', async () => {
    extraerArticulo.mockRejectedValueOnce(new Error('Esa direccion no esta permitida.'));
    const res = await request(app).post('/api/admin/autocompletar-ia')
      .set('x-test-user', ADMIN).send({ url: 'http://169.254.169.254/latest/meta-data' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no esta permitida/);
    expect(redactarDesdeArticulo).not.toHaveBeenCalled();
  });

  test('400 si Claude falla', async () => {
    extraerArticulo.mockResolvedValueOnce({ titulo: 't', texto: 'x', sitio: 's', autor: '', url: 'https://ejemplo.com/a' });
    redactarDesdeArticulo.mockRejectedValueOnce(new Error('ANTHROPIC_API_KEY no esta configurada en el servidor.'));
    const res = await request(app).post('/api/admin/autocompletar-ia')
      .set('x-test-user', ADMIN).send({ url: 'https://ejemplo.com/a' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ANTHROPIC_API_KEY/);
  });
});
