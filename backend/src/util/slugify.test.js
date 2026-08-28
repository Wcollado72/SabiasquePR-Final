const { slugify } = require('./slugify');

describe('slugify', () => {
  test('convierte a minusculas y reemplaza espacios por guiones', () => {
    expect(slugify('Hola Mundo')).toBe('hola-mundo');
  });

  test('quita acentos y signos de puntuacion', () => {
    expect(slugify('¡Ibrahim Traoré: Revolución!')).toBe('ibrahim-traore-revolucion');
  });

  test('colapsa guiones repetidos y recorta los de los extremos', () => {
    expect(slugify('  --Hola---Mundo--  ')).toBe('hola-mundo');
  });

  test('trunca a 80 caracteres', () => {
    const largo = 'a'.repeat(200);
    expect(slugify(largo).length).toBe(80);
  });

  test('acepta numeros', () => {
    expect(slugify('3I/ATLAS Cometa 2025')).toBe('3i-atlas-cometa-2025');
  });
});
