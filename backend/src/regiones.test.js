// Filtro por región de la página Noticias (regiones.js, raíz del repo).
const { filtrarPorRegion } = require('../../regiones.js');

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
