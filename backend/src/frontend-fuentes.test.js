// Taller E4: «otras fuentes» en el panel (formularios de Contenidos y Noticias, informe de La Guardiana) y en las páginas públicas.
const fs = require('fs');
const path = require('path');

const frontend = path.join(__dirname, '..', '..', 'frontend');
const leer = (f) => fs.readFileSync(path.join(frontend, f), 'utf8');
const entre = (texto, inicio) => {
  const a = texto.indexOf(`// INICIO ${inicio}`);
  const b = texto.indexOf(`// FIN ${inicio}`);
  if (a < 0 || b < 0) throw new Error(`Faltan las marcas ${inicio}`);
  return texto.slice(a, b);
};
const html = leer('admin.html');
const js = leer('admin.js');
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

describe('formularios: dónde se agregan las otras fuentes', () => {
  test.each(['contenido', 'noticia'])('la mesa de %s tiene su lista y su botón «Agregar otra fuente»', (clave) => {
    ['fuentes-extra', 'fuentes-extra-lista', 'fuentes-extra-agregar'].forEach((id) => expect(html).toContain(`id="${id}-${clave}"`));
    expect(js).toContain(`bindFuentesExtra('${clave}');`);
    expect(js).toContain(`pintarFuentesExtra('${clave}', item?.fuentes);`);
    expect(js).toContain(`fuentes: leerFuentesExtraDe('${clave}'),`);
  });

  test('solo la mesa de Contenidos menciona a Doña Pesquisa (la de Noticias no usa la Investigadora)', () => {
    const bloque = (clave) => html.slice(html.indexOf(`id="fuentes-extra-${clave}"`), html.indexOf(`id="fuentes-extra-lista-${clave}"`));
    expect(bloque('contenido')).toContain('Doña Pesquisa las lee todas juntas');
    expect(bloque('noticia')).not.toContain('Doña Pesquisa');
  });

  test('el Detective, la Guardiana y la Investigadora reciben las otras fuentes', () => {
    expect(js).toContain('fuentesExtra: urlsExtraDe(clave) };'); // Detective y Guardiana (una vez cada una)
    expect((js.match(/fuentesExtra: urlsExtraDe\(clave\)/g) || []).length).toBe(2);
    expect(js).toContain("const extras = urlsExtraDe('contenido');");
    expect(js).toContain('if (extras.length) body.fuentesExtra = extras;');
  });
});

describe('funciones puras de las otras fuentes', () => {
  const { limpiarFilasFuentes, htmlFilaFuente, nombreDeUrl } = new Function(`${entre(js, 'fuentes-extra')}
    return { limpiarFilasFuentes, htmlFilaFuente, nombreDeUrl };`)();

  test('el nombre por defecto es el sitio del enlace, sin «www.»', () => {
    expect(nombreDeUrl('https://www.elnuevodia.com/noticias/x')).toBe('elnuevodia.com');
    expect(nombreDeUrl('no es url')).toBe('');
  });

  test('de las filas del formulario salen solo las que tienen algo, con el nombre completado y sin espacios', () => {
    expect(limpiarFilasFuentes([
      { url: ' https://www.bbc.com/mundo/x ', nombre: '' }, { url: '', nombre: '' }, { url: '', nombre: ' Libro de Freire ' },
      { url: 'https://a.com', nombre: 'Medio A' }, { url: 'sin formato', nombre: '' },
    ])).toEqual([
      { nombre: 'bbc.com', url: 'https://www.bbc.com/mundo/x' }, { nombre: 'Libro de Freire', url: '' }, { nombre: 'Medio A', url: 'https://a.com' },
    ]);
  });

  test('la fila escapa lo que traiga y deja los dos campos y el botón de quitar', () => {
    const h = htmlFilaFuente({ nombre: 'Diario "X" <b>', url: 'https://a.com/?a=1&b=2' }, esc);
    expect(h).toContain('value="Diario &quot;X&quot; &lt;b>"');
    expect(h).toContain('value="https://a.com/?a=1&amp;b=2"');
    ['fe-url', 'fe-nombre', 'fe-quitar'].forEach((c) => expect(h).toContain(c));
    expect(htmlFilaFuente({}, esc)).toContain('class="fe-url"');
  });
});

describe('informe de La Guardiana con otras fuentes', () => {
  const { htmlRevision } = new Function(`${entre(js, 'brigada-guardiana')}
    return { htmlRevision };`)();
  const base = {
    copia: { evaluable: true, porcentaje: 3, nivel: 'bajo', pasajes: [] },
    revision: { banderas: [], requiere18: false, motivo18: '' },
  };

  test('muestra el parecido con cada otra fuente y sus pasajes cuando es medio o alto', () => {
    const h = htmlRevision({
      ...base,
      copiasExtra: [
        { url: 'https://b.com/y', copia: { evaluable: true, porcentaje: 42, nivel: 'alto', pasajes: [{ texto: 'una frase copiada', palabras: 12 }] } },
        { url: 'https://c.com/z', copia: { evaluable: false, motivo: 'No se pudo leer la fuente para comparar: HTTP 403' } },
      ],
    }, esc);
    expect(h).toContain('Parecido con otra fuente</strong> (https://b.com/y). 42%');
    expect(h).toContain('brigada-copia-alto');
    expect(h).toContain('«una frase copiada»');
    expect(h).toContain('(https://c.com/z). No se pudo leer la fuente');
  });

  test('sin otras fuentes el informe es el de siempre', () => {
    const h = htmlRevision(base, esc);
    expect(h).not.toContain('otra fuente');
    expect(h).toContain('Parecido con la fuente.');
  });
});

describe('páginas públicas: «Otras fuentes»', () => {
  // Un «document» minimo: lo unico que usa escapeHtml es createElement('div') con textContent -> innerHTML.
  const documentoFalso = {
    createElement: () => {
      let texto = '';
      return {
        set textContent(v) { texto = v; },
        get innerHTML() { return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); },
      };
    },
  };
  const ventana = {};
  new Function('window', 'document', leer('editorial.js'))(ventana, documentoFalso);
  const otras = ventana.SQPR.otrasFuentesHtml;

  test('lista cada fuente, con enlace solo si es http(s) seguro, y escapa el nombre', () => {
    const h = otras([
      { nombre: 'El Nuevo Día', url: 'https://elnuevodia.com/a?x=1&y=2' }, { nombre: 'Libro <i>', url: '' }, { nombre: 'Trampa', url: 'javascript:alert(1)' },
    ]);
    expect(h).toContain('<p class="article-source article-source-extra">Otras fuentes:</p>');
    expect(h).toContain('<a href="https://elnuevodia.com/a?x=1&amp;y=2" target="_blank" rel="noopener noreferrer">El Nuevo Día</a>');
    expect(h).toContain('<li>Libro &lt;i&gt;</li>');
    expect(h).toContain('<li>Trampa</li>');
    expect(h).not.toContain('javascript:');
  });

  test('sin fuentes (o datos raros) no pinta nada', () => {
    expect(otras([])).toBe('');
    expect(otras(undefined)).toBe('');
    expect(otras('x')).toBe('');
    expect(otras([null, { url: 'https://x.com' }])).toBe('');
  });

  test('las páginas de contenido y de noticia la usan y el texto está traducido al inglés', () => {
    expect(leer('recurso.js')).toContain('S.otrasFuentesHtml(item.fuentes)');
    expect(leer('articulo.js')).toContain('S.otrasFuentesHtml(art.fuentes)');
    expect(JSON.parse(leer('i18n/en.json'))['Otras fuentes:']).toBe('Other sources:');
  });
});
