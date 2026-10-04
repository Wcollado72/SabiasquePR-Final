const express = require('express');
const { pool } = require('../db');
const { enviarError500 } = require('../util/errores');

const router = express.Router();

// GET /api/agradecimientos -- publico. Nombres que quienes APOYAN CADA MES autorizaron mostrar en el muro de
// agradecimiento ("Apoya el canal"). Solo aparece quien (1) tiene el rol de colaborador activo (premium) y
// (2) dio su autorizacion (agradecimiento_nombre no vacio). Si cancela el apoyo, el rol vuelve a `usuario`
// (webhook de Stripe) y deja de aparecer solo. Cuentas suspendidas tampoco aparecen. Solo se devuelve el nombre.
router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.agradecimiento_nombre AS nombre
       FROM perfiles p
       WHERE p.rol = 'premium'
         AND p.agradecimiento_nombre IS NOT NULL
         AND NOT COALESCE((SELECT banned_until > now() FROM auth.users WHERE id = p.id), false)
       ORDER BY p.agradecimiento_autorizado_en ASC NULLS LAST, p.agradecimiento_nombre ASC
       LIMIT 200`
    );
    res.json({ ok: true, nombres: rows.map((r) => r.nombre) });
  } catch (err) { enviarError500(res, err); }
});

module.exports = router;
