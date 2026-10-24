const { construirContenido, hoyEnPuertoRico, AUTOR, PORTADA } = require('./semillaAContenido');
const { validateContenido } = require('../validators/contenido');

const desarrollo = (extra = {}) => ({
  id: 'd1', formato: 'columna', titulo: ' La vergüenza que mueve ', resumen: 'Una mirada a la vergüenza como motor y como freno.', idioma: 'es',
  parrafos: [[{ texto: 'Creo que la gente cambia por vergüenza.', origen: 'autor' }, { texto: ' Imagina a alguien que calla.', origen: 'farolera' }], [{ texto: 'Segundo párrafo.', origen: 'autor' }]],
  ...extra,
});

describe('construirContenido', () => {
  const c = construirContenido({ titulo: 'Semilla' }, desarrollo(), '2026-10-24');

  test('es un BORRADOR de Lógica Humana (Revolución Humana), de Aliado Imperfekto, sin premium ni destacado', () => {
    expect(c).toMatchObject({
      seccion: 'revolucion-humana', subseccion: 'logica-humana', autor: AUTOR, publicado: false, destacado: false, es_premium: false, categoria: 'cultura',
    });
    expect(c.url_portada).toBe(PORTADA.url);
    expect(c.portada_alt).toBe(PORTADA.alt);
    expect(c.fecha_publicacion).toBe('2026-10-24');
  });

  test('el cuerpo son los párrafos en texto corrido, el título sale limpio y el resumen es el de la Farolera', () => {
    expect(c.titulo).toBe('La vergüenza que mueve');
    expect(c.cuerpo).toBe('Creo que la gente cambia por vergüenza. Imagina a alguien que calla.\n\nSegundo párrafo.');
    expect(c.subtitulo_resumen).toBe('Una mirada a la vergüenza como motor y como freno.');
    expect(c.duracion_min).toBe(1);
  });

  test('declara la IA parcial y marca «sin fuente externa» porque es una idea propia', () => {
    expect(c.divulgacion_ia).toBe('parcial');
    expect(c.ia_herramientas).toEqual(['claude']);
    expect(c.cita_sin_fuente_externa).toBe(true);
  });

  test('si todo es del autor no declara IA', () => {
    const solo = construirContenido({ titulo: 'S' }, desarrollo({ parrafos: [[{ texto: 'Todo mío.', origen: 'autor' }]] }), '2026-10-24');
    expect(solo.divulgacion_ia).toBe('no');
    expect(solo.ia_herramientas).toEqual([]);
  });

  test.each([
    ['ensayo', 'ensayo', null], ['reflexion', 'ensayo', 'opinion'], ['columna', 'ensayo', 'columna'], ['lectura_corta', 'lectura_corta', null],
  ])('el formato «%s» se vuelve tipo «%s» y subformato %p', (formato, tipo, sub) => {
    const r = construirContenido({ titulo: 'S' }, desarrollo({ formato }), '2026-10-24');
    expect([r.tipo_formato, r.subformato]).toEqual([tipo, sub]);
  });

  test('sin título ni resumen usa el de la semilla y el inicio del cuerpo; la duración sale de las palabras', () => {
    const largo = 'palabra '.repeat(450).trim();
    const r = construirContenido({ titulo: 'De la semilla' }, desarrollo({ titulo: '', resumen: '', parrafos: [[{ texto: largo, origen: 'autor' }]] }), '2026-10-24');
    expect(r.titulo).toBe('De la semilla');
    expect(r.subtitulo_resumen.length).toBeLessThanOrEqual(200);
    expect(r.subtitulo_resumen.length).toBeGreaterThanOrEqual(10);
    expect(r.duracion_min).toBe(3);
  });

  test('lo que se crea es válido para el validador de Contenidos (mismas reglas que el formulario)', () => {
    const cuerpo = {
      seccion: c.seccion, tipoFormato: c.tipo_formato, categoria: c.categoria, titulo: c.titulo, subtituloResumen: c.subtitulo_resumen,
      urlPortada: c.url_portada, portadaAlt: c.portada_alt, fechaPublicacion: c.fecha_publicacion, subformato: c.subformato,
      divulgacionIa: c.divulgacion_ia, iaHerramientas: c.ia_herramientas, subseccion: c.subseccion, idiomaOriginal: c.idioma_original,
      citaSinFuenteExterna: c.cita_sin_fuente_externa, publicado: c.publicado, duracionMin: c.duracion_min,
    };
    expect(validateContenido(cuerpo)).toEqual([]);
  });
});

describe('hoyEnPuertoRico', () => {
  test('es una fecha AAAA-MM-DD', () => {
    expect(hoyEnPuertoRico()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
