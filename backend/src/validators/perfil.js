function validatePerfil(body) {
  const errors = [];
  if (body.nombre !== undefined && body.nombre !== null) {
    if (typeof body.nombre !== 'string') {
      errors.push('El campo "nombre" debe ser texto.');
    } else if (body.nombre.trim().length > 80) {
      errors.push('El nombre debe tener 80 caracteres o menos.');
    }
  }
  return errors;
}

module.exports = { validatePerfil };
