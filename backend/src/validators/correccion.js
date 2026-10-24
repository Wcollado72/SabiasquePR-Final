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

const MAX_CAMPOS_VARIOS = 8;
const MAX_TEXTO_VARIOS = 60000; // cabe en el limite de 100 KB del cuerpo JSON de la API

// «Corregir todo»: varios campos de un formulario, cada uno con su propia variante de idioma.
function validateCorreccionVarios(body) {
  const items = (body || {}).items;
  if (!Array.isArray(items) || !items.length) return ['No hay campos con texto para corregir.'];
  if (items.length > MAX_CAMPOS_VARIOS) return [`Son demasiados campos (máximo ${MAX_CAMPOS_VARIOS}).`];
  const ids = new Set();
  let total = 0;
  for (const it of items) {
    if (!it || typeof it.id !== 'string' || !it.id.trim() || it.id.length > 80 || ids.has(it.id)) return ['Cada campo necesita un identificador distinto.'];
    ids.add(it.id);
    const errores = validateCorreccion({ texto: it.texto, variante: it.variante });
    if (errores.length) return [errores.join(' ')];
    total += it.texto.length;
  }
  if (total > MAX_TEXTO_VARIOS) return [`Entre todos los campos hay demasiado texto (máximo ${MAX_TEXTO_VARIOS} caracteres).`];
  return [];
}

module.exports = { validateCorreccion, validateCorreccionVarios, VARIANTES_VALIDAS, MAX_TEXTO, MAX_CAMPOS_VARIOS, MAX_TEXTO_VARIOS };
