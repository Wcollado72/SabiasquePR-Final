const express = require('express');
const { pool } = require('../db');
const { enviarError500 } = require('../util/errores');
const { requireAuth } = require('../middleware/auth');
const { validatePost } = require('../validators/foroPost');
const { MAX_COMENTARIO_CARACTERES } = require('../validators/comentario');
const { esMenorConocido } = require('../util/edad');
const { detectarRiesgo } = require('../util/deteccionRiesgo');
const { nombreVisibleSql } = require('../util/autorVisible');

const router = express.Router();

// El gate de edad 18+ solo aplica a sub-secciones de tono fuerte/moderacion
// minima -- Nuevos Humanos y Logica Humana (audiencia general) no lo necesitan. Politica
// de edad por seccion fijada 2026-09-27: solo Corrupcion Humana e Ilogica
// Humana son 18+.
const SUBSECCIONES_18_MAS = ['corrupcion-humana', 'ilogica-humana'];

// Admin y moderador pueden editar/borrar cualquier post o comentario del
// debate (moderacion real) -- el moderador NO tiene acceso al CRUD de
// contenido editorial (noticias/contenidos/productos), eso sigue siendo
// solo admin via requireAdmin en esas rutas.
function esModeracion(rol) {
  return rol === 'admin' || rol === 'moderador';
}

// Bloquea si la subseccion es 18+ y, o bien el usuario nunca lo autoafirmo
// (edad_confirmada), o bien -- mas fuerte -- su fecha de nacimiento REAL
// (cuando se conoce, ver docs/interno/AUDITORIA-LEGAL-MENORES.md) dice que es menor de 18.
// El dato conocido siempre gana sobre el checkbox: nadie puede "mentir" por
// encima de una fecha de nacimiento ya registrada.
function bloqueadoPorEdad(user, subseccion) {
  if (!SUBSECCIONES_18_MAS.includes(subseccion)) return false;
  if (esMenorConocido(user.fecha_nacimiento, 18)) return true;
  return !user.edad_confirmada;
}

// Si `texto` coincide con un patron de riesgo, crea un reporte automatico
// (pendiente, sin reportado_por -- ver docs/interno/AUDITORIA-LEGAL-MENORES.md) para que
// un moderador lo revise con prioridad. Nunca bloquea ni borra el contenido
// por si sola; un error aqui tampoco debe tumbar la publicacion del post/
// comentario, por eso se llama envuelta en su propio try/catch desde fuera.
async function marcarSiHayRiesgo(tipo, itemId, texto) {
  const categoria = detectarRiesgo(texto);
  if (!categoria) return;
  await pool.query(
    `INSERT INTO reportes (tipo, item_id, reportado_por, motivo, automatico)
     VALUES ($1, $2, NULL, $3, true)
     ON CONFLICT (tipo, item_id) WHERE estado = 'pendiente' AND automatico DO NOTHING`,
    [tipo, itemId, `Detección automática: ${categoria}`]
  );
}

// Al EDITAR una publicacion se repite la deteccion, pero sin apilar reportes:
// si ya hay uno automatico pendiente para esa publicacion, no se crea otro.
async function marcarSiHayRiesgoEnEdicion(tipo, itemId, texto) {
  if (!detectarRiesgo(texto)) return;
  const { rows } = await pool.query(
    `SELECT id FROM reportes WHERE tipo = $1 AND item_id = $2 AND automatico = true AND estado = 'pendiente' LIMIT 1`,
    [tipo, itemId]
  );
  if (rows && rows.length) return;
  await marcarSiHayRiesgo(tipo, itemId, texto);
}

// Anti-bots gratis para el debate publico (sin CAPTCHA): honeypot + cooldown
// de cuenta nueva. Ambos son capas adicionales sobre requireAuth + el rate
// limit ya activo en /api/foro -- ninguno reemplaza a los otros.
const COOLDOWN_HORAS_CUENTA_NUEVA = 1;

// Campo oculto (nunca visible ni accesible para un humano real, ver
// debate.js/estilos) que un bot que llena todos los inputs de un formulario
// va a completar. Si llega con contenido, se rechaza en silencio.
function esHoneypot(body) {
  return Boolean(body.sitioWeb && String(body.sitioWeb).trim());
}

function cuentaEnCooldown(user) {
  if (!user.creado_en) return false;
  const horas = (Date.now() - new Date(user.creado_en).getTime()) / 3_600_000;
  return horas < COOLDOWN_HORAS_CUENTA_NUEVA;
}

