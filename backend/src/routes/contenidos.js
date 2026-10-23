const express = require('express');
const { pool } = require('../db');
const { enviarError500 } = require('../util/errores');
const { requireAuth, requireAdmin, tryAuth } = require('../middleware/auth');
const { slugify } = require('../util/slugify');
const { validateContenido } = require('../validators/contenido');
const { resolverIaHerramientas } = require('../validators/iaHerramientas');
const { aplicarTraducciones, normalizarLang } = require('../util/traducciones');

const router = express.Router();

// Un contenido sin publicar (borrador) nunca es el destacado de su seccion; igual que en noticias.
function resolverPublicadoYDestacado(body, existing = {}) {
  const publicado = body.publicado ?? existing.publicado ?? true;
  const destacado = publicado ? Boolean(body.destacado ?? existing.destacado ?? false) : false;
  return { publicado, destacado };
}

function toRow(id, body, existing = {}) {
  return [
    id,
    body.seccion ?? existing.seccion,
    body.tipoFormato ?? existing.tipo_formato,
    body.categoria ?? existing.categoria,
    body.titulo ?? existing.titulo,
    body.subtituloResumen ?? existing.subtitulo_resumen,
    body.cuerpo !== undefined ? body.cuerpo : (existing.cuerpo ?? null),
    body.autor !== undefined ? body.autor : (existing.autor ?? null),
    body.urlMedia !== undefined ? body.urlMedia : (existing.url_media ?? null),
    body.fuenteUrl !== undefined ? body.fuenteUrl : (existing.fuente_url ?? null),
    body.fuenteTexto !== undefined ? body.fuenteTexto : (existing.fuente_texto ?? null),
    body.duracionMin ?? existing.duracion_min ?? 1,
    body.urlPortada ?? existing.url_portada,
    body.portadaAlt ?? existing.portada_alt,
    body.fechaPublicacion ?? existing.fecha_publicacion,
    resolverPublicadoYDestacado(body, existing).destacado,
    body.subformato !== undefined ? body.subformato : (existing.subformato ?? null),
    body.divulgacionIa ?? existing.divulgacion_ia ?? 'no',
    body.citaEstilo !== undefined ? body.citaEstilo : (existing.cita_estilo ?? null),
    body.citaAutor !== undefined ? body.citaAutor : (existing.cita_autor ?? null),
    body.citaAnio !== undefined ? body.citaAnio : (existing.cita_anio ?? null),
    body.citaTituloOriginal !== undefined ? body.citaTituloOriginal : (existing.cita_titulo_original ?? null),
    body.citaFechaAcceso !== undefined ? body.citaFechaAcceso : (existing.cita_fecha_acceso ?? null),
    body.citaSinFuenteExterna ?? existing.cita_sin_fuente_externa ?? false,
    body.subseccion !== undefined ? body.subseccion : (existing.subseccion ?? null),
    body.esPremium ?? existing.es_premium ?? false,
    body.enfoque !== undefined ? body.enfoque : (existing.enfoque ?? null),
    body.idiomaOriginal ?? existing.idioma_original ?? 'es',
    resolverIaHerramientas(body, existing).valor,
    resolverPublicadoYDestacado(body, existing).publicado,
  ];
}

// Trunca `cuerpo` a los primeros ~300 caracteres (cortando en el ultimo
// espacio antes del limite) para la vista previa de contenido premium.
function truncarCuerpo(cuerpo) {
  if (!cuerpo || cuerpo.length <= 300) return cuerpo;
  const corte = cuerpo.slice(0, 300);
  const ultimoEspacio = corte.lastIndexOf(' ');
  return (ultimoEspacio > 0 ? corte.slice(0, ultimoEspacio) : corte) + '…';
}

