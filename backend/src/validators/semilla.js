// Validacion de las «semillas» del Taller de Aliado Imperfekto (ideas propias del autor).
const ESTADOS_VALIDOS = ['semilla', 'explorada', 'en_desarrollo', 'lista', 'pasada'];
const MAX_TEXTO = 20000;
const MAX_TITULO = 160;
const MAX_ETIQUETAS = 10;
const MAX_ETIQUETA = 40;

function validateSemilla(body, { parcial = false } = {}) {
  const errors = [];
  const b = body || {};
  if (!parcial || b.texto !== undefined) {
    if (typeof b.texto !== 'string' || !b.texto.trim()) errors.push('Escribe la idea: la semilla no puede estar vacía.');
    else if (b.texto.length > MAX_TEXTO) errors.push(`La idea es demasiado larga (máximo ${MAX_TEXTO} caracteres).`);
  }
  if (b.titulo !== undefined && (typeof b.titulo !== 'string' || b.titulo.length > MAX_TITULO)) {
    errors.push(`El título debe ser texto de máximo ${MAX_TITULO} caracteres.`);
  }
  if (b.etiquetas !== undefined) {
    if (!Array.isArray(b.etiquetas) || b.etiquetas.length > MAX_ETIQUETAS
      || b.etiquetas.some((t) => typeof t !== 'string' || !t.trim() || t.length > MAX_ETIQUETA)) {
      errors.push(`Las etiquetas son una lista de hasta ${MAX_ETIQUETAS} textos cortos (máximo ${MAX_ETIQUETA} caracteres cada uno).`);
    }
  }
  if (b.estado !== undefined && !ESTADOS_VALIDOS.includes(b.estado)) errors.push('Estado no válido.');
  return errors;
}

// Etiquetas limpias: sin espacios sobrantes, en minuscula y sin repetir.
function normalizarEtiquetas(etiquetas) {
  return [...new Set((etiquetas || []).map((t) => t.trim().toLowerCase()))];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const esUuid = (v) => typeof v === 'string' && UUID.test(v);

module.exports = { validateSemilla, normalizarEtiquetas, esUuid, ESTADOS_VALIDOS, MAX_TEXTO, MAX_TITULO, MAX_ETIQUETAS, MAX_ETIQUETA };
