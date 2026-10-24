jest.mock('./articleExtractor', () => ({ extraerArticulo: jest.fn() }));
const { extraerArticulo } = require('./articleExtractor');
const { investigarDesdeVarias, promptBase, MAX_FUENTES_EXTRA } = require('./investigador');

const articulo = (n, extra = {}) => ({ url: `https://medio${n}.com/nota`, sitio: `Medio ${n}`, texto: `Texto de la fuente ${n}. `.repeat(20), ...extra });
const RESPUESTA = {
  stop_reason: 'tool_use',
  content: [{ type: 'tool_use', name: 'entregar_notas', input: { notas: 'Hechos (Fuente 1 y 2).', tituloOriginal: 'Título', preguntas: [], correcciones: [] } }],
  usage: { input_tokens: 3000, output_tokens: 400 },
};

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = 'x';
  extraerArticulo.mockReset();
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => RESPUESTA });
});
afterEach(() => { delete process.env.ANTHROPIC_API_KEY; });

describe('promptBase con varias fuentes', () => {
  test('pide marcar de cuál fuente salió cada dato y señalar contradicciones; con una sola no lo pide', () => {
    const varias = promptBase('texto', { numFuentes: 3 });
    expect(varias).toContain('las 3 fuentes siguientes');
    expect(varias).toContain('Hay 3 fuentes sobre el mismo tema');
    expect(varias).toContain('si se contradicen');
    expect(promptBase('texto')).not.toContain('Hay 1 fuentes');
    expect(promptBase('texto')).toContain('el siguiente texto');
  });
});

describe('investigarDesdeVarias', () => {
  test('lee la principal y las extra, las manda separadas y numeradas, y devuelve cuáles leyó', async () => {
    extraerArticulo.mockImplementation(async (u) => articulo(u.includes('medio1') ? 1 : 2));
    const r = await investigarDesdeVarias({ url: 'https://medio1.com/nota', extras: ['https://medio2.com/nota'], tituloSugerido: 'Mi título' });
    const prompt = JSON.parse(global.fetch.mock.calls[0][1].body).messages[0].content;
    expect(prompt).toContain('=== FUENTE 1 (Medio 1 — https://medio1.com/nota) ===');
    expect(prompt).toContain('=== FUENTE 2 (Medio 2 — https://medio2.com/nota) ===');
    expect(prompt).toContain('Hay 2 fuentes');
    expect(r.numFuentes).toBe(2);
    expect(r.fuentesLeidas.map((f) => f.nombre)).toEqual(['Medio 1', 'Medio 2']);
    expect(r.fuentesFallidas).toEqual([]);
    expect(r.fuenteUrl).toBe('https://medio1.com/nota');
    expect(r.tituloOriginal).toBe('Mi título');
    expect(r.correcciones).toEqual([]);
    expect(r.fuenteTipo).toBe('url');
  });

  test('si una fuente no se puede leer sigue con las demás y avisa cuál falló', async () => {
    extraerArticulo.mockImplementation(async (u) => { if (u.includes('malo')) throw new Error('HTTP 403'); return articulo(1); });
    const r = await investigarDesdeVarias({ url: 'https://medio1.com/nota', extras: ['https://malo.com/x'] });
    expect(r.fuentesLeidas).toHaveLength(1);
    expect(r.fuentesFallidas).toEqual([{ url: 'https://malo.com/x', error: 'HTTP 403' }]);
    expect(JSON.parse(global.fetch.mock.calls[0][1].body).messages[0].content).not.toContain('Hay 1 fuentes');
  });

  test('si ninguna se puede leer, falla con el motivo de cada una', async () => {
    extraerArticulo.mockRejectedValue(new Error('HTTP 404'));
    await expect(investigarDesdeVarias({ url: 'https://a.com/x', extras: ['https://b.com/y'] })).rejects.toThrow(/No se pudo leer ninguna.*a\.com.*HTTP 404.*b\.com/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('un texto pegado cuenta como otra fuente (la primera) junto con las URLs', async () => {
    extraerArticulo.mockResolvedValue(articulo(2));
    const r = await investigarDesdeVarias({ texto: 'Transcripción pegada del video '.repeat(5), extras: ['https://medio2.com/nota'] });
    const prompt = JSON.parse(global.fetch.mock.calls[0][1].body).messages[0].content;
    expect(prompt).toContain('=== FUENTE 1 (Texto pegado por el admin) ===');
    expect(prompt).toContain('=== FUENTE 2 (Medio 2');
    expect(r.numFuentes).toBe(2);
  });

  test('un texto pegado demasiado corto se rechaza; las URLs repetidas se leen una sola vez y hay un tope', async () => {
    await expect(investigarDesdeVarias({ texto: 'corto', extras: ['https://a.com/x'] })).rejects.toThrow(/mínimo 50/);
    extraerArticulo.mockImplementation(async (u) => ({ ...articulo(1), url: u }));
    const muchas = Array.from({ length: 8 }, (_, i) => `https://m${i}.com/n`);
    await investigarDesdeVarias({ url: 'https://m0.com/n', extras: muchas });
    expect(extraerArticulo).toHaveBeenCalledTimes(1 + MAX_FUENTES_EXTRA);
  });

  test('el texto total se reparte entre las fuentes (costo acotado)', async () => {
    extraerArticulo.mockImplementation(async (u) => ({ url: u, sitio: 'M', texto: 'x'.repeat(15000) }));
    await investigarDesdeVarias({ url: 'https://m0.com/n', extras: ['https://m1.com/n', 'https://m2.com/n', 'https://m3.com/n', 'https://m4.com/n'] });
    const prompt = JSON.parse(global.fetch.mock.calls[0][1].body).messages[0].content;
    expect(prompt.length).toBeLessThan(40000);
  });
});