// Si el contenido es premium (por pieza, `es_premium`) o pertenece a la
// sub-seccion Logica Humana (premium por completo, area personal de
// Aliado Imperfekto) y quien pregunta no tiene acceso (ni premium ni
// admin), se trunca el cuerpo y se oculta el media real -- esto pasa
// SIEMPRE en el servidor, nunca solo visualmente en el cliente, porque de
// lo contrario cualquiera podria leer el cuerpo completo pegando la URL
// de la API a mano.
function aplicarMuroDePago(contenido, user) {
  const tieneAcceso = user && (user.rol === 'premium' || user.rol === 'admin');
  // 2026-09-27: se elimino el premium ligado a la seccion completa de
  // Logica Humana -- ver todo el sitio es gratis para cualquiera, con o
  // sin cuenta. El muro de pago ahora es exclusivamente por pieza
  // individual marcada es_premium, sin importar la seccion.
  const requierePremium = contenido.es_premium;
  if (!requierePremium || tieneAcceso) {
    return { ...contenido, bloqueado: false };
  }
  return { ...contenido, cuerpo: truncarCuerpo(contenido.cuerpo), url_media: null, bloqueado: true };
}

// Guarda un contenido. Si se marca como destacado, limpia el anterior de la
// MISMA seccion en la misma transaccion (indice unico parcial por seccion).
// `destacado` se recibe explicito (no se infiere por posicion de `values`)
// para que agregar columnas a `toRow` en el futuro no pueda romper esto en silencio.
async function saveContenido(id, seccion, destacado, values, sql) {
  if (!destacado) return pool.query(sql, values);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'UPDATE contenidos SET destacado = false WHERE destacado AND seccion = $1 AND id <> $2',
      [seccion, id]
    );
    const result = await client.query(sql, values);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// GET /api/contenidos?seccion=&categoria=&tipoFormato=&subformato=&subseccion=
// -- lista, publico (verifica sesion sin exigirla, mismo motivo que el
// detalle: un video/audio premium no puede exponer su url_media real en
// la grilla aunque el texto no se muestre ahi).
router.get('/', tryAuth, async (req, res) => {
  try {
    const { seccion, categoria, tipoFormato, subformato, subseccion, enfoque } = req.query;
    const esAdmin = req.user?.rol === 'admin';
    const params = [];
    const where = [];
    if (!esAdmin) where.push('publicado = true');
    if (seccion) { params.push(seccion); where.push(`seccion = $${params.length}`); }
    if (categoria) { params.push(categoria); where.push(`categoria = $${params.length}`); }
    if (tipoFormato) { params.push(tipoFormato); where.push(`tipo_formato = $${params.length}`); }
    if (subformato) { params.push(subformato); where.push(`subformato = $${params.length}`); }
    if (subseccion) { params.push(subseccion); where.push(`subseccion = $${params.length}`); }
    if (enfoque) { params.push(enfoque); where.push(`enfoque = $${params.length}`); }
    const sql = `SELECT * FROM contenidos ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY fecha_publicacion DESC, creado_en DESC`;
    const { rows } = await pool.query(sql, params);
    // La traduccion se superpone ANTES del muro de pago: asi el recorte de
    // contenido premium se aplica al texto que el visitante realmente ve.
    const traducidos = await aplicarTraducciones('contenido', rows, normalizarLang(req.query.lang));
    res.json({ ok: true, contenidos: traducidos.map((r) => aplicarMuroDePago(r, req.user)) });
  } catch (err) { enviarError500(res, err); }
});

// GET /api/contenidos/:id -- detalle, publico (verifica sesion sin exigirla,
// para saber si aplica el muro de pago de contenido premium)
router.get('/:id', tryAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM contenidos WHERE id = $1', [req.params.id]);
    // Un borrador se trata como inexistente para quien no sea admin (no revela que existe).
    if (rows.length === 0 || (rows[0].publicado === false && req.user?.rol !== 'admin')) {
      return res.status(404).json({ ok: false, error: 'Contenido no encontrado.' });
    }
    const [traducido] = await aplicarTraducciones('contenido', [rows[0]], normalizarLang(req.query.lang));
    res.json({ ok: true, contenido: aplicarMuroDePago(traducido, req.user) });
  } catch (err) { enviarError500(res, err); }
});

