// Registro del gasto de IA por agente en `ia_generaciones`. Cada agente de la Brigada Coquí que usa IA deja su propia
// fila con su propio nombre, así el panel muestra cuánto gasta cada una (antes todas se sumaban a «redactor»).
// Nunca tumba la respuesta: si el registro falla, solo se pierde esa línea del tablero.
const AGENTES_CON_REGISTRO = [
  'investigador', 'redactor', 'traductor', 'clasificadora', 'resumidora', 'correctora', 'guardiana', 'pintora',
  'grieta', 'cazadora', 'contrapunto', 'farolera',
];
const FUENTES_TIPO = ['url', 'texto', 'notas'];

async function registrarUsoAgente(pool, { agente, fuenteTipo, usage, creadoPor }) {
  if (!AGENTES_CON_REGISTRO.includes(agente) || !FUENTES_TIPO.includes(fuenteTipo)) {
    console.error(`No se registró el uso de IA: agente o fuente no válidos (${agente}, ${fuenteTipo}).`);
    return;
  }
  try {
    await pool.query(
      `INSERT INTO ia_generaciones (agente, fuente_tipo, uso_busqueda_web, busquedas_realizadas, tokens_entrada, tokens_salida, costo_estimado_usd, creado_por)
       VALUES ($1,$2,false,0,$3,$4,$5,$6)`,
      [agente, fuenteTipo, usage.tokensEntrada || 0, usage.tokensSalida || 0, usage.costoEstimadoUsd || 0, creadoPor]
    );
  } catch (err) {
    console.error(`No se pudo registrar el uso de IA de ${agente}:`, err.message);
  }
}

module.exports = { registrarUsoAgente, AGENTES_CON_REGISTRO, FUENTES_TIPO };
