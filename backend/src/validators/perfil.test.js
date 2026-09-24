const { validatePerfil } = require('./perfil');

describe('validatePerfil', () => {
  test('acepta un cuerpo vacio (nombre es opcional)', () => {
    expect(validatePerfil({})).toEqual([]);
  });

  test('acepta un nombre valido', () => {
    expect(validatePerfil({ nombre: 'Will Collado' })).toEqual([]);
  });

  test('acepta nombre null (para borrarlo)', () => {
    expect(validatePerfil({ nombre: null })).toEqual([]);
  });

  test('rechaza nombre que no es texto', () => {
    const errors = validatePerfil({ nombre: 123 });
    expect(errors).toContain('El campo "nombre" debe ser texto.');
  });

  test('rechaza nombre de mas de 80 caracteres', () => {
    const errors = validatePerfil({ nombre: 'a'.repeat(81) });
    expect(errors).toContain('El nombre debe tener 80 caracteres o menos.');
  });
});
