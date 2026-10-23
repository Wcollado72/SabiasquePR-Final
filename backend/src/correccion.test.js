// Correctores de idioma del panel (frontend/correccion.js): funciones puras + que el módulo esté cableado.
const fs = require('fs');
const path = require('path');
const corr = require('../../frontend/correccion.js');
const { VARIANTES_VALIDAS } = require('./validators/correccion');

const leer = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', ...p), 'utf8');

describe('variantes', () => {
  test('coinciden con las que valida el backend', () => {
    expect(corr.VARIANTES.map((v) => v.codigo).sort()).toEqual([...VARIANTES_VALIDAS].sort());
  });

  test('LanguageTool recibe es o el inglés correspondiente', () => {
    expect(corr.codigoLanguageTool('es-PR')).toBe('es');
    expect(corr.codigoLanguageTool('es-419')).toBe('es');
    expect(corr.codigoLanguageTool('en-GB')).toBe('en-GB');
    expect(corr.codigoLanguageTool('en-US')).toBe('en-US');
    expect(corr.codigoLanguageTool('xx')).toBe('es');
  });

  test('variante inicial: español de PR salvo que el destino sea inglés', () => {
    expect(corr.varianteInicial('es')).toBe('es-PR');
    expect(corr.varianteInicial('en')).toBe('en-US');
  });
});

describe('diccionario de Puerto Rico y del proyecto', () => {
  const error = (offset, length, regla = 'MORFOLOGIK_RULE_ES') =>
    ({ offset, length, message: 'x', rule: { id: regla, issueType: 'misspelling' } });

  test('no marca puertorriqueñismos ni nombres del proyecto', () => {
    const texto = 'La guagua llegó a Loíza con Aliado Imperfekto';
    const matches = [error(3, 6), error(18, 5), error(28, 6), error(35, 10)];
    expect(corr.filtrarCoincidencias(texto, matches)).toEqual([]);
  });

  test('sigue marcando errores reales y los que no son de ortografía', () => {
    const texto = 'Una palabrra mala';
    const real = error(4, 8);
    const gramatica = { offset: 0, length: 3, message: 'g', rule: { id: 'X', issueType: 'grammar' } };
    expect(corr.filtrarCoincidencias(texto, [real, gramatica])).toEqual([real, gramatica]);
  });

  test('respeta las palabras que el admin agrega', () => {
    const texto = 'El zorzal canta';
    expect(corr.filtrarCoincidencias(texto, [error(3, 6)], ['Zorzal'])).toEqual([]);
  });
});

describe('aplicarReemplazo', () => {
  test('reemplaza solo el fragmento indicado', () => {
    expect(corr.aplicarReemplazo('Hola mundoo', 5, 6, 'mundo')).toBe('Hola mundo');
  });
});

describe('cableado en el panel', () => {
  test('admin.html carga correccion.js antes de admin.js y ya no tiene el botón viejo', () => {
    const html = leer('admin.html');
    expect(html.indexOf('correccion.js')).toBeGreaterThan(-1);
    expect(html.indexOf('correccion.js')).toBeLessThan(html.indexOf('admin.js'));
    expect(html).not.toContain('data-revisar');
  });

  test('el service worker lo precarga', () => {
    expect(leer('sw.js')).toContain("'/correccion.js'");
  });

  test('los campos con barra existen en el panel', () => {
    const html = leer('admin.html');
    corr.CAMPOS.forEach((id) => expect(html).toContain(`id="${id}"`));
  });

  test('la ruta del servidor es la que llama el panel', () => {
    expect(leer('correccion.js')).toContain('/api/admin/corregir');
  });
});

describe('sintaxis del panel', () => {
  test.each(['admin.js', 'correccion.js'])('%s se puede interpretar sin errores', (archivo) => {
    expect(() => new (require('vm').Script)(leer(archivo), { filename: archivo })).not.toThrow();
  });
});
