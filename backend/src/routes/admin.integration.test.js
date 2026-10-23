jest.mock('../middleware/auth', () => require('../test-utils/authMock'));
jest.mock('../services/articleExtractor');
jest.mock('../services/anthropic');
jest.mock('../services/investigador');
jest.mock('../services/redactor');
jest.mock('../db', () => ({ pool: { query: jest.fn() } }));

const request = require('supertest');
const { buildApp } = require('../app');
const { extraerArticulo } = require('../services/articleExtractor');
const { redactarDesdeArticulo } = require('../services/anthropic');
const { investigarDesdeUrl, investigarDesdeTexto } = require('../services/investigador');
const { redactarDesdeNotas } = require('../services/redactor');
const { pool } = require('../db');

const app = buildApp();

const ADMIN = JSON.stringify({ id: 'admin-1', rol: 'admin' });
const USUARIO = JSON.stringify({ id: 'user-1', rol: 'usuario' });
const MODERADOR = JSON.stringify({ id: 'mod-1', rol: 'moderador' });

beforeEach(() => {
  extraerArticulo.mockReset();
  redactarDesdeArticulo.mockReset();
  investigarDesdeUrl.mockReset();
  investigarDesdeTexto.mockReset();
  redactarDesdeNotas.mockReset();
  pool.query.mockReset();
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

describe('GET /api/admin/estado-seguridad', () => {
  test('401 sin autenticacion', async () => {
    const res = await request(app).get('/api/admin/estado-seguridad');
    expect(res.status).toBe(401);
  });

  test('403 si el usuario no es admin ni moderador', async () => {
    const res = await request(app).get('/api/admin/estado-seguridad').set('x-test-user', USUARIO);
    expect(res.status).toBe(403);
  });

  test('200 con los datos reales para un admin', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ n: 2 }] })
      .mockResolvedValueOnce({ rows: [{ n: 5 }] });
    const res = await request(app).get('/api/admin/estado-seguridad').set('x-test-user', ADMIN);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      cooldownActivos: 2,
      cooldownHoras: 1,
      edadConfirmadasTotal: 5,
      turnstileActivo: expect.any(Boolean),
      rateLimitConfig: { general: 300, escritura: 20, ventanaMin: 15 },
    });
  });

  test('200 para un moderador', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ n: 0 }] })
      .mockResolvedValueOnce({ rows: [{ n: 0 }] });
    const res = await request(app).get('/api/admin/estado-seguridad').set('x-test-user', MODERADOR);
    expect(res.status).toBe(200);
  });
});

const USAGE_MOCK = { tokensEntrada: 1000, tokensSalida: 300, busquedasRealizadas: 0, costoEstimadoUsd: 0.005 };

