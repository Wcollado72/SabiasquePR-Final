const { calcularEdad, esMenorConocido } = require('./edad');

function fechaHaceAnios(anios, diasExtra = 0) {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - anios);
  d.setUTCDate(d.getUTCDate() - diasExtra);
  return d.toISOString().slice(0, 10);
}

describe('calcularEdad', () => {
  test('null si no hay fecha', () => {
    expect(calcularEdad(null)).toBeNull();
    expect(calcularEdad(undefined)).toBeNull();
  });

  test('null si la fecha es invalida', () => {
    expect(calcularEdad('no-es-una-fecha')).toBeNull();
  });

  test('calcula la edad correcta cuando ya paso el cumpleanos este ano', () => {
    expect(calcularEdad(fechaHaceAnios(25, 10))).toBe(25);
  });

  test('resta 1 si el cumpleanos todavia no ha pasado este ano', () => {
    expect(calcularEdad(fechaHaceAnios(25, -10))).toBe(24);
  });
});

describe('esMenorConocido', () => {
  test('true si la fecha real dice que es menor del limite', () => {
    expect(esMenorConocido(fechaHaceAnios(16), 18)).toBe(true);
  });

  test('false si la fecha real dice que ya cumplio el limite', () => {
    expect(esMenorConocido(fechaHaceAnios(20), 18)).toBe(false);
  });

  test('false (no true) cuando no se conoce la fecha -- no reemplaza el checkbox, solo lo refuerza', () => {
    expect(esMenorConocido(null, 18)).toBe(false);
  });

  test('true justo un dia antes del cumpleanos 18', () => {
    expect(esMenorConocido(fechaHaceAnios(18, -1), 18)).toBe(true);
  });

  test('false el mismo dia del cumpleanos 18', () => {
    expect(esMenorConocido(fechaHaceAnios(18, 0), 18)).toBe(false);
  });
});
