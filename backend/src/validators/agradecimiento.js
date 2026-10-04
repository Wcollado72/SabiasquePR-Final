// Nombre que una persona autoriza para el muro de agradecimiento (pagina "Apoya el canal").
// Es texto que se muestra PUBLICAMENTE, asi que se restringe: 2 a 40 caracteres, solo letras (de cualquier
// idioma), numeros, espacios y . ' ’ - ; sin direcciones web, correos ni simbolos. El frontend ademas lo escapa
// al pintarlo (nunca como HTML).
const PATRON = /^[\p{L}\p{N} .'’-]+$/u;

function validateNombreAgradecimiento(nombre) {
  if (typeof nombre !== 'string') return ['Escribe el nombre que quieres que aparezca.'];
  const limpio = nombre.trim().replace(/\s+/g, ' ');
  if (limpio.length < 2) return ['El nombre debe tener al menos 2 caracteres.'];
  if (limpio.length > 40) return ['El nombre no puede superar 40 caracteres.'];
  if (!PATRON.test(limpio)) return ['Usa solo letras, números, espacios y . \' - (sin enlaces, correos ni símbolos).'];
  if (/(https?|www)/i.test(limpio)) return ['El nombre no puede contener direcciones web.'];
  return [];
}

// Misma limpieza que se guarda en la base: sin espacios de sobra.
function limpiarNombre(nombre) {
  return String(nombre).trim().replace(/\s+/g, ' ');
}

module.exports = { validateNombreAgradecimiento, limpiarNombre };
