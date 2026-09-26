const request = require('supertest');
const { buildApp } = require('../app');

const app = buildApp();

const ENV_ORIGINAL = { ...process.env };

beforeEach(() => {
  process.env.BEEHIIV_API_KEY = 'test-key';
  process.env.BEEHIIV_PUBLICATION_ID = 'pub_test123';
  global.fetch = jest.fn();
});

afterEach(() => {
  process.env = { ...ENV_ORIGINAL };
  jest.restoreAllMocks();
});

describe('POST /api/newsletter/subscribe', () => {
  test('400 con correo invalido', async () => {
    const res = await request(app).post('/api/newsletter/subscribe').send({ email: 'no-es-un-correo' });
    expect(res.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('503 si BEEHIIV_API_KEY o BEEHIIV_PUBLICATION_ID no estan configurados', async () => {
    delete process.env.BEEHIIV_API_KEY;
    const res = await request(app).post('/api/newsletter/subscribe').send({ email: 'test@example.com' });
    expect(res.status).toBe(503);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('200 y llama a la API de beehiiv con la llave en el header, nunca en el body visible al cliente', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ data: { id: 'sub_1' } }) });
    const res = await request(app).post('/api/newsletter/subscribe').send({ email: 'test@example.com' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('https://api.beehiiv.com/v2/publications/pub_test123/subscriptions');
    expect(options.headers.Authorization).toBe('Bearer test-key');
    expect(JSON.parse(options.body).email).toBe('test@example.com');
  });

  test('400 con el mensaje de beehiiv cuando el correo ya esta suscrito', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ errors: [{ message: 'El correo ya está suscrito.' }] }),
    });
    const res = await request(app).post('/api/newsletter/subscribe').send({ email: 'test@example.com' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('El correo ya está suscrito.');
  });

  test('500 generico (no filtra el error real) si beehiiv no responde', async () => {
    global.fetch.mockRejectedValueOnce(new Error('network boom'));
    const res = await request(app).post('/api/newsletter/subscribe').send({ email: 'test@example.com' });
    expect(res.status).toBe(500);
    expect(res.body.error).not.toMatch(/network boom/);
  });
});
