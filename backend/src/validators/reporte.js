const TIPOS_VALIDOS = ['debate_post', 'debate_comentario'];
const ESTADOS_VALIDOS = ['pendiente', 'revisado', 'descartado'];

function validateReporte({ tipo, itemId, motivo }) {
  const errors = [];
  if (!tipo || !TIPOS_VALIDOS.includes(tipo)) errors.push('Tipo de reporte no valido.');
  if (!itemId) errors.push('Falta el elemento reportado.');
  if (!motivo || motivo.trim().length < 5) errors.push('El motivo debe tener al menos 5 caracteres.');
  if (motivo && motivo.length > 500) errors.push('El motivo no puede superar 500 caracteres.');
  return errors;
}

module.exports = { validateReporte, TIPOS_VALIDOS, ESTADOS_VALIDOS };
