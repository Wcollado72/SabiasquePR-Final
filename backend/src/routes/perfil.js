const express = require('express');
const { pool } = require('../db');
const { enviarError500 } = require('../util/errores');
const { requireAuth } = require('../middleware/auth');
const { validatePerfil } = require('../validators/perfil');
const { validateFechaNacimiento } = require('../validators/fechaNacimiento');

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
  } catch (err) { enviarError500(res, err); }
});

// POST /api/perfil/fecha-nacimiento -- paso "Completa tu perfil". Las cuentas
// creadas con Google (que no pasan por el formulario de registro) y las
// anteriores a que existiera el campo tienen la fecha vacia. Se puede fijar
// UNA sola vez: el UPDATE solo aplica si sigue vacia, asi nadie puede cambiarla
// despues (por ejemplo, para saltarse el gate de las secciones 18+ una vez
// que ya quedo registrada una fecha de menor). No rechaza a nadie por su edad.
router.post('/fecha-nacimiento', requireAuth, async (req, res) => {
  const errors = validateFechaNacimiento(req.body);
  if (errors.length) return res.status(400).json({ ok: false, error: errors.join(' ') });
  try {
    const { rows } = await pool.query(
      `UPDATE perfiles SET fecha_nacimiento = $2
       WHERE id = $1 AND fecha_nacimiento IS NULL
       RETURNING id, email, rol, nombre, edad_confirmada, fecha_nacimiento::text AS fecha_nacimiento`,
      [req.user.id, req.body.fechaNacimiento]
    );
    if (rows.length === 0) {
      return res.status(409).json({ ok: false, error: 'Tu fecha de nacimiento ya está registrada y no se puede cambiar.' });
    }
    res.json({ ok: true, user: rows[0] });
  } catch (err) { enviarError500(res, err); }
});

// POST /api/perfil/confirmar-edad -- autoafirmacion de 18+ (checkbox, no
// verificacion real con ID) para entrar a secciones 18+ como Corrupcion
// Humana. Se guarda una sola vez en el perfil.
router.post('/confirmar-edad', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'UPDATE perfiles SET edad_confirmada = true WHERE id = $1 RETURNING id, email, rol, nombre, edad_confirmada',
      [req.user.id]
    );
    res.json({ ok: true, user: rows[0] });
  } catch (err) { enviarError500(res, err); }
});

// POST /api/perfil/confirmar-terminos-logica-humana -- disclaimer propio de
// Logica Humana (area personal de Aliado Imperfekto, solo premium),
// separado del de edad -- se recuerda aparte, permanente en el perfil.
router.post('/confirmar-terminos-logica-humana', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'UPDATE perfiles SET logica_humana_terminos_ok = true WHERE id = $1 RETURNING id, email, rol, nombre, edad_confirmada, logica_humana_terminos_ok',
      [req.user.id]
    );
    res.json({ ok: true, user: rows[0] });
  } catch (err) { enviarError500(res, err); }
});

module.exports = router;
