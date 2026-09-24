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
    expect(errors).toContain('Los contenidos de tipo "video" o "audio" requieren "urlMedia".');
  });

  test('acepta video con urlMedia presente', () => {
    const errors = validateContenido({ ...BASE, tipoFormato: 'video', urlMedia: 'https://www.youtube.com/embed/xyz' });
    expect(errors).toEqual([]);
  });

  test('no exige urlMedia para video en modo parcial', () => {
    const errors = validateContenido({ tipoFormato: 'video' }, { partial: true });
    expect(errors).not.toContain('Los contenidos de tipo "video" o "audio" requieren "urlMedia".');
  });

  test('acepta tipoFormato "audio" y "foto"', () => {
    expect(validateContenido({ ...BASE, tipoFormato: 'audio', urlMedia: 'https://example.com/audio.mp3' })).toEqual([]);
    expect(validateContenido({ ...BASE, tipoFormato: 'foto' })).toEqual([]);
  });

  test('exige urlMedia cuando tipoFormato es audio (no parcial)', () => {
    const errors = validateContenido({ ...BASE, tipoFormato: 'audio' });
    expect(errors).toContain('Los contenidos de tipo "video" o "audio" requieren "urlMedia".');
  });

  test('no exige urlMedia para foto', () => {
    const errors = validateContenido({ ...BASE, tipoFormato: 'foto' });
    expect(errors).toEqual([]);
  });

  test('acepta subformato valido, ausente, y rechaza invalido', () => {
    expect(validateContenido({ ...BASE, subformato: 'entrevista' })).toEqual([]);
    expect(validateContenido(BASE)).toEqual([]);
    expect(validateContenido({ ...BASE, subformato: 'inventado' })).toContain('Subformato no valido.');
  });

  test('acepta los 3 niveles de divulgacionIa y rechaza invalido', () => {
    expect(validateContenido({ ...BASE, divulgacionIa: 'no' })).toEqual([]);
    expect(validateContenido({ ...BASE, divulgacionIa: 'parcial' })).toEqual([]);
    expect(validateContenido({ ...BASE, divulgacionIa: 'generado' })).toEqual([]);
    expect(validateContenido({ ...BASE, divulgacionIa: 'total' })).toContain('Divulgacion de IA no valida.');
  });

  test('acepta cada uno de los 10 estilos de cita y rechaza invalido', () => {
    const estilos = ['apa', 'mla', 'chicago', 'turabian', 'ama', 'vancouver', 'abnt', 'icontec', 'ieee', 'bluebook'];
    for (const citaEstilo of estilos) {
      expect(validateContenido({ ...BASE, citaEstilo })).toEqual([]);
    }
    expect(validateContenido({ ...BASE, citaEstilo: 'harvard' })).toContain('Estilo de cita no valido.');
  });

  test('acepta citaSinFuenteExterna booleano y rechaza otros tipos', () => {
    expect(validateContenido({ ...BASE, citaSinFuenteExterna: true })).toEqual([]);
    expect(validateContenido({ ...BASE, citaSinFuenteExterna: 'si' }))
      .toContain('El campo "citaSinFuenteExterna" debe ser verdadero o falso.');
  });

  test('rechaza citaFechaAcceso invalida', () => {
    expect(validateContenido({ ...BASE, citaFechaAcceso: 'no-es-una-fecha' }))
      .toContain('La fecha de acceso de la cita no es valida.');
    expect(validateContenido({ ...BASE, citaFechaAcceso: '2026-09-23' })).toEqual([]);
  });

  test('un contenido sin ningun campo de cita sigue siendo valido (todo opcional)', () => {
    expect(validateContenido(BASE)).toEqual([]);
  });

  test('acepta cada una de las 4 subsecciones, subseccion ausente, y rechaza invalida', () => {
    for (const subseccion of ['humanos-inhumanos', 'nuevo-pr', 'revolucion-mundial', 'logica-humana']) {
      expect(validateContenido({ ...BASE, subseccion })).toEqual([]);
    }
    expect(validateContenido(BASE)).toEqual([]);
    expect(validateContenido({ ...BASE, subseccion: 'inventada' })).toContain('Subseccion no valida.');
  });

  test('acepta esPremium booleano y rechaza otros tipos', () => {
    expect(validateContenido({ ...BASE, esPremium: true })).toEqual([]);
    expect(validateContenido({ ...BASE, esPremium: false })).toEqual([]);
    expect(validateContenido({ ...BASE, esPremium: 'si' }))
      .toContain('El campo "esPremium" debe ser verdadero o falso.');
  });
});
