const { registrarUsoAgente, AGENTES_CON_REGISTRO } = require('./usoIa');
const fs = require('fs');
const path = require('path');

const USAGE = { tokensEntrada: 120, tokensSalida: 30, costoEstimadoUsd: 0.0007 };

describe('registrarUsoAgente', () => {
  afterEach(() => jest.restoreAllMocks());

  test('guarda una fila con el nombre de la agente, la fuente, los tokens y el costo', async () => {
    const pool = { query: jest.fn().mockResolvedValue({}) };
    await registrarUsoAgente(pool, { agente: 'clasificadora', fuenteTipo: 'url', usage: USAGE, creadoPor: 'u1' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO ia_generaciones/);
    expect(params).toEqual(['clasificadora', 'url', 120, 30, 0.0007, 'u1']);
  });

  test('un uso sin datos guarda ceros, no vacíos', async () => {
    const pool = { query: jest.fn().mockResolvedValue({}) };
    await registrarUsoAgente(pool, { agente: 'pintora', fuenteTipo: 'texto', usage: {}, creadoPor: 'u1' });
    expect(pool.query.mock.calls[0][1]).toEqual(['pintora', 'texto', 0, 0, 0, 'u1']);
  });

  test('un agente o una fuente que la base no admite no se intenta guardar (así no rompe el CHECK)', async () => {
    const pool = { query: jest.fn() };
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await registrarUsoAgente(pool, { agente: 'inventada', fuenteTipo: 'texto', usage: USAGE, creadoPor: 'u1' });
    await registrarUsoAgente(pool, { agente: 'pintora', fuenteTipo: 'otra', usage: USAGE, creadoPor: 'u1' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('si la base falla, no tumba la respuesta: solo lo anota en el registro del servidor', async () => {
    const pool = { query: jest.fn().mockRejectedValue(new Error('db caída')) };
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(registrarUsoAgente(pool, { agente: 'guardiana', fuenteTipo: 'texto', usage: USAGE, creadoPor: 'u1' })).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
  });
});

describe('la lista de agentes coincide con la base de datos', () => {
  test('migración y schema.sql permiten exactamente los mismos nombres que usa el código', () => {
    const raiz = path.join(__dirname, '..', '..');
    const mig = fs.readFileSync(path.join(raiz, 'sql', 'migraciones', '2026-10-26-taller-semillas.sql'), 'utf8');
    const schema = fs.readFileSync(path.join(raiz, 'sql', 'schema.sql'), 'utf8');
    const nombres = (texto) => [...texto.match(/CHECK \(agente IN \(([^)]*)\)\)/g).pop().matchAll(/'([a-z]+)'/g)].map((m) => m[1]).sort();
    expect(nombres(mig)).toEqual([...AGENTES_CON_REGISTRO].sort());
    expect(nombres(schema)).toEqual([...AGENTES_CON_REGISTRO].sort());
  });

  test('cada ruta de agente registra con su propio nombre (ninguna usa ya «redactor» por comodidad)', () => {
    const lee = (f) => fs.readFileSync(path.join(__dirname, '..', 'routes', f), 'utf8');
    expect(lee('brigada.js')).toMatch(/agente: 'clasificadora'[\s\S]*agente: 'guardiana'[\s\S]*agente: 'pintora'/);
    expect(lee('contenidoIa.js')).toContain("agente: 'resumidora'");
    expect(lee('correccion.js')).toContain("agente: 'correctora'");
    ['brigada.js', 'contenidoIa.js', 'correccion.js'].forEach((f) => expect(lee(f)).not.toContain("'redactor'"));
  });
});
