jest.mock('../db', () => ({ pool: { query: jest.fn() } }));
jest.mock('../lib/stripe', () => ({
  stripe: {
    webhooks: { constructEvent: jest.fn() },
    checkout: { sessions: { listLineItems: jest.fn() } },
  },
}));

const request = require('supertest');
const { buildApp } = require('../app');
const { pool } = require('../db');
const { stripe } = require('../lib/stripe');

const app = buildApp();

beforeEach(() => {
  pool.query.mockReset();
  stripe.webhooks.constructEvent.mockReset();
  stripe.checkout.sessions.listLineItems.mockReset();
});

describe('POST /api/stripe/webhook', () => {
  test('400 si la firma es invalida', async () => {
    stripe.webhooks.constructEvent.mockImplementation(() => { throw new Error('firma invalida'); });
    const res = await request(app).post('/api/stripe/webhook').send({ foo: 'bar' });
    expect(res.status).toBe(400);
  });

  test('checkout.session.completed actualiza el perfil a premium', async () => {
    stripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: {
        mode: 'subscription', client_reference_id: 'user-1', customer: 'cus_1', subscription: 'sub_1', payment_status: 'paid',
      } },
    });
    pool.query.mockResolvedValueOnce({});
    const res = await request(app).post('/api/stripe/webhook').send({});
    expect(res.status).toBe(200);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/UPDATE perfiles/);
    expect(params).toEqual(['cus_1', 'sub_1', 'user-1']);
  });

  test('checkout.session.async_payment_succeeded actualiza el perfil a premium', async () => {
    stripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.async_payment_succeeded',
      data: { object: {
        mode: 'subscription', client_reference_id: 'user-2', customer: 'cus_2', subscription: 'sub_2', payment_status: 'paid',
      } },
    });
    pool.query.mockResolvedValueOnce({});
    const res = await request(app).post('/api/stripe/webhook').send({});
    expect(res.status).toBe(200);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/UPDATE perfiles/);
    expect(params).toEqual(['cus_2', 'sub_2', 'user-2']);
  });

  test('checkout.session.completed no actualiza el perfil si el pago aun no esta confirmado', async () => {
    stripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: {
        mode: 'subscription', client_reference_id: 'user-3', customer: 'cus_3', subscription: 'sub_3', payment_status: 'unpaid',
      } },
    });
    const res = await request(app).post('/api/stripe/webhook').send({});
    expect(res.status).toBe(200);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('checkout.session.completed (compra de Tienda) registra el pedido en ordenes', async () => {
    stripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: {
        id: 'cs_1', mode: 'payment', client_reference_id: 'user-4',
        payment_status: 'paid', amount_total: 3400,
      } },
    });
    stripe.checkout.sessions.listLineItems.mockResolvedValue({
      data: [
        { description: 'Taza "Nuevos Humanos"', quantity: 2, amount_total: 2400 },
        { description: 'Libreta "Educación y Lógica"', quantity: 1, amount_total: 1000 },
      ],
    });
    pool.query.mockResolvedValueOnce({});
    const res = await request(app).post('/api/stripe/webhook').send({});
    expect(res.status).toBe(200);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO ordenes/);
    expect(params[0]).toBe('user-4');
    expect(JSON.parse(params[1])).toEqual([
      { nombre: 'Taza "Nuevos Humanos"', cantidad: 2, total: 24 },
      { nombre: 'Libreta "Educación y Lógica"', cantidad: 1, total: 10 },
    ]);
    expect(params[2]).toBe(34);
    expect(params[3]).toBe('cs_1');
  });

  test('checkout.session.completed no registra pedido de Tienda si el pago no esta confirmado', async () => {
    stripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_2', mode: 'payment', client_reference_id: 'user-5', payment_status: 'unpaid' } },
    });
    const res = await request(app).post('/api/stripe/webhook').send({});
    expect(res.status).toBe(200);
    expect(pool.query).not.toHaveBeenCalled();
    expect(stripe.checkout.sessions.listLineItems).not.toHaveBeenCalled();
  });

  test('customer.subscription.deleted regresa el rol a usuario', async () => {
    stripe.webhooks.constructEvent.mockReturnValue({
      type: 'customer.subscription.deleted',
      data: { object: { customer: 'cus_1' } },
    });
    pool.query.mockResolvedValueOnce({});
    const res = await request(app).post('/api/stripe/webhook').send({});
    expect(res.status).toBe(200);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/UPDATE perfiles/);
    expect(params).toEqual(['cus_1']);
  });

  test('evento no manejado responde 200 sin tocar la base de datos', async () => {
    stripe.webhooks.constructEvent.mockReturnValue({ type: 'invoice.paid', data: { object: {} } });
    const res = await request(app).post('/api/stripe/webhook').send({});
    expect(res.status).toBe(200);
    expect(pool.query).not.toHaveBeenCalled();
  });
});
