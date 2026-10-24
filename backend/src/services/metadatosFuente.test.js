const { extraerMetadatos, estiloSugerido } = require('./metadatosFuente');

describe('extraerMetadatos', () => {
  test('lee Open Graph y metadatos de articulo', () => {
    const html = `<html><head><title>Titulo de la pagina</title>
      <meta property="og:title" content="La NASA halla un crater &amp; mas">
      <meta property="og:site_name" content="BBC News Mundo">
      <meta property="article:published_time" content="2025-03-14T10:00:00Z">
      <meta name="author" content="Ana Pérez">
      <meta property="article:author" content="https://ejemplo.com/perfil/ana">
    </head></html>`;
    expect(extraerMetadatos(html)).toEqual({
      autorFuente: 'Ana Pérez', anio: '2025', tituloOriginal: 'La NASA halla un crater & mas', nombreFuente: 'BBC News Mundo',
    });
  });

  test('lee las etiquetas academicas (varios autores) y el JSON-LD', () => {
    const html = `<head>
      <meta name="citation_title" content="Carbon capture review">
      <meta name="citation_author" content="Smith, John">
      <meta name="citation_author" content="Lee, Mary">
      <meta name="citation_publication_date" content="2023/06/01">
      <meta name="citation_journal_title" content="Nature Climate">
    </head>`;
    expect(extraerMetadatos(html)).toEqual({
      autorFuente: 'Smith, John; Lee, Mary', anio: '2023', tituloOriginal: 'Carbon capture review', nombreFuente: 'Nature Climate',
    });
    const ld = `<script type="application/ld+json">{"@graph":[{"@type":"NewsArticle","headline":"Titular LD","datePublished":"2021-11-02","author":[{"@type":"Person","name":"Luis Soto"},{"name":"Rosa Díaz"}],"publisher":{"@type":"Organization","name":"El Nuevo Día"}}]}</script>`;
    expect(extraerMetadatos(ld)).toEqual({
      autorFuente: 'Luis Soto; Rosa Díaz', anio: '2021', tituloOriginal: 'Titular LD', nombreFuente: 'El Nuevo Día',
    });
  });

  test('si la pagina no declara un dato, queda vacio (no se inventa nada)', () => {
    expect(extraerMetadatos('<html><body><p>Hola</p></body></html>')).toEqual({
      autorFuente: '', anio: '', tituloOriginal: '', nombreFuente: '',
    });
  });

  test('usa <title> solo como ultimo recurso para el titulo, y descarta @usuarios y URLs como autor', () => {
    const html = '<title>  Solo el titulo  </title><meta name="twitter:creator" content="@medio"><meta name="author" content="https://x.com/yo">';
    expect(extraerMetadatos(html)).toEqual({ autorFuente: '', anio: '', tituloOriginal: 'Solo el titulo', nombreFuente: '' });
  });

  test('ignora JSON-LD mal formado sin romperse', () => {
    expect(extraerMetadatos('<script type="application/ld+json">{no es json</script><meta property="og:title" content="Ok">').tituloOriginal).toBe('Ok');
  });

  test('un anio fuera de rango razonable no se toma', () => {
    expect(extraerMetadatos('<meta name="dc.date" content="0000-00-00">').anio).toBe('');
  });
});

describe('estiloSugerido (La Bibliotecaria propone el estilo de cita, sin IA)', () => {
  test.each([
    ['pubmed.ncbi.nlm.nih.gov', 'vancouver'],
    ['www.who.int', 'vancouver'],
    ['www.law.cornell.edu', 'bluebook'],
    ['ieeexplore.ieee.org', 'ieee'],
    ['arxiv.org', 'ieee'],
    ['folha.uol.com.br', 'abnt'],
    ['eltiempo.com.co', 'icontec'],
    ['elnuevodia.com', 'apa'],
    ['www.bbc.com', 'apa'],
  ])('%s -> %s', (host, estilo) => {
    expect(estiloSugerido(host).estilo).toBe(estilo);
  });

  test('explica el motivo y reconoce subdominios, no dominios parecidos', () => {
    expect(estiloSugerido('x.nih.gov').motivo).toContain('VANCOUVER');
    expect(estiloSugerido('notnih.gov').estilo).toBe('apa');
    expect(estiloSugerido('').estilo).toBe('apa');
    expect(estiloSugerido('sitio.com').motivo).toContain('APA es el estilo más usado');
  });
});
