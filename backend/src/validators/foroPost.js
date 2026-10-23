// El "foro" evoluciono de un foro general (retirado, ver git history) al
// motor del debate semanal 18+ de Revolucion Humana -- sigue siendo el
// mismo CRUD+JWT, ahora acotado por sub-seccion y con reglas por rol.
const SUBSECCIONES_VALIDAS = ['corrupcion-humana', 'ilogica-humana', 'nuevos-humanos', 'educacion'];
// El eje "institucional/individual" (Corrupcion Humana) se elimino
// 2026-09-27 -- todas las sub-secciones usan el mismo modelo de region.
const ENFOQUES_VALIDOS = [
  'puerto-rico', 'estados-unidos', 'hispanoamerica', 'internacionales',
];
const ENLACE_MEDIA_TIPOS_VALIDOS = ['imagen', 'audio', 'video'];
// Politica confirmada 2026-09-27: 200 palabras para cuentas regulares en
// cualquier foro/debate del sitio (no solo secciones 18+); mas de eso
// requiere premium. Aplica por igual a todas las sub-secciones.
const WORD_LIMITS = { usuario: 200, premium: 1000, admin: 1000 };

function countWords(text) {
  return (text || '').trim().split(/\s+/).filter(Boolean).length;
}

// `existente` (solo al editar) es la fila guardada: permite corregir un typo
// aunque la persona ya no tenga el rol que le dio mas palabras o el enlace --
// el limite nunca baja de lo ya guardado y un enlace sin cambios no se vuelve
// a exigir premium.
function validatePost({ titulo, cuerpo, subseccion, enfoque, enlaceMedia, enlaceMediaTipo }, rol = 'usuario', existente = null) {
  const errors = [];
  if (!titulo || titulo.trim().length < 3) errors.push('El titulo debe tener al menos 3 caracteres.');
  if (titulo && titulo.length > 140) errors.push('El titulo no puede superar 140 caracteres.');
  if (!cuerpo || cuerpo.trim().length < 10) errors.push('El mensaje debe tener al menos 10 caracteres.');
  let limit = WORD_LIMITS[rol] || WORD_LIMITS.usuario;
  if (existente && existente.cuerpo) limit = Math.max(limit, countWords(existente.cuerpo));
  if (cuerpo && countWords(cuerpo) > limit) {
    errors.push(`El mensaje no puede superar ${limit} palabras.`);
  }
  if (!subseccion || !SUBSECCIONES_VALIDAS.includes(subseccion)) errors.push('Sub-seccion no valida.');
  if (enfoque !== undefined && enfoque !== null && enfoque !== '' && !ENFOQUES_VALIDOS.includes(enfoque)) {
    errors.push('Enfoque no valido.');
  }
  const enlaceSinCambios = Boolean(existente)
    && (enlaceMedia || null) === (existente.enlace_media || null)
    && (enlaceMediaTipo || null) === (existente.enlace_media_tipo || null);
  if ((enlaceMedia || enlaceMediaTipo) && !enlaceSinCambios) {
    if (rol !== 'premium' && rol !== 'admin') {
      errors.push('Solo las cuentas premium pueden anadir un enlace multimedia.');
    }
    if (!enlaceMediaTipo || !ENLACE_MEDIA_TIPOS_VALIDOS.includes(enlaceMediaTipo)) {
      errors.push('Indica un tipo de enlace multimedia valido (imagen, audio o video).');
    }
    if (!enlaceMedia) {
      errors.push('Falta la URL del enlace multimedia.');
    } else {
      // Solo http(s): "new URL()" por si sola acepta esquemas como
      // "javascript:" o "data:", que si se dejaran pasar aqui se guardarian
      // en foro_posts y luego se renderizan como <a href> real en debate.js
      // -- eso abriria un XSS almacenado contra quien haga clic en el enlace.
      let esquemaValido = false;
      try { esquemaValido = ['http:', 'https:'].includes(new URL(enlaceMedia).protocol); } catch { /* invalida */ }
      if (!esquemaValido) errors.push('El enlace multimedia debe ser una URL http:// o https:// valida.');
    }
  }
  return errors;
}

module.exports = {
  validatePost, SUBSECCIONES_VALIDAS, ENFOQUES_VALIDOS, ENLACE_MEDIA_TIPOS_VALIDOS, WORD_LIMITS, countWords,
};
