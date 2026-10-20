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
// Fecha de nacimiento REAL conocida -- ver AUDITORIA-LEGAL-MENORES.md: el
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
