const express = require('express');
const { pool } = require('../db');
const { registrarUsoAgente } = require('../util/usoIa');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { enviarError500 } = require('../util/errores');
const { clasificarUrl } = require('../services/clasificadora');
const { revisarPieza } = require('../services/guardiana');
const { pintarPieza } = require('../services/pintora');
const { buscarDuplicados } = require('../services/detective');
const { validateClasificar, validateRevisar, validateDuplicados, validatePintar } = require('../validators/brigada');

const router = express.Router();

// POST /api/admin/brigada/clasificar -- solo admin. Recibe { url, destino } y devuelve las sugerencias de la pestana
// Clasificacion. Nunca guarda nada: el panel las muestra marcadas y el admin decide.
router.post('/clasificar', requireAuth, requireAdmin, async (req, res) => {
  const errors = validateClasificar(req.body);
  if (errors.length) return res.status(400).json({ ok: false, error: errors.join(' ') });
  try {
    const { sugerencias, formatoOriginal, url, usage } = await clasificarUrl({
      url: req.body.url.trim(), destino: req.body.destino || 'contenido',
    });
    await registrarUsoAgente(pool, { agente: 'clasificadora', fuenteTipo: 'url', usage, creadoPor: req.user.id });
    res.json({ ok: true, sugerencias, formatoOriginal, url });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// POST /api/admin/brigada/revisar -- solo admin. La Guardiana compara la pieza con su fuente (anti-copia, sin IA) y
// marca contenido sensible (IA). Solo orienta: no guarda, no bloquea y no borra nada.
router.post('/revisar', requireAuth, requireAdmin, async (req, res) => {
  const errors = validateRevisar(req.body);
  if (errors.length) return res.status(400).json({ ok: false, error: errors.join(' ') });
  try {
    const { titulo, resumen, cuerpo, fuenteUrl, seccion } = req.body;
    const { copia, revision, usage } = await revisarPieza({
      titulo, resumen, cuerpo, fuenteUrl: typeof fuenteUrl === 'string' ? fuenteUrl.trim() : '', seccion,
    });
    await registrarUsoAgente(pool, { agente: 'guardiana', fuenteTipo: 'texto', usage, creadoPor: req.user.id });
    res.json({ ok: true, copia, revision });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// POST /api/admin/brigada/duplicados -- solo admin. El Detective busca, entre las noticias y los contenidos que ya
// existen (publicados y borradores), historias que se parezcan a la que se esta escribiendo. Sin IA y sin costo.
router.post('/duplicados', requireAuth, requireAdmin, async (req, res) => {
  const errors = validateDuplicados(req.body);
  if (errors.length) return res.status(400).json({ ok: false, error: errors.join(' ') });
  try {
    const { titulo, resumen, fuenteUrl, excluir } = req.body;
    const [noticias, contenidos] = await Promise.all([
      pool.query(`SELECT id, titulo, fuente_url, publicado, fecha,
                         concat_ws(' ', parrafos->>0, parrafos->>1) AS resumen
                  FROM noticias ORDER BY creado_en DESC LIMIT 1000`),
      pool.query(`SELECT id, titulo, fuente_url, publicado, fecha_publicacion AS fecha, subtitulo_resumen AS resumen
                  FROM contenidos ORDER BY creado_en DESC LIMIT 1000`),
    ]);
    const existentes = [
      ...noticias.rows.map((r) => ({ tipo: 'noticia', id: r.id, titulo: r.titulo, resumen: r.resumen, fuenteUrl: r.fuente_url, publicado: r.publicado, fecha: r.fecha })),
      ...contenidos.rows.map((r) => ({ tipo: 'contenido', id: r.id, titulo: r.titulo, resumen: r.resumen, fuenteUrl: r.fuente_url, publicado: r.publicado, fecha: r.fecha })),
    ];
    const candidatas = buscarDuplicados({ titulo, resumen, fuenteUrl }, existentes, excluir || null);
    res.json({ ok: true, candidatas, revisadas: existentes.length });
  } catch (err) {
    enviarError500(res, err);
  }
});

// POST /api/admin/brigada/pintar -- solo admin. La Pintora sugiere el texto alternativo y un prompt de imagen (en el
// estilo fijo de Aliado Imperfekto). No genera la imagen ni guarda nada.
router.post('/pintar', requireAuth, requireAdmin, async (req, res) => {
  const errors = validatePintar(req.body);
  if (errors.length) return res.status(400).json({ ok: false, error: errors.join(' ') });
  try {
    const { titulo, resumen, cuerpo, idioma, seccion } = req.body;
    const { textoAlternativo, escena, promptImagen, usage } = await pintarPieza({ titulo, resumen, cuerpo, idioma, seccion });
    await registrarUsoAgente(pool, { agente: 'pintora', fuenteTipo: 'texto', usage, creadoPor: req.user.id });
    res.json({ ok: true, textoAlternativo, escena, promptImagen });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

module.exports = router;
