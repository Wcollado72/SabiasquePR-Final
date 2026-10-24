const crypto = require('crypto');
const express = require('express');
const { pool } = require('../db');
const { enviarError500 } = require('../util/errores');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { registrarUsoAgente } = require('../util/usoIa');
const { analizarSemilla } = require('../services/grieta');
const { cazarEcos } = require('../services/cazadora');
const { hacerContrapunto } = require('../services/contrapunto');
const { validateSemilla, normalizarEtiquetas, esUuid } = require('../validators/semilla');

const router = express.Router();

// Todo el Taller es de la persona que escribe (Aliado Imperfekto): solo admin, y cada quien ve SOLO sus semillas.
router.use(requireAuth, requireAdmin);

// Agentes que ya trabajan en el Taller (el nombre es el de la clave dentro de `analisis` y de la bitacora de uso).
// La Cazadora tambien recibe lo que ya se sabe de la idea (la tesis que saco La Grieta) para buscar mejor.
const AGENTES_DEL_TALLER = {
  grieta: { analizar: analizarSemilla, fuenteTipo: 'texto' },
  contrapunto: { analizar: hacerContrapunto, fuenteTipo: 'texto' },
  cazadora: { analizar: cazarEcos, fuenteTipo: 'texto' },
};

const hashTexto = (texto) => crypto.createHash('sha1').update(String(texto)).digest('hex').slice(0, 16);

// Marca los analisis hechos sobre una version anterior del texto (la idea cambio despues).
function conDesactualizados(fila) {
  const hash = hashTexto(fila.texto);
  const desactualizados = Object.entries(fila.analisis || {}).filter(([, a]) => a && a.texto_hash !== hash).map(([nombre]) => nombre);
  return { ...fila, desactualizados };
}

const COLUMNAS = 'id, titulo, texto, etiquetas, estado, analisis, desarrollos, contenido_id, creado_en, actualizado_en';

// GET /api/semillas?estado= -- lista (con un extracto del texto, no el texto completo)
router.get('/', async (req, res) => {
  try {
    const params = [req.user.id];
    let filtro = '';
    if (req.query.estado) { params.push(String(req.query.estado)); filtro = 'AND estado = $2'; }
    const { rows } = await pool.query(
      `SELECT id, titulo, left(texto, 240) AS extracto, etiquetas, estado, contenido_id, creado_en, actualizado_en,
              ARRAY(SELECT jsonb_object_keys(analisis)) AS agentes_que_la_analizaron
       FROM semillas WHERE autor_id = $1 ${filtro} ORDER BY actualizado_en DESC LIMIT 200`,
      params
    );
    res.json({ ok: true, semillas: rows });
  } catch (err) { enviarError500(res, err); }
});

// GET /api/semillas/:id -- una semilla completa, con sus analisis
router.get('/:id', async (req, res) => {
  if (!esUuid(req.params.id)) return res.status(404).json({ ok: false, error: 'Semilla no encontrada.' });
  try {
    const { rows } = await pool.query(`SELECT ${COLUMNAS} FROM semillas WHERE id = $1 AND autor_id = $2`, [req.params.id, req.user.id]);
    if (!rows.length) return res.status(404).json({ ok: false, error: 'Semilla no encontrada.' });
    res.json({ ok: true, semilla: conDesactualizados(rows[0]) });
  } catch (err) { enviarError500(res, err); }
});

