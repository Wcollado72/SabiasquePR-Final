const express = require('express');
const { pool } = require('../db');
const { enviarError500 } = require('../util/errores');
const { requireAuth, requireAdmin, tryAuth } = require('../middleware/auth');
const { slugify } = require('../util/slugify');
const { validateNoticia } = require('../validators/noticia');
const { resolverIaHerramientas } = require('../validators/iaHerramientas');
const { resolverFuentes } = require('../validators/fuentes');
const { aplicarTraducciones, normalizarLang } = require('../util/traducciones');

const router = express.Router();

// Una noticia sin publicar nunca es la destacada de la portada. Se calcula
// aqui para que `toRow` y el guardado usen exactamente el mismo valor.
function resolverPublicadoYDestacado(body, existing = {}) {
  const publicado = body.publicado ?? existing.publicado ?? true;
  const destacado = publicado ? Boolean(body.destacado ?? existing.destacado ?? false) : false;
  return { publicado, destacado };
}

function toRow(id, body, existing = {}) {
  const { publicado, destacado } = resolverPublicadoYDestacado(body, existing);
  const fecha = body.fecha || existing.fecha;
  const fechaDisplay = body.fechaDisplay || existing.fecha_display ||
    new Date(fecha).toLocaleDateString('es-PR', { year: 'numeric', month: 'long', day: 'numeric' });
  return [
    id,
    body.titulo ?? existing.titulo,
    fecha,
    fechaDisplay,
    body.imagen ?? existing.imagen,
    body.imagenAlt ?? existing.imagen_alt,
    body.imagenCaption ?? existing.imagen_caption ?? `Fuente: ${body.fuenteTexto ?? existing.fuente_texto}`,
    body.clase ?? existing.clase ?? `noticia-${id}`,
    body.fuenteUrl ?? existing.fuente_url,
    body.fuenteTexto ?? existing.fuente_texto,
    JSON.stringify((body.parrafos ?? existing.parrafos ?? []).filter((p) => p && p.trim())),
    body.categoria ?? existing.categoria,
    destacado,
    body.divulgacionIa ?? existing.divulgacion_ia ?? 'no',
    publicado,
    body.idiomaOriginal ?? existing.idioma_original ?? 'es',
    resolverIaHerramientas(body, existing).valor,
    JSON.stringify(resolverFuentes(body, existing)),
  ];
}

// Guarda una noticia. Si se marca como destacada, limpia la anterior en la
// misma transaccion (el indice unico parcial solo admite una destacada).
// `destacado` se recibe explicito (no se infiere por posicion de `values`)
// para que agregar columnas a `toRow` en el futuro no pueda romper esto en silencio.
async function saveNoticia(id, destacado, values, sql) {
  if (!destacado) return pool.query(sql, values);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE noticias SET destacado = false WHERE destacado AND id <> $1', [id]);
    const result = await client.query(sql, values);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// GET /api/noticias?categoria=  -- publico ve solo publicadas; un admin
// autenticado (tryAuth) ve tambien los borradores, para poder gestionarlos
// desde el panel.
router.get('/', tryAuth, async (req, res) => {
  try {
    const { categoria } = req.query;
    const esAdmin = req.user?.rol === 'admin';
    const params = [];
    const where = [];
    if (categoria) { params.push(categoria); where.push(`categoria = $${params.length}`); }
    if (!esAdmin) where.push('publicado = true');
    const sql = `SELECT * FROM noticias ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY fecha DESC, creado_en DESC`;
    const { rows } = await pool.query(sql, params);
    res.json({ ok: true, noticias: await aplicarTraducciones('noticia', rows, normalizarLang(req.query.lang)) });
  } catch (err) { enviarError500(res, err); }
});

// GET /api/noticias/:id -- detalle. Un borrador no publicado se trata como
// inexistente para quien no sea admin (no revela que existe).
router.get('/:id', tryAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM noticias WHERE id = $1', [req.params.id]);
    const noticia = rows[0];
    const esAdmin = req.user?.rol === 'admin';
    if (!noticia || (!noticia.publicado && !esAdmin)) {
      return res.status(404).json({ ok: false, error: 'Noticia no encontrada.' });
    }
    const [traducida] = await aplicarTraducciones('noticia', [noticia], normalizarLang(req.query.lang));
    res.json({ ok: true, noticia: traducida });
  } catch (err) { enviarError500(res, err); }
});

