// Sub-sección única del formulario de Contenidos (frontend/clasificacion.js).
const fs = require('fs');
const path = require('path');
const clasif = require('../../frontend/clasificacion.js');
const validador = require('./validators/contenido');

const html = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'admin.html'), 'utf8');

describe('clasificacion', () => {
  test('las listas coinciden con las que valida el backend', () => {
    const todas = [...clasif.CATEGORIAS_NOTICIAS, ...clasif.CATEGORIAS_EDUCACION];
    expect([...todas].sort()).toEqual([...validador.CATEGORIAS_VALIDAS].sort());
    expect([...clasif.SUBSECCIONES_RH].sort()).toEqual([...validador.SUBSECCIONES_VALIDAS].sort());
    expect(validador.CATEGORIAS_VALIDAS).toContain(clasif.CATEGORIA_POR_DEFECTO_RH);
  });

  test('clavesDe devuelve la lista de cada sección', () => {
    expect(clasif.clavesDe('noticias')).toHaveLength(11);
    expect(clasif.clavesDe('educacion')).toHaveLength(4);
    expect(clasif.clavesDe('revolucion-humana')).toHaveLength(5);
  });

  test('solo Revolución Humana permite dejarla vacía', () => {
    expect(clasif.esObligatoria('noticias')).toBe(true);
    expect(clasif.esObligatoria('educacion')).toBe(true);
    expect(clasif.esObligatoria('revolucion-humana')).toBe(false);
  });

  test('aCampos: Noticias y Educación guardan la categoría y ninguna sub-sección', () => {
    expect(clasif.aCampos('noticias', 'crimen')).toEqual({ categoria: 'crimen', subseccion: null });
    expect(clasif.aCampos('educacion', 'leyes-educativas')).toEqual({ categoria: 'leyes-educativas', subseccion: null });
  });

  test('aCampos: Revolución Humana usa la categoría por defecto o conserva la guardada', () => {
    expect(clasif.aCampos('revolucion-humana', 'logica-humana')).toEqual({ categoria: 'cultura', subseccion: 'logica-humana' });
    expect(clasif.aCampos('revolucion-humana', '')).toEqual({ categoria: 'cultura', subseccion: null });
    expect(clasif.aCampos('revolucion-humana', 'nuevos-humanos', 'salud')).toEqual({ categoria: 'salud', subseccion: 'nuevos-humanos' });
  });

  test('aValor es la operación inversa al cargar una pieza', () => {
    expect(clasif.aValor('noticias', null, 'crimen')).toBe('crimen');
    expect(clasif.aValor('revolucion-humana', 'logica-humana', 'cultura')).toBe('logica-humana');
    expect(clasif.aValor('revolucion-humana', null, 'cultura')).toBe('');
  });
});

describe('admin.html', () => {
  test('el formulario trae la sub-sección dinámica con sus opciones por sección', () => {
    expect(html).toContain('id="ac-clasificacion"');
    const m = html.match(/id="ac-clasificacion" data-opciones='([^']*)'/);
    const opciones = JSON.parse(m[1]);
    expect(opciones.noticias).toHaveLength(11);
    expect(opciones.educacion).toHaveLength(4);
    expect(opciones['revolucion-humana']).toHaveLength(5);
    for (const lista of Object.values(opciones)) for (const [, etiqueta] of lista) expect(etiqueta).toBeTruthy();
  });

  test('categoría y sub-sección son campos ocultos y la Región se ofrece siempre', () => {
    expect(html).toMatch(/<input type="hidden" id="ac-categoria">/);
    expect(html).toMatch(/<input type="hidden" id="ac-subseccion">/);
    expect(html).toContain('id="ac-enfoque"');
  });

  test('carga clasificacion.js antes que admin.js y la pestaña se llama Noticias rápidas', () => {
    expect(html.indexOf('clasificacion.js')).toBeGreaterThan(-1);
    expect(html.indexOf('clasificacion.js')).toBeLessThan(html.indexOf('admin.js'));
    expect(html).toContain('>Noticias rápidas</button>');
  });
});
