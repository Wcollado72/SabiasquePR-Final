// Llama a la API de Claude (Anthropic) directamente via fetch -- sin SDK,
// para no agregar una dependencia mas de lo necesario. Requiere
// ANTHROPIC_API_KEY en las variables de entorno del backend (nunca se
// expone al navegador).
const MODEL = 'claude-sonnet-5';
const API_URL = 'https://api.anthropic.com/v1/messages';

const HERRAMIENTA = {
  name: 'redactar_articulo',
  description: 'Entrega los datos estructurados del articulo listo para publicar.',
  input_schema: {
    type: 'object',
    properties: {
      titulo: { type: 'string', description: 'Titular en español, puede ajustarse del original pero debe ser preciso.' },
      resumen: { type: 'string', description: 'Resumen editorial de 2-3 oraciones, en español, redaccion 100% original (no traduccion literal).' },
      parrafos: {
        type: 'array',
        items: { type: 'string' },
        description: 'Cuerpo del articulo en español, 3-6 parrafos cortos, redaccion 100% original que explica y contextualiza el tema -- nunca una traduccion ni copia del texto fuente.',
      },
      fuenteTexto: { type: 'string', description: 'Nombre del medio, canal o autor original de la fuente.' },
    },
    required: ['titulo', 'resumen', 'parrafos', 'fuenteTexto'],
  },
};

async function redactarDesdeArticulo({ titulo, texto, sitio, autor }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY no esta configurada en el servidor.');

  const prompt = `Eres redactor editorial de "Sabías que PR", un sitio de noticias y curiosidades en español para audiencia de Puerto Rico y Latinoamérica.

Te doy el texto extraído de un artículo original (puede estar en cualquier idioma). Tu trabajo:
1. Escribe TODO en español, con redacción propia y original -- nunca traduzcas ni copies frases del original (es una fuente externa, hay que evitar plagio/derechos de autor).
2. Sé preciso con los hechos, pero cuéntalos con tu propia voz editorial, clara y directa.
3. Formato de NOTICIA CORTA, no de ensayo ni artículo enciclopédico: resumen de 2-3 oraciones, y máximo 3-4 párrafos breves (2-4 oraciones cada uno). Prioriza lo más relevante y noticioso del tema -- no intentes cubrir todo el artículo original, es un resumen, no una traducción completa.
4. El resumen y los párrafos deben poder publicarse tal cual, sin necesitar traducción ni edición adicional.

Sitio de origen: ${sitio || 'desconocido'}
Autor/fuente: ${autor || 'no especificado'}
Título original: ${titulo || '(sin título)'}

Texto del artículo:
"""
${texto}
"""

Usa la herramienta "redactar_articulo" para entregar el resultado.`;

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
      tool_choice: { type: 'tool', name: 'redactar_articulo' },
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error?.message || `Error de la API de Claude (HTTP ${res.status}).`);
  }
  if (data.stop_reason === 'max_tokens') {
    throw new Error('El artículo es demasiado largo para redactarlo de una vez. Intenta con uno más corto.');
  }

  const toolUse = (data.content || []).find((b) => b.type === 'tool_use' && b.name === 'redactar_articulo');
  if (!toolUse || !Array.isArray(toolUse.input?.parrafos)) {
    throw new Error('Claude no devolvió el formato esperado.');
  }

  return toolUse.input;
}

module.exports = { redactarDesdeArticulo };
