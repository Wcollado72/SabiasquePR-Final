jest.mock('../middleware/auth', () => require('../test-utils/authMock'));
jest.mock('../db', () => ({ pool: { query: jest.fn() } }));

const request = require('supertest');
const { buildApp } = require('../app');
const { pool } = require('../db');

const app = buildApp();

const ADMIN = JSON.stringify({ id: 'admin-1', rol: 'admin' });
const USUARIO = JSON.stringify({ id: 'user-1', rol: 'usuario' });

const PRODUCTO_VALIDO = {
  nombre: 'Taza Nuevos Humanos',
  descripcion: 'Una taza de ceramica.',
  precio: 12.5,
  imagen: 'images/taza.webp',
  imagenAlt: 'Foto de la taza',
};

beforeEach(() => {
  pool.query.mockReset();
});

describe('GET /api/productos', () => {
  test('devuelve la lista de productos', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'a', nombre: 'A' }] });
    const res = await request(app).get('/api/productos');
    expect(res.status).toBe(200);
    expect(res.body.productos).toHaveLength(1);
  });
});

describe('GET /api/productos/:id', () => {
  test('404 si no existe', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/productos/no-existe');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/productos', () => {
  test('401 sin autenticacion', async () => {
    const res = await request(app).post('/api/productos').send(PRODUCTO_VALIDO);
    expect(res.status).toBe(401);
  });

  test('403 si el usuario no es admin', async () => {
    const res = await request(app)
      .post('/api/productos')
      .set('x-test-user', USUARIO)
      .send(PRODUCTO_VALIDO);
    expect(res.status).toBe(403);
  });

  test('400 si el precio es invalido', async () => {
    const res = await request(app)
      .post('/api/productos')
      .set('x-test-user', ADMIN)
      .send({ ...PRODUCTO_VALIDO, precio: -5 });
    expect(res.status).toBe(400);
  });

  test('201 al crear un producto valido como admin', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] }) // chequeo de id duplicado
      .mockResolvedValueOnce({ rows: [{ id: 'taza-nuevos-humanos', ...PRODUCTO_VALIDO }] }); // insert
    const res = await request(app)
      .post('/api/productos')
      .set('x-test-user', ADMIN)
      .send(PRODUCTO_VALIDO);
    expect(res.status).toBe(201);
    expect(res.body.producto.id).toBe('taza-nuevos-humanos');
  });
});

describe('PUT /api/productos/:id', () => {
  test('404 si el producto no existe', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .put('/api/productos/no-existe')
      .set('x-test-user', ADMIN)
      .send({ nombre: 'Nuevo nombre' });
    expect(res.status).toBe(404);
  });

  test('200 al editar un producto existente', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'a', ...PRODUCTO_VALIDO }] })
      .mockResolvedValueOnce({ rows: [{ id: 'a', nombre: 'Nombre editado' }] });
    const res = await request(app)
      .put('/api/productos/a')
      .set('x-test-user', ADMIN)
      .send({ nombre: 'Nombre editado' });
    expect(res.status).toBe(200);
    expect(res.body.producto.nombre).toBe('Nombre editado');
  });
});

describe('DELETE /api/productos/:id', () => {
  test('404 si no existe', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0 });
    const res = await request(app).delete('/api/productos/no-existe').set('x-test-user', ADMIN);
    expect(res.status).toBe(404);
  });

  test('200 al eliminar un producto existente', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });
    const res = await request(app).delete('/api/productos/a').set('x-test-user', ADMIN);
    expect(res.status).toBe(200);
  });
});

describe('GET /api/productos?lang= (Fase C2)', () => {
  test('traduce nombre y descripcion pero deja precio y enlaces intactos', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 't', nombre: 'Taza', descripcion: 'Bonita', precio: '12.00', stripe_link: 'https://buy.stripe.com/x', stripe_price_id: 'price_1' }] })
      .mockResolvedValueOnce({ rows: [{ item_id: 't', campos: { nombre: 'Mug', descripcion: 'Nice', precio: '0', stripe_link: 'https://evil.com' } }] });
    const res = await request(app).get('/api/productos?lang=en');
    expect(res.body.productos[0]).toMatchObject({ nombre: 'Mug', descripcion: 'Nice', precio: '12.00', stripe_link: 'https://buy.stripe.com/x', stripe_price_id: 'price_1' });
  });

  test('sin ?lang= no cambia el comportamiento anterior', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 't', nombre: 'Taza' }] });
    const res = await request(app).get('/api/productos');
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(res.body.productos[0]).toEqual({ id: 't', nombre: 'Taza' });
  });
});
