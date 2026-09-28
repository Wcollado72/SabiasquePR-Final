const express = require('express');
const { pool } = require('../db');
const { enviarError500 } = require('../util/errores');
const { requireAuth, requireAdmin, requireModerador } = require('../middleware/auth');
const { extraerArticulo } = require('../services/articleExtractor');
const { redactarDesdeArticulo } = require('../services/anthropic');
const { investigarDesdeUrl, investigarDesdeTexto } = require('../services/investigador');
const { redactarDesdeNotas } = require('../services/redactor');
const { traducirCampos } = require('../services/traductor');
const { validateTraduccion, TIPOS_VALIDOS, IDIOMAS_VALIDOS, CAMPOS_POR_TIPO } = require('../validators/traduccion');

const router = express.Router();

// Limites configurados en app.js (rate limiting) -- se muestran como dato de
// configuracion, no de uso en vivo: express-rate-limit usa un MemoryStore
// interno no expuesto fuera de app.js, asi que no hay forma honesta de leer
// "uso actual %" sin instrumentar un store custom (fuera de alcance hoy).
const RATE_LIMIT_CONFIG = { general: 300, escritura: 20, ventanaMin: 15 };
const COOLDOWN_HORAS_CUENTA_NUEVA = 1;

// GET /api/admin/estado-seguridad -- admin o moderador. Solo devuelve datos
// que se pueden calcular de verdad hoy (ver comentarios de cada campo) --
// nunca numeros de ejemplo/inventados.
router.get('/estado-seguridad', requireAuth, requireModerador, async (req, res) => {
  try {
    const [cooldown, edad] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS n FROM perfiles WHERE creado_en > now() - interval '${COOLDOWN_HORAS_CUENTA_NUEVA} hour'`),
      pool.query('SELECT COUNT(*)::int AS n FROM perfiles WHERE edad_confirmada = true'),
    ]);
    res.json({
      ok: true,
      cooldownActivos: cooldown.rows[0].n,
      cooldownHoras: COOLDOWN_HORAS_CUENTA_NUEVA,
      edadConfirmadasTotal: edad.rows[0].n,
      turnstileActivo: Boolean(process.env.TURNSTILE_SECRET_KEY),
      rateLimitConfig: RATE_LIMIT_CONFIG,
    });
  } catch (err) { enviarError500(res, err); }
});

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

// Registra cada llamada a los agentes de IA de contenido con el costo REAL
// reportado por la API (nunca un estimado de antemano) -- alimenta el tile
// de gasto en el dashboard de Agentes.
async function registrarUsoIa({ agente, fuenteTipo, usarBusquedaWeb, usage, creadoPor }) {
  try {
    await pool.query(
      `INSERT INTO ia_generaciones (agente, fuente_tipo, uso_busqueda_web, busquedas_realizadas, tokens_entrada, tokens_salida, costo_estimado_usd, creado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        agente, fuenteTipo, Boolean(usarBusquedaWeb), usage.busquedasRealizadas || 0,
        usage.tokensEntrada || 0, usage.tokensSalida || 0, usage.costoEstimadoUsd || 0, creadoPor,
      ]
    );
  } catch (err) {
    // No tumbar la respuesta al admin por un fallo al loguear el gasto --
    // solo se pierde visibilidad de esa llamada puntual en el dashboard.
    console.error('No se pudo registrar el uso de IA:', err.message);
  }
}

