const { validateTraduccion, CAMPOS_POR_TIPO } = require('./traduccion');

describe('validateTraduccion', () => {
  test('acepta una traduccion valida de noticia y la sanea', () => {
    const r = validateTraduccion('noticia', 'en', {
      titulo: '  Title  ', parrafos: ['One.', '  ', ' Two. '], imagen_alt: '', imagen_caption: 'Caption',
    });
    expect(r.errors).toEqual([]);
    expect(r.campos).toEqual({ titulo: 'Title', parrafos: ['One.', 'Two.'], imagen_caption: 'Caption' });
  });

  test('acepta contenido y producto con sus campos propios', () => {
    expect(validateTraduccion('contenido', 'en', { titulo: 'T', subtitulo_resumen: 'S', cuerpo: 'C', portada_alt: 'A' }).errors).toEqual([]);
    expect(validateTraduccion('producto', 'es', { nombre: 'Mug', descripcion: 'A mug' }).errors).toEqual([]);
  });

  test('rechaza tipo o idioma invalidos', () => {
    expect(validateTraduccion('inventado', 'en', { titulo: 'x' }).errors).toContain('Tipo de contenido no valido.');
    expect(validateTraduccion('noticia', 'fr', { titulo: 'x' }).errors).toContain('Idioma no valido.');
  });

  test('rechaza campos no traducibles (precio, enlaces, ids)', () => {
    const r = validateTraduccion('producto', 'en', { nombre: 'Mug', precio: 5, stripe_link: 'https://x.com' });
    expect(r.errors).toEqual(expect.arrayContaining([
      'El campo "precio" no se puede traducir.',
      'El campo "stripe_link" no se puede traducir.',
    ]));
  });

  test('rechaza campos que no son del tipo correcto', () => {
    expect(validateTraduccion('noticia', 'en', { parrafos: 'texto suelto' }).errors[0]).toMatch(/lista de parrafos/);
    expect(validateTraduccion('noticia', 'en', { parrafos: [5] }).errors[0]).toMatch(/Cada parrafo/);
    expect(validateTraduccion('noticia', 'en', { titulo: 5 }).errors[0]).toMatch(/debe ser texto/);
  });

  test('respeta los limites de longitud', () => {
    expect(validateTraduccion('noticia', 'en', { titulo: 'a'.repeat(301) }).errors[0]).toMatch(/supera 300/);
    const muchos = Array.from({ length: CAMPOS_POR_TIPO.noticia.parrafos.maxItems + 1 }, () => 'p');
    expect(validateTraduccion('noticia', 'en', { parrafos: muchos }).errors[0]).toMatch(/demasiados parrafos/);
  });

  test('rechaza una traduccion vacia o sin objeto', () => {
    expect(validateTraduccion('noticia', 'en', { titulo: '   ', parrafos: [] }).errors).toContain('La traduccion no tiene ningun texto.');
    expect(validateTraduccion('noticia', 'en', null).errors).toContain('Faltan los campos de la traduccion.');
    expect(validateTraduccion('noticia', 'en', ['x']).errors).toContain('Faltan los campos de la traduccion.');
  });
});
