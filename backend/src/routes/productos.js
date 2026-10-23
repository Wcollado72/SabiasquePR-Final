const express = require('express');
const { pool } = require('../db');
const { enviarError500 } = require('../util/errores');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { slugify } = require('../util/slugify');
const { validateProducto } = require('../validators/producto');
const { aplicarTraducciones, normalizarLang } = require('../util/traducciones');

const router = express.Router();

function toRow(id, body, existing = {}) {
  const stripeLink = body.stripeLink !== undefined ? (body.stripeLink || null) : (existing.stripe_link ?? null);
  const stripePriceId = body.stripePriceId !== undefined ? (body.stripePriceId || null) : (existing.stripe_price_id ?? null);
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
    stripePriceId,
  ];
}

// GET /api/productos -- lista, publico
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM productos ORDER BY creado_en DESC');
    res.json({ ok: true, productos: await aplicarTraducciones('producto', rows, normalizarLang(req.query.lang)) });
  } catch (err) { enviarError500(res, err); }
});

// GET /api/productos/:id -- detalle, publico
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM productos WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ ok: false, error: 'Producto no encontrado.' });
    const [traducido] = await aplicarTraducciones('producto', [rows[0]], normalizarLang(req.query.lang));
    res.json({ ok: true, producto: traducido });
  } catch (err) { enviarError500(res, err); }
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
      `INSERT INTO productos (id, nombre, descripcion, precio, imagen, imagen_alt, stripe_link, disponible, stripe_price_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      values
    );
    res.status(201).json({ ok: true, producto: rows[0] });
  } catch (err) { enviarError500(res, err); }
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
      `UPDATE productos SET nombre=$2, descripcion=$3, precio=$4, imagen=$5, imagen_alt=$6, stripe_link=$7, disponible=$8, stripe_price_id=$9
       WHERE id=$1 RETURNING *`,
      values
    );
    res.json({ ok: true, producto: rows[0] });
  } catch (err) { enviarError500(res, err); }
});

// DELETE /api/productos/:id -- solo admin
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    // Una sola sentencia: borra el producto y sus traducciones (sin clave foranea).
    const { rowCount } = await pool.query(
      `WITH borrado AS (DELETE FROM productos WHERE id = $1 RETURNING id),
            traducciones_borradas AS (DELETE FROM traducciones WHERE tipo = 'producto' AND item_id = $1)
       SELECT id FROM borrado`,
      [req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ ok: false, error: 'Producto no encontrado.' });
    res.json({ ok: true });
  } catch (err) { enviarError500(res, err); }
});

module.exports = router;
