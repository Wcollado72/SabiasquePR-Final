jest.mock('../middleware/auth', () => require('../test-utils/authMock'));
jest.mock('../services/grieta');
jest.mock('../services/farolera', () => ({ ...jest.requireActual('../services/farolera'), desarrollarSemilla: jest.fn() }));
jest.mock('../db', () => ({ pool: { query: jest.fn(), connect: jest.fn() } }));

// Taller E3: La Farolera (desarrollar), descartar un borrador y «Pasar a Contenidos».
const crypto = require('crypto');
const request = require('supertest');
const { buildApp } = require('../app');
const { desarrollarSemilla } = require('../services/farolera');
const { pool } = require('../db');

const app = buildApp();
const ADMIN = JSON.stringify({ id: 'admin-1', rol: 'admin' });
const USUARIO = JSON.stringify({ id: 'user-1', rol: 'usuario' });
const ID = '11111111-1111-4111-8111-111111111111';
const DID = '22222222-2222-4222-8222-222222222222';
const hash = (t) => crypto.createHash('sha1').update(t).digest('hex').slice(0, 16);

beforeEach(() => {
  pool.query.mockReset();
  pool.connect.mockReset();
  desarrollarSemilla.mockReset();
});

describe('acceso (solo admin)', () => {
  test.each([
    ['post', `/api/semillas/${ID}/desarrollar`],
    ['delete', `/api/semillas/${ID}/desarrollos/${DID}`],
    ['post', `/api/semillas/${ID}/pasar-a-contenidos`],
  ])('%s %s: 401 sin sesión y 403 para un usuario', async (metodo, ruta) => {
    expect((await request(app)[metodo](ruta).send({})).status).toBe(401);
    expect((await request(app)[metodo](ruta).set('x-test-user', USUARIO).send({})).status).toBe(403);
    expect(pool.query).not.toHaveBeenCalled();
    expect(pool.connect).not.toHaveBeenCalled();
  });
});

describe('POST /api/semillas/:id/desarrollar (La Farolera)', () => {
  const URL = `/api/semillas/${ID}/desarrollar`;
  const BORRADOR = {
    resultado: {
      titulo: 'Título', resumen: 'Un resumen suficiente.', idioma: 'es', notas: [], datos_a_verificar: [], palabras: { autor: 3, farolera: 3, porcentaje_autor: 50 },
      parrafos: [[{ texto: 'La gente cambia.', origen: 'autor' }, { texto: ' Imagina que sí.', origen: 'farolera' }]],
    },
    usage: { tokensEntrada: 1000, tokensSalida: 1500, costoEstimadoUsd: 0.017 },
  };

  test('400 sin formato válido o con indicaciones demasiado largas, sin tocar la base', async () => {
    expect((await request(app).post(URL).set('x-test-user', ADMIN).send({ formato: 'novela' })).status).toBe(400);
    expect((await request(app).post(URL).set('x-test-user', ADMIN).send({})).status).toBe(400);
    const largo = await request(app).post(URL).set('x-test-user', ADMIN).send({ formato: 'ensayo', indicaciones: 'x'.repeat(501) });
    expect(largo.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
    expect(desarrollarSemilla).not.toHaveBeenCalled();
  });

  test('404 si la semilla no es de quien pregunta o el id no es válido', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    expect((await request(app).post(URL).set('x-test-user', ADMIN).send({ formato: 'ensayo' })).status).toBe(404);
    expect((await request(app).post('/api/semillas/no-es-uuid/desarrollar').set('x-test-user', ADMIN).send({ formato: 'ensayo' })).status).toBe(404);
    expect(desarrollarSemilla).not.toHaveBeenCalled();
  });

  test('200 desarrolla el texto guardado con el análisis previo, guarda el borrador (tope de 5), pasa a «en_desarrollo» y cobra a «farolera»', async () => {
    const analisis = { grieta: { resultado: { tesis: 'T' } } };
    pool.query
      .mockResolvedValueOnce({ rows: [{ titulo: 'V', texto: 'La gente cambia.', analisis }] })
      .mockResolvedValueOnce({ rows: [] }) // registro de uso
      .mockResolvedValueOnce({ rows: [{ estado: 'en_desarrollo' }] });
    desarrollarSemilla.mockResolvedValue(BORRADOR);
    const res = await request(app).post(URL).set('x-test-user', ADMIN).send({ formato: 'columna', indicaciones: ' Más cálido ' });
    expect(res.status).toBe(200);
    expect(desarrollarSemilla).toHaveBeenCalledWith({ titulo: 'V', texto: 'La gente cambia.', formato: 'columna', indicaciones: ' Más cálido ', analisis });
    expect(res.body.estado).toBe('en_desarrollo');
    expect(res.body.desarrollo).toMatchObject({ formato: 'columna', indicaciones: 'Más cálido', titulo: 'Título', texto_hash: hash('La gente cambia.') });
    expect(res.body.desarrollo.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(pool.query.mock.calls[1][1]).toEqual(['farolera', 'texto', 1000, 1500, 0.017, 'admin-1', 0]);
    const [sql, params] = pool.query.mock.calls[2];
    expect(sql).toContain("jsonb_path_query_array(desarrollos || $3::jsonb, '$[last-4 to last]')");
    expect(sql).toContain("WHEN estado IN ('semilla', 'explorada') THEN 'en_desarrollo'");
    expect(params.slice(0, 2)).toEqual([ID, 'admin-1']);
    expect(JSON.parse(params[2])[0].id).toBe(res.body.desarrollo.id);
  });

  test('si la IA falla, 400 con el motivo, sin guardar ni cobrar', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ titulo: '', texto: 'Idea.', analisis: {} }] });
    desarrollarSemilla.mockRejectedValue(new Error('La Farolera no devolvió su desarrollo. Intenta de nuevo.'));
    const res = await request(app).post(URL).set('x-test-user', ADMIN).send({ formato: 'ensayo' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Intenta de nuevo/);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });
});

