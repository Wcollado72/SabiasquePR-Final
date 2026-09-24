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
