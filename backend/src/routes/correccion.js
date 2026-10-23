const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { corregirTexto } = require('../services/corrector');
const { validateCorreccion } = require('../validators/correccion');

const router = express.Router();

// Mismo registro de costo que usan los demas agentes de IA (routes/admin.js); se reutiliza el agente 'redactor'
// porque la tabla ia_generaciones solo admite investigador, redactor o traductor.
async function registrarUso(usage, creadoPor) {
  try {
    await pool.query(
      `INSERT INTO ia_generaciones (agente, fuente_tipo, uso_busqueda_web, busquedas_realizadas, tokens_entrada, tokens_salida, costo_estimado_usd, creado_por)
       VALUES ('redactor','texto',false,0,$1,$2,$3,$4)`,
      [usage.tokensEntrada || 0, usage.tokensSalida || 0, usage.costoEstimadoUsd || 0, creadoPor]
    );
  } catch (err) {
    console.error('No se pudo registrar el uso de IA del corrector:', err.message);
  }
}

// POST /api/admin/corregir -- solo admin. Devuelve el texto corregido y la lista de cambios; nunca guarda nada:
// el panel muestra los cambios y el admin decide si los aplica.
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const errors = validateCorreccion(req.body);
  if (errors.length) return res.status(400).json({ ok: false, error: errors.join(' ') });
  try {
    const { textoCorregido, cambios, usage } = await corregirTexto({ texto: req.body.texto, variante: req.body.variante });
    await registrarUso(usage, req.user.id);
    res.json({ ok: true, textoCorregido, cambios });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

module.exports = router;
