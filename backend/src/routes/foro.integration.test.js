jest.mock('../middleware/auth', () => require('../test-utils/authMock'));
jest.mock('../db', () => ({ pool: { query: jest.fn() } }));

const request = require('supertest');
const { buildApp } = require('../app');
const { pool } = require('../db');

const app = buildApp();

const AUTOR = JSON.stringify({ id: 'user-autor', rol: 'usuario', edad_confirmada: true });
const OTRO_USUARIO = JSON.stringify({ id: 'user-otro', rol: 'usuario', edad_confirmada: true });
const ADMIN = JSON.stringify({ id: 'admin-1', rol: 'admin', edad_confirmada: true });
const SIN_EDAD_CONFIRMADA = JSON.stringify({ id: 'user-menor', rol: 'usuario', edad_confirmada: false });
const CUENTA_NUEVA = JSON.stringify({ id: 'user-nuevo', rol: 'usuario', edad_confirmada: true, creado_en: new Date().toISOString() });
const MODERADOR = JSON.stringify({ id: 'mod-1', rol: 'moderador', edad_confirmada: true });
// Fecha de nacimiento REAL conocida -- ver la auditoría legal de protección de menores del proyecto: el
// dato conocido siempre gana sobre el checkbox de autoafirmacion.
const MENOR_CON_FECHA_CONOCIDA = JSON.stringify({
  id: 'user-menor-real', rol: 'usuario', edad_confirmada: true,
  fecha_nacimiento: new Date(Date.now() - 16 * 365.25 * 24 * 3600 * 1000).toISOString().slice(0, 10),
});
const ADULTO_SIN_CONFIRMAR = JSON.stringify({
  id: 'user-adulto-sin-check', rol: 'usuario', edad_confirmada: false,
  fecha_nacimiento: new Date(Date.now() - 25 * 365.25 * 24 * 3600 * 1000).toISOString().slice(0, 10),
});

const POST_VALIDO = { titulo: 'Un titulo valido', cuerpo: 'Un mensaje suficientemente largo.', subseccion: 'corrupcion-humana' };

beforeEach(() => {
  pool.query.mockReset();
});

describe('GET /api/foro/posts', () => {
  test('400 si falta el parametro subseccion', async () => {
    const res = await request(app).get('/api/foro/posts');
    expect(res.status).toBe(400);
  });

  test('devuelve la lista de publicaciones de una subseccion', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'p1', titulo: 'Hola' }] });
    const res = await request(app).get('/api/foro/posts?subseccion=corrupcion-humana');
    expect(res.status).toBe(200);
    expect(res.body.posts).toHaveLength(1);
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/AS autor_nombre/);
    expect(sql).not.toMatch(/email/i); // el correo del autor nunca sale en la API publica
  });
});

