// Agente "Redactor": segunda etapa del asistente de redaccion con IA para
// Contenidos. Toma las notas del Investigador (ya revisadas/editadas por el
// admin) y redacta el borrador final -- el admin ya eligio seccion,
// sub-seccion, enfoque y categoria en el formulario, asi que el Redactor
// NUNCA tiene que adivinar la clasificacion. El tono y el estilo de
// redaccion son ejes independientes de la clasificacion, elegidos a mano en
// el formulario (ver TONOS/ESTILOS_REDACCION abajo) -- no se derivan de la
// seccion, para poder redactar las mismas notas con voces/estructuras
// distintas sin tener que investigar de nuevo. Mismo patron de fetch crudo
// que anthropic.js.
const MODEL = 'claude-sonnet-5';
const API_URL = 'https://api.anthropic.com/v1/messages';
const PRECIO_ENTRADA_POR_MTOK = 2;  // Sonnet 5
const PRECIO_SALIDA_POR_MTOK = 10;  // Sonnet 5

// Tono de redaccion -- eje independiente de la seccion/subseccion (ver
// ESTILOS_REDACCION abajo para la estructura). El admin lo elige en el
// selector "Tono" del formulario; "editorial" es el valor por defecto si no
// elige ninguno. "logica-humana" no tiene entrada aqui a proposito: es la
// voz personal de Aliado Imperfekto, no algo que un agente generico redacte.
const TONOS = {
  esperanzador: 'Tono esperanzador y humano, sin caer en lo ingenuo -- celebra lo que la humanidad está logrando bien, con hechos concretos, no frases vacías de optimismo.',
  critico: 'Tono directo y crítico, sin eufemismos -- nombra el fallo institucional o individual con claridad, respaldado en hechos, sin sensacionalismo barato.',
  analitico: 'Tono analítico, con perspectiva global -- conecta el tema con su contexto internacional más amplio.',
  informativo: 'Tono informativo y claro, como si le explicaras el tema a alguien inteligente pero sin conocimiento previo del asunto -- prioriza la precisión sobre el estilo.',
  neutral: 'Tono neutral y directo -- prioriza los hechos más relevantes, sin adornos ni opinión personal.',
  editorial: 'Tono editorial claro y directo, con redacción propia y original.',
};

function elegirTono(tono) {
  return TONOS[tono] || TONOS.editorial;
}

// Estilo de redaccion -- eje independiente del tono de seccion de arriba.
// El tono dice CON QUE VOZ/POSTURA se escribe (segun la seccion); esto dice
// QUE ESTRUCTURA tiene el resultado (segun lo que el admin pida en el
// selector "Estilo de redaccion" del formulario), para que las mismas notas
// del Investigador se puedan redactar como ensayo, noticia corta,
// investigacion u opinion sin tener que investigar de nuevo.
const ESTILOS_REDACCION = {
  ensayo: 'Formato ENSAYO: desarrollo reflexivo y argumentado, varios párrafos que conectan el hecho con su contexto o significado más amplio -- no es un resumen de los hechos, es una reflexión a partir de ellos.',
  noticia: 'Formato NOTICIA CORTA: resumen de 2-3 oraciones y máximo 3-4 párrafos breves (2-4 oraciones cada uno) -- solo los hechos verificables de las notas, en orden de importancia, sin interpretación personal.',
  investigacion: 'Formato INVESTIGACIÓN: estructura de reportaje extendido -- expón el hecho central, después el contexto/antecedentes, y cierra con las implicaciones o lo que queda sin resolver. Más párrafos que una noticia corta, con más detalle de las notas.',
  opinion: 'Formato OPINIÓN: primera persona editorial, argumenta una postura clara sobre el tema a partir de los hechos de las notas -- dile al lector qué pensar y por qué, sin fingir neutralidad.',
};

// Idioma en que se redacta el resultado. El sitio publica en espanol e
// ingles; las notas del Investigador siempre vienen en espanol.
const IDIOMAS_REDACCION = {
  es: 'español (natural para Puerto Rico y Latinoamérica)',
  en: 'inglés (American English, natural y claro)',
};

function elegirIdioma(idioma) {
  return IDIOMAS_REDACCION[idioma] || IDIOMAS_REDACCION.es;
}

function elegirEstructura(estilo) {
  return ESTILOS_REDACCION[estilo] || ESTILOS_REDACCION.ensayo;
}

const HERRAMIENTA = {
  name: 'redactar_contenido',
  description: 'Entrega el borrador redactado, listo para revisión.',
  input_schema: {
    type: 'object',
    properties: {
      titulo: { type: 'string', description: 'Titular en el idioma de redacción indicado, claro y preciso.' },
      subtituloResumen: { type: 'string', description: 'Resumen editorial de 2-3 oraciones, en el idioma de redacción indicado, redacción 100% original.' },
      parrafos: {
        type: 'array',
        items: { type: 'string' },
        description: 'Cuerpo del contenido en el idioma de redacción indicado, redacción 100% original -- nunca traducción literal ni copia de las notas fuente.',
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

async function redactarDesdeNotas({ notas, seccion, subseccion, categoria, tipoFormato, estilo, tono: tonoElegido, idioma, fuenteTexto, fuenteUrl }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY no esta configurada en el servidor.');
  if (!notas || notas.trim().length < 20) {
    throw new Error('Las notas de investigación son muy cortas para redactar. Revisa el paso del Investigador primero.');
  }

  const tono = elegirTono(tonoElegido);
  const estructura = elegirEstructura(estilo);
  const idiomaNombre = elegirIdioma(idioma);
  const prompt = `Eres redactor editorial de "Sabías que PR", un sitio de noticias y análisis en español para audiencia de Puerto Rico y Latinoamérica.

Te doy notas de investigación ya organizadas sobre un tema. Tu trabajo:
1. Escribe TODO en ${idiomaNombre}, con redacción propia y original -- nunca copies ni traduzcas literalmente las notas. Mantén en su idioma original los nombres propios y las citas textuales importantes (con traducción entre paréntesis si hace falta). Si corriges algo, no pierdas el sentido ni el tono pedido.
2. Sé preciso con los hechos de las notas, pero cuéntalos con tu propia voz editorial.
3. ${tono}
4. ${estructura}
5. El resumen y los párrafos deben poder publicarse tal cual, sin necesitar edición adicional de fondo (el admin solo revisa, no reescribe).
6. Estándar editorial y legal: nunca reproduzcas descripciones gráficas de violencia o de abuso (sexual o de otro tipo), ni detalles que identifiquen a víctimas menores de edad; limítate a hechos verificables de las notas (quién, qué, cargos, decisión judicial, fecha). Atribuye cada afirmación seria a su fuente y no presentes acusaciones como hechos probados si las notas solo dicen que hay un arresto o cargos.

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

module.exports = { redactarDesdeNotas, elegirTono, elegirEstructura, elegirIdioma, calcularCosto };