// POST /api/contenidos -- crear, solo admin
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const errors = validateContenido(req.body);
  if (errors.length) return res.status(400).json({ ok: false, error: errors.join(' ') });
  try {
    const ia = resolverIaHerramientas(req.body);
    if (ia.error) return res.status(400).json({ ok: false, error: ia.error });
    let id = req.body.id ? slugify(req.body.id) : slugify(req.body.titulo);
    const { rows: dupe } = await pool.query('SELECT id FROM contenidos WHERE id = $1', [id]);
    if (dupe.length) id = `${id}-${Date.now().toString(36)}`;

    const values = toRow(id, req.body);
    const destacado = resolverPublicadoYDestacado(req.body).destacado;
    const { rows } = await saveContenido(
      id,
      req.body.seccion,
      destacado,
      values,
      `INSERT INTO contenidos (
         id, seccion, tipo_formato, categoria, titulo, subtitulo_resumen, cuerpo, autor,
         url_media, fuente_url, fuente_texto, duracion_min, url_portada, portada_alt,
         fecha_publicacion, destacado, subformato, divulgacion_ia, cita_estilo, cita_autor,
         cita_anio, cita_titulo_original, cita_fecha_acceso, cita_sin_fuente_externa,
         subseccion, es_premium, enfoque, idioma_original, ia_herramientas, publicado
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29::text[],$30)
       RETURNING *`
    );
    res.status(201).json({ ok: true, contenido: rows[0] });
  } catch (err) { enviarError500(res, err); }
});

// PUT /api/contenidos/:id -- editar, solo admin
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const errors = validateContenido(req.body, { partial: true });
  if (errors.length) return res.status(400).json({ ok: false, error: errors.join(' ') });
  try {
    const { rows: existingRows } = await pool.query('SELECT * FROM contenidos WHERE id = $1', [req.params.id]);
    if (existingRows.length === 0) return res.status(404).json({ ok: false, error: 'Contenido no encontrado.' });
    const existing = existingRows[0];

    const ia = resolverIaHerramientas(req.body, existing);
    if (ia.error) return res.status(400).json({ ok: false, error: ia.error });

    const values = toRow(req.params.id, req.body, existing);
    const seccion = req.body.seccion ?? existing.seccion;
    const destacado = resolverPublicadoYDestacado(req.body, existing).destacado;
    const { rows } = await saveContenido(
      req.params.id,
      seccion,
      destacado,
      values,
      `UPDATE contenidos SET seccion=$2, tipo_formato=$3, categoria=$4, titulo=$5, subtitulo_resumen=$6,
         cuerpo=$7, autor=$8, url_media=$9, fuente_url=$10, fuente_texto=$11, duracion_min=$12,
         url_portada=$13, portada_alt=$14, fecha_publicacion=$15, destacado=$16, subformato=$17,
         divulgacion_ia=$18, cita_estilo=$19, cita_autor=$20, cita_anio=$21, cita_titulo_original=$22,
         cita_fecha_acceso=$23, cita_sin_fuente_externa=$24, subseccion=$25, es_premium=$26, enfoque=$27, idioma_original=$28, ia_herramientas=$29::text[], publicado=$30
       WHERE id=$1 RETURNING *`
    );
    res.json({ ok: true, contenido: rows[0] });
  } catch (err) { enviarError500(res, err); }
});

// DELETE /api/contenidos/:id -- solo admin
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    // Una sola sentencia: borra el contenido y sus comentarios y traducciones (sin clave
    // foranea), para que no queden huerfanos ni los herede otra pieza con el mismo slug.
    const { rowCount } = await pool.query(
      `WITH borrado AS (DELETE FROM contenidos WHERE id = $1 RETURNING id),
            comentarios_borrados AS (DELETE FROM comentarios WHERE tipo = 'contenido' AND item_id = $1),
            traducciones_borradas AS (DELETE FROM traducciones WHERE tipo = 'contenido' AND item_id = $1)
       SELECT id FROM borrado`,
      [req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ ok: false, error: 'Contenido no encontrado.' });
    res.json({ ok: true });
  } catch (err) { enviarError500(res, err); }
});

module.exports = router;