describe('POST /api/foro/posts', () => {
  test('401 sin autenticacion', async () => {
    const res = await request(app).post('/api/foro/posts').send(POST_VALIDO);
    expect(res.status).toBe(401);
  });

  test('400 si el cuerpo es invalido', async () => {
    const res = await request(app).post('/api/foro/posts').set('x-test-user', AUTOR).send({ titulo: 'Hi' });
    expect(res.status).toBe(400);
  });

  test('201 al crear una publicacion valida', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'p1', autor_id: 'user-autor', ...POST_VALIDO }] });
    const res = await request(app).post('/api/foro/posts').set('x-test-user', AUTOR).send(POST_VALIDO);
    expect(res.status).toBe(201);
    expect(res.body.post.id).toBe('p1');
  });

  test('400 si un usuario regular supera las 200 palabras', async () => {
    const cuerpo = Array(201).fill('palabra').join(' ');
    const res = await request(app)
      .post('/api/foro/posts')
      .set('x-test-user', AUTOR)
      .send({ titulo: 'Titulo valido', cuerpo, subseccion: 'corrupcion-humana' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('200 palabras');
  });

  test('201 si un usuario regular publica hasta 200 palabras', async () => {
    const cuerpo = Array(150).fill('palabra').join(' ');
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'p1', autor_id: 'user-autor', titulo: 'Titulo valido', cuerpo }] });
    const res = await request(app)
      .post('/api/foro/posts')
      .set('x-test-user', AUTOR)
      .send({ titulo: 'Titulo valido', cuerpo, subseccion: 'corrupcion-humana' });
    expect(res.status).toBe(201);
  });

  test('201 si un premium publica hasta 1000 palabras con enlace multimedia', async () => {
    const cuerpo = Array(800).fill('palabra').join(' ');
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'p1', autor_id: 'user-premium', titulo: 'Titulo valido', cuerpo }] });
    const res = await request(app)
      .post('/api/foro/posts')
      .set('x-test-user', JSON.stringify({ id: 'user-premium', rol: 'premium', edad_confirmada: true }))
      .send({
        titulo: 'Titulo valido', cuerpo, subseccion: 'corrupcion-humana',
        enlaceMedia: 'https://example.com/video.mp4', enlaceMediaTipo: 'video',
      });
    expect(res.status).toBe(201);
  });

  test('400 si el campo honeypot viene lleno (bot)', async () => {
    const res = await request(app)
      .post('/api/foro/posts')
      .set('x-test-user', AUTOR)
      .send({ ...POST_VALIDO, sitioWeb: 'http://spam.example' });
    expect(res.status).toBe(400);
  });

  test('403 si la cuenta tiene menos de 1 hora de creada', async () => {
    const res = await request(app)
      .post('/api/foro/posts')
      .set('x-test-user', CUENTA_NUEVA)
      .send(POST_VALIDO);
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('hora');
  });

  test('403 si no ha confirmado ser mayor de edad en corrupcion-humana', async () => {
    const res = await request(app)
      .post('/api/foro/posts')
      .set('x-test-user', SIN_EDAD_CONFIRMADA)
      .send(POST_VALIDO);
    expect(res.status).toBe(403);
  });

  test('201 en nuevos-humanos sin confirmar edad (no la exige)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'p1', autor_id: 'user-menor', titulo: 'Titulo valido' }] });
    const res = await request(app)
      .post('/api/foro/posts')
      .set('x-test-user', SIN_EDAD_CONFIRMADA)
      .send({ titulo: 'Titulo valido', cuerpo: 'Un mensaje suficientemente largo.', subseccion: 'nuevos-humanos' });
    expect(res.status).toBe(201);
  });

  test('403 en corrupcion-humana si la fecha de nacimiento real dice que es menor, aunque haya marcado el checkbox', async () => {
    const res = await request(app)
      .post('/api/foro/posts')
      .set('x-test-user', MENOR_CON_FECHA_CONOCIDA)
      .send(POST_VALIDO);
    expect(res.status).toBe(403);
  });

  test('403 en corrupcion-humana si es adulto por fecha de nacimiento pero no marco el checkbox (la fecha no reemplaza el consentimiento)', async () => {
    const res = await request(app)
      .post('/api/foro/posts')
      .set('x-test-user', ADULTO_SIN_CONFIRMAR)
      .send(POST_VALIDO);
    expect(res.status).toBe(403);
  });

  test('201 y crea un reporte automatico si el texto coincide con un patron de riesgo', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'p1', autor_id: 'user-autor', titulo: 'Hola' }] }) // INSERT del post
      .mockResolvedValueOnce({ rows: [] }); // INSERT del reporte automatico
    const res = await request(app)
      .post('/api/foro/posts')
      .set('x-test-user', AUTOR)
      .send({ titulo: 'Hola', cuerpo: 'agregame a whatsapp para seguir hablando', subseccion: 'corrupcion-humana' });
    expect(res.status).toBe(201);
    expect(pool.query).toHaveBeenCalledTimes(2);
    const [sql, params] = pool.query.mock.calls[1];
    expect(sql).toContain('INSERT INTO reportes');
    expect(params).toEqual(['debate_post', 'p1', 'Detección automática: Solicitud de contacto fuera de la plataforma']);
  });

  test('201 sin reporte automatico si el texto no coincide con ningun patron de riesgo', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'p1', autor_id: 'user-autor', titulo: 'Hola' }] });
    const res = await request(app)
      .post('/api/foro/posts')
      .set('x-test-user', AUTOR)
      .send(POST_VALIDO);
    expect(res.status).toBe(201);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test('201 en educacion sin confirmar edad (audiencia general, sin gate)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'p1', autor_id: 'user-menor', titulo: 'Titulo valido' }] });
    const res = await request(app)
      .post('/api/foro/posts')
      .set('x-test-user', SIN_EDAD_CONFIRMADA)
      .send({ titulo: 'Titulo valido', cuerpo: 'Un mensaje suficientemente largo.', subseccion: 'educacion' });
    expect(res.status).toBe(201);
  });
});

