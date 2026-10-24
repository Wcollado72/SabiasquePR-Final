const { validarIaHerramientas } = require('./iaHerramientas');
const { validarFuentes } = require('./fuentes');

const SECCIONES_VALIDAS =['revolucion-humana', 'educacion', 'noticias'];
const TIPOS_VALIDOS = ['video', 'ensayo', 'noticia', 'lectura_corta', 'audio', 'foto'];
const CATEGORIAS_VALIDAS = [
  'internacionales', 'crimen', 'salud', 'deportes',
  'finanzas', 'tecnologia', 'descubrimientos', 'politica', 'clima', 'cultura', 'ciencia',
  'leyes-educativas', 'estudiantes-sobresalientes', 'sistemas-mundiales', 'programas-educativos',
];
const SUBFORMATOS_VALIDOS = [
  'podcast', 'entrevista', 'galeria', 'opinion', 'reportaje',
  'cronica', 'guia', 'infografia', 'tutorial', 'documental', 'columna',
];
const DIVULGACION_IA_VALIDAS = ['no', 'parcial', 'generado'];
const IDIOMAS_ORIGINAL_VALIDOS = ['es', 'en'];
const CITA_ESTILOS_VALIDOS = [
  'apa', 'mla', 'chicago', 'turabian', 'ama', 'vancouver', 'abnt', 'icontec', 'ieee', 'bluebook',
];
const SUBSECCIONES_VALIDAS = ['nuevos-humanos', 'revolucion-mundial', 'logica-humana', 'corrupcion-humana', 'ilogica-humana'];
// `enfoque` es la region dentro de cualquier sub-seccion de Revolucion
// Humana -- el eje "institucional/individual" (Corrupcion Humana) se
// elimino 2026-09-27: las 4 sub-secciones usan el mismo modelo de 2 niveles,
// Seccion -> Region (ver docs/interno/AUDITORIA-LEGAL-MENORES.md / plan de "pocos clics").
const ENFOQUES_VALIDOS = [
  'puerto-rico', 'estados-unidos', 'hispanoamerica', 'internacionales',
];

function validateContenido(body, { partial = false } = {}) {
  const errors = [];
  const required = ['seccion', 'tipoFormato', 'categoria', 'titulo', 'subtituloResumen', 'urlPortada', 'portadaAlt', 'fechaPublicacion'];
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
  if (body.subformato !== undefined && body.subformato !== null && !SUBFORMATOS_VALIDOS.includes(body.subformato)) {
    errors.push('Subformato no valido.');
  }
  if (body.divulgacionIa !== undefined && !DIVULGACION_IA_VALIDAS.includes(body.divulgacionIa)) {
    errors.push('Divulgacion de IA no valida.');
  }
  errors.push(...validarIaHerramientas(body.iaHerramientas, body.divulgacionIa));
  errors.push(...validarFuentes(body.fuentes));
  if (body.idiomaOriginal !== undefined && !IDIOMAS_ORIGINAL_VALIDOS.includes(body.idiomaOriginal)) {
    errors.push('Idioma original no valido.');
  }
  if (body.citaEstilo !== undefined && body.citaEstilo !== null && !CITA_ESTILOS_VALIDOS.includes(body.citaEstilo)) {
    errors.push('Estilo de cita no valido.');
  }
  if (body.citaSinFuenteExterna !== undefined && typeof body.citaSinFuenteExterna !== 'boolean') {
    errors.push('El campo "citaSinFuenteExterna" debe ser verdadero o falso.');
  }
  if (body.citaFechaAcceso !== undefined && body.citaFechaAcceso !== null && Number.isNaN(Date.parse(body.citaFechaAcceso))) {
    errors.push('La fecha de acceso de la cita no es valida.');
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
  if (body.publicado !== undefined && typeof body.publicado !== 'boolean') {
    errors.push('El campo "publicado" debe ser verdadero o falso.');
  }
  if (body.subseccion !== undefined && body.subseccion !== null && !SUBSECCIONES_VALIDAS.includes(body.subseccion)) {
    errors.push('Subseccion no valida.');
  }
  if (body.esPremium !== undefined && typeof body.esPremium !== 'boolean') {
    errors.push('El campo "esPremium" debe ser verdadero o falso.');
  }
  if (body.enfoque !== undefined && body.enfoque !== null && body.enfoque !== '' && !ENFOQUES_VALIDOS.includes(body.enfoque)) {
    errors.push('Enfoque no valido.');
  }
  // El video y el audio necesitan de donde reproducirse
  const tipo = body.tipoFormato;
  if ((tipo === 'video' || tipo === 'audio') && !partial && !body.urlMedia) {
    errors.push('Los contenidos de tipo "video" o "audio" requieren "urlMedia".');
  }
  // recurso.js/editorial.js pintan esto como <iframe src="urlMedia"> en una
  // pagina publica -- sin esta validacion, "javascript:" o "data:" pasarian
  // como URL "valida" y se ejecutarian dentro del iframe (mismo tipo de hueco
  // que el enlaceMedia del debate, ver foroPost.js).
  if (body.urlMedia) {
    let esquemaValido = false;
    try { esquemaValido = ['http:', 'https:'].includes(new URL(body.urlMedia).protocol); } catch { /* invalida */ }
    if (!esquemaValido) errors.push('"urlMedia" debe ser una URL http:// o https:// valida.');
  }
  return errors;
}

module.exports = {
  validateContenido,
  SECCIONES_VALIDAS,
  TIPOS_VALIDOS,
  CATEGORIAS_VALIDAS,
  SUBFORMATOS_VALIDOS,
  DIVULGACION_IA_VALIDAS,
  IDIOMAS_ORIGINAL_VALIDOS,
  CITA_ESTILOS_VALIDOS,
  SUBSECCIONES_VALIDAS,
  ENFOQUES_VALIDOS,
};
