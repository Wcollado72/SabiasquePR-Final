const { elegirTono, elegirEstructura } = require('./redactor');

describe('elegirTono', () => {
  test('devuelve una instruccion distinta por cada tono valido', () => {
    expect(elegirTono('esperanzador')).toMatch(/esperanzador/);
    expect(elegirTono('critico')).toMatch(/crítico/);
    expect(elegirTono('analitico')).toMatch(/analítico/);
    expect(elegirTono('informativo')).toMatch(/informativo/);
    expect(elegirTono('neutral')).toMatch(/neutral/);
    expect(elegirTono('editorial')).toMatch(/editorial/);
  });

  test('los 6 tonos son distintos entre si', () => {
    const tonos = ['esperanzador', 'critico', 'analitico', 'informativo', 'neutral', 'editorial'];
    const textos = tonos.map(elegirTono);
    expect(new Set(textos).size).toBe(tonos.length);
  });

  test('cae a editorial si el tono no existe o falta', () => {
    expect(elegirTono('inventado')).toBe(elegirTono('editorial'));
    expect(elegirTono(undefined)).toBe(elegirTono('editorial'));
  });
});

describe('elegirEstructura', () => {
  test('devuelve una instruccion distinta por cada estilo valido', () => {
    expect(elegirEstructura('ensayo')).toMatch(/ENSAYO/);
    expect(elegirEstructura('noticia')).toMatch(/NOTICIA CORTA/);
    expect(elegirEstructura('investigacion')).toMatch(/INVESTIGACIÓN/);
    expect(elegirEstructura('opinion')).toMatch(/OPINIÓN/);
  });

  test('las 4 instrucciones son distintas entre si', () => {
    const estilos = ['ensayo', 'noticia', 'investigacion', 'opinion'];
    const textos = estilos.map(elegirEstructura);
    expect(new Set(textos).size).toBe(estilos.length);
  });

  test('cae a ensayo si el estilo no existe o falta', () => {
    expect(elegirEstructura('inventado')).toBe(elegirEstructura('ensayo'));
    expect(elegirEstructura(undefined)).toBe(elegirEstructura('ensayo'));
  });
});