// POST /api/semillas -- crear
router.post('/', async (req, res) => {
  const errors = validateSemilla(req.body);
  if (errors.length) return res.status(400).json({ ok: false, error: errors.join(' ') });
  try {
    const { titulo, texto, etiquetas } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO semillas (autor_id, titulo, texto, etiquetas) VALUES ($1, $2, $3, $4::text[]) RETURNING ${COLUMNAS}`,
      [req.user.id, (titulo || '').trim(), texto.trim(), normalizarEtiquetas(etiquetas)]
    );
    res.status(201).json({ ok: true, semilla: conDesactualizados(rows[0]) });
  } catch (err) { enviarError500(res, err); }
});

// PUT /api/semillas/:id -- editar (solo lo que se manda)
router.put('/:id', async (req, res) => {
  if (!esUuid(req.params.id)) return res.status(404).json({ ok: false, error: 'Semilla no encontrada.' });
  const errors = validateSemilla(req.body, { parcial: true });
  if (errors.length) return res.status(400).json({ ok: false, error: errors.join(' ') });
  try {
    const { rows: actual } = await pool.query('SELECT titulo, texto, etiquetas, estado FROM semillas WHERE id = $1 AND autor_id = $2', [req.params.id, req.user.id]);
    if (!actual.length) return res.status(404).json({ ok: false, error: 'Semilla no encontrada.' });
    const b = req.body;
    const { rows } = await pool.query(
      `UPDATE semillas SET titulo = $3, texto = $4, etiquetas = $5::text[], estado = $6, actualizado_en = now()
       WHERE id = $1 AND autor_id = $2 RETURNING ${COLUMNAS}`,
      [
        req.params.id, req.user.id,
        b.titulo !== undefined ? b.titulo.trim() : actual[0].titulo,
        b.texto !== undefined ? b.texto.trim() : actual[0].texto,
        b.etiquetas !== undefined ? normalizarEtiquetas(b.etiquetas) : actual[0].etiquetas,
        b.estado !== undefined ? b.estado : actual[0].estado,
      ]
    );
    res.json({ ok: true, semilla: conDesactualizados(rows[0]) });
  } catch (err) { enviarError500(res, err); }
});

// DELETE /api/semillas/:id -- borrar la semilla (la pieza de Contenidos que haya salido de ella NO se toca)
router.delete('/:id', async (req, res) => {
  if (!esUuid(req.params.id)) return res.status(404).json({ ok: false, error: 'Semilla no encontrada.' });
  try {
    const { rowCount } = await pool.query('DELETE FROM semillas WHERE id = $1 AND autor_id = $2', [req.params.id, req.user.id]);
    if (rowCount === 0) return res.status(404).json({ ok: false, error: 'Semilla no encontrada.' });
    res.json({ ok: true });
  } catch (err) { enviarError500(res, err); }
});

// POST /api/semillas/:id/agentes/:agente -- una agente del Taller trabaja sobre la semilla. Guarda su resultado en
// `analisis` (con el hash del texto que leyo) y pasa la semilla de «semilla» a «explorada». Nunca cambia el texto del autor.
router.post('/:id/agentes/:agente', async (req, res) => {
  if (!esUuid(req.params.id)) return res.status(404).json({ ok: false, error: 'Semilla no encontrada.' });
  const agente = AGENTES_DEL_TALLER[req.params.agente];
  if (!agente) return res.status(404).json({ ok: false, error: 'Esa agente todavía no trabaja en el Taller.' });
  try {
    const { rows } = await pool.query('SELECT titulo, texto, analisis FROM semillas WHERE id = $1 AND autor_id = $2', [req.params.id, req.user.id]);
    if (!rows.length) return res.status(404).json({ ok: false, error: 'Semilla no encontrada.' });

    let resultado;
    try {
      resultado = await agente.analizar({ titulo: rows[0].titulo, texto: rows[0].texto, analisis: rows[0].analisis });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
    await registrarUsoAgente(pool, { agente: req.params.agente, fuenteTipo: agente.fuenteTipo, usage: resultado.usage, creadoPor: req.user.id });

    const entrada = { resultado: resultado.resultado, texto_hash: hashTexto(rows[0].texto), creado_en: new Date().toISOString() };
    const { rows: guardada } = await pool.query(
      `UPDATE semillas SET analisis = jsonb_set(analisis, ARRAY[$3]::text[], $4::jsonb),
                          estado = CASE WHEN estado = 'semilla' THEN 'explorada' ELSE estado END, actualizado_en = now()
       WHERE id = $1 AND autor_id = $2 RETURNING estado`,
      [req.params.id, req.user.id, req.params.agente, JSON.stringify(entrada)]
    );
    res.json({ ok: true, agente: req.params.agente, analisis: entrada, estado: guardada[0] ? guardada[0].estado : 'explorada' });
  } catch (err) { enviarError500(res, err); }
});

module.exports = router;
