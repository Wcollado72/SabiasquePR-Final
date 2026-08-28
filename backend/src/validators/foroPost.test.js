const { validatePost } = require('./foroPost');

describe('validatePost', () => {
  test('acepta un post valido sin errores', () => {
    expect(validatePost({ titulo: 'Un titulo valido', cuerpo: 'Un mensaje suficientemente largo.' })).toEqual([]);
  });

  test('rechaza titulo muy corto', () => {
    const errors = validatePost({ titulo: 'Hi', cuerpo: 'Un mensaje suficientemente largo.' });
    expect(errors).toContain('El titulo debe tener al menos 3 caracteres.');
  });

  test('rechaza titulo ausente', () => {
    const errors = validatePost({ cuerpo: 'Un mensaje suficientemente largo.' });
    expect(errors).toContain('El titulo debe tener al menos 3 caracteres.');
  });

  test('rechaza titulo mayor a 140 caracteres', () => {
    const errors = validatePost({ titulo: 'a'.repeat(141), cuerpo: 'Un mensaje suficientemente largo.' });
    expect(errors).toContain('El titulo no puede superar 140 caracteres.');
  });

  test('rechaza cuerpo muy corto', () => {
    const errors = validatePost({ titulo: 'Titulo valido', cuerpo: 'corto' });
    expect(errors).toContain('El mensaje debe tener al menos 10 caracteres.');
  });

  test('rechaza categoria no reconocida', () => {
    const errors = validatePost({ titulo: 'Titulo valido', cuerpo: 'Un mensaje suficientemente largo.', categoria: 'inventada' });
    expect(errors).toContain('Categoria no valida.');
  });

  test('acepta una categoria valida', () => {
    const errors = validatePost({ titulo: 'Titulo valido', cuerpo: 'Un mensaje suficientemente largo.', categoria: 'tecnologia' });
    expect(errors).toEqual([]);
  });

  test('acumula varios errores a la vez', () => {
    const errors = validatePost({ titulo: 'a', cuerpo: 'x' });
    expect(errors.length).toBe(2);
  });
});
