jest.mock('../middleware/auth', () => require('../test-utils/authMock'));
jest.mock('../services/clasificadora');
jest.mock('../services/guardiana');
jest.mock('../services/pintora');
jest.mock('../db', () => ({ pool: { query: jest.fn() } }));

const request = require('supertest');
const { buildApp } = require('../app');
const { clasificarUrl } = require('../services/clasificadora');
const { revisarPieza } = require('../services/guardiana');
const { pintarPieza } = require('../services/pintora');
const { pool } = require('../db');

const app = buildApp();
const ADMIN = JSON.stringify({ id: 'admin-1', rol: 'admin' });
const USUARIO = JSON.stringify({ id: 'user-1', rol: 'usuario' });
const MODERADOR = JSON.stringify({ id: 'mod-1', rol: 'moderador' });
const URL_RUTA = '/api/admin/brigada/clasificar';
const USAGE = { tokensEntrada: 800, tokensSalida: 150, costoEstimadoUsd: 0.0015 };

beforeEach(() => {
  pool.query.mockReset();
  pool.query.mockResolvedValue({ rows: [] });
  clasificarUrl.mockReset();
  revisarPieza.mockReset();
  pintarPieza.mockReset();
});

describe('POST /api/admin/brigada/clasificar', () => {
  test('401 sin sesión; 403 para usuario y moderador (solo admin)', async () => {
    expect((await request(app).post(URL_RUTA).send({ url: 'https://a.com' })).status).toBe(401);
    for (const quien of [USUARIO, MODERADOR]) {
      expect((await request(app).post(URL_RUTA).set('x-test-user', quien).send({ url: 'https://a.com' })).status).toBe(403);
    }
    expect(clasificarUrl).not.toHaveBeenCalled();
  });

  test.each([
    [{}, /URL/],
    [{ url: '   ' }, /URL/],
    [{ url: 'https://a.com', destino: 'otro' }, /Destino/],
  ])('400 con datos inválidos %#', async (body, patron) => {
    const res = await request(app).post(URL_RUTA).set('x-test-user', ADMIN).send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(patron);
    expect(clasificarUrl).not.toHaveBeenCalled();
  });

  test('200 devuelve las sugerencias y registra el costo', async () => {
    clasificarUrl.mockResolvedValue({
      sugerencias: { idioma: { valor: 'es', motivo: 'm', confianza: 'alta' } }, formatoOriginal: 'video', url: 'https://a.com/', usage: USAGE,
    });
    const res = await request(app).post(URL_RUTA).set('x-test-user', ADMIN).send({ url: ' https://a.com/x ', destino: 'noticia' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true, sugerencias: { idioma: { valor: 'es', motivo: 'm', confianza: 'alta' } }, formatoOriginal: 'video', url: 'https://a.com/',
    });
    expect(clasificarUrl).toHaveBeenCalledWith({ url: 'https://a.com/x', destino: 'noticia' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO ia_generaciones/);
    expect(params).toEqual(['clasificadora', 'url', 800, 150, 0.0015, 'admin-1', 0]);
  });

  test('el destino por defecto es contenido', async () => {
    clasificarUrl.mockResolvedValue({ sugerencias: {}, formatoOriginal: null, url: 'https://a.com/', usage: USAGE });
    await request(app).post(URL_RUTA).set('x-test-user', ADMIN).send({ url: 'https://a.com' });
    expect(clasificarUrl).toHaveBeenCalledWith({ url: 'https://a.com', destino: 'contenido' });
  });

  test('si la página no se puede leer, 400 con el motivo y sin costo', async () => {
    clasificarUrl.mockRejectedValue(new Error('Esa direccion no esta permitida.'));
    const res = await request(app).post(URL_RUTA).set('x-test-user', ADMIN).send({ url: 'http://127.0.0.1/' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no esta permitida/);
    expect(pool.query).not.toHaveBeenCalled();
  });
});

describe('POST /api/admin/brigada/revisar (La Guardiana)', () => {
  const URL_REVISAR = '/api/admin/brigada/revisar';
  const RESULTADO = {
    copia: { evaluable: true, porcentaje: 4, nivel: 'bajo', pasajes: [] },
    revision: { banderas: [], requiere18: false, motivo18: 'No es explícito.' },
    usage: USAGE,
  };

  test('401 sin sesión; 403 para usuario y moderador (solo admin)', async () => {
    expect((await request(app).post(URL_REVISAR).send({ titulo: 'T' })).status).toBe(401);
    for (const quien of [USUARIO, MODERADOR]) {
      expect((await request(app).post(URL_REVISAR).set('x-test-user', quien).send({ titulo: 'T' })).status).toBe(403);
    }
    expect(revisarPieza).not.toHaveBeenCalled();
  });

  test.each([
    [{}, /título, el resumen o el cuerpo/],
    [{ titulo: '  ', cuerpo: '' }, /título, el resumen o el cuerpo/],
    [{ titulo: 5 }, /deben ser texto/],
    [{ cuerpo: 'x'.repeat(60001) }, /demasiado largo/],
    [{ cuerpo: 'Texto', fuenteUrl: 5 }, /URL/],
  ])('400 con datos inválidos %#', async (body, patron) => {
    const res = await request(app).post(URL_REVISAR).set('x-test-user', ADMIN).send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(patron);
    expect(revisarPieza).not.toHaveBeenCalled();
  });

  test('200 devuelve la copia y la revisión, y registra el costo', async () => {
    revisarPieza.mockResolvedValue(RESULTADO);
    const res = await request(app).post(URL_REVISAR).set('x-test-user', ADMIN)
      .send({ titulo: 'T', cuerpo: 'Texto.', fuenteUrl: ' https://a.com/x ', seccion: 'noticias' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, copia: RESULTADO.copia, revision: RESULTADO.revision });
    expect(revisarPieza).toHaveBeenCalledWith({ titulo: 'T', resumen: undefined, cuerpo: 'Texto.', fuenteUrl: 'https://a.com/x', fuentesExtra: [], seccion: 'noticias' });
    expect(pool.query.mock.calls[0][0]).toMatch(/INSERT INTO ia_generaciones/);
    expect(pool.query.mock.calls[0][1]).toEqual(['guardiana', 'texto', 800, 150, 0.0015, 'admin-1', 0]);
  });

  test('con otras fuentes las limpia y se las pasa a La Guardiana, y devuelve el parecido con cada una', async () => {
    const copiasExtra = [{ url: 'https://b.com/y', copia: { evaluable: true, porcentaje: 40, nivel: 'alto', pasajes: [] } }];
    revisarPieza.mockResolvedValue({ ...RESULTADO, copiasExtra });
    const res = await request(app).post(URL_REVISAR).set('x-test-user', ADMIN)
      .send({ titulo: 'T', cuerpo: 'Texto.', fuenteUrl: 'https://a.com/x', fuentesExtra: [{ nombre: 'B', url: ' https://b.com/y ' }, { nombre: 'Libro' }, 'https://b.com/y'] });
    expect(res.status).toBe(200);
    expect(res.body.copiasExtra).toEqual(copiasExtra);
    expect(revisarPieza).toHaveBeenCalledWith(expect.objectContaining({ fuentesExtra: ['https://b.com/y'] }));
  });

  test.each([[['javascript:alert(1)']], ['no-es-lista'], [Array.from({ length: 5 }, (_, i) => `https://m${i}.com`)]])('400 con otras fuentes inválidas %#', async (fuentesExtra) => {
    const res = await request(app).post(URL_REVISAR).set('x-test-user', ADMIN).send({ titulo: 'T', fuentesExtra });
    expect(res.status).toBe(400);
    expect(revisarPieza).not.toHaveBeenCalled();
  });

  test('sin URL de la fuente manda cadena vacía; si la IA falla, 400 sin costo', async () => {
    revisarPieza.mockRejectedValue(new Error('ANTHROPIC_API_KEY no esta configurada en el servidor.'));
    const res = await request(app).post(URL_REVISAR).set('x-test-user', ADMIN).send({ titulo: 'T' });
    expect(res.status).toBe(400);
    expect(revisarPieza).toHaveBeenCalledWith(expect.objectContaining({ fuenteUrl: '' }));
    expect(pool.query).not.toHaveBeenCalled();
  });
});

describe('POST /api/admin/brigada/duplicados (El Detective)', () => {
  const URL_DUP = '/api/admin/brigada/duplicados';

  test('401 sin sesión; 403 para usuario y moderador (solo admin)', async () => {
    expect((await request(app).post(URL_DUP).send({ titulo: 'T' })).status).toBe(401);
    for (const quien of [USUARIO, MODERADOR]) {
      expect((await request(app).post(URL_DUP).set('x-test-user', quien).send({ titulo: 'T' })).status).toBe(403);
    }
    expect(pool.query).not.toHaveBeenCalled();
  });

  test.each([
    [{}, /título o la URL/],
    [{ titulo: '  ', fuenteUrl: '' }, /título o la URL/],
    [{ titulo: 5 }, /deben ser texto/],
    [{ titulo: 'x'.repeat(5001) }, /demasiado largos/],
    [{ titulo: 'T', excluir: { tipo: 'otra', id: 'a' } }, /excluir/],
    [{ titulo: 'T', excluir: 'a' }, /excluir/],
  ])('400 con datos inválidos %#', async (body, patron) => {
    const res = await request(app).post(URL_DUP).set('x-test-user', ADMIN).send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(patron);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('200 busca en noticias y contenidos, deja fuera la pieza que se está editando y no cuesta IA', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [
        { id: 'luna', titulo: 'La NASA halla el cráter más grande formado en la Luna', fuente_url: 'https://nasa.gov/crater', publicado: true, fecha: '2026-09-16', resumen: 'Texto.' },
        { id: 'esta', titulo: 'La NASA halla el cráter más grande formado en la Luna', fuente_url: 'https://nasa.gov/crater', publicado: false, fecha: '2026-09-17', resumen: 'Texto.' },
      ] })
      .mockResolvedValueOnce({ rows: [{ id: 'ensayo', titulo: 'Reforma educativa', fuente_url: null, publicado: true, fecha: '2026-01-01', resumen: 'Escuelas.' }] });
    const res = await request(app).post(URL_DUP).set('x-test-user', ADMIN)
      .send({ titulo: 'La NASA halla el cráter más grande formado en la Luna', fuenteUrl: 'http://www.nasa.gov/crater/', excluir: { tipo: 'noticia', id: 'esta' } });
    expect(res.status).toBe(200);
    expect(res.body.revisadas).toBe(3);
    expect(res.body.candidatas.map((c) => [c.tipo, c.id])).toEqual([['noticia', 'luna']]);
    expect(res.body.candidatas[0]).toMatchObject({ nivel: 'muy_probable', publicado: true });
    expect(pool.query.mock.calls[0][0]).toMatch(/FROM noticias/);
    expect(pool.query.mock.calls[1][0]).toMatch(/FROM contenidos/);
    expect(pool.query).toHaveBeenCalledTimes(2); // dos lecturas, ningun registro de costo
  });

  test('detecta la misma fuente aunque esté en la lista de OTRAS fuentes de la pieza existente o de la nueva', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'con-extra', titulo: 'Algo muy distinto', fuente_url: 'https://principal.com/a', fuentes: [{ nombre: 'Medio', url: 'https://medio.com/nota?utm_source=x' }, { nombre: 'Libro', url: '' }], publicado: true, fecha: '2026-01-01', resumen: 'Otro tema.' }] });
    const res = await request(app).post(URL_DUP).set('x-test-user', ADMIN)
      .send({ titulo: 'Un título sin relación', fuenteUrl: 'https://otra.com/z', fuentesExtra: [{ nombre: 'Medio', url: 'https://www.medio.com/nota/' }] });
    expect(res.status).toBe(200);
    expect(res.body.candidatas.map((c) => c.id)).toEqual(['con-extra']);
    expect(pool.query.mock.calls[1][0]).toMatch(/fuentes/);
  });

  test('400 con otras fuentes inválidas', async () => {
    const res = await request(app).post(URL_DUP).set('x-test-user', ADMIN).send({ titulo: 'T', fuentesExtra: ['ftp://x.com'] });
    expect(res.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('si la base falla, 500 genérico sin detalles internos', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    pool.query.mockRejectedValue(new Error('relation "noticias" secreta'));
    const res = await request(app).post(URL_DUP).set('x-test-user', ADMIN).send({ titulo: 'T' });
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('secreta');
  });
});

