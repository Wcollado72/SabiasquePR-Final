const TIPOS_VALIDOS = ['noticia', 'contenido'];
const MAX_COMENTARIO_CARACTERES = 2000;

function validateComentario(body) {
  const errors = [];
  if (!body.tipo || !TIPOS_VALIDOS.includes(body.tipo)) {
    errors.push('El campo "tipo" debe ser "noticia" o "contenido".');
  }
  if (typeof body.itemId !== 'string' || !body.itemId.trim()) {
    errors.push('El campo "itemId" es obligatorio.');
  }
  if (typeof body.cuerpo !== 'string' || body.cuerpo.trim().length < 2) {
    errors.push('El comentario debe tener al menos 2 caracteres.');
  } else if (body.cuerpo.trim().length > MAX_COMENTARIO_CARACTERES) {
    errors.push(`El comentario no puede superar ${MAX_COMENTARIO_CARACTERES} caracteres.`);
  }
  return errors;
}

module.exports = { validateComentario, TIPOS_VALIDOS, MAX_COMENTARIO_CARACTERES };