// POST /api/noticias -- crear, solo admin
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const errors = validateNoticia(req.body);
  if (errors.length) return res.status(400).json({ ok: false, error: errors.join(' ') });
  try {
    const ia = resolverIaHerramientas(req.body);
    if (ia.error) return res.status(400).json({ ok: false, error: ia.error });
    let id = req.body.id ? slugify(req.body.id) : slugify(req.body.titulo);
    const { rows: dupe } = await pool.query('SELECT id FROM noticias WHERE id = $1', [id]);
    if (dupe.length) id = `${id}-${Date.now().toString(36)}`;

    const values = toRow(id, req.body);
    const { destacado } = resolverPublicadoYDestacado(req.body);
    const { rows } = await saveNoticia(
      id,
      destacado,
      values,
      `INSERT INTO noticias (id, titulo, fecha, fecha_display, imagen, imagen_alt, imagen_caption, clase, fuente_url, fuente_texto, parrafos, categoria, destacado, divulgacion_ia, publicado, idioma_original, ia_herramientas, fuentes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15,$16,$17::text[],$18::jsonb) RETURNING *`
    );
    res.status(201).json({ ok: true, noticia: rows[0] });
  } catch (err) { enviarError500(res, err); }
});

// PUT /api/noticias/:id -- editar, solo admin
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const errors = validateNoticia(req.body, { partial: true });
  if (errors.length) return res.status(400).json({ ok: false, error: errors.join(' ') });
  try {
    const { rows: existingRows } = await pool.query('SELECT * FROM noticias WHERE id = $1', [req.params.id]);
    if (existingRows.length === 0) return res.status(404).json({ ok: false, error: 'Noticia no encontrada.' });

    const ia = resolverIaHerramientas(req.body, existingRows[0]);
    if (ia.error) return res.status(400).json({ ok: false, error: ia.error });

    const values = toRow(req.params.id, req.body, existingRows[0]);
    const { destacado } = resolverPublicadoYDestacado(req.body, existingRows[0]);
    const { rows } = await saveNoticia(
      req.params.id,
      destacado,
      values,
      `UPDATE noticias SET titulo=$2, fecha=$3, fecha_display=$4, imagen=$5, imagen_alt=$6,
         imagen_caption=$7, clase=$8, fuente_url=$9, fuente_texto=$10, parrafos=$11::jsonb, categoria=$12,
         destacado=$13, divulgacion_ia=$14, publicado=$15, idioma_original=$16, ia_herramientas=$17::text[], fuentes=$18::jsonb
       WHERE id=$1 RETURNING *`
    );
    res.json({ ok: true, noticia: rows[0] });
  } catch (err) { enviarError500(res, err); }
});

// DELETE /api/noticias/:id -- solo admin
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    // Una sola sentencia: borra la noticia y sus comentarios y traducciones (no tienen
    // clave foranea), para que no queden huerfanos ni los herede otra pieza con el mismo slug.
    const { rowCount } = await pool.query(
      `WITH borrada AS (DELETE FROM noticias WHERE id = $1 RETURNING id),
            comentarios_borrados AS (DELETE FROM comentarios WHERE tipo = 'noticia' AND item_id = $1),
            traducciones_borradas AS (DELETE FROM traducciones WHERE tipo = 'noticia' AND item_id = $1)
       SELECT id FROM borrada`,
      [req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ ok: false, error: 'Noticia no encontrada.' });
    res.json({ ok: true });
  } catch (err) { enviarError500(res, err); }
});

module.exports = router;