describe('POST /api/admin/investigar', () => {
  test('401 sin autenticacion', async () => {
    const res = await request(app).post('/api/admin/investigar').send({ url: 'https://ejemplo.com/a' });
    expect(res.status).toBe(401);
  });

  test('403 si el usuario no es admin', async () => {
    const res = await request(app).post('/api/admin/investigar')
      .set('x-test-user', USUARIO).send({ url: 'https://ejemplo.com/a' });
    expect(res.status).toBe(403);
  });

  test('403 si el usuario es moderador (no tiene acceso a creacion de contenido)', async () => {
    const res = await request(app).post('/api/admin/investigar')
      .set('x-test-user', MODERADOR).send({ url: 'https://ejemplo.com/a' });
    expect(res.status).toBe(403);
  });

  test('400 si falta url y texto', async () => {
    const res = await request(app).post('/api/admin/investigar').set('x-test-user', ADMIN).send({});
    expect(res.status).toBe(400);
    expect(investigarDesdeUrl).not.toHaveBeenCalled();
    expect(investigarDesdeTexto).not.toHaveBeenCalled();
  });

  test('200 investigando desde URL, y registra el uso con el costo real', async () => {
    investigarDesdeUrl.mockResolvedValueOnce({
      notas: 'Notas de prueba', tituloOriginal: 'Titulo', fuenteTexto: 'El Ejemplo', fuenteUrl: 'https://ejemplo.com/a',
      fuenteTipo: 'url', usage: USAGE_MOCK,
    });
    pool.query.mockResolvedValueOnce({});
    const res = await request(app).post('/api/admin/investigar')
      .set('x-test-user', ADMIN).send({ url: 'https://ejemplo.com/a', usarBusquedaWeb: false });
    expect(res.status).toBe(200);
    expect(res.body.notas).toBe('Notas de prueba');
    expect(investigarDesdeUrl).toHaveBeenCalledWith('https://ejemplo.com/a', expect.objectContaining({ usarBusquedaWeb: false }));
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO ia_generaciones'),
      expect.arrayContaining(['investigador', 'url', false])
    );
  });

  test('200 investigando desde texto pegado', async () => {
    investigarDesdeTexto.mockResolvedValueOnce({
      notas: 'Notas desde transcripcion', tituloOriginal: 'Video X', fuenteTexto: '', fuenteUrl: '',
      fuenteTipo: 'texto', usage: USAGE_MOCK,
    });
    pool.query.mockResolvedValueOnce({});
    const res = await request(app).post('/api/admin/investigar')
      .set('x-test-user', ADMIN).send({ texto: 'Una transcripcion larga de prueba...', tituloSugerido: 'Video X' });
    expect(res.status).toBe(200);
    expect(investigarDesdeTexto).toHaveBeenCalled();
  });

  test('devuelve correcciones/preguntas/idioma y pasa instrucciones y tono al agente', async () => {
    investigarDesdeTexto.mockResolvedValueOnce({
      notas: 'N', tituloOriginal: 'T', fuenteTexto: '', fuenteUrl: '', fuenteTipo: 'texto', usage: USAGE_MOCK,
      idiomaDetectado: 'suajili', textoCorregido: 'texto limpio',
      correcciones: [{ antes: 'tecsto', despues: 'texto', motivo: 'ortografia' }],
      preguntas: [{ pregunta: '¿Tono?', opciones: ['Neutral', 'Crítico'] }],
    });
    pool.query.mockResolvedValueOnce({});
    const res = await request(app).post('/api/admin/investigar').set('x-test-user', ADMIN)
      .send({ texto: 'Un tecsto largo de prueba con suficientes caracteres para investigar.', instrucciones: 'Busca fuentes africanas', tono: 'neutral', respuestas: 'Neutral' });
    expect(res.status).toBe(200);
    expect(res.body.idiomaDetectado).toBe('suajili');
    expect(res.body.textoCorregido).toBe('texto limpio');
    expect(res.body.correcciones).toHaveLength(1);
    expect(res.body.preguntas[0].opciones).toEqual(['Neutral', 'Crítico']);
    expect(investigarDesdeTexto).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ instrucciones: 'Busca fuentes africanas', tono: 'neutral', respuestas: 'Neutral' }));
  });

  test('pasa continente y region al agente (origen conocido de la fuente)', async () => {
    investigarDesdeUrl.mockResolvedValueOnce({
      notas: 'N', tituloOriginal: 'T', fuenteTexto: 'Nation Africa', fuenteUrl: 'https://nation.africa/a', fuenteTipo: 'url', usage: USAGE_MOCK,
    });
    pool.query.mockResolvedValueOnce({});
    const res = await request(app).post('/api/admin/investigar').set('x-test-user', ADMIN)
      .send({ url: 'https://nation.africa/a', continente: 'africa', region: 'Nairobi, Kenia' });
    expect(res.status).toBe(200);
    expect(investigarDesdeUrl).toHaveBeenCalledWith('https://nation.africa/a', expect.objectContaining({ continente: 'africa', region: 'Nairobi, Kenia' }));
  });

  test('400 si el servicio lanza un error', async () => {
    investigarDesdeUrl.mockRejectedValueOnce(new Error('El texto pegado es muy corto.'));
    const res = await request(app).post('/api/admin/investigar')
      .set('x-test-user', ADMIN).send({ url: 'https://ejemplo.com/a' });
    expect(res.status).toBe(400);
  });

  test('sigue devolviendo 200 aunque falle el registro del gasto', async () => {
    investigarDesdeUrl.mockResolvedValueOnce({
      notas: 'Notas', tituloOriginal: 'T', fuenteTexto: 'X', fuenteUrl: 'https://ejemplo.com/a',
      fuenteTipo: 'url', usage: USAGE_MOCK,
    });
    pool.query.mockRejectedValueOnce(new Error('DB caida'));
    const res = await request(app).post('/api/admin/investigar')
      .set('x-test-user', ADMIN).send({ url: 'https://ejemplo.com/a' });
    expect(res.status).toBe(200);
  });
});

