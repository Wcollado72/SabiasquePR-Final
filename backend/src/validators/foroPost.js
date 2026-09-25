const CATEGORIAS_VALIDAS = ['general', 'tecnologia', 'internacionales', 'nuevos-humanos', 'educacion'];
// El foro es un canal abierto (ideas, solicitudes de info/conferencias), no
// un beneficio premium -- el limite de palabras es el mismo para todos.
const WORD_LIMIT = 500;

function countWords(text) {
  return (text || '').trim().split(/\s+/).filter(Boolean).length;
}

function validatePost({ titulo, cuerpo, categoria }) {
  const errors = [];
  if (!titulo || titulo.trim().length < 3) errors.push('El titulo debe tener al menos 3 caracteres.');
  if (titulo && titulo.length > 140) errors.push('El titulo no puede superar 140 caracteres.');
  if (!cuerpo || cuerpo.trim().length < 10) errors.push('El mensaje debe tener al menos 10 caracteres.');
  if (cuerpo && countWords(cuerpo) > WORD_LIMIT) {
    errors.push(`El mensaje no puede superar ${WORD_LIMIT} palabras.`);
  }
  if (categoria && !CATEGORIAS_VALIDAS.includes(categoria)) errors.push('Categoria no valida.');
  return errors;
}

module.exports = { validatePost, CATEGORIAS_VALIDAS, WORD_LIMIT, countWords };
