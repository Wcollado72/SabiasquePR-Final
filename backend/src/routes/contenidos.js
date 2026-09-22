const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { slugify } = require('../util/slugify');
const { validateContenido } = require('../validators/contenido');

const router = express.Router();

function toRow(id, body, existing = {}) {
  return [
    id,
    body.seccion ?? existing.seccion,
    body.tipoFormato ?? existing.tipo_formato,
    body.categoria ?? existing.categoria ?? 'general',
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
    body.destacado ?? existing.destacado ?? false,
  ];
}

// Guarda un contenido. Si se marca como destacado, limpia el anterior de la
// MISMA seccion en la misma transaccion (indice unico parcial por seccion).
async function saveContenido(id, seccion, values, sql) {
  const destacado = values[values.length - 1];
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

// GET /api/contenidos?seccion=&categoria=&tipoFormato=  -- lista, publico
router.get('/', async (req, res) => {
  try {
    const { seccion, categoria, tipoFormato } = req.query;
    const params = [];
    const where = [];
    if (seccion) { params.push(seccion); where.push(`seccion = $${params.length}`); }
    if (categoria) { params.push(categoria); where.push(`categoria = $${params.length}`); }
    if (tipoFormato) { params.push(tipoFormato); where.push(`tipo_formato = $${params.length}`); }
    const sql = `SELECT * FROM contenidos ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY fecha_publicacion DESC, creado_en DESC`;
    const { rows } = await pool.query(sql, params);
    res.json({ ok: true, contenidos: rows });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// GET /api/contenidos/:id -- detalle, publico
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM contenidos WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ ok: false, error: 'Contenido no encontrado.' });
    res.json({ ok: true, contenido: rows[0] });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// POST /api/contenidos -- crear, solo admin
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const errors = validateContenido(req.body);
  if (errors.length) return res.status(400).json({ ok: false, error: errors.join(' ') });
  try {
    let id = req.body.id ? slugify(req.body.id) : slugify(req.body.titulo);
    const { rows: dupe } = await pool.query('SELECT id FROM contenidos WHERE id = $1', [id]);
    if (dupe.length) id = `${id}-${Date.now().toString(36)}`;

    const values = toRow(id, req.body);
    const { rows } = await saveContenido(
      id,
      req.body.seccion,
      values,
      `INSERT INTO contenidos (id, seccion, tipo_formato, categoria, titulo, subtitulo_resumen, cuerpo, autor, url_media, fuente_url, fuente_texto, duracion_min, url_portada, portada_alt, fecha_publicacion, destacado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`
    );
    res.status(201).json({ ok: true, contenido: rows[0] });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// PUT /api/contenidos/:id -- editar, solo admin
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const errors = validateContenido(req.body, { partial: true });
  if (errors.length) return res.status(400).json({ ok: false, error: errors.join(' ') });
  try {
    const { rows: existingRows } = await pool.query('SELECT * FROM contenidos WHERE id = $1', [req.params.id]);
    if (existingRows.length === 0) return res.status(404).json({ ok: false, error: 'Contenido no encontrado.' });
    const existing = existingRows[0];

    const values = toRow(req.params.id, req.body, existing);
    const { rows } = await saveContenido(
      req.params.id,
      req.body.seccion ?? existing.seccion,
      values,
      `UPDATE contenidos SET seccion=$2, tipo_formato=$3, categoria=$4, titulo=$5, subtitulo_resumen=$6,
         cuerpo=$7, autor=$8, url_media=$9, fuente_url=$10, fuente_texto=$11, duracion_min=$12,
         url_portada=$13, portada_alt=$14, fecha_publicacion=$15, destacado=$16
       WHERE id=$1 RETURNING *`
    );
    res.json({ ok: true, contenido: rows[0] });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// DELETE /api/contenidos/:id -- solo admin
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM contenidos WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ ok: false, error: 'Contenido no encontrado.' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

module.exports = router;
