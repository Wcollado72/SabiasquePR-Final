const { validateGastoServicio, ESTADOS_VALIDOS } = require('./gastoServicio');

const BASE = { nombre: 'Claude Pro', estado: 'por_uso' };

describe('validateGastoServicio', () => {
  test('acepta un gasto valido minimo', () => {
    expect(validateGastoServicio(BASE)).toEqual([]);
  });

  test('acepta los 3 estados validos', () => {
    for (const estado of ESTADOS_VALIDOS) {
      expect(validateGastoServicio({ ...BASE, estado })).toEqual([]);
    }
  });

  test('rechaza nombre o estado ausentes/invalidos', () => {
    expect(validateGastoServicio({ estado: 'gratis' })).toContain('El campo "nombre" es obligatorio.');
    expect(validateGastoServicio({ nombre: 'X' })).toContain('El campo "estado" es obligatorio.');
    expect(validateGastoServicio({ ...BASE, estado: 'inventado' })).toContain('Estado no valido (gratis, gratis_por_ahora o por_uso).');
    expect(validateGastoServicio({ ...BASE, nombre: 'A' })).toContain('El nombre debe tener entre 2 y 120 caracteres.');
    expect(validateGastoServicio({ ...BASE, nombre: 'a'.repeat(121) })).toContain('El nombre debe tener entre 2 y 120 caracteres.');
  });

  test('acepta costo mensual valido, rechaza negativo o no numerico', () => {
    expect(validateGastoServicio({ ...BASE, costoMensualUsd: 20 })).toEqual([]);
    expect(validateGastoServicio({ ...BASE, costoMensualUsd: 0 })).toEqual([]);
    expect(validateGastoServicio({ ...BASE, costoMensualUsd: -5 })).toContain('El costo mensual debe ser un numero mayor o igual a cero.');
    expect(validateGastoServicio({ ...BASE, costoMensualUsd: 'gratis' })).toContain('El costo mensual debe ser un numero mayor o igual a cero.');
  });

  test('acepta fecha de renovacion valida y rechaza invalida', () => {
    expect(validateGastoServicio({ ...BASE, fechaRenovacion: '2026-12-01' })).toEqual([]);
    expect(validateGastoServicio({ ...BASE, fechaRenovacion: 'no-es-fecha' })).toContain('La fecha de renovacion no es valida.');
  });

  test('acepta un enlace de facturacion http(s) y rechaza esquemas peligrosos', () => {
    expect(validateGastoServicio({ ...BASE, enlaceFacturacion: 'https://console.anthropic.com/billing' })).toEqual([]);
    expect(validateGastoServicio({ ...BASE, enlaceFacturacion: 'javascript:alert(1)' }))
      .toContain('El enlace de facturacion debe ser una URL http:// o https:// valida.');
    expect(validateGastoServicio({ ...BASE, enlaceFacturacion: 'no-es-url' }))
      .toContain('El enlace de facturacion debe ser una URL http:// o https:// valida.');
  });

  test('rechaza notas demasiado largas', () => {
    expect(validateGastoServicio({ ...BASE, notas: 'x'.repeat(501) })).toContain('Las notas no pueden superar 500 caracteres.');
    expect(validateGastoServicio({ ...BASE, notas: 'x'.repeat(500) })).toEqual([]);
  });

  test('partial: no exige nombre/estado si no vienen', () => {
    expect(validateGastoServicio({ costoMensualUsd: 5 }, { partial: true })).toEqual([]);
  });

  test('campos vacios opcionales (null o cadena vacia) no generan error', () => {
    expect(validateGastoServicio({ ...BASE, costoMensualUsd: null, fechaRenovacion: '', enlaceFacturacion: null, notas: null })).toEqual([]);
  });
});
