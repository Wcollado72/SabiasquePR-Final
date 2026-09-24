const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { validatePerfil } = require('../validators/perfil');

const router = express.Router();

// PUT /api/perfil -- el usuario autenticado edita su propio nombre.
// El correo no es editable aqui: cambiarlo requiere el flujo de
// confirmacion propio de Supabase Auth, fuera de alcance por ahora.
router.put('/', requireAuth, async (req, res) => {
  const errors = validatePerfil(req.body);
  if (errors.length) return res.status(400).json({ ok: false, error: errors.join(' ') });
  try {
    const nombre = req.body.nombre !== undefined ? (req.body.nombre === null ? null : req.body.nombre.trim()) : req.user.nombre;
    const { rows } = await pool.query(
      'UPDATE perfiles SET nombre = $2 WHERE id = $1 RETURNING id, email, rol, nombre',
      [req.user.id, nombre]
    );
    res.json({ ok: true, user: rows[0] });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

module.exports = router;