describe('POST /api/admin/redactar', () => {
  test('401 sin autenticacion', async () => {
    const res = await request(app).post('/api/admin/redactar').send({ notas: 'x' });
    expect(res.status).toBe(401);
  });

  test('403 si el usuario es moderador', async () => {
    const res = await request(app).post('/api/admin/redactar')
      .set('x-test-user', MODERADOR).send({ notas: 'Notas de prueba suficientemente largas' });
    expect(res.status).toBe(403);
  });

  test('400 si faltan las notas', async () => {
    const res = await request(app).post('/api/admin/redactar').set('x-test-user', ADMIN).send({});
    expect(res.status).toBe(400);
    expect(redactarDesdeNotas).not.toHaveBeenCalled();
  });

  test('200 al redactar desde notas', async () => {
    redactarDesdeNotas.mockResolvedValueOnce({
      titulo: 'Titulo redactado', subtituloResumen: 'Resumen.', parrafos: ['Uno.', 'Dos.'],
      duracionMinEstimado: 2, usage: USAGE_MOCK,
    });
    pool.query.mockResolvedValueOnce({});
    const res = await request(app).post('/api/admin/redactar')
      .set('x-test-user', ADMIN)
      .send({ notas: 'Notas de prueba suficientemente largas', seccion: 'revolucion-humana', subseccion: 'nuevos-humanos', estilo: 'investigacion', tono: 'critico', idioma: 'en' });
    expect(res.status).toBe(200);
    expect(res.body.titulo).toBe('Titulo redactado');
    expect(redactarDesdeNotas).toHaveBeenCalledWith(expect.objectContaining({ seccion: 'revolucion-humana', subseccion: 'nuevos-humanos', estilo: 'investigacion', tono: 'critico', idioma: 'en' }));
  });
});

describe('GET /api/admin/uso-ia', () => {
  test('401 sin autenticacion', async () => {
    const res = await request(app).get('/api/admin/uso-ia');
    expect(res.status).toBe(401);
  });

  test('403 si no es admin ni moderador', async () => {
    const res = await request(app).get('/api/admin/uso-ia').set('x-test-user', USUARIO);
    expect(res.status).toBe(403);
  });

  test('200 con el resumen de gasto para un moderador', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ agente: 'investigador', llamadas: 3, costo_total: 0.05 }] })
      .mockResolvedValueOnce({ rows: [{ costo_mes: 0.05 }] })
      .mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/admin/uso-ia').set('x-test-user', MODERADOR);
    expect(res.status).toBe(200);
    expect(res.body.costoMesActual).toBe(0.05);
  });

  test('200 para un admin', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ costo_mes: 0 }] })
      .mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/admin/uso-ia').set('x-test-user', ADMIN);
    expect(res.status).toBe(200);
  });
});