// Cloudflare Turnstile: verifica el token que el frontend obtiene del
// widget contra la API de Cloudflare, usando la Secret Key (nunca en el
// codigo -- variable de entorno TURNSTILE_SECRET_KEY en Render). Sin esa
// variable configurada (desarrollo local, tests) se deja pasar sin
// verificar, para no romper el flujo local por falta de una cuenta de
// Cloudflare -- en produccion la variable siempre debe estar puesta.
async function verificarTurnstile(token) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
    });
    const data = await res.json();
    return Boolean(data.success);
  } catch {
    return false;
  }
}

// Campos que solo el admin puede fijar -- separado del resto del body para
// no dejar que cualquier usuario se auto-destaque o enlace un tema oficial.
function camposAdmin(body, rol) {
  if (rol !== 'admin') return { destacado: false, temaContenidoId: null };
  return {
    destacado: Boolean(body.destacado),
    temaContenidoId: body.temaContenidoId || null,
  };
}

// El contenido relacionado (tema) debe existir: sin esta revision la clave
// foranea fallaba y el panel recibia un 500 generico.
async function contenidoExiste(id) {
  const { rows } = await pool.query('SELECT id FROM contenidos WHERE id = $1', [id]);
  return rows.length > 0;
}

// GET /api/foro/posts?subseccion=&enfoque=&limit=&offset=  -- publico
// (el gate de edad 18+ es de lectura visual en el frontend, no aqui --
// bloquear la lectura del API mismo no aporta seguridad real y rompe la
// posibilidad de moderar/enlazar desde el panel de admin).
router.get('/posts', async (req, res) => {
  try {
    const { subseccion, enfoque } = req.query;
    if (!subseccion) return res.status(400).json({ ok: false, error: 'Falta el parametro subseccion.' });
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const offset = parseInt(req.query.offset, 10) || 0;
    const params = [subseccion];
    let where = 'WHERE p.subseccion = $1';
    if (enfoque) { params.push(enfoque); where += ` AND p.enfoque = $${params.length}`; }
    params.push(limit, offset);

    const { rows } = await pool.query(
      `SELECT p.id, p.titulo, p.subseccion, p.enfoque, p.destacado, p.tema_contenido_id,
              p.enlace_media, p.enlace_media_tipo, p.creado_en, p.editado_en, ${nombreVisibleSql('pf')} AS autor_nombre,
              (SELECT COUNT(*) FROM foro_comentarios c WHERE c.post_id = p.id)::int AS comentarios_count
       FROM foro_posts p JOIN perfiles pf ON pf.id = p.autor_id
       ${where}
       ORDER BY p.destacado DESC, p.creado_en DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ ok: true, posts: rows });
  } catch (err) { enviarError500(res, err); }
});

// GET /api/foro/posts/:id -- detalle + comentarios -- publico
router.get('/posts/:id', async (req, res) => {
  try {
    const { rows: postRows } = await pool.query(
      `SELECT p.id, p.titulo, p.cuerpo, p.subseccion, p.enfoque, p.destacado, p.tema_contenido_id,
              p.enlace_media, p.enlace_media_tipo, p.autor_id, p.creado_en, p.editado_en, ${nombreVisibleSql('pf')} AS autor_nombre
       FROM foro_posts p JOIN perfiles pf ON pf.id = p.autor_id WHERE p.id = $1`,
      [req.params.id]
    );
    if (postRows.length === 0) return res.status(404).json({ ok: false, error: 'Publicacion no encontrada.' });

    const { rows: comentarios } = await pool.query(
      `SELECT c.id, c.cuerpo, c.autor_id, c.creado_en, ${nombreVisibleSql('pf')} AS autor_nombre
       FROM foro_comentarios c JOIN perfiles pf ON pf.id = c.autor_id
       WHERE c.post_id = $1 ORDER BY c.creado_en ASC`,
      [req.params.id]
    );
    res.json({ ok: true, post: postRows[0], comentarios });
  } catch (err) { enviarError500(res, err); }
});

// POST /api/foro/posts -- crear -- requiere sesion y edad confirmada
router.post('/posts', requireAuth, async (req, res) => {
  if (esHoneypot(req.body)) return res.status(400).json({ ok: false, error: 'No se pudo procesar la solicitud.' });
  if (cuentaEnCooldown(req.user)) {
    return res.status(403).json({ ok: false, error: `Tu cuenta debe tener al menos ${COOLDOWN_HORAS_CUENTA_NUEVA} hora(s) de creada para publicar aquí.` });
  }
  if (bloqueadoPorEdad(req.user, req.body.subseccion)) {
    return res.status(403).json({ ok: false, error: 'Debes confirmar que eres mayor de 18 años para participar en esta sección.' });
  }
  if (!(await verificarTurnstile(req.body.turnstileToken))) {
    return res.status(400).json({ ok: false, error: 'No se pudo verificar que eres una persona. Intenta de nuevo.' });
  }
  const errors = validatePost(req.body, req.user.rol);
  if (errors.length) return res.status(400).json({ ok: false, error: errors.join(' ') });
  try {
    const { titulo, cuerpo, subseccion, enfoque, enlaceMedia, enlaceMediaTipo } = req.body;
    const { destacado, temaContenidoId } = camposAdmin(req.body, req.user.rol);
    if (temaContenidoId && !(await contenidoExiste(temaContenidoId))) {
      return res.status(400).json({ ok: false, error: 'El contenido relacionado no existe.' });
    }
    const { rows } = await pool.query(
      `INSERT INTO foro_posts (autor_id, titulo, cuerpo, subseccion, enfoque, enlace_media, enlace_media_tipo, destacado, tema_contenido_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id, titulo, cuerpo, subseccion, enfoque, enlace_media, enlace_media_tipo, destacado, tema_contenido_id, autor_id, creado_en, editado_en`,
      [req.user.id, titulo.trim(), cuerpo.trim(), subseccion, enfoque || null, enlaceMedia || null, enlaceMediaTipo || null, destacado, temaContenidoId]
    );
    try { await marcarSiHayRiesgo('debate_post', rows[0].id, `${titulo} ${cuerpo}`); } catch { /* nunca tumbar la publicacion por esto */ }
    res.status(201).json({ ok: true, post: rows[0] });
  } catch (err) { enviarError500(res, err); }
});

// PATCH /api/foro/posts/:id -- editar -- dueno, admin o moderador
// Repite las verificaciones de la creacion (edad 18+, lenguaje de riesgo), no
// deja cambiar la sub-seccion, y solo el admin toca destacado/tema.
router.patch('/posts/:id', requireAuth, async (req, res) => {
  try {
    const { rows: existing } = await pool.query(
      `SELECT autor_id, titulo, cuerpo, subseccion, enlace_media, enlace_media_tipo, destacado, tema_contenido_id
       FROM foro_posts WHERE id = $1`,
      [req.params.id]
    );
    if (existing.length === 0) return res.status(404).json({ ok: false, error: 'Publicacion no encontrada.' });
    const actual = existing[0];
    if (actual.autor_id !== req.user.id && !esModeracion(req.user.rol)) {
      return res.status(403).json({ ok: false, error: 'No tienes permiso para editar esta publicacion.' });
    }
    if (actual.subseccion && req.body.subseccion !== undefined && req.body.subseccion !== actual.subseccion) {
      return res.status(400).json({ ok: false, error: 'No se puede cambiar la sub-sección de una publicación.' });
    }
    const subseccion = actual.subseccion || req.body.subseccion;
    if (bloqueadoPorEdad(req.user, subseccion)) {
      return res.status(403).json({ ok: false, error: 'Debes confirmar que eres mayor de 18 años para participar en esta sección.' });
    }
    const errors = validatePost({ ...req.body, subseccion }, req.user.rol, actual);
    if (errors.length) return res.status(400).json({ ok: false, error: errors.join(' ') });

    const { titulo, cuerpo, enfoque, enlaceMedia, enlaceMediaTipo } = req.body;
    // Solo el admin cambia destacado y tema; si no los manda, se conservan los guardados.
    let destacado = actual.destacado ?? false;
    let temaContenidoId = actual.tema_contenido_id ?? null;
    if (req.user.rol === 'admin') {
      if (req.body.destacado !== undefined) destacado = Boolean(req.body.destacado);
      if (req.body.temaContenidoId !== undefined) temaContenidoId = req.body.temaContenidoId || null;
    }
    if (temaContenidoId && temaContenidoId !== actual.tema_contenido_id && !(await contenidoExiste(temaContenidoId))) {
      return res.status(400).json({ ok: false, error: 'El contenido relacionado no existe.' });
    }
    const { rows } = await pool.query(
      `UPDATE foro_posts SET titulo=$1, cuerpo=$2, subseccion=$3, enfoque=$4, enlace_media=$5,
         enlace_media_tipo=$6, destacado=$7, tema_contenido_id=$8, editado_en=now()
       WHERE id=$9 RETURNING id, titulo, cuerpo, subseccion, enfoque, enlace_media, enlace_media_tipo, destacado, tema_contenido_id, autor_id, creado_en, editado_en`,
      [titulo.trim(), cuerpo.trim(), subseccion, enfoque || null, enlaceMedia || null, enlaceMediaTipo || null, destacado, temaContenidoId, req.params.id]
    );
    if (titulo.trim() !== actual.titulo || cuerpo.trim() !== actual.cuerpo) {
      try { await marcarSiHayRiesgoEnEdicion('debate_post', req.params.id, `${titulo} ${cuerpo}`); } catch { /* nunca tumbar la edicion por esto */ }
    }
    res.json({ ok: true, post: rows[0] });
  } catch (err) { enviarError500(res, err); }
});

// DELETE /api/foro/posts/:id -- dueno, admin o moderador (cascada borra comentarios)
router.delete('/posts/:id', requireAuth, async (req, res) => {
  try {
    const { rows: existing } = await pool.query('SELECT autor_id FROM foro_posts WHERE id = $1', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ ok: false, error: 'Publicacion no encontrada.' });
    if (existing[0].autor_id !== req.user.id && !esModeracion(req.user.rol)) {
      return res.status(403).json({ ok: false, error: 'No tienes permiso para eliminar esta publicacion.' });
    }
    // Una sola sentencia: borra la publicacion y pasa a "revisado" los reportes
    // pendientes de ella y de sus comentarios (que se borran en cascada).
    await pool.query(
      `WITH borrada AS (DELETE FROM foro_posts WHERE id = $1 RETURNING id),
            cerrados AS (
              UPDATE reportes SET estado = 'revisado'
              WHERE estado = 'pendiente'
                AND ((tipo = 'debate_post' AND item_id = $1)
                  OR (tipo = 'debate_comentario' AND item_id IN (SELECT id FROM foro_comentarios WHERE post_id = $1)))
            )
       SELECT id FROM borrada`,
      [req.params.id]
    );
    res.json({ ok: true });
  } catch (err) { enviarError500(res, err); }
});

// POST /api/foro/posts/:postId/comentarios -- crear -- requiere sesion y edad confirmada
router.post('/posts/:postId/comentarios', requireAuth, async (req, res) => {
  if (esHoneypot(req.body)) return res.status(400).json({ ok: false, error: 'No se pudo procesar la solicitud.' });
  if (cuentaEnCooldown(req.user)) {
    return res.status(403).json({ ok: false, error: `Tu cuenta debe tener al menos ${COOLDOWN_HORAS_CUENTA_NUEVA} hora(s) de creada para comentar aquí.` });
  }
  if (!(await verificarTurnstile(req.body.turnstileToken))) {
    return res.status(400).json({ ok: false, error: 'No se pudo verificar que eres una persona. Intenta de nuevo.' });
  }
  try {
    const cuerpo = String(req.body.cuerpo || '').trim();
    if (cuerpo.length < 2) return res.status(400).json({ ok: false, error: 'El comentario es muy corto.' });
    if (cuerpo.length > MAX_COMENTARIO_CARACTERES) {
      return res.status(400).json({ ok: false, error: `El comentario no puede superar ${MAX_COMENTARIO_CARACTERES} caracteres.` });
    }
    const { rows: postExists } = await pool.query('SELECT id, subseccion FROM foro_posts WHERE id = $1', [req.params.postId]);
    if (postExists.length === 0) return res.status(404).json({ ok: false, error: 'Publicacion no encontrada.' });
    if (bloqueadoPorEdad(req.user, postExists[0].subseccion)) {
      return res.status(403).json({ ok: false, error: 'Debes confirmar que eres mayor de 18 años para participar en esta sección.' });
    }

    const { rows } = await pool.query(
      `INSERT INTO foro_comentarios (post_id, autor_id, cuerpo) VALUES ($1,$2,$3)
       RETURNING id, post_id, cuerpo, autor_id, creado_en`,
      [req.params.postId, req.user.id, cuerpo]
    );
    try { await marcarSiHayRiesgo('debate_comentario', rows[0].id, cuerpo); } catch { /* nunca tumbar el comentario por esto */ }
    res.status(201).json({ ok: true, comentario: rows[0] });
  } catch (err) { enviarError500(res, err); }
});

// DELETE /api/foro/comentarios/:id -- dueno, admin o moderador
router.delete('/comentarios/:id', requireAuth, async (req, res) => {
  try {
    const { rows: existing } = await pool.query('SELECT autor_id FROM foro_comentarios WHERE id = $1', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ ok: false, error: 'Comentario no encontrado.' });
    if (existing[0].autor_id !== req.user.id && !esModeracion(req.user.rol)) {
      return res.status(403).json({ ok: false, error: 'No tienes permiso para eliminar este comentario.' });
    }
    await pool.query(
      `WITH borrado AS (DELETE FROM foro_comentarios WHERE id = $1 RETURNING id),
            cerrados AS (
              UPDATE reportes SET estado = 'revisado'
              WHERE estado = 'pendiente' AND tipo = 'debate_comentario' AND item_id = $1
            )
       SELECT id FROM borrado`,
      [req.params.id]
    );
    res.json({ ok: true });
  } catch (err) { enviarError500(res, err); }
});

module.exports = router;
