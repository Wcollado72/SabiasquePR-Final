const CATEGORIAS_VALIDAS = [
  'general', 'internacionales', 'crimenes', 'salud', 'deportes',
  'finanzas', 'tecnologia', 'descubrimientos', 'politica', 'clima', 'cultura',
];

function validateNoticia(body, { partial = false } = {}) {
  const errors = [];
  const required = ['titulo', 'fecha', 'imagen', 'imagenAlt', 'fuenteUrl', 'fuenteTexto'];
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
  if (!partial || body.parrafos !== undefined) {
    if (!Array.isArray(body.parrafos) || body.parrafos.filter((p) => p && p.trim()).length === 0) {
      errors.push('Debe incluir al menos un parrafo.');
    }
  }
  return errors;
}

module.exports = { validateNoticia, CATEGORIAS_VALIDAS };
