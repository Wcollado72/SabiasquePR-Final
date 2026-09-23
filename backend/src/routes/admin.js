const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { extraerArticulo } = require('../services/articleExtractor');
const { redactarDesdeArticulo } = require('../services/anthropic');

const router = express.Router();

// POST /api/admin/autocompletar-ia -- solo admin. Recibe { url }, descarga
// y extrae el articulo, y le pide a Claude un resumen/parrafos originales
// en español. Nunca guarda nada -- el admin revisa y decide si publicar.
router.post('/autocompletar-ia', requireAuth, requireAdmin, async (req, res) => {
  const { url } = req.body || {};
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ ok: false, error: 'Falta la URL del artículo.' });
  }
  try {
    const articulo = await extraerArticulo(url);
    const redactado = await redactarDesdeArticulo(articulo);
    res.json({
      ok: true,
      titulo: redactado.titulo,
      subtituloResumen: redactado.resumen,
      parrafos: redactado.parrafos,
      fuenteTexto: redactado.fuenteTexto || articulo.sitio,
      fuenteUrl: articulo.url,
    });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

module.exports = router;
