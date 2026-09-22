const { validateContenido } = require('./contenido');

const BASE = {
  seccion: 'educacion',
  tipoFormato: 'ensayo',
  titulo: 'Un titulo cualquiera',
  subtituloResumen: 'Un resumen de al menos diez caracteres.',
  urlPortada: 'images/educacion.webp',
  portadaAlt: 'Descripcion',
  fechaPublicacion: '2026-01-15',
};

describe('validateContenido', () => {
  test('acepta un contenido completo y valido', () => {
    expect(validateContenido(BASE)).toEqual([]);
  });

  test('exige los campos obligatorios al crear (no parcial)', () => {
    const errors = validateContenido({});
    expect(errors).toContain('El campo "seccion" es obligatorio.');
    expect(errors).toContain('El campo "tipoFormato" es obligatorio.');
    expect(errors).toContain('El campo "titulo" es obligatorio.');
    expect(errors).toContain('El campo "subtituloResumen" es obligatorio.');
    expect(errors).toContain('El campo "urlPortada" es obligatorio.');
  });

  test('no exige nada en modo parcial', () => {
    expect(validateContenido({}, { partial: true })).toEqual([]);
  });

  test('rechaza seccion no valida', () => {
    const errors = validateContenido({ ...BASE, seccion: 'tienda' });
    expect(errors).toContain('Seccion no valida.');
  });

  test('acepta seccion "noticias" (Noticias combina noticias + contenidos)', () => {
    expect(validateContenido({ ...BASE, seccion: 'noticias' })).toEqual([]);
  });

  test('acepta categoria "ciencia"', () => {
    expect(validateContenido({ ...BASE, categoria: 'ciencia' })).toEqual([]);
  });

  test('acepta categoria "crimen" y ya no reconoce "crimenes" (plural, retirada)', () => {
    expect(validateContenido({ ...BASE, categoria: 'crimen' })).toEqual([]);
    expect(validateContenido({ ...BASE, categoria: 'crimenes' })).toContain('Categoria no valida.');
  });

  test('rechaza tipoFormato no valido', () => {
    const errors = validateContenido({ ...BASE, tipoFormato: 'podcast' });
    expect(errors).toContain('Tipo de formato no valido.');
  });

  test('rechaza categoria no valida', () => {
    const errors = validateContenido({ ...BASE, categoria: 'deportes-imaginarios' });
    expect(errors).toContain('Categoria no valida.');
  });

  test('rechaza titulo muy corto', () => {
    const errors = validateContenido({ ...BASE, titulo: 'Hi' });
    expect(errors).toContain('El titulo debe tener al menos 3 caracteres.');
  });

  test('rechaza resumen muy corto', () => {
    const errors = validateContenido({ ...BASE, subtituloResumen: 'corto' });
    expect(errors).toContain('El resumen debe tener al menos 10 caracteres.');
  });

  test('rechaza fecha invalida', () => {
    const errors = validateContenido({ ...BASE, fechaPublicacion: 'no-es-una-fecha' });
    expect(errors).toContain('La fecha de publicacion no es valida.');
  });

  test('rechaza duracionMin no entero o no positivo', () => {
    expect(validateContenido({ ...BASE, duracionMin: 0 })).toContain('La duracion debe ser un numero entero mayor que 0.');
    expect(validateContenido({ ...BASE, duracionMin: 1.5 })).toContain('La duracion debe ser un numero entero mayor que 0.');
    expect(validateContenido({ ...BASE, duracionMin: 5 })).toEqual([]);
  });

  test('acepta destacado booleano y rechaza otros tipos', () => {
    expect(validateContenido({ ...BASE, destacado: true })).toEqual([]);
    expect(validateContenido({ ...BASE, destacado: 'si' }))
      .toContain('El campo "destacado" debe ser verdadero o falso.');
  });

  test('exige urlMedia cuando tipoFormato es video (no parcial)', () => {
    const errors = validateContenido({ ...BASE, tipoFormato: 'video' });
    expect(errors).toContain('Los contenidos de tipo "video" requieren "urlMedia".');
  });

  test('acepta video con urlMedia presente', () => {
    const errors = validateContenido({ ...BASE, tipoFormato: 'video', urlMedia: 'https://www.youtube.com/embed/xyz' });
    expect(errors).toEqual([]);
  });

  test('no exige urlMedia para video en modo parcial', () => {
    const errors = validateContenido({ tipoFormato: 'video' }, { partial: true });
    expect(errors).not.toContain('Los contenidos de tipo "video" requieren "urlMedia".');
  });
});