describe('POST /api/foro/posts -- Cloudflare Turnstile', () => {
  const ORIGINAL_SECRET = process.env.TURNSTILE_SECRET_KEY;
  const ORIGINAL_FETCH = global.fetch;

  afterEach(() => {
    if (ORIGINAL_SECRET === undefined) delete process.env.TURNSTILE_SECRET_KEY;
    else process.env.TURNSTILE_SECRET_KEY = ORIGINAL_SECRET;
    global.fetch = ORIGINAL_FETCH;
  });

  test('201 sin TURNSTILE_SECRET_KEY configurado (no bloquea en dev/tests)', async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'p1', autor_id: 'user-autor', ...POST_VALIDO }] });
    const res = await request(app).post('/api/foro/posts').set('x-test-user', AUTOR).send(POST_VALIDO);
    expect(res.status).toBe(201);
  });

  test('400 si esta configurado y no llega token', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secreta-de-prueba';
    const res = await request(app).post('/api/foro/posts').set('x-test-user', AUTOR).send(POST_VALIDO);
    expect(res.status).toBe(400);
  });

  test('400 si Cloudflare rechaza el token', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secreta-de-prueba';
    global.fetch = jest.fn().mockResolvedValue({ json: async () => ({ success: false }) });
    const res = await request(app)
      .post('/api/foro/posts')
      .set('x-test-user', AUTOR)
      .send({ ...POST_VALIDO, turnstileToken: 'token-invalido' });
    expect(res.status).toBe(400);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      expect.objectContaining({ method: 'POST' })
    );
  });

  test('201 si Cloudflare acepta el token', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secreta-de-prueba';
    global.fetch = jest.fn().mockResolvedValue({ json: async () => ({ success: true }) });
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'p1', autor_id: 'user-autor', ...POST_VALIDO }] });
    const res = await request(app)
      .post('/api/foro/posts')
      .set('x-test-user', AUTOR)
      .send({ ...POST_VALIDO, turnstileToken: 'token-valido' });
    expect(res.status).toBe(201);
  });
});

describe('PATCH /api/foro/posts/:id (permisos)', () => {
  test('404 si la publicacion no existe', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .patch('/api/foro/posts/no-existe')
      .set('x-test-user', AUTOR)
      .send(POST_VALIDO);
    expect(res.status).toBe(404);
  });

  test('403 si el usuario no es el autor ni admin', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ autor_id: 'user-autor' }] });
    const res = await request(app)
      .patch('/api/foro/posts/p1')
      .set('x-test-user', OTRO_USUARIO)
      .send(POST_VALIDO);
    expect(res.status).toBe(403);
  });

  test('200 si el usuario es el autor', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ autor_id: 'user-autor' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'p1', autor_id: 'user-autor', titulo: 'Editado', cuerpo: POST_VALIDO.cuerpo }] });
    const res = await request(app)
      .patch('/api/foro/posts/p1')
      .set('x-test-user', AUTOR)
      .send({ titulo: 'Editado', cuerpo: POST_VALIDO.cuerpo, subseccion: 'corrupcion-humana' });
    expect(res.status).toBe(200);
  });

  test('200 si el usuario es admin aunque no sea el autor', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ autor_id: 'user-autor' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'p1', autor_id: 'user-autor', titulo: 'Editado por admin', cuerpo: POST_VALIDO.cuerpo }] });
    const res = await request(app)
      .patch('/api/foro/posts/p1')
      .set('x-test-user', ADMIN)
      .send({ titulo: 'Editado por admin', cuerpo: POST_VALIDO.cuerpo, subseccion: 'corrupcion-humana' });
    expect(res.status).toBe(200);
  });
});

