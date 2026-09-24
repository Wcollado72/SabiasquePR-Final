function validateProducto(body, { partial = false } = {}) {
  const errors = [];
  const required = ['nombre', 'descripcion', 'precio', 'imagen', 'imagenAlt'];
  for (const field of required) {
    if (!partial && (body[field] === undefined || body[field] === '')) {
      errors.push(`El campo "${field}" es obligatorio.`);
    }
  }
  if (body.nombre !== undefined && body.nombre.trim().length < 3) {
    errors.push('El nombre debe tener al menos 3 caracteres.');
  }
  if (body.precio !== undefined && (Number.isNaN(Number(body.precio)) || Number(body.precio) <= 0)) {
    errors.push('El precio debe ser un numero mayor que cero.');
  }
  if (body.stripePriceId !== undefined && body.stripePriceId !== null && body.stripePriceId !== ''
      && !body.stripePriceId.startsWith('price_')) {
    errors.push('El Price ID de Stripe debe empezar con "price_".');
  }
  return errors;
}

module.exports = { validateProducto };
