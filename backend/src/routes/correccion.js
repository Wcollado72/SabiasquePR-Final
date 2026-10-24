const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { corregirTexto } = require('../services/corrector');
const { validateCorreccion, validateCorreccionVarios } = require('../validators/correccion');

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
    console.error('No se pudo registrar el uso de IA del corrector:', err.message);
  }
}

// POST /api/admin/corregir -- solo admin. Devuelve el texto corregido y la lista de cambios; nunca guarda nada:
// el panel muestra los cambios y el admin decide si los aplica.
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const errors = validateCorreccion(req.body);
  if (errors.length) return res.status(400).json({ ok: false, error: errors.join(' ') });
  try {
    const { textoCorregido, cambios, usage } = await corregirTexto({ texto: req.body.texto, variante: req.body.variante });
    await registrarUso(usage, req.user.id);
    res.json({ ok: true, textoCorregido, cambios });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// POST /api/admin/corregir/varios -- solo admin. «Corregir todo» (Doña Tilde): corrige varios campos de una vez, cada uno
// con su variante de idioma, en lotes de 4 llamadas a la vez. Devuelve un resultado por campo (si uno falla, los demas
// siguen) y registra el costo sumado. Nunca guarda nada: el panel muestra los cambios y la persona decide.
const SIMULTANEAS = 4;
router.post('/varios', requireAuth, requireAdmin, async (req, res) => {
  const errors = validateCorreccionVarios(req.body);
  if (errors.length) return res.status(400).json({ ok: false, error: errors.join(' ') });
  const { items } = req.body;
  const total = { tokensEntrada: 0, tokensSalida: 0, costoEstimadoUsd: 0 };
  const resultados = [];
  for (let i = 0; i < items.length; i += SIMULTANEAS) {
    const lote = await Promise.all(items.slice(i, i + SIMULTANEAS).map(async (it) => {
      try {
        const r = await corregirTexto({ texto: it.texto, variante: it.variante });
        total.tokensEntrada += r.usage.tokensEntrada || 0;
        total.tokensSalida += r.usage.tokensSalida || 0;
        total.costoEstimadoUsd += r.usage.costoEstimadoUsd || 0;
        return { id: it.id, textoCorregido: r.textoCorregido, cambios: r.cambios };
      } catch (err) {
        return { id: it.id, error: err.message };
      }
    }));
    resultados.push(...lote);
  }
  // Si TODOS fallaron (p. ej. falta la llave de la IA) es un error de verdad; si solo fallaron algunos, se informa por campo.
  if (resultados.every((r) => r.error)) return res.status(400).json({ ok: false, error: resultados[0].error });
  await registrarUso(total, req.user.id);
  res.json({ ok: true, resultados });
});

module.exports = router;