describe('DELETE /api/foro/posts/:id (permisos)', () => {
  test('403 si el usuario no es el autor ni admin', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ autor_id: 'user-autor' }] });
    const res = await request(app).delete('/api/foro/posts/p1').set('x-test-user', OTRO_USUARIO);
    expect(res.status).toBe(403);
  });

  test('200 si el usuario es el autor', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ autor_id: 'user-autor' }] })
      .mockResolvedValueOnce({});
    const res = await request(app).delete('/api/foro/posts/p1').set('x-test-user', AUTOR);
    expect(res.status).toBe(200);
  });

  test('200 si el usuario es moderador aunque no sea el autor', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ autor_id: 'user-autor' }] })
      .mockResolvedValueOnce({});
    const res = await request(app).delete('/api/foro/posts/p1').set('x-test-user', MODERADOR);
    expect(res.status).toBe(200);
  });
});

describe('GET /api/foro/posts/:id', () => {
  test('404 si la publicacion no existe', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/foro/posts/no-existe');
    expect(res.status).toBe(404);
  });

  test('200 con la publicacion y sus comentarios', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'p1', titulo: 'Hola', autor_id: 'user-autor' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'c1', cuerpo: 'Un comentario' }] });
    const res = await request(app).get('/api/foro/posts/p1');
    expect(res.status).toBe(200);
    expect(res.body.post.id).toBe('p1');
    expect(res.body.comentarios).toHaveLength(1);
    for (const [sql] of pool.query.mock.calls) expect(sql).not.toMatch(/email/i);
  });
});

describe('DELETE /api/foro/comentarios/:id (permisos)', () => {
  test('403 si el usuario no es el autor ni admin', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ autor_id: 'user-autor' }] });
    const res = await request(app).delete('/api/foro/comentarios/c1').set('x-test-user', OTRO_USUARIO);
    expect(res.status).toBe(403);
  });

  test('200 si el usuario es el autor del comentario', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ autor_id: 'user-autor' }] })
      .mockResolvedValueOnce({});
    const res = await request(app).delete('/api/foro/comentarios/c1').set('x-test-user', AUTOR);
    expect(res.status).toBe(200);
  });

  test('200 si el usuario es moderador aunque no sea el autor', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ autor_id: 'user-autor' }] })
      .mockResolvedValueOnce({});
    const res = await request(app).delete('/api/foro/comentarios/c1').set('x-test-user', MODERADOR);
    expect(res.status).toBe(200);
  });
});

