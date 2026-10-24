// Validacion de la fecha de nacimiento que se pide en "Completa tu perfil"
// (cuentas creadas con Google, o anteriores al campo). Solo verifica que sea una
// fecha REAL y plausible; no rechaza a nadie por su edad -- la politica del
// sitio es no bloquear a menores del sitio en general (ver la auditoría legal de protección de menores del proyecto);
// la edad solo refuerza el gate de las secciones 18+ (util/edad.js).
const EDAD_MAXIMA = 120;

function validateFechaNacimiento(body, hoy = new Date()) {
  const valor = body?.fechaNacimiento;
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return ['La fecha de nacimiento debe tener el formato AAAA-MM-DD.'];
  }
  const [anio, mes, dia] = valor.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  const esReal = fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
  if (!esReal) return ['La fecha de nacimiento no es una fecha válida.'];

  const hoyUtc = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()));
  if (fecha > hoyUtc) return ['La fecha de nacimiento no puede estar en el futuro.'];
  if (hoyUtc.getUTCFullYear() - anio > EDAD_MAXIMA) return ['La fecha de nacimiento no es plausible.'];
  return [];
}

module.exports = { validateFechaNacimiento };
