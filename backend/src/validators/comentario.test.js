const { validateComentario } = require('./comentario');

const VALIDO = { tipo: 'contenido', itemId: 'un-articulo', cuerpo: 'Buen articulo!' };

describe('validateComentario', () => {
  test('acepta un comentario valido', () => {
    expect(validateComentario(VALIDO)).toEqual([]);
  });

  test('acepta tipo "noticia"', () => {
    expect(validateComentario({ ...VALIDO, tipo: 'noticia' })).toEqual([]);
  });

  test('rechaza tipo invalido o ausente', () => {
    expect(validateComentario({ ...VALIDO, tipo: 'foro' }))
      .toContain('El campo "tipo" debe ser "noticia" o "contenido".');
    expect(validateComentario({ ...VALIDO, tipo: undefined }))
      .toContain('El campo "tipo" debe ser "noticia" o "contenido".');
  });

  test('rechaza itemId vacio o ausente', () => {
    expect(validateComentario({ ...VALIDO, itemId: '' })).toContain('El campo "itemId" es obligatorio.');
    expect(validateComentario({ ...VALIDO, itemId: undefined })).toContain('El campo "itemId" es obligatorio.');
  });

  test('rechaza cuerpo muy corto o ausente', () => {
    expect(validateComentario({ ...VALIDO, cuerpo: 'x' })).toContain('El comentario debe tener al menos 2 caracteres.');
    expect(validateComentario({ ...VALIDO, cuerpo: '' })).toContain('El comentario debe tener al menos 2 caracteres.');
  });
});

describe('validateComentario -- largo maximo', () => {
  const { validateComentario: validar, MAX_COMENTARIO_CARACTERES } = require('./comentario');
  test('rechaza mas de 2000 caracteres y acepta exactamente 2000', () => {
    expect(MAX_COMENTARIO_CARACTERES).toBe(2000);
    expect(validar({ tipo: 'noticia', itemId: 'a', cuerpo: 'a'.repeat(2000) })).toEqual([]);
    expect(validar({ tipo: 'noticia', itemId: 'a', cuerpo: 'a'.repeat(2001) })).toEqual(['El comentario no puede superar 2000 caracteres.']);
  });
  test('un cuerpo que no es texto da error en vez de romper', () => {
    expect(validar({ tipo: 'noticia', itemId: 'a', cuerpo: { x: 1 } })).toHaveLength(1);
  });
});
