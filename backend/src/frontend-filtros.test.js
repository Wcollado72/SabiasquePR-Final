// Filas de filtro de Noticias (regiones) y Educación (4 categorías), y el formulario del debate sin "Enfoque".
// Lee los archivos generados por build.js que están en la raíz del repo (los mismos que se publican).
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..', '..');
const leer = (f) => fs.readFileSync(path.join(raiz, f), 'utf8');

describe('Noticias: botones de región', () => {
  const html = leer('noticias.html');

  test('hay una fila de 4 botones de región, con Puerto Rico activo, debajo de las categorías', () => {
    expect(html).toMatch(/id="noticias-enfoque-filter"/);
    const valores = [...html.matchAll(/data-enfoque="([a-z-]+)"/g)].map((m) => m[1]);
    expect(valores).toEqual(['puerto-rico', 'estados-unidos', 'hispanoamerica', 'internacionales']);
    expect(html).toMatch(/foro-filter-btn active" aria-pressed="true" data-enfoque="puerto-rico"/);
    expect(html.indexOf('id="noticias-filters"')).toBeLessThan(html.indexOf('id="noticias-enfoque-filter"'));
  });

  test('carga regiones.js antes que noticias.js', () => {
    expect(html.indexOf('regiones.js')).toBeGreaterThan(-1);
    expect(html.indexOf('regiones.js')).toBeLessThan(html.indexOf('noticias.js'));
  });
});

describe('Educación: botones por categoría', () => {
  const html = leer('educacion.html');

  test('hay 4 botones de categoría educativa, el primero activo, conectados a la grilla', () => {
    const valores = [...html.matchAll(/data-categoria="([a-z-]+)"/g)].map((m) => m[1]);
    expect(valores).toEqual(['estudiantes-sobresalientes', 'leyes-educativas', 'programas-educativos', 'sistemas-mundiales']);
    expect(html).toMatch(/foro-filter-btn active" aria-pressed="true" data-categoria="estudiantes-sobresalientes"/);
    expect(html).toMatch(/data-filters="edu-categoria-filter"/);
    expect(html).toMatch(/id="edu-categoria-filter" data-filter-param="categoria"/);
  });
});

describe('Debate: formulario sin "Enfoque"', () => {
  const js = leer('debate.js');

  test('el formulario ya no tiene el selector de enfoque ni lo envía', () => {
    expect(js).not.toMatch(/debate-enfoque/);
    expect(js).not.toMatch(/ENFOQUE_OPCIONES/);
  });

  test('sigue mostrando la etiqueta de las publicaciones que ya tienen enfoque', () => {
    expect(js).toMatch(/ENFOQUE_LABEL/);
  });
});

describe('Traducciones nuevas', () => {
  const dic = JSON.parse(leer('i18n/en.json'));
  test.each(['Filtrar por región', 'Filtrar por tema', 'Aún no hay noticias en esta selección.'])('"%s" está en inglés', (k) => {
    expect(typeof dic[k]).toBe('string');
    expect(dic[k].length).toBeGreaterThan(3);
  });
});
