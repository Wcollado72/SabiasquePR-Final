const express = require('express');
const { pool } = require('../db');
const { enviarError500 } = require('../util/errores');
const { requireAuth, requireModerador } = require('../middleware/auth');
const { validateReporte, ESTADOS_VALIDOS } = require('../validators/reporte');
const { nombreVisibleSql } = require('../util/autorVisible');

const router = express.Router();

const TABLA_POR_TIPO = { debate_post: 'foro_posts', debate_comentario: 'foro_comentarios' };

// POST /api/reportes -- cualquier usuario con sesion puede reportar (no
// exige edad_confirmada: reportar es una accion de seguridad, no de
// participacion en el debate).
router.post('/', requireAuth, async (req, res) => {
  const errors = validateReporte(req.body);
  if (errors.length) return res.status(400).json({ ok: false, error: errors.join(' ') });
  try {
    const { tipo, itemId, motivo } = req.body;
    const tabla = TABLA_POR_TIPO[tipo];
    const { rows: existe } = await pool.query(`SELECT id FROM ${tabla} WHERE id = $1`, [itemId]);
    if (existe.length === 0) return res.status(404).json({ ok: false, error: 'El elemento reportado no existe.' });

    const { rows } = await pool.query(
      `INSERT INTO reportes (tipo, item_id, reportado_por, motivo) VALUES ($1,$2,$3,$4)
       RETURNING id, tipo, item_id, reportado_por, motivo, estado, creado_en`,
      [tipo, itemId, req.user.id, motivo.trim()]
    );
    res.status(201).json({ ok: true, reporte: rows[0] });
  } catch (err) { enviarError500(res, err); }
});

// GET /api/reportes?estado=pendiente -- admin o moderador
// Cada reporte trae el texto reportado (publicacion o comentario del debate)
// para poder decidir sin ir a buscarlo; si ya se borro, contenido_existe=false.
// El autor sale con su nombre visible, nunca con el correo.
router.get('/', requireAuth, requireModerador, async (req, res) => {
  try {
    const estado = req.query.estado;
    const params = [];
    let where = '';
    if (estado) { params.push(estado); where = `WHERE r.estado = $${params.length}`; }
    const { rows } = await pool.query(
      `SELECT r.id, r.tipo, r.item_id, r.motivo, r.estado, r.automatico, r.creado_en, pf.email AS reportado_por_email,
              (fp.id IS NOT NULL OR fc.id IS NOT NULL) AS contenido_existe,
              fp.titulo AS contenido_titulo,
              COALESCE(fp.cuerpo, fc.cuerpo) AS contenido_cuerpo,
              COALESCE(fp.creado_en, fc.creado_en) AS contenido_creado_en,
              fc.post_id AS contenido_post_id,
              ${nombreVisibleSql('au')} AS contenido_autor_nombre
       FROM reportes r
       LEFT JOIN perfiles pf ON pf.id = r.reportado_por
       LEFT JOIN foro_posts fp ON r.tipo = 'debate_post' AND fp.id = r.item_id
       LEFT JOIN foro_comentarios fc ON r.tipo = 'debate_comentario' AND fc.id = r.item_id
       LEFT JOIN perfiles au ON au.id = COALESCE(fp.autor_id, fc.autor_id)
       ${where}
       ORDER BY (r.estado = 'pendiente') DESC, r.creado_en DESC`,
      params
    );
    res.json({ ok: true, reportes: rows });
  } catch (err) { enviarError500(res, err); }
});

// PATCH /api/reportes/:id -- admin o moderador, cambia el estado (tambien puede reabrirlo: 'pendiente')
router.patch('/:id', requireAuth, requireModerador, async (req, res) => {
  const estado = req.body.estado;
  if (!ESTADOS_VALIDOS.includes(estado)) {
    return res.status(400).json({ ok: false, error: 'Estado no valido.' });
  }
  try {
    const { rows } = await pool.query(
      'UPDATE reportes SET estado = $1 WHERE id = $2 RETURNING id, tipo, item_id, motivo, estado, creado_en',
      [estado, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ ok: false, error: 'Reporte no encontrado.' });
    res.json({ ok: true, reporte: rows[0] });
  } catch (err) { enviarError500(res, err); }
});

module.exports = router;
