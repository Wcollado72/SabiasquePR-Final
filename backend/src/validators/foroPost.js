const CATEGORIAS_VALIDAS = ['general', 'tecnologia', 'critica-internacional', 'nuevos-humanos', 'educacion'];

function validatePost({ titulo, cuerpo, categoria }) {
  const errors = [];
  if (!titulo || titulo.trim().length < 3) errors.push('El titulo debe tener al menos 3 caracteres.');
  if (titulo && titulo.length > 140) errors.push('El titulo no puede superar 140 caracteres.');
  if (!cuerpo || cuerpo.trim().length < 10) errors.push('El mensaje debe tener al menos 10 caracteres.');
  if (categoria && !CATEGORIAS_VALIDAS.includes(categoria)) errors.push('Categoria no valida.');
  return errors;
}

module.exports = { validatePost, CATEGORIAS_VALIDAS };
