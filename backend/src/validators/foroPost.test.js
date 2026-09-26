const { validatePost } = require('./foroPost');

const BASE = { titulo: 'Un titulo valido', cuerpo: 'Un mensaje suficientemente largo.', subseccion: 'corrupcion-humana' };

describe('validatePost', () => {
  test('acepta un post valido sin errores', () => {
    expect(validatePost(BASE)).toEqual([]);
  });

  test('rechaza titulo muy corto', () => {
    const errors = validatePost({ ...BASE, titulo: 'Hi' });
    expect(errors).toContain('El titulo debe tener al menos 3 caracteres.');
  });

  test('rechaza titulo ausente', () => {
    const errors = validatePost({ ...BASE, titulo: undefined });
    expect(errors).toContain('El titulo debe tener al menos 3 caracteres.');
  });

  test('rechaza titulo mayor a 140 caracteres', () => {
    const errors = validatePost({ ...BASE, titulo: 'a'.repeat(141) });
    expect(errors).toContain('El titulo no puede superar 140 caracteres.');
  });

  test('rechaza cuerpo muy corto', () => {
    const errors = validatePost({ ...BASE, cuerpo: 'corto' });
    expect(errors).toContain('El mensaje debe tener al menos 10 caracteres.');
  });

  test('rechaza subseccion ausente o no reconocida', () => {
    expect(validatePost({ ...BASE, subseccion: undefined })).toContain('Sub-seccion no valida.');
    expect(validatePost({ ...BASE, subseccion: 'inventada' })).toContain('Sub-seccion no valida.');
  });

  test('acepta enfoque institucional/individual y rechaza invalido', () => {
    expect(validatePost({ ...BASE, enfoque: 'institucional' })).toEqual([]);
    expect(validatePost({ ...BASE, enfoque: 'individual' })).toEqual([]);
    expect(validatePost({ ...BASE, enfoque: 'inventado' })).toContain('Enfoque no valido.');
  });

  test('acepta la subseccion nuevos-humanos y sus regiones de enfoque', () => {
    const post = { ...BASE, subseccion: 'nuevos-humanos' };
    expect(validatePost(post)).toEqual([]);
    for (const enfoque of ['puerto-rico', 'estados-unidos', 'hispanoamerica', 'internacionales']) {
      expect(validatePost({ ...post, enfoque })).toEqual([]);
    }
  });

  test('acepta la subseccion educacion', () => {
    expect(validatePost({ ...BASE, subseccion: 'educacion' })).toEqual([]);
  });

  test('acumula varios errores a la vez', () => {
    const errors = validatePost({ titulo: 'a', cuerpo: 'x' });
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });

  test('acepta hasta 500 palabras para un usuario regular', () => {
    const cuerpo = Array(500).fill('palabra').join(' ');
    expect(validatePost({ ...BASE, cuerpo }, 'usuario')).toEqual([]);
  });

  test('rechaza mas de 500 palabras para un usuario regular', () => {
    const cuerpo = Array(501).fill('palabra').join(' ');
    const errors = validatePost({ ...BASE, cuerpo }, 'usuario');
    expect(errors).toContain('El mensaje no puede superar 500 palabras.');
  });

  test('permite hasta 1500 palabras para premium y admin', () => {
    const cuerpo = Array(1500).fill('palabra').join(' ');
    expect(validatePost({ ...BASE, cuerpo }, 'premium')).toEqual([]);
    expect(validatePost({ ...BASE, cuerpo }, 'admin')).toEqual([]);
  });

  test('rechaza mas de 1500 palabras para premium', () => {
    const cuerpo = Array(1501).fill('palabra').join(' ');
    const errors = validatePost({ ...BASE, cuerpo }, 'premium');
    expect(errors).toContain('El mensaje no puede superar 1500 palabras.');
  });

  test('usa el limite de usuario regular si no se especifica rol', () => {
    const cuerpo = Array(501).fill('palabra').join(' ');
    const errors = validatePost({ ...BASE, cuerpo });
    expect(errors).toContain('El mensaje no puede superar 500 palabras.');
  });

  test('rechaza enlace multimedia de un usuario regular', () => {
    const errors = validatePost({ ...BASE, enlaceMedia: 'https://example.com/foto.jpg', enlaceMediaTipo: 'imagen' }, 'usuario');
    expect(errors).toContain('Solo las cuentas premium pueden anadir un enlace multimedia.');
  });

  test('acepta enlace multimedia valido de un usuario premium', () => {
    const errors = validatePost({ ...BASE, enlaceMedia: 'https://example.com/foto.jpg', enlaceMediaTipo: 'imagen' }, 'premium');
    expect(errors).toEqual([]);
  });

  test('rechaza enlace multimedia sin tipo o con URL invalida', () => {
    expect(validatePost({ ...BASE, enlaceMedia: 'https://example.com/foto.jpg' }, 'premium'))
      .toContain('Indica un tipo de enlace multimedia valido (imagen, audio o video).');
    expect(validatePost({ ...BASE, enlaceMedia: 'no-es-una-url', enlaceMediaTipo: 'imagen' }, 'premium'))
      .toContain('El enlace multimedia no es una URL valida.');
  });
});
