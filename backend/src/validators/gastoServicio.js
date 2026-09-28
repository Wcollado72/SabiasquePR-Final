// Pestaña "Gastos" del admin (2026-09-28): servicios/suscripciones fijas
// del proyecto (Claude Pro, Netlify, Supabase, etc.) -- distinto del gasto
// automatico de ia_generaciones (Investigador/Redactor/Traductor), que ya
// se calcula solo y se muestra por separado.
const ESTADOS_VALIDOS = ['gratis', 'gratis_por_ahora', 'por_uso'];

function esUrlSegura(url) {
  try { return ['http:', 'https:'].includes(new URL(url).protocol); } catch { return false; }
}

function validateGastoServicio(body, { partial = false } = {}) {
  const errors = [];
  const required = ['nombre', 'estado'];
  for (const field of required) {
    if (!partial && !body[field]) errors.push(`El campo "${field}" es obligatorio.`);
  }
  if (body.nombre !== undefined && (body.nombre.trim().length < 2 || body.nombre.length > 120)) {
    errors.push('El nombre debe tener entre 2 y 120 caracteres.');
  }
  if (body.estado !== undefined && !ESTADOS_VALIDOS.includes(body.estado)) {
    errors.push('Estado no valido (gratis, gratis_por_ahora o por_uso).');
  }
  if (body.costoMensualUsd !== undefined && body.costoMensualUsd !== null && body.costoMensualUsd !== '') {
    const n = Number(body.costoMensualUsd);
    if (Number.isNaN(n) || n < 0) errors.push('El costo mensual debe ser un numero mayor o igual a cero.');
  }
  if (body.fechaRenovacion !== undefined && body.fechaRenovacion !== null && body.fechaRenovacion !== ''
      && Number.isNaN(Date.parse(body.fechaRenovacion))) {
    errors.push('La fecha de renovacion no es valida.');
  }
  if (body.enlaceFacturacion !== undefined && body.enlaceFacturacion !== null && body.enlaceFacturacion !== ''
      && !esUrlSegura(body.enlaceFacturacion)) {
    errors.push('El enlace de facturacion debe ser una URL http:// o https:// valida.');
  }
  if (body.notas !== undefined && body.notas !== null && body.notas.length > 500) {
    errors.push('Las notas no pueden superar 500 caracteres.');
  }
  return errors;
}

module.exports = { validateGastoServicio, ESTADOS_VALIDOS };
