const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { slugify } = require('../util/slugify');
const { validateNoticia } = require('../validators/noticia');

const router = express.Router();

function toRow(id, body, existing = {}) {
  const fecha = body.fecha || existing.fecha;
  const fechaDisplay = body.fechaDisplay || existing.fecha_display ||
    new Date(fecha).toLocaleDateString('es-PR', { year: 'numeric', month: 'long', day: 'numeric' });
  return [
    id,
    body.titulo ?? existing.titulo,
    fecha,
    fechaDisplay,
    body.imagen ?? existing.imagen,
    body.imagenAlt ?? existing.imagen_alt,
    body.imagenCaption ?? existing.imagen_caption ?? `Fuente: ${body.fuenteTexto ?? existing.fuente_texto}`,
    body.clase ?? existing.clase ?? `noticia-${id}`,
    body.fuenteUrl ?? existing.fuente_url,
    body.fuenteTexto ?? existing.fuente_texto,
    JSON.stringify((body.parrafos ?? existing.parrafos ?? []).filter((p) => p && p.trim())),
    body.categoria ?? existing.categoria ?? 'general',
    body.destacado ?? existing.destacado ?? false,
  ];
}

// Guarda una noticia. Si se marca como destacada, limpia la anterior en la
// misma transaccion (el indice unico parcial solo admite una destacada).
async function saveNoticia(id, values, sql) {
  const destacado = values[values.length - 1];
  if (!destacado) return pool.query(sql, values);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE noticias SET destacado = false WHERE destacado AND id <> $1', [id]);
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

// GET /api/noticias?categoria=  -- lista, publico
router.get('/', async (req, res) => {
  try {
    const { categoria } = req.query;
    const params = [];
    let where = '';
    if (categoria) { params.push(categoria); where = 'WHERE categoria = $1'; }
    const { rows } = await pool.query(
      `SELECT * FROM noticias ${where} ORDER BY fecha DESC, creado_en DESC`,
      params
    );
    res.json({ ok: true, noticias: rows });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// GET /api/noticias/:id -- detalle, publico
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM noticias WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ ok: false, error: 'Noticia no encontrada.' });
    res.json({ ok: true, noticia: rows[0] });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// POST /api/noticias -- crear, solo admin
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const errors = validateNoticia(req.body);
  if (errors.length) return res.status(400).json({ ok: false, error: errors.join(' ') });
  try {
    let id = req.body.id ? slugify(req.body.id) : slugify(req.body.titulo);
    const { rows: dupe } = await pool.query('SELECT id FROM noticias WHERE id = $1', [id]);
    if (dupe.length) id = `${id}-${Date.now().toString(36)}`;

    const values = toRow(id, req.body);
    const { rows } = await saveNoticia(
      id,
      values,
      `INSERT INTO noticias (id, titulo, fecha, fecha_display, imagen, imagen_alt, imagen_caption, clase, fuente_url, fuente_texto, parrafos, categoria, destacado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13) RETURNING *`
    );
    res.status(201).json({ ok: true, noticia: rows[0] });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// PUT /api/noticias/:id -- editar, solo admin
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const errors = validateNoticia(req.body, { partial: true });
  if (errors.length) return res.status(400).json({ ok: false, error: errors.join(' ') });
  try {
    const { rows: existingRows } = await pool.query('SELECT * FROM noticias WHERE id = $1', [req.params.id]);
    if (existingRows.length === 0) return res.status(404).json({ ok: false, error: 'Noticia no encontrada.' });

    const values = toRow(req.params.id, req.body, existingRows[0]);
    const { rows } = await saveNoticia(
      req.params.id,
      values,
      `UPDATE noticias SET titulo=$2, fecha=$3, fecha_display=$4, imagen=$5, imagen_alt=$6,
         imagen_caption=$7, clase=$8, fuente_url=$9, fuente_texto=$10, parrafos=$11::jsonb, categoria=$12,
         destacado=$13
       WHERE id=$1 RETURNING *`
    );
    res.json({ ok: true, noticia: rows[0] });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// DELETE /api/noticias/:id -- solo admin
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM noticias WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ ok: false, error: 'Noticia no encontrada.' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

module.exports = router;