// POST /api/admin/investigar -- solo admin. Recibe { url } o { texto,
// tituloSugerido }, mas usarBusquedaWeb. Nunca guarda contenido, solo notas
// para que el admin revise antes de redactar.
router.post('/investigar', requireAuth, requireAdmin, async (req, res) => {
  const { url, texto, tituloSugerido, usarBusquedaWeb, instrucciones, tono, respuestas } = req.body || {};
  if (!url && !texto) {
    return res.status(400).json({ ok: false, error: 'Falta la URL o el texto de la fuente.' });
  }
  try {
    const opciones = { usarBusquedaWeb: Boolean(usarBusquedaWeb), instrucciones, tono, respuestas };
    const resultado = url
      ? await investigarDesdeUrl(url, opciones)
      : await investigarDesdeTexto(texto, { tituloSugerido, ...opciones });

    await registrarUsoIa({
      agente: 'investigador',
      fuenteTipo: resultado.fuenteTipo,
      usarBusquedaWeb: Boolean(usarBusquedaWeb),
      usage: resultado.usage,
      creadoPor: req.user.id,
    });

    res.json({
      ok: true,
      notas: resultado.notas,
      tituloOriginal: resultado.tituloOriginal,
      fuenteTexto: resultado.fuenteTexto,
      fuenteUrl: resultado.fuenteUrl,
      citaAutor: resultado.citaAutor,
      citaAnio: resultado.citaAnio,
      citaEstiloSugerido: resultado.citaEstiloSugerido,
      idiomaDetectado: resultado.idiomaDetectado || '',
      textoCorregido: resultado.textoCorregido || '',
      correcciones: resultado.correcciones || [],
      preguntas: resultado.preguntas || [],
    });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// POST /api/admin/redactar -- solo admin. Recibe las notas (ya revisadas
// por el admin) mas la clasificacion que el admin ya eligio en el
// formulario -- el Redactor nunca adivina seccion/subseccion/categoria.
router.post('/redactar', requireAuth, requireAdmin, async (req, res) => {
  const { notas, seccion, subseccion, categoria, tipoFormato, estilo, tono, idioma, fuenteTexto, fuenteUrl } = req.body || {};
  if (!notas || typeof notas !== 'string') {
    return res.status(400).json({ ok: false, error: 'Faltan las notas de investigación.' });
  }
  try {
    const redactado = await redactarDesdeNotas({ notas, seccion, subseccion, categoria, tipoFormato, estilo, tono, idioma, fuenteTexto, fuenteUrl });

    await registrarUsoIa({
      agente: 'redactor',
      fuenteTipo: 'notas',
      usarBusquedaWeb: false,
      usage: redactado.usage,
      creadoPor: req.user.id,
    });

    res.json({
      ok: true,
      titulo: redactado.titulo,
      subtituloResumen: redactado.subtituloResumen,
      parrafos: redactado.parrafos,
      duracionMinEstimado: redactado.duracionMinEstimado,
    });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// GET /api/admin/uso-ia -- admin o moderador (es solo lectura de gasto, no
// gestion de contenido). Agrega ia_generaciones para el tile del dashboard.
router.get('/uso-ia', requireAuth, requireModerador, async (req, res) => {
  try {
    const [totales, mes, ultimas] = await Promise.all([
      pool.query(`SELECT agente, COUNT(*)::int AS llamadas, COALESCE(SUM(costo_estimado_usd), 0)::float AS costo_total
                  FROM ia_generaciones GROUP BY agente`),
      pool.query(`SELECT COALESCE(SUM(costo_estimado_usd), 0)::float AS costo_mes
                  FROM ia_generaciones WHERE creado_en >= date_trunc('month', now())`),
      pool.query(`SELECT agente, fuente_tipo, uso_busqueda_web, costo_estimado_usd, creado_en
                  FROM ia_generaciones ORDER BY creado_en DESC LIMIT 10`),
    ]);
    res.json({
      ok: true,
      porAgente: totales.rows,
      costoMesActual: mes.rows[0].costo_mes,
      ultimas: ultimas.rows,
    });
  } catch (err) { enviarError500(res, err); }
});

// ── TRADUCCIONES (Fase C2) ──────────────────────────────────
// El nombre de la tabla sale de este mapa (nunca del request) para que el
// tipo que manda el cliente no pueda inyectar SQL.
const TABLA_POR_TIPO = { noticia: 'noticias', contenido: 'contenidos', producto: 'productos' };

async function cargarPieza(tipo, id) {
  const { rows } = await pool.query(`SELECT * FROM ${TABLA_POR_TIPO[tipo]} WHERE id = $1`, [id]);
  return rows[0] || null;
}

function idiomaOriginalDe(pieza) {
  return pieza.idioma_original === 'en' ? 'en' : 'es';
}

// Extrae de la fila guardada solo los campos traducibles del tipo.
function camposDePieza(tipo, pieza) {
  const campos = {};
  for (const nombre of Object.keys(CAMPOS_POR_TIPO[tipo])) {
    if (pieza[nombre] !== undefined && pieza[nombre] !== null) campos[nombre] = pieza[nombre];
  }
  return campos;
}

function tipoValido(res, tipo) {
  if (TIPOS_VALIDOS.includes(tipo)) return true;
  res.status(400).json({ ok: false, error: 'Tipo de contenido no valido.' });
  return false;
}

// GET /api/admin/traducciones/:tipo/:id -- traducciones guardadas de una pieza
router.get('/traducciones/:tipo/:id', requireAuth, requireAdmin, async (req, res) => {
  const { tipo, id } = req.params;
  if (!tipoValido(res, tipo)) return;
  try {
    const pieza = await cargarPieza(tipo, id);
    if (!pieza) return res.status(404).json({ ok: false, error: 'Contenido no encontrado.' });
    const { rows } = await pool.query(
      'SELECT idioma, campos, actualizado_en FROM traducciones WHERE tipo = $1 AND item_id = $2',
      [tipo, id]
    );
    res.json({
      ok: true,
      idiomaOriginal: idiomaOriginalDe(pieza),
      traducciones: Object.fromEntries(rows.map((r) => [r.idioma, { campos: r.campos, actualizadoEn: r.actualizado_en }])),
    });
  } catch (err) { enviarError500(res, err); }
});

// PUT /api/admin/traducciones/:tipo/:id/:idioma -- guardar (crear o reemplazar)
router.put('/traducciones/:tipo/:id/:idioma', requireAuth, requireAdmin, async (req, res) => {
  const { tipo, id, idioma } = req.params;
  const { errors, campos } = validateTraduccion(tipo, idioma, req.body && req.body.campos);
  if (errors.length) return res.status(400).json({ ok: false, error: errors.join(' ') });
  try {
    const pieza = await cargarPieza(tipo, id);
    if (!pieza) return res.status(404).json({ ok: false, error: 'Contenido no encontrado.' });
    if (idiomaOriginalDe(pieza) === idioma) {
      return res.status(400).json({ ok: false, error: 'Ese ya es el idioma original de la pieza; edita la pieza directamente.' });
    }
    await pool.query(
      `INSERT INTO traducciones (tipo, item_id, idioma, campos, actualizado_por)
       VALUES ($1,$2,$3,$4::jsonb,$5)
       ON CONFLICT (tipo, item_id, idioma)
       DO UPDATE SET campos = EXCLUDED.campos, actualizado_en = now(), actualizado_por = EXCLUDED.actualizado_por`,
      [tipo, id, idioma, JSON.stringify(campos), req.user.id]
    );
    res.json({ ok: true, campos });
  } catch (err) { enviarError500(res, err); }
});

// DELETE /api/admin/traducciones/:tipo/:id/:idioma
router.delete('/traducciones/:tipo/:id/:idioma', requireAuth, requireAdmin, async (req, res) => {
  const { tipo, id, idioma } = req.params;
  if (!tipoValido(res, tipo)) return;
  if (!IDIOMAS_VALIDOS.includes(idioma)) return res.status(400).json({ ok: false, error: 'Idioma no valido.' });
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM traducciones WHERE tipo = $1 AND item_id = $2 AND idioma = $3',
      [tipo, id, idioma]
    );
    if (rowCount === 0) return res.status(404).json({ ok: false, error: 'No hay traduccion guardada en ese idioma.' });
    res.json({ ok: true });
  } catch (err) { enviarError500(res, err); }
});

// POST /api/admin/traducir -- solo admin. Genera un BORRADOR de traduccion con
// el agente Traductor; nunca guarda nada -- el admin revisa y luego usa el PUT.
// Recibe { tipo, idiomaDestino, campos } (lo que hay en el formulario) o
// { tipo, id, idiomaDestino } para traducir lo ya guardado. Si viene `id`, el
// idioma de origen es el idioma original de la pieza; si no, `idiomaOrigen`.
router.post('/traducir', requireAuth, requireAdmin, async (req, res) => {
  const { tipo, id, idiomaDestino } = req.body || {};
  if (!tipoValido(res, tipo)) return;
  if (!IDIOMAS_VALIDOS.includes(idiomaDestino)) {
    return res.status(400).json({ ok: false, error: 'Idioma de destino no valido (es / en).' });
  }
  try {
    let idiomaOrigen = req.body.idiomaOrigen;
    let camposEntrada = req.body.campos;
    if (id) {
      const pieza = await cargarPieza(tipo, id);
      if (!pieza) return res.status(404).json({ ok: false, error: 'Contenido no encontrado.' });
      idiomaOrigen = idiomaOriginalDe(pieza);
      if (!camposEntrada) camposEntrada = camposDePieza(tipo, pieza);
    }
    if (!IDIOMAS_VALIDOS.includes(idiomaOrigen)) {
      return res.status(400).json({ ok: false, error: 'Falta el idioma de origen (es / en).' });
    }
    if (idiomaOrigen === idiomaDestino) {
      return res.status(400).json({ ok: false, error: 'El idioma de origen y el de destino son el mismo.' });
    }
    const { errors, campos } = validateTraduccion(tipo, idiomaOrigen, camposEntrada);
    if (errors.length) return res.status(400).json({ ok: false, error: errors.join(' ') });

    const traducido = await traducirCampos({ tipo, campos, idiomaOrigen, idiomaDestino });
    await registrarUsoIa({
      agente: 'traductor', fuenteTipo: 'texto', usarBusquedaWeb: false, usage: traducido.usage, creadoPor: req.user.id,
    });
    res.json({ ok: true, campos: traducido.campos, idiomaOrigen, idiomaDestino });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

module.exports = router;
