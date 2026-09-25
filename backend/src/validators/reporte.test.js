const { validateReporte } = require('./reporte');

const VALIDO = { tipo: 'debate_post', itemId: 'uuid-1', motivo: 'Contiene una amenaza directa.' };

describe('validateReporte', () => {
  test('acepta un reporte valido', () => {
    expect(validateReporte(VALIDO)).toEqual([]);
  });

  test('acepta tipo "debate_comentario"', () => {
    expect(validateReporte({ ...VALIDO, tipo: 'debate_comentario' })).toEqual([]);
  });

  test('rechaza tipo invalido o ausente', () => {
    expect(validateReporte({ ...VALIDO, tipo: 'otro' })).toContain('Tipo de reporte no valido.');
    expect(validateReporte({ ...VALIDO, tipo: undefined })).toContain('Tipo de reporte no valido.');
  });

  test('rechaza itemId ausente', () => {
    expect(validateReporte({ ...VALIDO, itemId: undefined })).toContain('Falta el elemento reportado.');
  });

  test('rechaza motivo muy corto, ausente o muy largo', () => {
    expect(validateReporte({ ...VALIDO, motivo: 'hi' })).toContain('El motivo debe tener al menos 5 caracteres.');
    expect(validateReporte({ ...VALIDO, motivo: undefined })).toContain('El motivo debe tener al menos 5 caracteres.');
    expect(validateReporte({ ...VALIDO, motivo: 'x'.repeat(501) })).toContain('El motivo no puede superar 500 caracteres.');
  });
});
