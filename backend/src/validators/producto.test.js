const { validateProducto } = require('./producto');

const PRODUCTO_VALIDO = {
  nombre: 'Taza Nuevos Humanos',
  descripcion: 'Una taza de ceramica.',
  precio: 12.5,
  imagen: 'images/taza.webp',
  imagenAlt: 'Foto de la taza',
};

describe('validateProducto', () => {
  test('acepta un producto completo y valido', () => {
    expect(validateProducto(PRODUCTO_VALIDO)).toEqual([]);
  });

  test('exige todos los campos obligatorios al crear', () => {
    const errors = validateProducto({});
    expect(errors).toContain('El campo "nombre" es obligatorio.');
    expect(errors).toContain('El campo "precio" es obligatorio.');
    expect(errors).toContain('El campo "imagen" es obligatorio.');
  });

  test('rechaza nombre muy corto', () => {
    const errors = validateProducto({ ...PRODUCTO_VALIDO, nombre: 'Hi' });
    expect(errors).toContain('El nombre debe tener al menos 3 caracteres.');
  });

  test('rechaza precio cero o negativo', () => {
    expect(validateProducto({ ...PRODUCTO_VALIDO, precio: 0 })).toContain('El precio debe ser un numero mayor que cero.');
    expect(validateProducto({ ...PRODUCTO_VALIDO, precio: -5 })).toContain('El precio debe ser un numero mayor que cero.');
  });

  test('rechaza precio no numerico', () => {
    const errors = validateProducto({ ...PRODUCTO_VALIDO, precio: 'gratis' });
    expect(errors).toContain('El precio debe ser un numero mayor que cero.');
  });

  test('en modo parcial (edicion) no exige campos ausentes', () => {
    expect(validateProducto({ nombre: 'Nuevo nombre' }, { partial: true })).toEqual([]);
  });

  test('en modo parcial sigue validando los campos que si se envian', () => {
    const errors = validateProducto({ precio: -1 }, { partial: true });
    expect(errors).toContain('El precio debe ser un numero mayor que cero.');
  });
});
