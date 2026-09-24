const TIPOS_VALIDOS = ['noticia', 'contenido'];

function validateComentario(body) {
  const errors = [];
  if (!body.tipo || !TIPOS_VALIDOS.includes(body.tipo)) {
    errors.push('El campo "tipo" debe ser "noticia" o "contenido".');
  }
  if (!body.itemId || !body.itemId.trim()) {
    errors.push('El campo "itemId" es obligatorio.');
  }
  if (!body.cuerpo || body.cuerpo.trim().length < 2) {
    errors.push('El comentario debe tener al menos 2 caracteres.');
  }
  return errors;
}

module.exports = { validateComentario, TIPOS_VALIDOS };
