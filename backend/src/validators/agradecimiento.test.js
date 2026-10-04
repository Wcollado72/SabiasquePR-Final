const { validateNombreAgradecimiento, limpiarNombre } = require('./agradecimiento');

describe('validateNombreAgradecimiento', () => {
  test.each(['Ana', 'María José', "O'Brien", 'Jean-Luc', 'Ana M.', 'José Ñandú 2', '李小龍'])('acepta "%s"', (n) => {
    expect(validateNombreAgradecimiento(n)).toEqual([]);
  });

  test('rechaza lo que no es texto, vacío o demasiado corto/largo', () => {
    expect(validateNombreAgradecimiento(undefined)).not.toEqual([]);
    expect(validateNombreAgradecimiento(null)).not.toEqual([]);
    expect(validateNombreAgradecimiento(42)).not.toEqual([]);
    expect(validateNombreAgradecimiento('   ')).not.toEqual([]);
    expect(validateNombreAgradecimiento('A')).not.toEqual([]);
    expect(validateNombreAgradecimiento('a'.repeat(41))).toEqual(['El nombre no puede superar 40 caracteres.']);
    expect(validateNombreAgradecimiento('a'.repeat(40))).toEqual([]);
  });

  test.each(['<script>alert(1)</script>', 'Ana <b>', 'ana@correo.com', 'visita http://x.com', 'www.sitio.com', 'Ana & Co', 'Ana;DROP'])('rechaza "%s" (símbolos, HTML, correos o enlaces)', (n) => {
    expect(validateNombreAgradecimiento(n)).not.toEqual([]);
  });
});

describe('limpiarNombre', () => {
  test('quita espacios de sobra', () => {
    expect(limpiarNombre('  María   José ')).toBe('María José');
  });
});
