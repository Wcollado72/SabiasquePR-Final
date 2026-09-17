const CATEGORIAS_VALIDAS = ['general', 'tecnologia', 'internacionales', 'nuevos-humanos', 'educacion'];
const WORD_LIMITS = { usuario: 100, premium: 500, admin: 500 };

function countWords(text) {
  return (text || '').trim().split(/\s+/).filter(Boolean).length;
}

function validatePost({ titulo, cuerpo, categoria }, rol = 'usuario') {
  const errors = [];
  if (!titulo || titulo.trim().length < 3) errors.push('El titulo debe tener al menos 3 caracteres.');
  if (titulo && titulo.length > 140) errors.push('El titulo no puede superar 140 caracteres.');
  if (!cuerpo || cuerpo.trim().length < 10) errors.push('El mensaje debe tener al menos 10 caracteres.');
  const limit = WORD_LIMITS[rol] || WORD_LIMITS.usuario;
  if (cuerpo && countWords(cuerpo) > limit) {
    errors.push(`El mensaje no puede superar ${limit} palabras.`);
  }
  if (categoria && !CATEGORIAS_VALIDAS.includes(categoria)) errors.push('Categoria no valida.');
  return errors;
}

module.exports = { validatePost, CATEGORIAS_VALIDAS, WORD_LIMITS, countWords };
