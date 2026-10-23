// Herramientas de IA usadas en una noticia o contenido (columna `ia_herramientas`).
// Cada elemento es una clave conocida en minuscula o un nombre libre (otra IA).
const CLAVES_IA_CONOCIDAS = ['claude', 'gemini', 'perplexity', 'chatgpt', 'copilot'];
const MAX_HERRAMIENTAS = 8;
const MAX_NOMBRE = 40;

const MENSAJE_DIVULGACION_NO = 'Si indicas qué IA usaste, la divulgación no puede ser “No se usó IA”.';

// Una clave conocida se normaliza a minuscula; un nombre libre conserva su capitalizacion.
function normalizarElemento(valor) {
  const texto = valor.trim();
  const minuscula = texto.toLowerCase();
  return CLAVES_IA_CONOCIDAS.includes(minuscula) ? minuscula : texto;
}

// Devuelve la lista limpia (sin duplicados). Solo se llama con una lista ya validada.
function normalizarIaHerramientas(lista) {
  const vistos = new Set();
  const resultado = [];
  for (const item of lista) {
    const limpio = normalizarElemento(item);
    const llave = limpio.toLowerCase();
    if (vistos.has(llave)) continue;
    vistos.add(llave);
    resultado.push(limpio);
  }
  return resultado;
}

// `divulgacionIa` es la del cuerpo; si es undefined no se cruza (ver resolverIaHerramientas).
function validarIaHerramientas(valor, divulgacionIa) {
  if (valor === undefined) return [];
  if (!Array.isArray(valor)) return ['Las herramientas de IA deben enviarse como una lista.'];
  const errors = [];
  if (valor.length > MAX_HERRAMIENTAS) {
    errors.push(`Puedes indicar un máximo de ${MAX_HERRAMIENTAS} herramientas de IA.`);
  }
  const vistos = new Set();
  for (const item of valor) {
    if (typeof item !== 'string') {
      errors.push('Cada herramienta de IA debe ser texto.');
      continue;
    }
    const texto = item.trim();
    if (texto.length < 1 || texto.length > MAX_NOMBRE) {
      errors.push(`Cada herramienta de IA debe tener entre 1 y ${MAX_NOMBRE} caracteres.`);
      continue;
    }
    if (/[<>]/u.test(texto) || /\p{Cc}/u.test(texto) || /:\/\/|www\./iu.test(texto)) {
      errors.push(`La herramienta de IA "${texto.slice(0, 20)}" contiene caracteres no permitidos.`);
      continue;
    }
    const llave = texto.toLowerCase();
    if (vistos.has(llave)) errors.push(`La herramienta de IA "${texto}" está repetida.`);
    vistos.add(llave);
  }
  if (valor.length > 0 && divulgacionIa === 'no') errors.push(MENSAJE_DIVULGACION_NO);
  return errors;
}

// Valor final de `ia_herramientas` al guardar. Omitido = se conserva lo que ya habia;
// si la divulgacion pasa a "no" sin lista nueva, se vacia para no dejar datos
// contradictorios. `error` aparece cuando la lista nueva choca con la divulgacion
// que la pieza ya tenia (el cuerpo no la traia, asi que el validador no pudo verlo).
function resolverIaHerramientas(body, existing = {}) {
  const divulgacion = body.divulgacionIa ?? existing.divulgacion_ia ?? 'no';
  if (body.iaHerramientas !== undefined) {
    const lista = normalizarIaHerramientas(Array.isArray(body.iaHerramientas) ? body.iaHerramientas : []);
    const error = lista.length > 0 && divulgacion === 'no' ? MENSAJE_DIVULGACION_NO : null;
    return { valor: lista, error };
  }
  if (body.divulgacionIa === 'no') return { valor: [], error: null };
  return { valor: existing.ia_herramientas ?? [], error: null };
}

module.exports = {
  CLAVES_IA_CONOCIDAS,
  MAX_HERRAMIENTAS,
  MAX_NOMBRE,
  MENSAJE_DIVULGACION_NO,
  validarIaHerramientas,
  normalizarIaHerramientas,
  resolverIaHerramientas,
};