describe('POST /api/admin/brigada/pintar (La Pintora)', () => {
  const URL_PINTAR = '/api/admin/brigada/pintar';
  const RESULTADO = { textoAlternativo: 'Un farol sobre la Luna.', escena: 'A lantern on the moon.', promptImagen: 'A lantern on the moon. Estilo.', usage: USAGE };

  test('401 sin sesión; 403 para usuario y moderador (solo admin)', async () => {
    expect((await request(app).post(URL_PINTAR).send({ titulo: 'T' })).status).toBe(401);
    for (const quien of [USUARIO, MODERADOR]) {
      expect((await request(app).post(URL_PINTAR).set('x-test-user', quien).send({ titulo: 'T' })).status).toBe(403);
    }
    expect(pintarPieza).not.toHaveBeenCalled();
  });

  test.each([
    [{}, /para que la pintora/],
    [{ titulo: 7 }, /deben ser texto/],
    [{ titulo: 'T', idioma: 'fr' }, /Idioma/],
    [{ cuerpo: 'x'.repeat(60001) }, /demasiado largo/],
  ])('400 con datos inválidos %#', async (body, patron) => {
    const res = await request(app).post(URL_PINTAR).set('x-test-user', ADMIN).send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(patron);
    expect(pintarPieza).not.toHaveBeenCalled();
  });

  test('200 devuelve el texto alternativo, la escena y el prompt, y registra el costo', async () => {
    pintarPieza.mockResolvedValue(RESULTADO);
    const res = await request(app).post(URL_PINTAR).set('x-test-user', ADMIN).send({ titulo: 'T', resumen: 'R', idioma: 'es', seccion: 'noticias' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, textoAlternativo: 'Un farol sobre la Luna.', escena: 'A lantern on the moon.', promptImagen: 'A lantern on the moon. Estilo.' });
    expect(pintarPieza).toHaveBeenCalledWith({ titulo: 'T', resumen: 'R', cuerpo: undefined, idioma: 'es', seccion: 'noticias' });
    expect(pool.query.mock.calls[0][0]).toMatch(/INSERT INTO ia_generaciones/);
    expect(pool.query.mock.calls[0][1]).toEqual(['pintora', 'texto', 800, 150, 0.0015, 'admin-1', 0]);
  });

  test('si la IA falla, 400 con el motivo y sin costo', async () => {
    pintarPieza.mockRejectedValue(new Error('La pintora no devolvió la imagen. Intenta de nuevo.'));
    const res = await request(app).post(URL_PINTAR).set('x-test-user', ADMIN).send({ titulo: 'T' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Intenta de nuevo/);
    expect(pool.query).not.toHaveBeenCalled();
  });
});
