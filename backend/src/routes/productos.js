const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { slugify } = require('../util/slugify');
const { validateProducto } = require('../validators/producto');

const router = express.Router();

function toRow(id, body, existing = {}) {
  const stripeLink = body.stripeLink !== undefined ? (body.stripeLink || null) : (existing.stripe_link ?? null);
  const disponible = body.disponible !== undefined ? !!body.disponible : (existing.disponible ?? true);
  return [
    id,
    body.nombre ?? existing.nombre,
    body.descripcion ?? existing.descripcion,
    body.precio !== undefined ? Number(body.precio) : existing.precio,
    body.imagen ?? existing.imagen,
    body.imagenAlt ?? existing.imagen_alt,
    stripeLink,
    disponible,
  ];
}

// GET /api/productos -- lista, publico
router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM productos ORDER BY creado_en DESC');
    res.json({ ok: true, productos: rows });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// GET /api/productos/:id -- detalle, publico
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM productos WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ ok: false, error: 'Producto no encontrado.' });
    res.json({ ok: true, producto: rows[0] });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// POST /api/productos -- crear, solo admin
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const errors = validateProducto(req.body);
  if (errors.length) return res.status(400).json({ ok: false, error: errors.join(' ') });
  try {
    let id = req.body.id ? slugify(req.body.id) : slugify(req.body.nombre);
    const { rows: dupe } = await pool.query('SELECT id FROM productos WHERE id = $1', [id]);
    if (dupe.length) id = `${id}-${Date.now().toString(36)}`;

    const values = toRow(id, req.body);
    const { rows } = await pool.query(
      `INSERT INTO productos (id, nombre, descripcion, precio, imagen, imagen_alt, stripe_link, disponible)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      values
    );
    res.status(201).json({ ok: true, producto: rows[0] });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// PUT /api/productos/:id -- editar, solo admin
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const errors = validateProducto(req.body, { partial: true });
  if (errors.length) return res.status(400).json({ ok: false, error: errors.join(' ') });
  try {
    const { rows: existingRows } = await pool.query('SELECT * FROM productos WHERE id = $1', [req.params.id]);
    if (existingRows.length === 0) return res.status(404).json({ ok: false, error: 'Producto no encontrado.' });

    const values = toRow(req.params.id, req.body, existingRows[0]);
    const { rows } = await pool.query(
      `UPDATE productos SET nombre=$2, descripcion=$3, precio=$4, imagen=$5, imagen_alt=$6, stripe_link=$7, disponible=$8
       WHERE id=$1 RETURNING *`,
      values
    );
    res.json({ ok: true, producto: rows[0] });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// DELETE /api/productos/:id -- solo admin
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM productos WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ ok: false, error: 'Producto no encontrado.' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

module.exports = router;
