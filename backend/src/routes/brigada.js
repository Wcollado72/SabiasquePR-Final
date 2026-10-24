const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { clasificarUrl } = require('../services/clasificadora');
const { validateClasificar } = require('../validators/brigada');

const router = express.Router();

// Mismo registro de costo que usan los demas agentes de IA (routes/admin.js); se reutiliza el agente 'redactor'
// porque la tabla ia_generaciones solo admite investigador, redactor o traductor.
async function registrarUso(usage, creadoPor) {
  try {
    await pool.query(
      `INSERT INTO ia_generaciones (agente, fuente_tipo, uso_busqueda_web, busquedas_realizadas, tokens_entrada, tokens_salida, costo_estimado_usd, creado_por)
       VALUES ('redactor','url',false,0,$1,$2,$3,$4)`,
      [usage.tokensEntrada || 0, usage.tokensSalida || 0, usage.costoEstimadoUsd || 0, creadoPor]
    );
  } catch (err) {
    console.error('No se pudo registrar el uso de IA de la clasificadora:', err.message);
  }
}

// POST /api/admin/brigada/clasificar -- solo admin. Recibe { url, destino } y devuelve las sugerencias de la pestana
// Clasificacion. Nunca guarda nada: el panel las muestra marcadas y el admin decide.
router.post('/clasificar', requireAuth, requireAdmin, async (req, res) => {
  const errors = validateClasificar(req.body);
  if (errors.length) return res.status(400).json({ ok: false, error: errors.join(' ') });
  try {
    const { sugerencias, formatoOriginal, url, usage } = await clasificarUrl({
      url: req.body.url.trim(), destino: req.body.destino || 'contenido',
    });
    await registrarUso(usage, req.user.id);
    res.json({ ok: true, sugerencias, formatoOriginal, url });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

module.exports = router;
