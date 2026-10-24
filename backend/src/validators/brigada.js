// Validacion de los endpoints de la Brigada Coqui (agentes de contenido del panel).
const DESTINOS_VALIDOS = ['contenido', 'noticia'];

function validateClasificar(body) {
  const { url, destino } = body || {};
  if (typeof url !== 'string' || !url.trim()) return ['Pega la URL de la fuente para clasificarla.'];
  if (url.length > 2000) return ['La URL es demasiado larga.'];
  if (destino !== undefined && !DESTINOS_VALIDOS.includes(destino)) return ['Destino no válido.'];
  return [];
}

const MAX_TEXTO_REVISAR = 60000; // cabe en el limite de 100 KB del cuerpo JSON de la API

function validateRevisar(body) {
  const { titulo, resumen, cuerpo, fuenteUrl, seccion } = body || {};
  const textos = [titulo, resumen, cuerpo];
  if (textos.some((t) => t !== undefined && t !== null && typeof t !== 'string')) return ['Los textos a revisar deben ser texto.'];
  if (!textos.some((t) => typeof t === 'string' && t.trim())) return ['Escribe el título, el resumen o el cuerpo para poder revisarlos.'];
  if (textos.reduce((n, t) => n + (t ? t.length : 0), 0) > MAX_TEXTO_REVISAR) return [`El texto es demasiado largo para revisarlo (máximo ${MAX_TEXTO_REVISAR} caracteres).`];
  if (fuenteUrl !== undefined && fuenteUrl !== null && (typeof fuenteUrl !== 'string' || fuenteUrl.length > 2000)) return ['La URL de la fuente no es válida.'];
  if (seccion !== undefined && seccion !== null && typeof seccion !== 'string') return ['Sección no válida.'];
  return [];
}

function validateDuplicados(body) {
  const { titulo, resumen, fuenteUrl, excluir } = body || {};
  if ([titulo, resumen, fuenteUrl].some((t) => t !== undefined && t !== null && typeof t !== 'string')) return ['Los datos a buscar deben ser texto.'];
  if (![titulo, fuenteUrl].some((t) => typeof t === 'string' && t.trim())) return ['Escribe el título o la URL de la fuente para buscar historias repetidas.'];
  if ([titulo, resumen, fuenteUrl].some((t) => t && t.length > 5000)) return ['Los datos a buscar son demasiado largos.'];
  if (excluir !== undefined && excluir !== null) {
    if (typeof excluir !== 'object' || !DESTINOS_VALIDOS.includes(excluir.tipo) || typeof excluir.id !== 'string') return ['La pieza a excluir no es válida.'];
  }
  return [];
}

function validatePintar(body) {
  const { titulo, resumen, cuerpo, idioma, seccion } = body || {};
  const textos = [titulo, resumen, cuerpo];
  if (textos.some((t) => t !== undefined && t !== null && typeof t !== 'string')) return ['Los textos deben ser texto.'];
  if (!textos.some((t) => typeof t === 'string' && t.trim())) return ['Escribe el título, el resumen o el cuerpo para que la pintora imagine la imagen.'];
  if (textos.reduce((n, t) => n + (t ? t.length : 0), 0) > MAX_TEXTO_REVISAR) return [`El texto es demasiado largo (máximo ${MAX_TEXTO_REVISAR} caracteres).`];
  if (idioma !== undefined && idioma !== null && !['es', 'en'].includes(idioma)) return ['Idioma no válido.'];
  if (seccion !== undefined && seccion !== null && typeof seccion !== 'string') return ['Sección no válida.'];
  return [];
}

module.exports = { validateClasificar, validateRevisar, validateDuplicados, validatePintar, DESTINOS_VALIDOS, MAX_TEXTO_REVISAR };
