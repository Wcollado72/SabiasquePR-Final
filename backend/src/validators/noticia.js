const { validarIaHerramientas } = require('./iaHerramientas');
const { validarFuentes } = require('./fuentes');

const CATEGORIAS_VALIDAS = [
  'internacionales', 'crimen', 'salud', 'deportes',
  'finanzas', 'tecnologia', 'descubrimientos', 'politica', 'clima', 'cultura', 'ciencia',
];
const DIVULGACION_IA_VALIDAS = ['no', 'parcial', 'generado'];
const IDIOMAS_ORIGINAL_VALIDOS = ['es', 'en'];

function validateNoticia(body, { partial = false } = {}) {
  const errors = [];
  const required = ['titulo', 'fecha', 'categoria', 'imagen', 'imagenAlt', 'fuenteUrl', 'fuenteTexto'];
  for (const field of required) {
    if (!partial && !body[field]) errors.push(`El campo "${field}" es obligatorio.`);
  }
  if (body.titulo !== undefined && body.titulo.trim().length < 3) {
    errors.push('El titulo debe tener al menos 3 caracteres.');
  }
  if (body.fecha !== undefined && Number.isNaN(Date.parse(body.fecha))) {
    errors.push('La fecha no es valida.');
  }
  if (body.categoria !== undefined && !CATEGORIAS_VALIDAS.includes(body.categoria)) {
    errors.push('Categoria no valida.');
  }
  if (body.divulgacionIa !== undefined && !DIVULGACION_IA_VALIDAS.includes(body.divulgacionIa)) {
    errors.push('Divulgacion de IA no valida.');
  }
  errors.push(...validarIaHerramientas(body.iaHerramientas, body.divulgacionIa));
  errors.push(...validarFuentes(body.fuentes));
  if (body.idiomaOriginal !== undefined && !IDIOMAS_ORIGINAL_VALIDOS.includes(body.idiomaOriginal)) {
    errors.push('Idioma original no valido.');
  }
  if (body.destacado !== undefined && typeof body.destacado !== 'boolean') {
    errors.push('El campo "destacado" debe ser verdadero o falso.');
  }
  if (body.publicado !== undefined && typeof body.publicado !== 'boolean') {
    errors.push('El campo "publicado" debe ser verdadero o falso.');
  }
  if (!partial || body.parrafos !== undefined) {
    if (!Array.isArray(body.parrafos) || body.parrafos.filter((p) => p && p.trim()).length === 0) {
      errors.push('Debe incluir al menos un parrafo.');
    }
  }
  return errors;
}

module.exports = { validateNoticia, CATEGORIAS_VALIDAS, DIVULGACION_IA_VALIDAS, IDIOMAS_ORIGINAL_VALIDOS };
