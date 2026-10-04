const { calcularDelta, enTandas, ORDEN_TABLAS_PUBLIC } = require('./delta');

describe('calcularDelta', () => {
  test('detecta faltantes, extras y modificadas', () => {
    const viejo = new Map([['a', 'h1'], ['b', 'h2'], ['c', 'h3']]);
    const nuevo = new Map([['a', 'h1'], ['b', 'OTRO'], ['z', 'h9']]);
    expect(calcularDelta(viejo, nuevo)).toEqual({ faltantes: ['c'], extras: ['z'], modificadas: ['b'] });
  });

  test('copias idénticas: no hay nada que sincronizar', () => {
    const m = new Map([['a', 'h1'], ['b', 'h2']]);
    expect(calcularDelta(m, new Map(m))).toEqual({ faltantes: [], extras: [], modificadas: [] });
  });

  test('nuevo vacío: todo el viejo falta', () => {
    expect(calcularDelta(new Map([['a', 1], ['b', 2]]), new Map()).faltantes).toEqual(['a', 'b']);
  });

  test('no modifica los mapas recibidos', () => {
    const viejo = new Map([['a', 'h1']]);
    const nuevo = new Map([['b', 'h2']]);
    calcularDelta(viejo, nuevo);
    expect([...viejo]).toEqual([['a', 'h1']]);
    expect([...nuevo]).toEqual([['b', 'h2']]);
  });
});

describe('enTandas', () => {
  test('divide en grupos del tamaño pedido', () => {
    expect(enTandas([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(enTandas([], 3)).toEqual([]);
  });
});

describe('ORDEN_TABLAS_PUBLIC', () => {
  test('los padres van antes que los hijos (perfiles antes de órdenes y foro; posts antes de comentarios)', () => {
    const i = (t) => ORDEN_TABLAS_PUBLIC.indexOf(t);
    expect(i('perfiles')).toBeLessThan(i('ordenes'));
    expect(i('perfiles')).toBeLessThan(i('foro_posts'));
    expect(i('foro_posts')).toBeLessThan(i('foro_comentarios'));
    expect(i('contenidos')).toBeLessThan(i('foro_posts')); // foro_posts.tema_contenido_id
  });
  test('no repite tablas', () => {
    expect(new Set(ORDEN_TABLAS_PUBLIC).size).toBe(ORDEN_TABLAS_PUBLIC.length);
  });
});
