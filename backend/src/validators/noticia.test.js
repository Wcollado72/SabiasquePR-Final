const { validateNoticia } = require('./noticia');

const NOTICIA_VALIDA = {
  titulo: 'Un titulo cualquiera',
  fecha: '2026-01-15',
  imagen: 'images/foto.webp',
  imagenAlt: 'Descripcion de la foto',
  fuenteUrl: 'https://ejemplo.com',
  fuenteTexto: 'Ejemplo News',
  parrafos: ['Primer parrafo.'],
};

describe('validateNoticia', () => {
  test('acepta una noticia completa y valida', () => {
    expect(validateNoticia(NOTICIA_VALIDA)).toEqual([]);
  });

  test('exige todos los campos obligatorios al crear (no parcial)', () => {
    const errors = validateNoticia({});
    expect(errors).toContain('El campo "titulo" es obligatorio.');
    expect(errors).toContain('El campo "fecha" es obligatorio.');
    expect(errors).toContain('El campo "imagen" es obligatorio.');
    expect(errors).toContain('Debe incluir al menos un parrafo.');
  });

  test('rechaza titulo muy corto', () => {
    const errors = validateNoticia({ ...NOTICIA_VALIDA, titulo: 'Hi' });
    expect(errors).toContain('El titulo debe tener al menos 3 caracteres.');
  });

  test('rechaza fecha invalida', () => {
    const errors = validateNoticia({ ...NOTICIA_VALIDA, fecha: 'no-es-una-fecha' });
    expect(errors).toContain('La fecha no es valida.');
  });

  test('rechaza parrafos vacios', () => {
    const errors = validateNoticia({ ...NOTICIA_VALIDA, parrafos: ['   ', ''] });
    expect(errors).toContain('Debe incluir al menos un parrafo.');
  });

  test('en modo parcial (edicion) no exige campos ausentes', () => {
    expect(validateNoticia({ titulo: 'Nuevo titulo' }, { partial: true })).toEqual([]);
  });

  test('en modo parcial sigue validando los campos que si se envian', () => {
    const errors = validateNoticia({ titulo: 'Hi' }, { partial: true });
    expect(errors).toContain('El titulo debe tener al menos 3 caracteres.');
  });

  test('en modo parcial valida parrafos solo si se envian', () => {
    const errors = validateNoticia({ parrafos: [] }, { partial: true });
    expect(errors).toContain('Debe incluir al menos un parrafo.');
  });
});