describe('POST /api/admin/autocompletar-ia -- bitacora de uso (A-1)', () => {
  const ARTICULO = { titulo: 't', texto: 'x', sitio: 'El Ejemplo', autor: '', url: 'https://ejemplo.com/a' };
  const REDACTADO = { titulo: 'T', resumen: 'R', parrafos: ['P'], fuenteTexto: 'El Ejemplo' };

  test('registra la llamada en ia_generaciones como redactor (con 0 si el servicio no devuelve tokens)', async () => {
    extraerArticulo.mockResolvedValueOnce(ARTICULO);
    redactarDesdeArticulo.mockResolvedValueOnce(REDACTADO);
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post('/api/admin/autocompletar-ia').set('x-test-user', ADMIN).send({ url: 'https://ejemplo.com/a' });
    expect(res.status).toBe(200);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('INSERT INTO ia_generaciones');
    expect(params).toEqual(['redactor', 'url', false, 0, 0, 0, 0, 'admin-1']);
    expect(res.body.usage).toBeUndefined();
  });

  test('registra los tokens y el costo cuando el servicio los devuelve', async () => {
    extraerArticulo.mockResolvedValueOnce(ARTICULO);
    redactarDesdeArticulo.mockResolvedValueOnce({ ...REDACTADO, usage: { tokensEntrada: 1000, tokensSalida: 500, costoEstimadoUsd: 0.0123 } });
    pool.query.mockResolvedValueOnce({ rows: [] });
    await request(app).post('/api/admin/autocompletar-ia').set('x-test-user', ADMIN).send({ url: 'https://ejemplo.com/a' });
    expect(pool.query.mock.calls[0][1]).toEqual(['redactor', 'url', false, 0, 1000, 500, 0.0123, 'admin-1']);
  });

  test('si falla el registro, igual responde 200 al admin', async () => {
    extraerArticulo.mockResolvedValueOnce(ARTICULO);
    redactarDesdeArticulo.mockResolvedValueOnce(REDACTADO);
    pool.query.mockRejectedValueOnce(new Error('db caida'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).post('/api/admin/autocompletar-ia').set('x-test-user', ADMIN).send({ url: 'https://ejemplo.com/a' });
    spy.mockRestore();
    expect(res.status).toBe(200);
  });

  test('no registra nada si la redaccion falla', async () => {
    extraerArticulo.mockResolvedValueOnce(ARTICULO);
    redactarDesdeArticulo.mockRejectedValueOnce(new Error('fallo'));
    const res = await request(app).post('/api/admin/autocompletar-ia').set('x-test-user', ADMIN).send({ url: 'https://ejemplo.com/a' });
    expect(res.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });
});

describe('GET /api/admin/ordenes (P-3)', () => {
  test('401 sin autenticacion', async () => {
    const res = await request(app).get('/api/admin/ordenes');
    expect(res.status).toBe(401);
  });

  test('403 si el usuario no es admin (ni siquiera moderador)', async () => {
    expect((await request(app).get('/api/admin/ordenes').set('x-test-user', USUARIO)).status).toBe(403);
    expect((await request(app).get('/api/admin/ordenes').set('x-test-user', MODERADOR)).status).toBe(403);
  });

  test('200 con los pedidos, direccion y valores por defecto de paginacion', async () => {
    const fila = { id: 'o1', estado: 'pagada', total: '25.00', items: [{ nombre: 'Taza', cantidad: 1 }], envio_nombre: 'Ana', envio_direccion: { city: 'Fajardo' }, comprador_email: 'a@ejemplo.com' };
    pool.query.mockResolvedValueOnce({ rows: [fila] });
    const res = await request(app).get('/api/admin/ordenes').set('x-test-user', ADMIN);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, limit: 50, offset: 0 });
    expect(res.body.ordenes).toEqual([fila]);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/FROM ordenes o LEFT JOIN perfiles pf/);
    expect(sql).toMatch(/envio_direccion/);
    expect(sql).toMatch(/facturacion_direccion/);
    expect(sql).toMatch(/ORDER BY o\.creado_en DESC/);
    expect(params).toEqual([50, 0]);
  });

  test('limit tiene tope de 100 y offset nunca es negativo', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    const res = await request(app).get('/api/admin/ordenes?limit=5000&offset=-3').set('x-test-user', ADMIN);
    expect(res.body).toMatchObject({ limit: 100, offset: 0 });
    expect(pool.query.mock.calls[0][1]).toEqual([100, 0]);
    await request(app).get('/api/admin/ordenes?limit=10&offset=20').set('x-test-user', ADMIN);
    expect(pool.query.mock.calls[1][1]).toEqual([10, 20]);
  });
});
