// Llamada minima a la API de Claude con "uso forzado de herramienta": Claude solo puede responder llamando a la
// herramienta indicada, asi la salida llega siempre como datos estructurados y no como texto libre.
// Compartido por los agentes cortos y baratos (corrector, resumidor). Mismo patron de fetch crudo (sin SDK)
// que traductor.js.
const API_URL = 'https://api.anthropic.com/v1/messages';

// Precios estimados por millon de tokens (Haiku por defecto); el costo real sale del `usage` que devuelve la API.
// Los agentes que usan otro modelo (p. ej. Sonnet) pasan sus propios precios.
const PRECIOS_HAIKU = { entrada: 1, salida: 5 };

function calcularCosto(usage, precios = PRECIOS_HAIKU) {
  return ((usage?.input_tokens || 0) * precios.entrada + (usage?.output_tokens || 0) * precios.salida) / 1_000_000;
}

async function llamarHerramienta({ modelo, maxTokens, herramienta, prompt, precios = PRECIOS_HAIKU }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY no esta configurada en el servidor.');

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: modelo,
      max_tokens: maxTokens,
      tools: [herramienta],
      tool_choice: { type: 'tool', name: herramienta.name },
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || `Error de la API de Claude (HTTP ${res.status}).`);
  if (data.stop_reason === 'max_tokens') throw new Error('El texto es demasiado largo para procesar de una vez.');
  const toolUse = (data.content || []).find((b) => b.type === 'tool_use' && b.name === herramienta.name);
  if (!toolUse) throw new Error('Claude no devolvió el resultado. Intenta de nuevo.');

  return {
    entrada: toolUse.input,
    usage: {
      tokensEntrada: data.usage?.input_tokens || 0,
      tokensSalida: data.usage?.output_tokens || 0,
      costoEstimadoUsd: calcularCosto(data.usage, precios),
    },
  };
}

module.exports = { llamarHerramienta, calcularCosto };
