const { camposPresentes, construirHerramienta, construirPrompt, limpiarSalida, calcularCosto, traducirCampos } = require('./traductor');

describe('camposPresentes', () => {
  test('solo campos traducibles con texto', () => {
    expect(camposPresentes('noticia', { titulo: 'Hola', parrafos: ['a', ' '], imagen_alt: '  ', precio: 5, id: 'x' }))
      .toEqual(['titulo', 'parrafos']);
    expect(camposPresentes('noticia', { parrafos: [' ', ''] })).toEqual([]);
    expect(camposPresentes('desconocido', { titulo: 'x' })).toEqual([]);
  });
});

describe('construirHerramienta', () => {
  test('pide exactamente los campos indicados, con lista para parrafos', () => {
    const h = construirHerramienta('noticia', ['titulo', 'parrafos']);
    expect(h.name).toBe('entregar_traduccion');
    expect(Object.keys(h.input_schema.properties)).toEqual(['titulo', 'parrafos']);
    expect(h.input_schema.properties.parrafos.type).toBe('array');
    expect(h.input_schema.properties.titulo.type).toBe('string');
    expect(h.input_schema.required).toEqual(['titulo', 'parrafos']);
  });
});

describe('construirPrompt', () => {
  test('es traduccion fiel, indica idiomas y trata el texto como material', () => {
    const p = construirPrompt({
      tipo: 'noticia', campos: { titulo: 'Hola' }, nombres: ['titulo'], idiomaOrigen: 'es', idiomaDestino: 'en',
    });
    expect(p).toMatch(/TRADUCCIÓN FIEL/);
    expect(p).toMatch(/del español .* al inglés/);
    expect(p).toMatch(/nunca lo presenta como hecho probado/);
    expect(p).toMatch(/no instrucciones/);
    expect(p).toMatch(/"titulo": "Hola"/);
  });

  test('no incluye campos que no se pidieron', () => {
    const p = construirPrompt({
      tipo: 'producto', campos: { nombre: 'Taza', descripcion: 'Secreta' }, nombres: ['nombre'], idiomaOrigen: 'es', idiomaDestino: 'en',
    });
    expect(p).toMatch(/Taza/);
    expect(p).not.toMatch(/Secreta/);
  });
});

describe('limpiarSalida', () => {
  test('acepta una salida completa y recorta espacios', () => {
    const r = limpiarSalida('noticia', { titulo: ' Title ', parrafos: [' One ', 'Two'] }, ['titulo', 'parrafos'], { titulo: 'Titulo', parrafos: ['Uno', 'Dos'] });
    expect(r).toEqual({ titulo: 'Title', parrafos: ['One', 'Two'] });
  });

  test('falla si falta un campo o no es del tipo esperado', () => {
    expect(() => limpiarSalida('noticia', { parrafos: ['x'] }, ['titulo'], { titulo: 'T' })).toThrow(/no devolvió "titulo"/);
    expect(() => limpiarSalida('noticia', { parrafos: 'x' }, ['parrafos'], { parrafos: ['a'] })).toThrow(/lista de párrafos/);
  });

  test('falla si cambia el numero de parrafos (no se puede alinear)', () => {
    expect(() => limpiarSalida('noticia', { parrafos: ['a'] }, ['parrafos'], { parrafos: ['a', 'b'] })).toThrow(/1 párrafos y el original 2/);
  });

  test('ignora campos extra que el modelo invente', () => {
    const r = limpiarSalida('noticia', { titulo: 'T', extra: 'no' }, ['titulo'], { titulo: 'x' });
    expect(r).toEqual({ titulo: 'T' });
  });
});

describe('traducirCampos (validaciones previas a la API)', () => {
  test('rechaza tipo, idiomas iguales o sin texto', async () => {
    await expect(traducirCampos({ tipo: 'x', campos: { titulo: 'a' }, idiomaOrigen: 'es', idiomaDestino: 'en' })).rejects.toThrow(/Tipo/);
    await expect(traducirCampos({ tipo: 'noticia', campos: { titulo: 'a' }, idiomaOrigen: 'es', idiomaDestino: 'es' })).rejects.toThrow(/distintos/);
  });

  test('sin clave de API o sin texto falla con mensaje claro', async () => {
    const previa = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    await expect(traducirCampos({ tipo: 'noticia', campos: { titulo: 'a' }, idiomaOrigen: 'es', idiomaDestino: 'en' })).rejects.toThrow(/ANTHROPIC_API_KEY/);
    process.env.ANTHROPIC_API_KEY = 'test';
    await expect(traducirCampos({ tipo: 'noticia', campos: { titulo: '  ' }, idiomaOrigen: 'es', idiomaDestino: 'en' })).rejects.toThrow(/No hay texto/);
    if (previa === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = previa;
  });
});

describe('calcularCosto', () => {
  test('usa el usage real', () => {
    expect(calcularCosto({ input_tokens: 1_000_000, output_tokens: 1_000_000 })).toBeCloseTo(12);
    expect(calcularCosto(undefined)).toBe(0);
  });
});
