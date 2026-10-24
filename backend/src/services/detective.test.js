const D = require('./detective');

const existente = (extra = {}) => ({
  tipo: 'noticia', id: 'luna', titulo: 'La NASA halla el cráter más grande formado en la Luna en un siglo', resumen: 'La NASA confirmó el hallazgo del cráter recién formado más grande jamás detectado en el sistema solar.',
  fuenteUrl: 'https://www.nasa.gov/noticias/crater-luna?utm_source=x', publicado: true, fecha: '2026-09-16', ...extra,
});

describe('normalizarUrl', () => {
  test('es la misma página aunque cambien http/https, www, la barra final, el # o los parámetros de rastreo', () => {
    const base = D.normalizarUrl('https://nasa.gov/noticias/crater');
    ['http://www.nasa.gov/noticias/crater/', 'https://NASA.gov/noticias/crater#seccion', 'https://nasa.gov/noticias/crater?utm_source=tw&fbclid=abc'].forEach((u) => {
      expect(D.normalizarUrl(u)).toBe(base);
    });
  });

  test('conserva los parámetros que sí identifican la página (p. ej. ?v= de un video) y rechaza lo que no es una URL web', () => {
    expect(D.normalizarUrl('https://www.youtube.com/watch?v=abc&utm_campaign=z')).toBe('youtube.com/watch?v=abc');
    expect(D.normalizarUrl('https://www.youtube.com/watch?v=abc')).not.toBe(D.normalizarUrl('https://www.youtube.com/watch?v=xyz'));
    expect(D.normalizarUrl('no es una url')).toBe('');
    expect(D.normalizarUrl('ftp://a.com/x')).toBe('');
    expect(D.normalizarUrl('')).toBe('');
  });
});

describe('compararPiezas', () => {
  test('la misma fuente es similitud total, aunque el título sea otro', () => {
    const r = D.compararPiezas({ titulo: 'Otro título', fuenteUrl: 'http://nasa.gov/noticias/crater-luna/' }, existente());
    expect(r.similitud).toBe(1);
    expect(r.razones[0]).toContain('misma fuente');
  });

  test('un título casi igual se detecta aunque se reescriba un poco y no haya URL', () => {
    const r = D.compararPiezas({ titulo: 'NASA halla el mayor cráter formado en la Luna en un siglo' }, existente());
    expect(r.similitud).toBeGreaterThanOrEqual(0.6);
    expect(r.razones.join(' ')).toContain('título es muy parecido');
  });

  test('el parecido de los resúmenes suma aunque el título cambie', () => {
    const r = D.compararPiezas({ titulo: 'Descubren impacto lunar', resumen: 'La NASA confirmó el hallazgo del cráter más grande recién formado jamás detectado en el sistema solar' }, existente());
    expect(r.similitud).toBeGreaterThan(0.3);
    expect(r.razones.join(' ')).toContain('resumen trata de lo mismo');
  });

  test('historias distintas no se parecen, y ignora tildes, mayúsculas y palabras vacías', () => {
    expect(D.compararPiezas({ titulo: 'Reforma educativa en Puerto Rico', resumen: 'Cambios en las escuelas públicas' }, existente()).similitud).toBeLessThan(0.2);
    expect(D.compararPiezas({ titulo: 'LA NASA HALLA EL CRATER MAS GRANDE FORMADO EN LA LUNA EN UN SIGLO' }, existente()).similitud).toBe(1);
  });
});

describe('buscarDuplicados', () => {
  const lista = [
    existente(),
    existente({ tipo: 'contenido', id: 'ensayo-1', titulo: 'Reforma educativa y escuelas públicas', resumen: 'Cambios en el sistema', fuenteUrl: 'https://otro.com/a', publicado: false }),
    existente({ id: 'luna-2', titulo: 'Hallazgo del cráter lunar más grande en cien años', fuenteUrl: null }),
  ];

  test('devuelve las más parecidas, de mayor a menor, con el nivel y las razones', () => {
    const r = D.buscarDuplicados({ titulo: 'La NASA halla el cráter más grande formado en la Luna', fuenteUrl: 'https://nasa.gov/noticias/crater-luna' }, lista);
    expect(r[0]).toMatchObject({ tipo: 'noticia', id: 'luna', nivel: 'muy_probable', publicado: true, fecha: '2026-09-16' });
    expect(r.map((c) => c.id)).not.toContain('ensayo-1');
    for (let i = 1; i < r.length; i += 1) expect(r[i - 1].similitud).toBeGreaterThanOrEqual(r[i].similitud);
  });

  test('no se cuenta a sí misma al editar (excluir) y distingue el tipo aunque el id coincida', () => {
    const nueva = { titulo: existente().titulo, fuenteUrl: existente().fuenteUrl };
    expect(D.buscarDuplicados(nueva, lista, { tipo: 'noticia', id: 'luna' }).map((c) => c.id)).not.toContain('luna');
    const mismoId = [existente({ tipo: 'contenido', id: 'luna' })];
    expect(D.buscarDuplicados(nueva, mismoId, { tipo: 'noticia', id: 'luna' })).toHaveLength(1);
  });

  test('marca los borradores y solo muestra las candidatas sobre el umbral, hasta cinco', () => {
    const muchas = Array.from({ length: 9 }, (_, i) => existente({ id: `n${i}` }));
    expect(D.buscarDuplicados({ titulo: existente().titulo }, muchas)).toHaveLength(D.MAX_CANDIDATAS);
    expect(D.buscarDuplicados({ titulo: 'Tema totalmente distinto sobre deportes' }, lista)).toEqual([]);
    const r = D.buscarDuplicados({ titulo: 'Reforma educativa y escuelas públicas' }, lista);
    expect(r[0]).toMatchObject({ id: 'ensayo-1', publicado: false });
  });

  test('niveles: muy probable, probable y posible', () => {
    expect(D.nivelDe(0.9)).toBe('muy_probable');
    expect(D.nivelDe(0.6)).toBe('probable');
    expect(D.nivelDe(0.45)).toBe('posible');
  });
});
