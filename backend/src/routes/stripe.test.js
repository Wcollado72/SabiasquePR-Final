jest.mock('../middleware/auth', () => require('../test-utils/authMock'));
jest.mock('../db', () => ({ pool: { query: jest.fn() } }));
jest.mock('../lib/stripe', () => ({ stripe: { checkout: { sessions: { create: jest.fn() } } } }));

const request = require('supertest');
const { buildApp } = require('../app');
const { pool } = require('../db');
const { stripe } = require('../lib/stripe');

const app = buildApp();

const USUARIO = JSON.stringify({ id: 'user-1', email: 'user1@example.com', rol: 'usuario' });

beforeEach(() => {
  pool.query.mockReset();
  stripe.checkout.sessions.create.mockReset();
  process.env.STRIPE_PREMIUM_PRICE_ID = 'price_123';
});

describe('POST /api/stripe/create-checkout-session', () => {
  test('401 sin autenticacion', async () => {
    const res = await request(app).post('/api/stripe/create-checkout-session');
    expect(res.status).toBe(401);
  });

  test('500 si no hay STRIPE_PREMIUM_PRICE_ID configurado', async () => {
    delete process.env.STRIPE_PREMIUM_PRICE_ID;
    const res = await request(app).post('/api/stripe/create-checkout-session').set('x-test-user', USUARIO);
    expect(res.status).toBe(500);
  });

  test('crea la sesion con customer_email si el perfil no tiene stripe_customer_id', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ stripe_customer_id: null }] });
    stripe.checkout.sessions.create.mockResolvedValueOnce({ url: 'https://checkout.stripe.com/session-1' });
    const res = await request(app).post('/api/stripe/create-checkout-session').set('x-test-user', USUARIO);
    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://checkout.stripe.com/session-1');
    const args = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(args.customer_email).toBe('user1@example.com');
    expect(args.customer).toBeUndefined();
  });

  test('reutiliza stripe_customer_id existente en vez de customer_email', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ stripe_customer_id: 'cus_existing' }] });
    stripe.checkout.sessions.create.mockResolvedValueOnce({ url: 'https://checkout.stripe.com/session-2' });
    const res = await request(app).post('/api/stripe/create-checkout-session').set('x-test-user', USUARIO);
    expect(res.status).toBe(200);
    const args = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(args.customer).toBe('cus_existing');
    expect(args.customer_email).toBeUndefined();
  });
});

describe('POST /api/stripe/create-checkout-session-tienda', () => {
  const PRODUCTO_A = { id: 'taza', nombre: 'Taza', disponible: true, stripe_price_id: 'price_taza' };
  const PRODUCTO_B = { id: 'libreta', nombre: 'Libreta', disponible: true, stripe_price_id: 'price_libreta' };

  test('401 sin autenticacion', async () => {
    const res = await request(app).post('/api/stripe/create-checkout-session-tienda').send({ items: [] });
    expect(res.status).toBe(401);
  });

  test('400 si el carrito esta vacio', async () => {
    const res = await request(app).post('/api/stripe/create-checkout-session-tienda')
      .set('x-test-user', USUARIO).send({ items: [] });
    expect(res.status).toBe(400);
  });

  test('400 si un producto no tiene stripe_price_id configurado', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ ...PRODUCTO_A, stripe_price_id: null }] });
    const res = await request(app).post('/api/stripe/create-checkout-session-tienda')
      .set('x-test-user', USUARIO).send({ items: [{ productId: 'taza', qty: 1 }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/todavia no tiene pago configurado/);
  });

  test('400 si un producto no esta disponible', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ ...PRODUCTO_A, disponible: false }] });
    const res = await request(app).post('/api/stripe/create-checkout-session-tienda')
      .set('x-test-user', USUARIO).send({ items: [{ productId: 'taza', qty: 1 }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ya no esta disponible/);
  });

  test('200 crea la sesion con multiples line_items usando los precios de la base de datos', async () => {
    pool.query.mockResolvedValueOnce({ rows: [PRODUCTO_A, PRODUCTO_B] });
    stripe.checkout.sessions.create.mockResolvedValueOnce({ url: 'https://checkout.stripe.com/session-tienda' });
    const res = await request(app).post('/api/stripe/create-checkout-session-tienda')
      .set('x-test-user', USUARIO)
      .send({ items: [{ productId: 'taza', qty: 2 }, { productId: 'libreta', qty: 1 }] });
    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://checkout.stripe.com/session-tienda');
    const args = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(args.mode).toBe('payment');
    expect(args.client_reference_id).toBe('user-1');
    expect(args.line_items).toEqual([
      { price: 'price_taza', quantity: 2 },
      { price: 'price_libreta', quantity: 1 },
    ]);
  });

  test('nunca confia en el precio/cantidad que manda el cliente, solo el id', async () => {
    pool.query.mockResolvedValueOnce({ rows: [PRODUCTO_A] });
    stripe.checkout.sessions.create.mockResolvedValueOnce({ url: 'https://x' });
    await request(app).post('/api/stripe/create-checkout-session-tienda')
      .set('x-test-user', USUARIO)
      .send({ items: [{ productId: 'taza', qty: 3, price: 0.01 }] });
    const args = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(args.line_items).toEqual([{ price: 'price_taza', quantity: 3 }]);
  });
});
