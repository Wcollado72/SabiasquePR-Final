// Validacion de POST /api/admin/corregir (corrector con IA del panel de administracion).
const VARIANTES_VALIDAS = ['es-PR', 'es-MX', 'es-ES', 'es-419', 'en-US', 'en-GB'];
const MAX_TEXTO = 12000;

function validateCorreccion(body) {
  const errors = [];
  const { texto, variante } = body || {};
  if (typeof texto !== 'string' || !texto.trim()) errors.push('Escribe el texto que quieres corregir.');
  else if (texto.length > MAX_TEXTO) errors.push(`El texto es demasiado largo (máximo ${MAX_TEXTO} caracteres).`);
  if (!VARIANTES_VALIDAS.includes(variante)) errors.push('Elige una variante de idioma válida.');
  return errors;
}

module.exports = { validateCorreccion, VARIANTES_VALIDAS, MAX_TEXTO };
