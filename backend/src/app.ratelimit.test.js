const request = require('supertest');

// El rate limit se desactiva con NODE_ENV=test (ver app.js), asi que aqui se
// construye la app como en produccion. Simula la cadena real de Render
// (auditoría de seguridad del proyecto, debilidad #1): supertest aporta el "socket local" y
// el X-Forwarded-For lleva "cliente, borde Cloudflare, balanceador interno".
const CF = '104.22.160.61';
const LB = '10.194.23.59';

let app;
const ENV = { ...process.env };

beforeAll(() => {
  process.env.NODE_ENV = 'production';
  process.env.TRUST_PROXY_HOPS = '3';
  delete require.cache[require.resolve('./app')];
  app = require('./app').buildApp();
});

afterAll(() => {
  process.env = { ...ENV };
  delete require.cache[require.resolve('./app')];
});

const restantes = (res) => Number(res.headers['ratelimit-remaining']);
const pedir = (xff) => request(app).get('/api/me').set('X-Forwarded-For', xff);

describe('rate limit por cliente real detras del proxy', () => {
  test('cada cliente tiene su propio contador (no se comparte entre visitantes)', async () => {
    const a1 = await pedir(`1.1.1.1, ${CF}, ${LB}`);
    const a2 = await pedir(`1.1.1.1, ${CF}, ${LB}`);
    expect(restantes(a2)).toBe(restantes(a1) - 1);

    const b1 = await pedir(`5.5.5.5, ${CF}, ${LB}`);
    expect(restantes(b1)).toBe(restantes(a1)); // cliente nuevo: contador propio, recien empezado
  });

  test('un X-Forwarded-For falso no da un contador nuevo (queda a la izquierda del cliente real)', async () => {
    const real = await pedir(`7.7.7.7, ${CF}, ${LB}`);
    const conSpoof = await pedir(`9.9.9.9, 7.7.7.7, ${CF}, ${LB}`);
    expect(restantes(conSpoof)).toBe(restantes(real) - 1);
  });

  test('sin TRUST_PROXY_HOPS ni RENDER no se confia en ningun proxy (local/pruebas)', () => {
    const prev = { ...process.env };
    delete process.env.TRUST_PROXY_HOPS;
    delete process.env.RENDER;
    delete require.cache[require.resolve('./app')];
    const local = require('./app').buildApp();
    expect(local.get('trust proxy')).toBe(0);
    process.env = prev;
  });

  test('en Render (variable RENDER) el default son 3 saltos', () => {
    const prev = { ...process.env };
    delete process.env.TRUST_PROXY_HOPS;
    process.env.RENDER = 'true';
    delete require.cache[require.resolve('./app')];
    const render = require('./app').buildApp();
    expect(render.get('trust proxy')).toBe(3);
    process.env = prev;
  });
});
