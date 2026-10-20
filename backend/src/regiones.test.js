// Filtro por región y armado del collage de Noticias (regiones.js, raíz del repo).
const { filtrarPorRegion, es18Mas, espaciarPremium, armarCollage } = require('../../frontend/regiones.js');

const items = [
  { id: 1, enfoque: 'puerto-rico' },
  { id: 2, enfoque: 'estados-unidos' },
  { id: 3, enfoque: 'internacionales' },
  { id: 4 }, // sin región (noticia antigua)
  { id: 5, enfoque: null }, // sin región asignada
];

describe('filtrarPorRegion', () => {
  test('sin región elegida devuelve todo', () => {
    expect(filtrarPorRegion(items, '')).toHaveLength(5);
    expect(filtrarPorRegion(items, undefined)).toHaveLength(5);
  });

  test('con una región, muestra las de esa región y las que no tienen región', () => {
    expect(filtrarPorRegion(items, 'puerto-rico').map((i) => i.id)).toEqual([1, 4, 5]);
    expect(filtrarPorRegion(items, 'estados-unidos').map((i) => i.id)).toEqual([2, 4, 5]);
  });

  test('una región sin contenido propio sigue mostrando las que no tienen región (nada publicado desaparece)', () => {
    expect(filtrarPorRegion(items, 'hispanoamerica').map((i) => i.id)).toEqual([4, 5]);
  });

  test('no modifica el arreglo original', () => {
    const copia = JSON.stringify(items);
    filtrarPorRegion(items, 'puerto-rico');
    expect(JSON.stringify(items)).toBe(copia);
  });
});

describe('es18Mas', () => {
  test('solo Corrupción Humana e Ilógica Humana son 18+', () => {
    expect(es18Mas({ subseccion: 'corrupcion-humana' })).toBe(true);
    expect(es18Mas({ subseccion: 'ilogica-humana' })).toBe(true);
    expect(es18Mas({ subseccion: 'nuevos-humanos' })).toBe(false);
    expect(es18Mas({ subseccion: 'logica-humana' })).toBe(false);
    expect(es18Mas({ seccion: 'noticias' })).toBe(false);
    expect(es18Mas(null)).toBe(false);
  });
});

describe('espaciarPremium', () => {
  const p = (id) => ({ id, es_premium: true });
  const n = (id) => ({ id });
  const ids = (l) => l.map((i) => i.id);

  test('no deja dos premium seguidas ni más de una por cada 4', () => {
    const r = espaciarPremium([p('a'), p('b'), n(1), n(2), n(3), n(4), n(5)], 4);
    const pos = r.map((i, k) => (i.es_premium ? k : -1)).filter((k) => k >= 0);
    expect(pos.length).toBe(2);
    expect(pos[1] - pos[0]).toBeGreaterThanOrEqual(4);
  });

  test('no descarta nada: lo que no cabe va al final', () => {
    const r = espaciarPremium([p('a'), p('b'), p('c')], 4);
    expect(ids(r).sort()).toEqual(['a', 'b', 'c']);
  });

  test('sin premium, el orden no cambia', () => {
    expect(ids(espaciarPremium([n(1), n(2), n(3)], 4))).toEqual([1, 2, 3]);
  });
});

describe('armarCollage', () => {
  const base = [
    { id: 'n1', seccion: 'noticias', fecha_publicacion: '2026-09-23', tipo_formato: 'video' },
    { id: 'n2', seccion: 'noticias', fecha_publicacion: '2026-09-22', tipo_formato: 'ensayo' },
    { id: 'n3', seccion: 'noticias', fecha_publicacion: '2026-09-21', tipo_formato: 'noticia' },
    { id: 'rh1', seccion: 'revolucion-humana', subseccion: 'nuevos-humanos', enfoque: 'puerto-rico', fecha_publicacion: '2026-09-01' },
    { id: 'rh2', seccion: 'revolucion-humana', subseccion: 'nuevos-humanos', enfoque: 'puerto-rico', fecha_publicacion: '2026-08-30' },
    { id: 'e1', seccion: 'educacion', fecha_publicacion: '2026-08-01' },
    { id: 'c1', seccion: 'revolucion-humana', subseccion: 'corrupcion-humana', fecha_publicacion: '2026-09-30' },
    { id: 'i1', seccion: 'revolucion-humana', subseccion: 'ilogica-humana', fecha_publicacion: '2026-09-29' },
  ];
  const ids = (l) => l.map((i) => i.id);

  test('incluye al menos una pieza de cada sección/subsección y las reparte por turnos', () => {
    const r = ids(armarCollage(base, {}));
    // primer turno: la más reciente de cada grupo (noticias, nuevos-humanos, educacion)
    expect(r.slice(0, 3)).toEqual(['n1', 'rh1', 'e1']);
    expect(r).toHaveLength(6);
  });

  test('18+ (opción A): sin edad verificada NO entran; con edad verificada sí', () => {
    expect(ids(armarCollage(base, { adultoVerificado: false }))).not.toEqual(expect.arrayContaining(['c1']));
    expect(ids(armarCollage(base, { adultoVerificado: false }))).not.toEqual(expect.arrayContaining(['i1']));
    const con = ids(armarCollage(base, { adultoVerificado: true }));
    expect(con).toEqual(expect.arrayContaining(['c1', 'i1']));
  });

  test('aplica la región: lo de otra región sale; lo sin región se queda', () => {
    const r = ids(armarCollage(base, { region: 'estados-unidos' }));
    expect(r).not.toContain('rh1');
    expect(r).toEqual(expect.arrayContaining(['n1', 'e1']));
  });

  test('es estable: el mismo resultado en cada llamada', () => {
    expect(ids(armarCollage(base, {}))).toEqual(ids(armarCollage(base, {})));
  });

  test('premium: con una proporción normal (2 de 10) nunca quedan dos seguidas', () => {
    const lista = Array.from({ length: 10 }, (_, k) => ({ id: 'p' + k, seccion: 'noticias', fecha_publicacion: '2026-09-' + (10 + k), es_premium: k % 5 === 0 }));
    const r = armarCollage(lista, {});
    expect(r).toHaveLength(10);
    for (let k = 1; k < r.length; k += 1) expect(r[k].es_premium && r[k - 1].es_premium).toBeFalsy();
  });

  test('con lista vacía devuelve vacío', () => {
    expect(armarCollage([], {})).toEqual([]);
  });
});
