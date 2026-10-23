const express = require('express');
const { pool } = require('../db');
const { enviarError500 } = require('../util/errores');
const { requireAuth } = require('../middleware/auth');
const { validateComentario } = require('../validators/comentario');
const { nombreVisibleSql } = require('../util/autorVisible');
const { crearCooldown } = require('../util/cooldown');
const { detectarRiesgo } = require('../util/deteccionRiesgo');

const router = express.Router();

// Espera entre comentarios de la misma persona (exportado para que las pruebas lo reinicien).
const COOLDOWN_COMENTARIO_MS = 10_000;
const cooldownComentarios = crearCooldown(COOLDOWN_COMENTARIO_MS);

const TABLA_POR_TIPO = { noticia: 'noticias', contenido: 'contenidos' };

// GET /api/comentarios?tipo=&itemId=  -- lista, publico
router.get('/', async (req, res) => {
  try {
    const { tipo, itemId } = req.query;
    if (!tipo || !itemId) return res.status(400).json({ ok: false, error: 'Faltan "tipo" e "itemId".' });
    const { rows } = await pool.query(
      `SELECT c.id, c.cuerpo, c.autor_id, c.creado_en, ${nombreVisibleSql('pf')} AS autor_nombre
       FROM comentarios c JOIN perfiles pf ON pf.id = c.autor_id
       WHERE c.tipo = $1 AND c.item_id = $2
       ORDER BY c.creado_en ASC`,
      [tipo, itemId]
    );
    res.json({ ok: true, comentarios: rows });
  } catch (err) { enviarError500(res, err); }
});

// POST /api/comentarios -- crear, requiere sesion
router.post('/', requireAuth, async (req, res) => {
  const errors = validateComentario(req.body);
  if (errors.length) return res.status(400).json({ ok: false, error: errors.join(' ') });
  const falta = cooldownComentarios.segundosRestantes(req.user.id);
  if (falta > 0) {
    res.set('Retry-After', String(falta));
    return res.status(429).json({ ok: false, error: `Espera ${falta} segundo(s) antes de comentar de nuevo.` });
  }
  try {
    const tabla = TABLA_POR_TIPO[req.body.tipo];
    const { rows: item } = await pool.query(`SELECT id FROM ${tabla} WHERE id = $1`, [req.body.itemId]);
    if (item.length === 0) return res.status(404).json({ ok: false, error: 'El contenido no existe.' });

    const { rows } = await pool.query(
      `INSERT INTO comentarios (tipo, item_id, autor_id, cuerpo)
       VALUES ($1, $2, $3, $4)
       RETURNING id, cuerpo, autor_id, creado_en,
                 (SELECT ${nombreVisibleSql('pf')} FROM perfiles pf WHERE pf.id = $3) AS autor_nombre`,
      [req.body.tipo, req.body.itemId, req.user.id, req.body.cuerpo.trim()]
    );
    cooldownComentarios.marcar(req.user.id);
    // Mismo filtro de riesgo que el debate: un comentario que coincide con un patron genera un reporte
    // automatico para revision; nunca se bloquea ni se borra solo, y un fallo aqui no tumba el comentario.
    try {
      const categoria = detectarRiesgo(req.body.cuerpo);
      if (categoria) {
        await pool.query(
          `INSERT INTO reportes (tipo, item_id, reportado_por, motivo, automatico)
           VALUES ('articulo_comentario', $1, NULL, $2, true)
           ON CONFLICT (tipo, item_id) WHERE estado = 'pendiente' AND automatico DO NOTHING`,
          [rows[0].id, `Detección automática: ${categoria}`]
        );
      }
    } catch (err) { console.error('No se pudo registrar el reporte automatico del comentario:', err.message); }
    res.status(201).json({ ok: true, comentario: rows[0] });
  } catch (err) { enviarError500(res, err); }
});

// DELETE /api/comentarios/:id -- el dueño, un admin o un moderador
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { rows: existing } = await pool.query('SELECT autor_id FROM comentarios WHERE id = $1', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ ok: false, error: 'Comentario no encontrado.' });
    const esModeracion = req.user.rol === 'admin' || req.user.rol === 'moderador';
    if (existing[0].autor_id !== req.user.id && !esModeracion) {
      return res.status(403).json({ ok: false, error: 'No tienes permiso para borrar este comentario.' });
    }
    // Una sola sentencia: borra el comentario y pasa a "revisado" sus reportes pendientes.
    await pool.query(
      `WITH borrado AS (DELETE FROM comentarios WHERE id = $1 RETURNING id),
            cerrados AS (
              UPDATE reportes SET estado = 'revisado'
              WHERE estado = 'pendiente' AND tipo = 'articulo_comentario' AND item_id = $1
            )
       SELECT id FROM borrado`,
      [req.params.id]
    );
    res.json({ ok: true });
  } catch (err) { enviarError500(res, err); }
});

module.exports = router;
module.exports.cooldownComentarios = cooldownComentarios;
