const { validarFuentes, normalizarFuentes, resolverFuentes, limpiarUrlsExtra, MAX_FUENTES } = require('./fuentes');

describe('validarFuentes', () => {
  test('lo omitido y una lista válida (con o sin enlace) no tienen errores', () => {
    expect(validarFuentes(undefined)).toEqual([]);
    expect(validarFuentes([])).toEqual([]);
    expect(validarFuentes([{ nombre: 'Diario', url: 'https://d.com/a' }, { nombre: 'Libro' }, { nombre: 'Otro', url: '' }, { nombre: 'Nulo', url: null }])).toEqual([]);
  });

  test.each([
    ['no es una lista', 'x', /lista/],
    ['más de 4 fuentes', Array.from({ length: MAX_FUENTES + 1 }, (_, i) => ({ nombre: `F${i}` })), /hasta 4/],
    ['un elemento que no es objeto', ['https://x.com'], /fuente 1 no es válida/],
    ['sin nombre', [{ nombre: '   ' }], /necesita un nombre/],
    ['nombre larguísimo', [{ nombre: 'x'.repeat(201) }], /necesita un nombre/],
    ['enlace con otro esquema', [{ nombre: 'M', url: 'javascript:alert(1)' }], /URL http/],
    ['enlace que no es texto', [{ nombre: 'M', url: 5 }], /URL http/],
    ['enlace sin formato de URL', [{ nombre: 'M', url: 'no es url' }], /URL http/],
  ])('rechaza %s', (_, valor, patron) => {
    const errores = validarFuentes(valor);
    expect(errores.length).toBeGreaterThan(0);
    expect(errores.join(' ')).toMatch(patron);
  });
});

describe('normalizarFuentes y resolverFuentes', () => {
  test('deja solo nombre y enlace, sin espacios sobrantes y sin repetir el mismo enlace (o el mismo nombre sin enlace)', () => {
    expect(normalizarFuentes([
      { nombre: ' A ', url: ' https://a.com ', otra: 'x' }, { nombre: 'A de nuevo', url: 'https://A.com' }, { nombre: 'Libro' }, { nombre: 'libro' },
    ])).toEqual([{ nombre: 'A', url: 'https://a.com' }, { nombre: 'Libro', url: '' }]);
    expect(normalizarFuentes(undefined)).toEqual([]);
  });

  test('omitido conserva lo que había (o vacío); enviado reemplaza, incluso por una lista vacía', () => {
    expect(resolverFuentes({}, { fuentes: [{ nombre: 'Vieja', url: '' }] })).toEqual([{ nombre: 'Vieja', url: '' }]);
    expect(resolverFuentes({})).toEqual([]);
    expect(resolverFuentes({ fuentes: [] }, { fuentes: [{ nombre: 'Vieja', url: '' }] })).toEqual([]);
    expect(resolverFuentes({ fuentes: [{ nombre: 'N', url: 'https://n.com' }] }, {})).toEqual([{ nombre: 'N', url: 'https://n.com' }]);
  });
});

describe('limpiarUrlsExtra', () => {
  test('acepta textos u objetos con url, omite los que no tienen enlace y quita repetidos', () => {
    expect(limpiarUrlsExtra(['https://a.com', { nombre: 'B', url: ' https://b.com ' }, { nombre: 'Libro' }, 'https://a.com'])).toEqual({ urls: ['https://a.com', 'https://b.com'] });
    expect(limpiarUrlsExtra(undefined)).toEqual({ urls: [] });
    expect(limpiarUrlsExtra(null)).toEqual({ urls: [] });
  });

  test('rechaza lo que no es una lista, más de 4 y enlaces que no son http(s)', () => {
    expect(limpiarUrlsExtra('x').error).toMatch(/lista/);
    expect(limpiarUrlsExtra(Array.from({ length: 5 }, (_, i) => `https://m${i}.com`)).error).toMatch(/hasta 4/);
    expect(limpiarUrlsExtra(['ftp://x.com']).error).toMatch(/http/);
    expect(limpiarUrlsExtra([{ url: 'https://' + 'a'.repeat(2000) + '.com' }]).error).toMatch(/http/);
  });
});
