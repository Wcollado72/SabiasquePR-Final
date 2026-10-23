const {
  CLAVES_IA_CONOCIDAS,
  MAX_HERRAMIENTAS,
  MENSAJE_DIVULGACION_NO,
  validarIaHerramientas,
  normalizarIaHerramientas,
  resolverIaHerramientas,
} = require('./iaHerramientas');

describe('esquema SQL', () => {
  const fs = require('fs');
  const path = require('path');
  const leer = (...partes) => fs.readFileSync(path.join(__dirname, '..', '..', 'sql', ...partes), 'utf8');

  test('schema.sql y la migracion crean la columna con el mismo limite que la validacion', () => {
    for (const sql of [leer('schema.sql'), leer('migraciones', '2026-10-23-ia-herramientas.sql')]) {
      for (const tabla of ['noticias', 'contenidos']) {
        expect(sql).toContain(`ALTER TABLE ${tabla} ADD COLUMN IF NOT EXISTS ia_herramientas text[] NOT NULL DEFAULT '{}'`);
        expect(sql).toContain(`CONSTRAINT ${tabla}_ia_herramientas_max CHECK (cardinality(ia_herramientas) <= ${MAX_HERRAMIENTAS})`);
      }
    }
  });
});

describe('CLAVES_IA_CONOCIDAS', () => {
  test('lista las cinco herramientas conocidas en minuscula', () => {
    expect(CLAVES_IA_CONOCIDAS).toEqual(['claude', 'gemini', 'perplexity', 'chatgpt', 'copilot']);
  });
});

describe('validarIaHerramientas', () => {
  test('omitido es valido', () => {
    expect(validarIaHerramientas(undefined, 'parcial')).toEqual([]);
  });

  test('acepta claves conocidas y nombres libres', () => {
    expect(validarIaHerramientas(['claude', 'Gemini', 'Mi IA local'], 'parcial')).toEqual([]);
  });

  test('acepta una lista vacia incluso con divulgacion "no"', () => {
    expect(validarIaHerramientas([], 'no')).toEqual([]);
  });

  test('rechaza lo que no sea una lista', () => {
    expect(validarIaHerramientas('claude', 'parcial')).toHaveLength(1);
    expect(validarIaHerramientas(null, 'parcial')).toHaveLength(1);
    expect(validarIaHerramientas({ 0: 'claude' }, 'parcial')).toHaveLength(1);
  });

  test('acepta 8 elementos y rechaza 9', () => {
    const ocho = Array.from({ length: 8 }, (_, i) => `IA ${i}`);
    expect(validarIaHerramientas(ocho, 'parcial')).toEqual([]);
    expect(validarIaHerramientas([...ocho, 'IA 9'], 'parcial')).toContain('Puedes indicar un máximo de 8 herramientas de IA.');
  });

  test('rechaza elementos que no son texto, vacios o de mas de 40 caracteres', () => {
    expect(validarIaHerramientas([42], 'parcial')).toContain('Cada herramienta de IA debe ser texto.');
    expect(validarIaHerramientas(['   '], 'parcial')).toHaveLength(1);
    expect(validarIaHerramientas(['x'.repeat(41)], 'parcial')).toHaveLength(1);
    expect(validarIaHerramientas(['x'.repeat(40)], 'parcial')).toEqual([]);
  });

  test('rechaza <, >, saltos de linea y URLs', () => {
    expect(validarIaHerramientas(['<script>'], 'parcial')).toHaveLength(1);
    expect(validarIaHerramientas(['a>b'], 'parcial')).toHaveLength(1);
    expect(validarIaHerramientas(['linea\nnueva'], 'parcial')).toHaveLength(1);
    expect(validarIaHerramientas(['https://ia.example.com'], 'parcial')).toHaveLength(1);
    expect(validarIaHerramientas(['WWW.ia.com'], 'parcial')).toHaveLength(1);
  });

  test('rechaza duplicados sin distinguir mayusculas ni espacios', () => {
    expect(validarIaHerramientas(['claude', 'Claude'], 'parcial')).toHaveLength(1);
    expect(validarIaHerramientas(['Mi IA', ' mi ia '], 'parcial')).toHaveLength(1);
  });

  test('con divulgacion "no" y elementos, pide cambiar la divulgacion', () => {
    expect(validarIaHerramientas(['claude'], 'no')).toEqual([MENSAJE_DIVULGACION_NO]);
  });

  test('sin divulgacion en el cuerpo no cruza (lo resuelve la ruta)', () => {
    expect(validarIaHerramientas(['claude'], undefined)).toEqual([]);
  });
});

describe('normalizarIaHerramientas', () => {
  test('claves conocidas a minuscula, nombres libres conservan capitalizacion', () => {
    expect(normalizarIaHerramientas([' Claude ', 'GEMINI', 'Mi IA Local'])).toEqual(['claude', 'gemini', 'Mi IA Local']);
  });

  test('quita duplicados conservando el primero', () => {
    expect(normalizarIaHerramientas(['ChatGPT', 'chatgpt', 'Otra', 'otra'])).toEqual(['chatgpt', 'Otra']);
  });
});

describe('resolverIaHerramientas', () => {
  test('omitido en edicion conserva lo guardado', () => {
    const existing = { divulgacion_ia: 'parcial', ia_herramientas: ['claude'] };
    expect(resolverIaHerramientas({ titulo: 'Nuevo' }, existing)).toEqual({ valor: ['claude'], error: null });
  });

  test('omitido al crear es una lista vacia', () => {
    expect(resolverIaHerramientas({})).toEqual({ valor: [], error: null });
  });

  test('una fila vieja sin la columna se trata como lista vacia', () => {
    expect(resolverIaHerramientas({}, { divulgacion_ia: 'no' })).toEqual({ valor: [], error: null });
  });

  test('normaliza la lista nueva', () => {
    const r = resolverIaHerramientas({ divulgacionIa: 'generado', iaHerramientas: ['CLAUDE', 'Otra'] });
    expect(r).toEqual({ valor: ['claude', 'Otra'], error: null });
  });

  test('lista nueva contra una pieza con divulgacion "no" (sin cambiarla) da error', () => {
    const r = resolverIaHerramientas({ iaHerramientas: ['claude'] }, { divulgacion_ia: 'no' });
    expect(r.error).toBe(MENSAJE_DIVULGACION_NO);
  });

  test('lista nueva que acompana un cambio de divulgacion a "parcial" es valida', () => {
    const r = resolverIaHerramientas({ divulgacionIa: 'parcial', iaHerramientas: ['claude'] }, { divulgacion_ia: 'no' });
    expect(r).toEqual({ valor: ['claude'], error: null });
  });

  test('cambiar la divulgacion a "no" sin lista nueva vacia la lista guardada', () => {
    const r = resolverIaHerramientas({ divulgacionIa: 'no' }, { divulgacion_ia: 'parcial', ia_herramientas: ['claude'] });
    expect(r).toEqual({ valor: [], error: null });
  });
});
