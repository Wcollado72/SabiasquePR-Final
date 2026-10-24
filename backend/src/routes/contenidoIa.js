const express = require('express');
const { pool } = require('../db');
const { registrarUsoAgente } = require('../util/usoIa');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { resumirTexto } = require('../services/resumidor');
const { leerMetadatosDeUrl } = require('../services/metadatosFuente');
const { validateResumir, validateMetadatos } = require('../validators/contenidoIa');

const router = express.Router();

// POST /api/admin/contenido-ia/resumir -- solo admin. Devuelve el resumen del texto; nunca guarda nada.
router.post('/resumir', requireAuth, requireAdmin, async (req, res) => {
  const errors = validateResumir(req.body);
  if (errors.length) return res.status(400).json({ ok: false, error: errors.join(' ') });
  try {
    const { resumen, usage } = await resumirTexto({ texto: req.body.texto });
    await registrarUsoAgente(pool, { agente: 'resumidora', fuenteTipo: 'texto', usage, creadoPor: req.user.id });
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
