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

  test('acepta hasta 100 palabras para un usuario regular', () => {
    const cuerpo = Array(100).fill('palabra').join(' ');
    expect(validatePost({ titulo: 'Titulo valido', cuerpo }, 'usuario')).toEqual([]);
  });

  test('rechaza mas de 100 palabras para un usuario regular', () => {
    const cuerpo = Array(101).fill('palabra').join(' ');
    const errors = validatePost({ titulo: 'Titulo valido', cuerpo }, 'usuario');
    expect(errors).toContain('El mensaje no puede superar 100 palabras.');
  });

  test('permite hasta 500 palabras para un usuario premium', () => {
    const cuerpo = Array(500).fill('palabra').join(' ');
    expect(validatePost({ titulo: 'Titulo valido', cuerpo }, 'premium')).toEqual([]);
  });

  test('permite hasta 500 palabras para un admin', () => {
    const cuerpo = Array(500).fill('palabra').join(' ');
    expect(validatePost({ titulo: 'Titulo valido', cuerpo }, 'admin')).toEqual([]);
  });

  test('usa el limite de usuario regular si no se especifica rol', () => {
    const cuerpo = Array(101).fill('palabra').join(' ');
    const errors = validatePost({ titulo: 'Titulo valido', cuerpo });
    expect(errors).toContain('El mensaje no puede superar 100 palabras.');
  });
});