describe('POST /api/foro/posts/:postId/comentarios', () => {
  test('400 si el campo honeypot viene lleno (bot)', async () => {
    const res = await request(app)
      .post('/api/foro/posts/p1/comentarios')
      .set('x-test-user', AUTOR)
      .send({ cuerpo: 'Un comentario', sitioWeb: 'http://spam.example' });
    expect(res.status).toBe(400);
  });

  test('403 si la cuenta tiene menos de 1 hora de creada', async () => {
    const res = await request(app)
      .post('/api/foro/posts/p1/comentarios')
      .set('x-test-user', CUENTA_NUEVA)
      .send({ cuerpo: 'Un comentario' });
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('hora');
  });

  test('403 si no ha confirmado ser mayor de edad en un post de corrupcion-humana', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'p1', subseccion: 'corrupcion-humana' }] });
    const res = await request(app)
      .post('/api/foro/posts/p1/comentarios')
      .set('x-test-user', SIN_EDAD_CONFIRMADA)
      .send({ cuerpo: 'Un comentario' });
    expect(res.status).toBe(403);
  });

  test('201 y crea un reporte automatico si el comentario coincide con un patron de riesgo', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'p2', subseccion: 'nuevos-humanos' }] }) // SELECT del post
      .mockResolvedValueOnce({ rows: [{ id: 'c1', post_id: 'p2', cuerpo: 'mandame una foto tuya' }] }) // INSERT del comentario
      .mockResolvedValueOnce({ rows: [] }); // INSERT del reporte automatico
    const res = await request(app)
      .post('/api/foro/posts/p2/comentarios')
      .set('x-test-user', AUTOR)
      .send({ cuerpo: 'mandame una foto tuya' });
    expect(res.status).toBe(201);
    expect(pool.query).toHaveBeenCalledTimes(3);
    const [sql, params] = pool.query.mock.calls[2];
    expect(sql).toContain('INSERT INTO reportes');
    expect(params).toEqual(['debate_comentario', 'c1', 'Detección automática: Solicitud de fotos/contenido personal']);
  });

  test('201 al comentar en nuevos-humanos sin confirmar edad (no la exige)', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'p2', subseccion: 'nuevos-humanos' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'c1', post_id: 'p2', cuerpo: 'Un comentario' }] });
    const res = await request(app)
      .post('/api/foro/posts/p2/comentarios')
      .set('x-test-user', SIN_EDAD_CONFIRMADA)
      .send({ cuerpo: 'Un comentario' });
    expect(res.status).toBe(201);
  });

  test('201 al comentar en educacion sin confirmar edad (audiencia general, sin gate)', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'p3', subseccion: 'educacion' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'c1', post_id: 'p3', cuerpo: 'Un comentario' }] });
    const res = await request(app)
      .post('/api/foro/posts/p3/comentarios')
      .set('x-test-user', SIN_EDAD_CONFIRMADA)
      .send({ cuerpo: 'Un comentario' });
    expect(res.status).toBe(201);
  });

  test('404 si la publicacion no existe', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .post('/api/foro/posts/no-existe/comentarios')
      .set('x-test-user', AUTOR)
      .send({ cuerpo: 'Un comentario' });
    expect(res.status).toBe(404);
  });

  test('400 si el comentario es muy corto', async () => {
    const res = await request(app)
      .post('/api/foro/posts/p1/comentarios')
      .set('x-test-user', AUTOR)
      .send({ cuerpo: 'x' });
    expect(res.status).toBe(400);
  });

  test('201 al comentar una publicacion existente', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'p1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'c1', post_id: 'p1', cuerpo: 'Un comentario' }] });
    const res = await request(app)
      .post('/api/foro/posts/p1/comentarios')
      .set('x-test-user', AUTOR)
      .send({ cuerpo: 'Un comentario' });
    expect(res.status).toBe(201);
  });
});

// Fila guardada de una publicacion tal como la lee el PATCH
const POST_GUARDADO = {
  autor_id: 'user-autor', titulo: 'Un titulo valido', cuerpo: 'Un mensaje suficientemente largo.',
  subseccion: 'corrupcion-humana', enlace_media: null, enlace_media_tipo: null, destacado: false, tema_contenido_id: null,
};
const EDICION = { titulo: 'Titulo editado', cuerpo: 'Mensaje editado y suficientemente largo.', subseccion: 'corrupcion-humana' };
const FILA_ACTUALIZADA = { rows: [{ id: 'p1', autor_id: 'user-autor', ...EDICION }] };

