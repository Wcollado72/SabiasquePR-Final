const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { resumirTexto } = require('../services/resumidor');
const { leerMetadatosDeUrl } = require('../services/metadatosFuente');
const { validateResumir, validateMetadatos } = require('../validators/contenidoIa');

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
    console.error('No se pudo registrar el uso de IA del resumidor:', err.message);
  }
}

// POST /api/admin/contenido-ia/resumir -- solo admin. Devuelve el resumen del texto; nunca guarda nada.
router.post('/resumir', requireAuth, requireAdmin, async (req, res) => {
  const errors = validateResumir(req.body);
  if (errors.length) return res.status(400).json({ ok: false, error: errors.join(' ') });
  try {
    const { resumen, usage } = await resumirTexto({ texto: req.body.texto });
    await registrarUso(usage, req.user.id);
    res.json({ ok: true, resumen });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// POST /api/admin/contenido-ia/metadatos-fuente -- solo admin. Lee lo que la pagina declara de si misma (autor,
// anio, titulo original, nombre del medio) y propone el estilo de cita. Sin IA y sin costo; lo que no encuentra viene vacio.
router.post('/metadatos-fuente', requireAuth, requireAdmin, async (req, res) => {
  const errors = validateMetadatos(req.body);
  if (errors.length) return res.status(400).json({ ok: false, error: errors.join(' ') });
  try {
    const { autorFuente, anio, tituloOriginal, nombreFuente, estiloSugerido, motivoEstilo } = await leerMetadatosDeUrl(req.body.url.trim());
    res.json({ ok: true, autorFuente, anio, tituloOriginal, nombreFuente, estiloSugerido, motivoEstilo });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

module.exports = router;