describe('DELETE /api/semillas/:id/desarrollos/:desarrolloId', () => {
  test('descarta el borrador de esa semilla y de ese autor', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: ID }] });
    const res = await request(app).delete(`/api/semillas/${ID}/desarrollos/${DID}`).set('x-test-user', ADMIN);
    expect(res.status).toBe(200);
    expect(pool.query.mock.calls[0][1]).toEqual([ID, 'admin-1', DID]);
    expect(pool.query.mock.calls[0][0]).toContain('autor_id = $2');
  });

  test('404 si el borrador ya no existe o los ids no son válidos', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    expect((await request(app).delete(`/api/semillas/${ID}/desarrollos/${DID}`).set('x-test-user', ADMIN)).status).toBe(404);
    expect((await request(app).delete(`/api/semillas/${ID}/desarrollos/xyz`).set('x-test-user', ADMIN)).status).toBe(404);
  });
});

describe('POST /api/semillas/:id/pasar-a-contenidos', () => {
  const URL = `/api/semillas/${ID}/pasar-a-contenidos`;
  const DESARROLLO = {
    id: DID, formato: 'columna', titulo: 'La vergüenza que mueve', resumen: 'Un resumen suficiente.', idioma: 'es',
    parrafos: [[{ texto: 'La gente cambia.', origen: 'autor' }, { texto: ' Imagina que sí.', origen: 'farolera' }]],
  };
  let client;
  beforeEach(() => {
    client = { query: jest.fn(), release: jest.fn() };
    pool.connect.mockResolvedValue(client);
  });
  const primeraPalabra = () => client.query.mock.calls.map((c) => String(c[0]).trim().split(/\s+/).slice(0, 2).join(' '));
  const enviar = () => request(app).post(URL).set('x-test-user', ADMIN).send({ desarrolloId: DID });

  test('400 si no se elige un borrador válido, sin abrir la transacción', async () => {
    expect((await request(app).post(URL).set('x-test-user', ADMIN).send({})).status).toBe(400);
    expect((await request(app).post(URL).set('x-test-user', ADMIN).send({ desarrolloId: 'xyz' })).status).toBe(400);
    expect(pool.connect).not.toHaveBeenCalled();
  });

  test('404 si la semilla o el borrador no existen (ROLLBACK y la conexión se suelta)', async () => {
    client.query.mockResolvedValueOnce({}).mockResolvedValueOnce({ rows: [] }).mockResolvedValue({});
    expect((await enviar()).status).toBe(404);
    client.query.mockReset();
    client.query.mockResolvedValueOnce({}).mockResolvedValueOnce({ rows: [{ titulo: 'V', desarrollos: [], contenido_id: null }] }).mockResolvedValue({});
    expect((await enviar()).status).toBe(404);
    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(2);
  });

  test('409 si la semilla ya pasó a una pieza que todavía existe', async () => {
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ titulo: 'V', desarrollos: [DESARROLLO], contenido_id: 'ya-existe' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'ya-existe' }] })
      .mockResolvedValue({});
    const res = await enviar();
    expect(res.status).toBe(409);
    expect(res.body.contenidoId).toBe('ya-existe');
    expect(primeraPalabra()).not.toContain('INSERT INTO');
  });

  test('201 crea el BORRADOR en Contenidos (sin publicar) y marca la semilla «pasada», todo en una transacción', async () => {
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ titulo: 'V', desarrollos: [DESARROLLO], contenido_id: null }] })
      .mockResolvedValueOnce({ rows: [] }) // el slug está libre
      .mockResolvedValue({ rows: [] });
    const res = await enviar();
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ ok: true, estado: 'pasada', contenido: { id: 'la-verguenza-que-mueve', publicado: false } });
    expect(primeraPalabra()).toEqual(['BEGIN', 'SELECT titulo,', 'SELECT id', 'INSERT INTO', 'UPDATE semillas', 'COMMIT']);
    const valores = client.query.mock.calls[3][1];
    expect(valores.slice(0, 5)).toEqual(['la-verguenza-que-mueve', 'revolucion-humana', 'logica-humana', 'ensayo', 'columna']);
    expect(valores).toContain('Aliado Imperfekto');
    expect(valores).toContain('parcial');
    expect(valores[valores.length - 2]).toBe(false); // publicado
    expect(client.query.mock.calls[4][1]).toEqual([ID, 'admin-1', 'la-verguenza-que-mueve']);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test('si el título ya existe agrega un sufijo, y si la pieza anterior fue borrada permite crear otra', async () => {
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ titulo: 'V', desarrollos: [DESARROLLO], contenido_id: 'borrada' }] })
      .mockResolvedValueOnce({ rows: [] }) // «borrada» ya no existe
      .mockResolvedValueOnce({ rows: [{ id: 'la-verguenza-que-mueve' }] }) // slug ocupado
      .mockResolvedValue({ rows: [] });
    const res = await enviar();
    expect(res.status).toBe(201);
    expect(res.body.contenido.id).toMatch(/^la-verguenza-que-mueve-[a-z0-9]+$/);
  });

  test('si algo falla a medias, hace ROLLBACK y no deja nada guardado', async () => {
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ titulo: 'V', desarrollos: [DESARROLLO], contenido_id: null }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue({});
    const res = await enviar();
    expect(res.status).toBe(500);
    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
