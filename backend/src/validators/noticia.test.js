const { validateNoticia } = require('./noticia');

const NOTICIA_VALIDA = {
  titulo: 'Un titulo cualquiera',
  fecha: '2026-01-15',
  categoria: 'salud',
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

  test('acepta destacado booleano y rechaza otros tipos', () => {
    expect(validateNoticia({ ...NOTICIA_VALIDA, destacado: true })).toEqual([]);
    expect(validateNoticia({ ...NOTICIA_VALIDA, destacado: false })).toEqual([]);
    expect(validateNoticia({ ...NOTICIA_VALIDA, destacado: 'true' }))
      .toContain('El campo "destacado" debe ser verdadero o falso.');
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

  test('acepta una categoria valida', () => {
    expect(validateNoticia({ ...NOTICIA_VALIDA, categoria: 'salud' })).toEqual([]);
  });

  test('rechaza una categoria invalida', () => {
    const errors = validateNoticia({ ...NOTICIA_VALIDA, categoria: 'chismes' });
    expect(errors).toContain('Categoria no valida.');
  });

  test('categoria es obligatoria al crear (ya no existe "general" por defecto)', () => {
    const sin = { ...NOTICIA_VALIDA };
    delete sin.categoria;
    expect(validateNoticia(sin)).toContain('El campo "categoria" es obligatorio.');
  });

  test('"general" ya no es una categoria valida', () => {
    expect(validateNoticia({ ...NOTICIA_VALIDA, categoria: 'general' })).toContain('Categoria no valida.');
  });

  test('al editar (parcial) la categoria sigue siendo opcional', () => {
    expect(validateNoticia({ titulo: 'Nuevo titulo' }, { partial: true })).toEqual([]);
  });

  test('acepta los 3 niveles de divulgacionIa y rechaza invalido', () => {
    expect(validateNoticia({ ...NOTICIA_VALIDA, divulgacionIa: 'no' })).toEqual([]);
    expect(validateNoticia({ ...NOTICIA_VALIDA, divulgacionIa: 'parcial' })).toEqual([]);
    expect(validateNoticia({ ...NOTICIA_VALIDA, divulgacionIa: 'generado' })).toEqual([]);
    expect(validateNoticia({ ...NOTICIA_VALIDA, divulgacionIa: 'total' })).toContain('Divulgacion de IA no valida.');
  });

  test('divulgacionIa es opcional (se asume "no")', () => {
    expect(validateNoticia(NOTICIA_VALIDA)).toEqual([]);
  });

  test('acepta publicado booleano y rechaza otros tipos', () => {
    expect(validateNoticia({ ...NOTICIA_VALIDA, publicado: true })).toEqual([]);
    expect(validateNoticia({ ...NOTICIA_VALIDA, publicado: false })).toEqual([]);
    expect(validateNoticia({ ...NOTICIA_VALIDA, publicado: 'si' }))
      .toContain('El campo "publicado" debe ser verdadero o falso.');
  });
});

describe('validateNoticia idiomaOriginal (Fase C2)', () => {
  const { validateNoticia: validar } = require('./noticia');
  test('acepta es y en, y rechaza cualquier otro valor', () => {
    expect(validar({ idiomaOriginal: 'es' }, { partial: true })).toEqual([]);
    expect(validar({ idiomaOriginal: 'en' }, { partial: true })).toEqual([]);
    expect(validar({ idiomaOriginal: 'fr' }, { partial: true })).toContain('Idioma original no valido.');
  });
});
