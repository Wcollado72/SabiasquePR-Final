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

describe('Noticias: categorías como interruptores y sin "General"', () => {
  const html = leer('noticias.html');
  const filtros = html.slice(html.indexOf('id="noticias-filters"'), html.indexOf('id="noticias-enfoque-filter"'));

  test('no hay botón "Todas" ni categoría "general"', () => {
    expect(filtros).not.toMatch(/>Todas</);
    expect(filtros).not.toMatch(/data-categoria="general"/);
    expect(filtros).not.toMatch(/data-categoria=""/);
  });

  test('hay 11 categorías y ninguna queda activa al entrar', () => {
    const valores = [...filtros.matchAll(/data-categoria="([a-z-]+)"/g)].map((m) => m[1]);
    expect(valores).toHaveLength(11);
    expect(filtros).not.toMatch(/foro-filter-btn active/);
    expect(filtros.match(/aria-pressed="false"/g)).toHaveLength(11);
  });

  test('noticias.js pide todas las secciones (sin ?seccion=) y usa armarCollage', () => {
    const js = leer('noticias.js');
    expect(js).not.toMatch(/seccion=noticias/);
    expect(js).toMatch(/armarCollage/);
    expect(js).toMatch(/sqpr_edad_confirmada_18mas/);
  });
});

describe('Admin: sin "General" y la categoría hay que elegirla', () => {
  const html = leer('admin.html');
  test.each(['an-categoria', 'ac-categoria'])('el selector %s no ofrece "general" y exige elegir', (id) => {
    const i = html.indexOf(`<select id="${id}"`);
    const sel = html.slice(i, html.indexOf('</select>', i));
    expect(sel).toMatch(/required/);
    expect(sel).toMatch(/Elige una categoría/);
    expect(sel).not.toMatch(/value="general"/);
  });
  test('admin.js ya no usa "general" como valor por defecto', () => {
    expect(leer('admin.js')).not.toMatch(/\|\| 'general'/);
  });
});

describe('Migración de categorías', () => {
  test('la migración reclasifica "general" y reemplaza las dos restricciones CHECK sin "general"', () => {
    const sql = leer('backend/sql/migraciones/2026-10-03-quitar-categoria-general.sql');
    expect(sql).toMatch(/UPDATE contenidos SET categoria = 'cultura' WHERE categoria = 'general'/);
    expect(sql).toMatch(/noticias_categoria_check/);
    expect(sql).toMatch(/contenidos_categoria_check/);
    const checks = sql.slice(sql.indexOf('ADD CONSTRAINT noticias_categoria_check'));
    expect(checks).not.toMatch(/'general'/);
  });
});

describe('Traducciones del collage', () => {
  const dic = JSON.parse(leer('i18n/en.json'));
  test.each(['Original', 'Elige una categoría'])('"%s" está en el diccionario', (k) => {
    expect(typeof dic[k]).toBe('string');
  });
});

describe('netlify.toml: redirección de la dirección de Netlify al dominio propio', () => {
  const toml = leer('netlify.toml');
  const primera = toml.slice(toml.indexOf('[[redirects]]'), toml.indexOf('[[redirects]]', toml.indexOf('[[redirects]]') + 1));

  test('la primera regla manda el nombre exacto de netlify.app a sabiasquepr.com conservando la ruta', () => {
    expect(primera).toMatch(/from = "https:\/\/fabulous-tartufo-fcb839\.netlify\.app\/\*"/);
    expect(primera).toMatch(/to = "https:\/\/sabiasquepr\.com\/:splat"/);
    expect(primera).toMatch(/status = 301/);
  });

  test('no usa un comodín que alcance a los deploy previews ni branch deploys', () => {
    expect(primera).not.toMatch(/\*\.netlify\.app/);
    expect(primera).not.toMatch(/deploy-preview|main--/);
  });
});
