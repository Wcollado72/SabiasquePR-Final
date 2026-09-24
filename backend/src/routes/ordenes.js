const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/ordenes -- el usuario autenticado ve solo sus propios pedidos.
router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, items, total, estado, envio_nombre, envio_direccion, creado_en FROM ordenes WHERE usuario_id = $1 ORDER BY creado_en DESC',
      [req.user.id]
    );
    res.json({ ok: true, ordenes: rows });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

module.exports = router;
