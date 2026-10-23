// Validacion de los endpoints de IA del formulario de Contenidos (resumir y leer metadatos de una URL).
const MAX_TEXTO_RESUMIR = 60000; // cabe en el limite de 100 KB del cuerpo JSON de la API

function validateResumir(body) {
  const errors = [];
  const { texto } = body || {};
  if (typeof texto !== 'string' || !texto.trim()) errors.push('Escribe el cuerpo del texto para poder resumirlo.');
  else if (texto.length > MAX_TEXTO_RESUMIR) errors.push(`El texto es demasiado largo para resumirlo (máximo ${MAX_TEXTO_RESUMIR} caracteres).`);
  return errors;
}

function validateMetadatos(body) {
  const { url } = body || {};
  if (typeof url !== 'string' || !url.trim()) return ['Falta la URL de la fuente.'];
  if (url.length > 2000) return ['La URL es demasiado larga.'];
  return [];
}

module.exports = { validateResumir, validateMetadatos, MAX_TEXTO_RESUMIR };
