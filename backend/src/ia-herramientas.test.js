// Herramientas de IA usadas (iconos): frontend/ia-herramientas.js y su conexion con el formulario y las paginas.
const fs = require('fs');
const path = require('path');
const ia = require('../../frontend/ia-herramientas.js');
const { CLAVES_IA_CONOCIDAS, MAX_HERRAMIENTAS, MAX_NOMBRE } = require('./validators/iaHerramientas');

const frontend = path.join(__dirname, '..', '..', 'frontend');
const leer = (f) => fs.readFileSync(path.join(frontend, f), 'utf8');

describe('catalogo y limites', () => {
  test('las claves y los limites coinciden con los que valida el backend', () => {
    expect(ia.CLAVES_IA_CONOCIDAS).toEqual(CLAVES_IA_CONOCIDAS);
    expect(ia.MAX_HERRAMIENTAS).toBe(MAX_HERRAMIENTAS);
    expect(ia.MAX_NOMBRE).toBe(MAX_NOMBRE);
  });

  test('cada IA conocida tiene su icono en images/ia/ (SVG con titulo)', () => {
    for (const clave of ia.CLAVES_IA_CONOCIDAS) {
      const svg = fs.readFileSync(path.join(frontend, ia.iconoDe(clave)), 'utf8');
      expect(svg).toMatch(/^<svg /);
      expect(svg).toContain('<title>');
    }
    expect(ia.iconoDe('mistral')).toBeNull();
  });

  test('el nombre visible de las conocidas va con su capitalizacion; las otras se muestran tal cual', () => {
    expect(ia.nombreDe('chatgpt')).toBe('ChatGPT');
    expect(ia.nombreDe('Mistral')).toBe('Mistral');
  });
});

describe('normalizar', () => {
  test('recorta, pasa las conocidas a minuscula y quita vacias y repetidas', () => {
    expect(ia.normalizar([' Claude ', 'claude', 'GEMINI', '', '   ', 'Mistral', 'mistral'])).toEqual(['claude', 'gemini', 'Mistral']);
  });

  test('ignora lo que no es texto y respeta el maximo y el largo del nombre', () => {
    const muchas = Array.from({ length: 12 }, (_, i) => `IA numero ${i}`);
    expect(ia.normalizar(muchas)).toHaveLength(MAX_HERRAMIENTAS);
    expect(ia.normalizar([42, null, { a: 1 }, 'ok'])).toEqual(['ok']);
    expect(ia.normalizar(['x'.repeat(80)])[0]).toHaveLength(MAX_NOMBRE);
    expect(ia.normalizar(undefined)).toEqual([]);
  });
});

describe('insigniasHtml', () => {
  test('sin herramientas no pinta nada', () => {
    expect(ia.insigniasHtml([])).toBe('');
    expect(ia.insigniasHtml(undefined)).toBe('');
  });

  test('las conocidas llevan icono y nombre; las escritas a mano solo el nombre', () => {
    const html = ia.insigniasHtml(['claude', 'Mistral']);
    expect(html).toContain('<img src="images/ia/claude.svg"');
    expect(html).toContain('Claude</span>');
    expect(html).toContain('ia-chip-otra');
    expect(html).not.toContain('images/ia/mistral');
  });

  test('escapa el HTML de un nombre escrito a mano', () => {
    const html = ia.insigniasHtml(['<img src=x onerror=alert(1)>']);
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img');
  });
});

describe('conexion con el formulario y las paginas', () => {
  test('los formularios tienen su selector, y las paginas cargan el modulo antes de editorial.js', () => {
    const admin = leer('admin.html');
    expect(admin).toContain('id="an-ia-selector"');
    expect(admin).toContain('id="ac-ia-selector"');
    for (const pagina of ['admin.html', 'index.html', 'noticias.html', 'articulo.html', 'recurso.html', 'revolucion-humana.html', 'educacion.html']) {
      const html = leer(pagina);
      expect(html.indexOf('ia-herramientas.js')).toBeGreaterThan(-1);
      expect(html.indexOf('ia-herramientas.js')).toBeLessThan(html.indexOf('editorial.js'));
    }
    expect(leer('sw.js')).toContain("'/ia-herramientas.js'");
  });

  test('el panel envia iaHerramientas al guardar noticias y contenidos y las carga al editar', () => {
    const js = leer('admin.js');
    expect(js).toMatch(/iaHerramientas: selectorIaNoticia\.leer\(\)/);
    expect(js).toMatch(/iaHerramientas: selectorIaContenido\.leer\(\)/);
    expect(js).toMatch(/cargarIaEnSelector\(selectorIaNoticia, 'an-divulgacion-ia', item\?\.ia_herramientas\)/);
    expect(js).toMatch(/cargarIaEnSelector\(selectorIaContenido, 'ac-divulgacion-ia', item\?\.ia_herramientas\)/);
  });

  test('las tarjetas y paginas de noticias y contenidos muestran la divulgacion con los iconos', () => {
    const ed = leer('editorial.js');
    expect(ed).toContain('function iaBadgesHtml');
    expect(ed).toMatch(/ia_herramientas: row\.ia_herramientas/);
    expect(ed).toMatch(/\+ iaBadgesHtml\(art\)/);
    expect(leer('recurso.js')).toContain('S.iaBadgesHtml(item)');
    expect(leer('articulo.js')).toContain('S.iaBadgesHtml(art)');
  });
});