describe('PATCH /api/foro/posts/:id -- verificaciones de la creacion', () => {
  test('201 -> reporte automatico: si el texto editado tiene lenguaje de riesgo se crea el reporte (U-3)', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [POST_GUARDADO] }) // fila guardada
      .mockResolvedValueOnce(FILA_ACTUALIZADA) // UPDATE
      .mockResolvedValueOnce({ rows: [] }) // no hay reporte automatico pendiente
      .mockResolvedValueOnce({ rows: [] }); // INSERT del reporte
    const res = await request(app).patch('/api/foro/posts/p1').set('x-test-user', AUTOR)
      .send({ ...EDICION, cuerpo: 'agregame a whatsapp para seguir hablando' });
    expect(res.status).toBe(200);
    expect(pool.query).toHaveBeenCalledTimes(4);
    const [sql, params] = pool.query.mock.calls[3];
    expect(sql).toContain('INSERT INTO reportes');
    expect(params).toEqual(['debate_post', 'p1', 'Detección automática: Solicitud de contacto fuera de la plataforma']);
  });

  test('no apila un segundo reporte automatico si ya hay uno pendiente (U-3)', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [POST_GUARDADO] })
      .mockResolvedValueOnce(FILA_ACTUALIZADA)
      .mockResolvedValueOnce({ rows: [{ id: 'r9' }] });
    const res = await request(app).patch('/api/foro/posts/p1').set('x-test-user', AUTOR)
      .send({ ...EDICION, cuerpo: 'agregame a whatsapp para seguir hablando' });
    expect(res.status).toBe(200);
    expect(pool.query).toHaveBeenCalledTimes(3);
  });

  test('si el titulo y el cuerpo no cambiaron no se vuelve a analizar el riesgo', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ ...POST_GUARDADO, cuerpo: 'agregame a whatsapp para seguir hablando' }] })
      .mockResolvedValueOnce(FILA_ACTUALIZADA);
    const res = await request(app).patch('/api/foro/posts/p1').set('x-test-user', AUTOR)
      .send({ titulo: POST_GUARDADO.titulo, cuerpo: 'agregame a whatsapp para seguir hablando', subseccion: 'corrupcion-humana' });
    expect(res.status).toBe(200);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test('403 si quien edita no confirmo su edad y la sub-seccion es 18+ (U-4)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ ...POST_GUARDADO, autor_id: 'user-menor' }] });
    const res = await request(app).patch('/api/foro/posts/p1').set('x-test-user', SIN_EDAD_CONFIRMADA).send(EDICION);
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('mayor de 18');
    expect(pool.query).toHaveBeenCalledTimes(1); // no se actualiza nada
  });

  test('403 si la fecha de nacimiento real dice que es menor, aunque haya marcado el checkbox (U-4)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ ...POST_GUARDADO, autor_id: 'user-menor-real' }] });
    const res = await request(app).patch('/api/foro/posts/p1').set('x-test-user', MENOR_CON_FECHA_CONOCIDA).send(EDICION);
    expect(res.status).toBe(403);
  });

  test('200 en una sub-seccion de audiencia general sin confirmar edad (U-4)', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ ...POST_GUARDADO, autor_id: 'user-menor', subseccion: 'educacion' }] })
      .mockResolvedValueOnce(FILA_ACTUALIZADA);
    const res = await request(app).patch('/api/foro/posts/p1').set('x-test-user', SIN_EDAD_CONFIRMADA)
      .send({ ...EDICION, subseccion: 'educacion' });
    expect(res.status).toBe(200);
  });

  test('400 si se intenta cambiar la sub-seccion (U-4)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [POST_GUARDADO] });
    const res = await request(app).patch('/api/foro/posts/p1').set('x-test-user', AUTOR)
      .send({ ...EDICION, subseccion: 'educacion' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('No se puede cambiar la sub-sección de una publicación.');
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test('si no se manda subseccion se conserva la guardada', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ ...POST_GUARDADO, subseccion: 'nuevos-humanos' }] })
      .mockResolvedValueOnce(FILA_ACTUALIZADA);
    const res = await request(app).patch('/api/foro/posts/p1').set('x-test-user', AUTOR)
      .send({ titulo: EDICION.titulo, cuerpo: EDICION.cuerpo });
    expect(res.status).toBe(200);
    expect(pool.query.mock.calls[1][1][2]).toBe('nuevos-humanos');
  });
});

