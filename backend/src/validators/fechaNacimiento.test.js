const { validateFechaNacimiento } = require('./fechaNacimiento');

const HOY = new Date('2026-10-02T12:00:00Z');
const validar = (fechaNacimiento) => validateFechaNacimiento({ fechaNacimiento }, HOY);

describe('validateFechaNacimiento', () => {
  test.each(['1990-05-17', '2008-10-02', '2026-10-02', '1950-02-28', '2000-02-29'])('acepta %s', (f) => {
    expect(validar(f)).toEqual([]);
  });

  test('no rechaza por edad: un menor de 13 tambien es una fecha valida', () => {
    expect(validar('2020-01-01')).toEqual([]);
  });

  test.each([undefined, null, 123, '', '17/05/1990', '1990-5-17', '19900517', '1990-05-17T00:00:00Z'])(
    'rechaza el formato %p', (f) => {
      expect(validar(f)).toEqual(['La fecha de nacimiento debe tener el formato AAAA-MM-DD.']);
    }
  );

  test('rechaza un cuerpo ausente', () => {
    expect(validateFechaNacimiento(undefined, HOY)).toHaveLength(1);
    expect(validateFechaNacimiento({}, HOY)).toHaveLength(1);
  });

  test.each(['2026-02-30', '2025-02-29', '1990-13-01', '1990-00-10', '1990-04-31'])('rechaza la fecha que no existe %s', (f) => {
    expect(validar(f)).toEqual(['La fecha de nacimiento no es una fecha válida.']);
  });

  test('rechaza el futuro (manana) pero acepta hoy', () => {
    expect(validar('2026-10-03')).toEqual(['La fecha de nacimiento no puede estar en el futuro.']);
    expect(validar('2026-10-02')).toEqual([]);
  });

  test('rechaza fechas no plausibles (mas de 120 anos)', () => {
    expect(validar('1900-01-01')).toEqual(['La fecha de nacimiento no es plausible.']);
    expect(validar('1906-10-02')).toEqual([]);
  });
});
