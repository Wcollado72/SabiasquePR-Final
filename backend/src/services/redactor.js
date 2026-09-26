// Agente "Redactor": segunda etapa del asistente de redaccion con IA para
// Contenidos. Toma las notas del Investigador (ya revisadas/editadas por el
// admin) y redacta el borrador final -- el admin ya eligio seccion,
// sub-seccion, enfoque y categoria en el formulario, asi que el Redactor
// NUNCA tiene que adivinar la clasificacion, solo el tono de redaccion
// segun esa clasificacion. Mismo patron de fetch crudo que anthropic.js.
const MODEL = 'claude-sonnet-5';
const API_URL = 'https://api.anthropic.com/v1/messages';
const PRECIO_ENTRADA_POR_MTOK = 2;  // Sonnet 5
const PRECIO_SALIDA_POR_MTOK = 10;  // Sonnet 5

// Tono por tipo de contenido -- decision ya aprobada por el usuario (no un
// solo tono generico). "logica-humana" queda FUERA a proposito: es la voz
// personal de Aliado Imperfekto, no algo que un agente generico deba imitar.
const TONOS = {
  noticias: 'Formato de NOTICIA CORTA: resumen de 2-3 oraciones y máximo 3-4 párrafos breves (2-4 oraciones cada uno). Tono neutral y directo, prioriza lo más relevante y noticioso.',
  'revolucion-humana:nuevos-humanos': 'Tono esperanzador y humano, sin caer en lo ingenuo -- celebra lo que la humanidad está logrando bien, con hechos concretos, no frases vacías de optimismo.',
  'revolucion-humana:corrupcion-humana': 'Tono directo y crítico, sin eufemismos -- nombra el fallo institucional o individual con claridad, respaldado en hechos, sin sensacionalismo barato.',
  'revolucion-humana:revolucion-mundial': 'Tono analítico, con perspectiva global -- conecta el tema con su contexto internacional más amplio.',
  educacion: 'Tono informativo y claro, como si le explicaras el tema a alguien inteligente pero sin conocimiento previo del asunto -- prioriza la precisión sobre el estilo.',
  default: 'Tono editorial claro y directo, con redacción propia y original.',
};

function elegirTono({ seccion, subseccion }) {
  if (subseccion) {
    const clave = `${seccion}:${subseccion}`;
    if (TONOS[clave]) return TONOS[clave];
  }
  if (TONOS[seccion]) return TONOS[seccion];
  return TONOS.default;
}

const HERRAMIENTA = {
  name: 'redactar_contenido',
  description: 'Entrega el borrador redactado, listo para revisión.',
  input_schema: {
    type: 'object',
    properties: {
      titulo: { type: 'string', description: 'Titular en español, claro y preciso.' },
      subtituloResumen: { type: 'string', description: 'Resumen editorial de 2-3 oraciones, en español, redacción 100% original.' },
      parrafos: {
        type: 'array',
        items: { type: 'string' },
        description: 'Cuerpo del contenido en español, redacción 100% original -- nunca traducción ni copia de las notas fuente.',
      },
      duracionMinEstimado: { type: 'integer', description: 'Minutos estimados de lectura del resultado (entero, mínimo 1).' },
    },
    required: ['titulo', 'subtituloResumen', 'parrafos', 'duracionMinEstimado'],
  },
};

function calcularCosto(usage) {
  const entrada = (usage?.input_tokens || 0) * PRECIO_ENTRADA_POR_MTOK / 1_000_000;
  const salida = (usage?.output_tokens || 0) * PRECIO_SALIDA_POR_MTOK / 1_000_000;
  return entrada + salida;
}

async function redactarDesdeNotas({ notas, seccion, subseccion, categoria, tipoFormato, fuenteTexto, fuenteUrl }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY no esta configurada en el servidor.');
  if (!notas || notas.trim().length < 20) {
    throw new Error('Las notas de investigación son muy cortas para redactar. Revisa el paso del Investigador primero.');
  }

  const tono = elegirTono({ seccion, subseccion });
  const prompt = `Eres redactor editorial de "Sabías que PR", un sitio de noticias y análisis en español para audiencia de Puerto Rico y Latinoamérica.

Te doy notas de investigación ya organizadas sobre un tema. Tu trabajo:
1. Escribe TODO en español, con redacción propia y original -- nunca copies ni traduzcas literalmente las notas.
2. Sé preciso con los hechos de las notas, pero cuéntalos con tu propia voz editorial.
3. ${tono}
4. El resumen y los párrafos deben poder publicarse tal cual, sin necesitar edición adicional de fondo (el admin solo revisa, no reescribe).

Sección: ${seccion || 'no especificada'}${subseccion ? ` / ${subseccion}` : ''}
Formato: ${tipoFormato || 'no especificado'}${categoria ? ` · Categoría: ${categoria}` : ''}
Fuente: ${fuenteTexto || 'no especificada'}${fuenteUrl ? ` (${fuenteUrl})` : ''}

Notas de investigación:
"""
${notas}
"""

Usa la herramienta "redactar_contenido" para entregar el resultado.`;

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8192,
      tools: [HERRAMIENTA],
      tool_choice: { type: 'tool', name: 'redactar_contenido' },
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error?.message || `Error de la API de Claude (HTTP ${res.status}).`);
  }
  if (data.stop_reason === 'max_tokens') {
    throw new Error('El contenido a redactar es demasiado largo. Intenta con notas más cortas.');
  }

  const toolUse = (data.content || []).find((b) => b.type === 'tool_use' && b.name === 'redactar_contenido');
  if (!toolUse || !Array.isArray(toolUse.input?.parrafos)) {
    throw new Error('Claude no devolvió el formato esperado.');
  }

  return {
    ...toolUse.input,
    usage: {
      tokensEntrada: data.usage?.input_tokens || 0,
      tokensSalida: data.usage?.output_tokens || 0,
      costoEstimadoUsd: calcularCosto(data.usage),
    },
  };
}

module.exports = { redactarDesdeNotas, elegirTono, calcularCosto };