describe('PATCH /api/foro/posts/:id -- destacado y tema solo del admin', () => {
  const GUARDADO_DESTACADO = { ...POST_GUARDADO, destacado: true, tema_contenido_id: 'tema-x' };

  test.each([['moderador', MODERADOR], ['autor', AUTOR]])('%s conserva destacado y tema guardados aunque los mande', async (_n, quien) => {
    pool.query
      .mockResolvedValueOnce({ rows: [GUARDADO_DESTACADO] })
      .mockResolvedValueOnce(FILA_ACTUALIZADA);
    const res = await request(app).patch('/api/foro/posts/p1').set('x-test-user', quien)
      .send({ ...EDICION, destacado: false, temaContenidoId: 'otro-tema' });
    expect(res.status).toBe(200);
    const params = pool.query.mock.calls[1][1];
    expect(params[6]).toBe(true);
    expect(params[7]).toBe('tema-x');
  });

  test('el admin si puede cambiarlos (y el contenido nuevo debe existir)', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [GUARDADO_DESTACADO] })
      .mockResolvedValueOnce({ rows: [{ id: 'otro-tema' }] }) // el contenido existe
      .mockResolvedValueOnce(FILA_ACTUALIZADA);
    const res = await request(app).patch('/api/foro/posts/p1').set('x-test-user', ADMIN)
      .send({ ...EDICION, destacado: false, temaContenidoId: 'otro-tema' });
    expect(res.status).toBe(200);
    const params = pool.query.mock.calls[2][1];
    expect(params[6]).toBe(false);
    expect(params[7]).toBe('otro-tema');
  });

  test('el admin que no manda destacado ni tema no los borra', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [GUARDADO_DESTACADO] })
      .mockResolvedValueOnce(FILA_ACTUALIZADA);
    const res = await request(app).patch('/api/foro/posts/p1').set('x-test-user', ADMIN).send(EDICION);
    expect(res.status).toBe(200);
    const params = pool.query.mock.calls[1][1];
    expect(params[6]).toBe(true);
    expect(params[7]).toBe('tema-x');
  });

  test('400 si el admin enlaza un contenido que no existe al editar (C-2)', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [POST_GUARDADO] })
      .mockResolvedValueOnce({ rows: [] }); // no existe
    const res = await request(app).patch('/api/foro/posts/p1').set('x-test-user', ADMIN)
      .send({ ...EDICION, temaContenidoId: 'no-existe' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('El contenido relacionado no existe.');
    expect(pool.query).toHaveBeenCalledTimes(2); // sin UPDATE
  });

  test('400 si el admin crea una publicacion con un contenido relacionado que no existe (C-2)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post('/api/foro/posts').set('x-test-user', ADMIN)
      .send({ ...POST_VALIDO, temaContenidoId: 'no-existe' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('El contenido relacionado no existe.');
    expect(pool.query).toHaveBeenCalledTimes(1); // sin INSERT
  });

  test('201 si el contenido relacionado existe (C-2)', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'tema-x' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'p1', autor_id: 'admin-1', ...POST_VALIDO, tema_contenido_id: 'tema-x' }] });
    const res = await request(app).post('/api/foro/posts').set('x-test-user', ADMIN)
      .send({ ...POST_VALIDO, temaContenidoId: 'tema-x' });
    expect(res.status).toBe(201);
    expect(pool.query.mock.calls[0][1]).toEqual(['tema-x']);
  });
});

