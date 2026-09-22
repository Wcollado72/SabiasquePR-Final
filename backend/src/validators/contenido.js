const SECCIONES_VALIDAS = ['revolucion-humana', 'educacion', 'noticias'];
const TIPOS_VALIDOS = ['video', 'ensayo', 'noticia', 'lectura_corta'];
const CATEGORIAS_VALIDAS = [
  'general', 'internacionales', 'crimen', 'salud', 'deportes',
  'finanzas', 'tecnologia', 'descubrimientos', 'politica', 'clima', 'cultura', 'ciencia',
];

function validateContenido(body, { partial = false } = {}) {
  const errors = [];
  const required = ['seccion', 'tipoFormato', 'titulo', 'subtituloResumen', 'urlPortada', 'portadaAlt', 'fechaPublicacion'];
  for (const field of required) {
    if (!partial && !body[field]) errors.push(`El campo "${field}" es obligatorio.`);
  }
  if (body.seccion !== undefined && !SECCIONES_VALIDAS.includes(body.seccion)) {
    errors.push('Seccion no valida.');
  }
  if (body.tipoFormato !== undefined && !TIPOS_VALIDOS.includes(body.tipoFormato)) {
    errors.push('Tipo de formato no valido.');
  }
  if (body.categoria !== undefined && !CATEGORIAS_VALIDAS.includes(body.categoria)) {
    errors.push('Categoria no valida.');
  }
  if (body.titulo !== undefined && body.titulo.trim().length < 3) {
    errors.push('El titulo debe tener al menos 3 caracteres.');
  }
  if (body.subtituloResumen !== undefined && body.subtituloResumen.trim().length < 10) {
    errors.push('El resumen debe tener al menos 10 caracteres.');
  }
  if (body.fechaPublicacion !== undefined && Number.isNaN(Date.parse(body.fechaPublicacion))) {
    errors.push('La fecha de publicacion no es valida.');
  }
  if (body.duracionMin !== undefined && (!Number.isInteger(body.duracionMin) || body.duracionMin <= 0)) {
    errors.push('La duracion debe ser un numero entero mayor que 0.');
  }
  if (body.destacado !== undefined && typeof body.destacado !== 'boolean') {
    errors.push('El campo "destacado" debe ser verdadero o falso.');
  }
  // El video necesita de donde reproducirse
  const tipo = body.tipoFormato;
  if (tipo === 'video' && !partial && !body.urlMedia) {
    errors.push('Los contenidos de tipo "video" requieren "urlMedia".');
  }
  return errors;
}

module.exports = { validateContenido, SECCIONES_VALIDAS, TIPOS_VALIDOS, CATEGORIAS_VALIDAS };
