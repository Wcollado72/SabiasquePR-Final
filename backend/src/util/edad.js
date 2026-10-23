// Calculo de edad real a partir de fecha_nacimiento (perfiles). Se usa para
// reforzar el gate de secciones 18+ con un hecho conocido en vez de depender
// solo de la autoafirmacion (edad_confirmada) -- ver docs/interno/AUDITORIA-LEGAL-MENORES.md.
// Cuentas creadas antes de que existiera este campo tienen fecha_nacimiento
// NULL y siguen dependiendo del checkbox de autoafirmacion unicamente.
function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return null;
  const nacimiento = new Date(fechaNacimiento);
  if (Number.isNaN(nacimiento.getTime())) return null;
  const hoy = new Date();
  let edad = hoy.getUTCFullYear() - nacimiento.getUTCFullYear();
  const aunNoCumple = (hoy.getUTCMonth() < nacimiento.getUTCMonth())
    || (hoy.getUTCMonth() === nacimiento.getUTCMonth() && hoy.getUTCDate() < nacimiento.getUTCDate());
  if (aunNoCumple) edad -= 1;
  return edad;
}

// true si, con la fecha de nacimiento conocida, la persona es definitivamente
// menor de `minEdad` -- false si es mayor O si no se conoce la fecha (en ese
// caso el checkbox de autoafirmacion sigue siendo la unica fuente, esta
// funcion no reemplaza esa capa, solo la refuerza cuando hay un dato real).
function esMenorConocido(fechaNacimiento, minEdad) {
  const edad = calcularEdad(fechaNacimiento);
  return edad !== null && edad < minEdad;
}

module.exports = { calcularEdad, esMenorConocido };
