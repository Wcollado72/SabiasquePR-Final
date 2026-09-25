const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { validatePost } = require('../validators/foroPost');

const router = express.Router();

// GET /api/foro/posts?categoria=&limit=&offset=  -- publico
router.get('/posts', async (req, res) => {
  try {
    const { categoria } = req.query;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const offset = parseInt(req.query.offset, 10) || 0;
    const params = [];
    let where = '';
    if (categoria) { params.push(categoria); where = `WHERE p.categoria = $${params.length}`; }
    params.push(limit, offset);

    const { rows } = await pool.query(
      `SELECT p.id, p.titulo, p.categoria, p.creado_en, p.editado_en, pf.email AS autor_email,
              (SELECT COUNT(*) FROM foro_comentarios c WHERE c.post_id = p.id)::int AS comentarios_count
       FROM foro_posts p JOIN perfiles pf ON pf.id = p.autor_id
       ${where}
       ORDER BY p.creado_en DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ ok: true, posts: rows });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// GET /api/foro/posts/:id -- detalle + comentarios -- publico
router.get('/posts/:id', async (req, res) => {
  try {
    const { rows: postRows } = await pool.query(
      `SELECT p.id, p.titulo, p.cuerpo, p.categoria, p.autor_id, p.creado_en, p.editado_en, pf.email AS autor_email
       FROM foro_posts p JOIN perfiles pf ON pf.id = p.autor_id WHERE p.id = $1`,
      [req.params.id]
    );
    if (postRows.length === 0) return res.status(404).json({ ok: false, error: 'Publicacion no encontrada.' });

    const { rows: comentarios } = await pool.query(
      `SELECT c.id, c.cuerpo, c.autor_id, c.creado_en, pf.email AS autor_email
       FROM foro_comentarios c JOIN perfiles pf ON pf.id = c.autor_id
       WHERE c.post_id = $1 ORDER BY c.creado_en ASC`,
      [req.params.id]
    );
    res.json({ ok: true, post: postRows[0], comentarios });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// POST /api/foro/posts -- crear -- requiere sesion
router.post('/posts', requireAuth, async (req, res) => {
  const errors = validatePost(req.body);
  if (errors.length) return res.status(400).json({ ok: false, error: errors.join(' ') });
  try {
    const { titulo, cuerpo } = req.body;
    const categoria = req.body.categoria || 'general';
    const { rows } = await pool.query(
      `INSERT INTO foro_posts (autor_id, titulo, cuerpo, categoria) VALUES ($1,$2,$3,$4)
       RETURNING id, titulo, cuerpo, categoria, autor_id, creado_en, editado_en`,
      [req.user.id, titulo.trim(), cuerpo.trim(), categoria]
    );
    res.status(201).json({ ok: true, post: rows[0] });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// PATCH /api/foro/posts/:id -- editar -- dueno o admin
router.patch('/posts/:id', requireAuth, async (req, res) => {
  try {
    const { rows: existing } = await pool.query('SELECT autor_id FROM foro_posts WHERE id = $1', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ ok: false, error: 'Publicacion no encontrada.' });
    if (existing[0].autor_id !== req.user.id && req.user.rol !== 'admin') {
      return res.status(403).json({ ok: false, error: 'No tienes permiso para editar esta publicacion.' });
    }
    const errors = validatePost(req.body);
    if (errors.length) return res.status(400).json({ ok: false, error: errors.join(' ') });

    const { titulo, cuerpo, categoria } = req.body;
    const { rows } = await pool.query(
      `UPDATE foro_posts SET titulo=$1, cuerpo=$2, categoria=$3, editado_en=now()
       WHERE id=$4 RETURNING id, titulo, cuerpo, categoria, autor_id, creado_en, editado_en`,
      [titulo.trim(), cuerpo.trim(), categoria || 'general', req.params.id]
    );
    res.json({ ok: true, post: rows[0] });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// DELETE /api/foro/posts/:id -- dueno o admin (cascada borra comentarios)
router.delete('/posts/:id', requireAuth, async (req, res) => {
  try {
    const { rows: existing } = await pool.query('SELECT autor_id FROM foro_posts WHERE id = $1', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ ok: false, error: 'Publicacion no encontrada.' });
    if (existing[0].autor_id !== req.user.id && req.user.rol !== 'admin') {
      return res.status(403).json({ ok: false, error: 'No tienes permiso para eliminar esta publicacion.' });
    }
    await pool.query('DELETE FROM foro_posts WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// POST /api/foro/posts/:postId/comentarios -- crear -- requiere sesion
router.post('/posts/:postId/comentarios', requireAuth, async (req, res) => {
  try {
    const cuerpo = (req.body.cuerpo || '').trim();
    if (cuerpo.length < 2) return res.status(400).json({ ok: false, error: 'El comentario es muy corto.' });
    const { rows: postExists } = await pool.query('SELECT id FROM foro_posts WHERE id = $1', [req.params.postId]);
    if (postExists.length === 0) return res.status(404).json({ ok: false, error: 'Publicacion no encontrada.' });

    const { rows } = await pool.query(
      `INSERT INTO foro_comentarios (post_id, autor_id, cuerpo) VALUES ($1,$2,$3)
       RETURNING id, post_id, cuerpo, autor_id, creado_en`,
      [req.params.postId, req.user.id, cuerpo]
    );
    res.status(201).json({ ok: true, comentario: rows[0] });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// DELETE /api/foro/comentarios/:id -- dueno o admin
router.delete('/comentarios/:id', requireAuth, async (req, res) => {
  try {
    const { rows: existing } = await pool.query('SELECT autor_id FROM foro_comentarios WHERE id = $1', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ ok: false, error: 'Comentario no encontrado.' });
    if (existing[0].autor_id !== req.user.id && req.user.rol !== 'admin') {
      return res.status(403).json({ ok: false, error: 'No tienes permiso para eliminar este comentario.' });
    }
    await pool.query('DELETE FROM foro_comentarios WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

module.exports = router;