describe('PATCH /api/foro/posts/:id -- corregir un typo sin el rol de antes (U-2)', () => {
  const CON_ENLACE = { ...POST_GUARDADO, enlace_media: 'https://ejemplo.com/foto.jpg', enlace_media_tipo: 'imagen' };

  test('200 si el enlace no cambio aunque ya no sea premium', async () => {
    pool.query.mockResolvedValueOnce({ rows: [CON_ENLACE] }).mockResolvedValueOnce(FILA_ACTUALIZADA);
    const res = await request(app).patch('/api/foro/posts/p1').set('x-test-user', AUTOR)
      .send({ ...EDICION, enlaceMedia: 'https://ejemplo.com/foto.jpg', enlaceMediaTipo: 'imagen' });
    expect(res.status).toBe(200);
  });

  test('400 si cambia el enlace y ya no es premium', async () => {
    pool.query.mockResolvedValueOnce({ rows: [CON_ENLACE] });
    const res = await request(app).patch('/api/foro/posts/p1').set('x-test-user', AUTOR)
      .send({ ...EDICION, enlaceMedia: 'https://ejemplo.com/otra.jpg', enlaceMediaTipo: 'imagen' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('premium');
  });

  test('un moderador puede editar sin tocar el enlace de la persona premium', async () => {
    pool.query.mockResolvedValueOnce({ rows: [CON_ENLACE] }).mockResolvedValueOnce(FILA_ACTUALIZADA);
    const res = await request(app).patch('/api/foro/posts/p1').set('x-test-user', MODERADOR)
      .send({ ...EDICION, enlaceMedia: 'https://ejemplo.com/foto.jpg', enlaceMediaTipo: 'imagen' });
    expect(res.status).toBe(200);
  });

  test('el limite de palabras no baja de lo ya guardado (typo en un texto largo)', async () => {
    const largo = Array(300).fill('palabra').join(' ');
    pool.query.mockResolvedValueOnce({ rows: [{ ...POST_GUARDADO, cuerpo: largo }] }).mockResolvedValueOnce(FILA_ACTUALIZADA);
    const res = await request(app).patch('/api/foro/posts/p1').set('x-test-user', AUTOR)
      .send({ ...EDICION, cuerpo: largo.replace('palabra', 'palabrA') });
    expect(res.status).toBe(200);
  });

  test('400 si el texto editado crece por encima de lo guardado y del limite', async () => {
    const largo = Array(300).fill('palabra').join(' ');
    pool.query.mockResolvedValueOnce({ rows: [{ ...POST_GUARDADO, cuerpo: largo }] });
    const res = await request(app).patch('/api/foro/posts/p1').set('x-test-user', AUTOR)
      .send({ ...EDICION, cuerpo: `${largo} extra` });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('palabras');
  });
});

describe('Reportes al eliminar contenido del debate (R-2) y largo de comentarios (U-7)', () => {
  test('borrar una publicacion cierra en la misma sentencia los reportes pendientes de ella y de sus comentarios', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ autor_id: 'user-autor' }] }).mockResolvedValueOnce({ rows: [] });
    const res = await request(app).delete('/api/foro/posts/p1').set('x-test-user', MODERADOR);
    expect(res.status).toBe(200);
    expect(pool.query).toHaveBeenCalledTimes(2);
    const [sql, params] = pool.query.mock.calls[1];
    expect(sql).toMatch(/^\s*WITH /);
    expect(sql).toContain('DELETE FROM foro_posts WHERE id = $1');
    expect(sql).toContain("UPDATE reportes SET estado = 'revisado'");
    expect(sql).toContain("tipo = 'debate_post' AND item_id = $1");
    expect(sql).toContain("tipo = 'debate_comentario' AND item_id IN (SELECT id FROM foro_comentarios WHERE post_id = $1)");
    expect(params).toEqual(['p1']);
  });

  test('borrar un comentario cierra en la misma sentencia sus reportes pendientes', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ autor_id: 'user-autor' }] }).mockResolvedValueOnce({ rows: [] });
    const res = await request(app).delete('/api/foro/comentarios/c1').set('x-test-user', AUTOR);
    expect(res.status).toBe(200);
    const [sql, params] = pool.query.mock.calls[1];
    expect(sql).toMatch(/^\s*WITH /);
    expect(sql).toContain('DELETE FROM foro_comentarios WHERE id = $1');
    expect(sql).toContain("UPDATE reportes SET estado = 'revisado'");
    expect(sql).toContain("tipo = 'debate_comentario' AND item_id = $1");
    expect(params).toEqual(['c1']);
  });

  test('400 si el comentario del debate supera 2000 caracteres', async () => {
    const res = await request(app).post('/api/foro/posts/p1/comentarios').set('x-test-user', AUTOR)
      .send({ cuerpo: 'a'.repeat(2001) });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('El comentario no puede superar 2000 caracteres.');
    expect(pool.query).not.toHaveBeenCalled();
  });
});
