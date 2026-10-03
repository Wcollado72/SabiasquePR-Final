// ============================================================
// seed-contenidos-pilot.js — Sabías que PR · Sembrado piloto de `contenidos`
// ============================================================
// Piloto de la categoría "descubrimientos": 8 piezas reales (2 video,
// 2 ensayo, 2 noticia, 2 lectura_corta), repartidas entre las secciones
// "revolucion-humana" y "educacion". Cada enlace fue verificado a mano
// (fuente real, pública, vigente al sembrarse — 2026-09-22).
//
// Uso: node scripts/seed-contenidos-pilot.js
// Es seguro repetir: usa ON CONFLICT (id) DO UPDATE.
// ============================================================
require('dotenv').config({ quiet: true });
const { pool } = require('../src/db');
const { validateContenido } = require('../src/validators/contenido');
const { slugify } = require('../src/util/slugify');

const PIEZAS = [
  {
    titulo: 'El palacio perdido de Keops sale a la luz en Egipto',
    seccion: 'educacion',
    tipoFormato: 'video',
    categoria: 'descubrimientos',
    subtituloResumen: 'Un video de National Geographic en Español recorre el hallazgo del palacio del faraón Keops, constructor de la Gran Pirámide, y lo que revela sobre la vida cotidiana en el Antiguo Egipto.',
    autor: null,
    urlMedia: 'https://www.youtube.com/embed/52ebuPeEvvo',
    fuenteUrl: 'https://www.youtube.com/watch?v=52ebuPeEvvo',
    fuenteTexto: 'Nat Geo en Español (YouTube)',
    duracionMin: 8,
    urlPortada: 'https://i.ytimg.com/vi/52ebuPeEvvo/hqdefault.jpg',
    portadaAlt: 'Miniatura del video de Nat Geo en Español sobre el palacio de Keops',
    fechaPublicacion: '2026-09-22',
  },
  {
    titulo: 'La nueva «máquina de descubrimientos» de la NASA',
    seccion: 'revolucion-humana',
    tipoFormato: 'video',
    categoria: 'descubrimientos',
    subtituloResumen: 'CNN 10 resume, para audiencias jóvenes, cómo el instrumento más reciente de la NASA promete ampliar lo que sabemos sobre el universo.',
    autor: null,
    urlMedia: 'https://www.youtube.com/embed/GOCRs9omW1U',
    fuenteUrl: 'https://www.youtube.com/watch?v=GOCRs9omW1U',
    fuenteTexto: 'CNN 10 (YouTube)',
    duracionMin: 10,
    urlPortada: 'https://i.ytimg.com/vi/GOCRs9omW1U/hqdefault.jpg',
    portadaAlt: 'Miniatura del video de CNN 10 sobre el nuevo instrumento de la NASA',
    fechaPublicacion: '2026-08-31',
  },
  {
    titulo: 'Organismos que llevan miles de años vivos, y qué significan para la vida misma',
    seccion: 'educacion',
    tipoFormato: 'ensayo',
    categoria: 'descubrimientos',
    subtituloResumen: 'La bióloga Karen G. Lloyd explica el hallazgo de los «aeonófilos»: microorganismos que sobreviven en el subsuelo terrestre durante cientos de miles o millones de años en un letargo extremo. Su existencia obliga a repensar qué es la vida.',
    autor: 'Karen G. Lloyd',
    urlMedia: null,
    fuenteUrl: 'https://aeon.co/essays/the-discovery-of-aeonophiles-expands-our-definition-of-life',
    fuenteTexto: 'Aeon Essays',
    duracionMin: 12,
    urlPortada: 'images/descubrimiento.webp',
    portadaAlt: 'Ilustración de un árbol del conocimiento con astronomía, arqueología y biología en sus ramas',
    fechaPublicacion: '2025-12-18',
  },
  {
    titulo: 'Cómo la inteligencia artificial ayuda a encontrar sitios arqueológicos',
    seccion: 'revolucion-humana',
    tipoFormato: 'ensayo',
    categoria: 'descubrimientos',
    subtituloResumen: 'La periodista Lina Zeldovich explora cómo la IA analiza miles de imágenes aéreas para detectar estructuras antiguas, desde fuertes romanos hasta caravasares, mientras los investigadores insisten en que la interpretación humana sigue siendo insustituible.',
    autor: 'Lina Zeldovich',
    urlMedia: null,
    fuenteUrl: 'https://nautil.us/how-ai-is-helping-archaeologists-make-discoveries-1238095',
    fuenteTexto: 'Nautilus',
    duracionMin: 9,
    urlPortada: 'images/enlaces.webp',
    portadaAlt: 'Ilustración con paneles de personas, tecnología y ruinas arqueológicas',
    fechaPublicacion: '2025-09-26',
  },
  {
    titulo: 'La NASA halla el cráter más grande formado en la Luna en un siglo',
    seccion: 'revolucion-humana',
    tipoFormato: 'noticia',
    categoria: 'descubrimientos',
    subtituloResumen: 'Un impacto ocurrido entre abril y mayo de 2024 creó el cráter lunar McGetchin, de 222 metros de diámetro, identificado en imágenes del orbitador LRO. Un evento de esta magnitud ocurre, en promedio, una vez cada 100 años.',
    autor: null,
    urlMedia: null,
    fuenteUrl: 'https://www.vanguardia.com/mundo/ciencia/2026/09/18/nasa-descubre-en-la-luna-el-mayor-crater-recien-formado-del-sistema-solar/',
    fuenteTexto: 'La Vanguardia',
    duracionMin: 3,
    urlPortada: 'images/descubrimiento.webp',
    portadaAlt: 'Ilustración de un árbol del conocimiento con astronomía, arqueología y biología en sus ramas',
    fechaPublicacion: '2026-09-18',
  },
  {
    titulo: 'Saturno hace crecer un extraño decágono en su polo sur',
    seccion: 'educacion',
    tipoFormato: 'noticia',
    categoria: 'descubrimientos',
    subtituloResumen: 'El telescopio Hubble confirmó una figura de diez lados en las nubes del polo sur de Saturno, muy distinta al famoso hexágono del polo norte. Los científicos aún no saben qué la originó ni cuánto tiempo se mantendrá.',
    autor: 'Margherita Bassi',
    urlMedia: null,
    fuenteUrl: 'https://www.smithsonianmag.com/smart-news/a-mysterious-decagon-unexpectedly-appeared-around-saturns-south-pole-the-ten-sided-shape-seems-to-be-a-wave-in-the-atmosphere-180989449/',
    fuenteTexto: 'Smithsonian Magazine',
    duracionMin: 3,
    urlPortada: 'images/descubrimiento.webp',
    portadaAlt: 'Ilustración de un árbol del conocimiento con astronomía, arqueología y biología en sus ramas',
    fechaPublicacion: '2026-09-03',
  },
  {
    titulo: 'Plutón pudo tener nitrógeno líquido fluyendo en su superficie',
    seccion: 'educacion',
    tipoFormato: 'lectura_corta',
    categoria: 'descubrimientos',
    subtituloResumen: 'Nuevas imágenes de la sonda New Horizons muestran manchas oscuras en el glaciar Sputnik Planitia que parecen formadas por nitrógeno líquido que sube desde el subsuelo. El hallazgo sugiere que Plutón es geológicamente más activo de lo que parece.',
    autor: null,
    urlMedia: null,
    fuenteUrl: 'https://science.nasa.gov/blogs/science-news/2026/08/05/nasas-new-horizons-finds-evidence-of-recent-liquid-on-plutos-surface/',
    fuenteTexto: 'NASA Science',
    duracionMin: 4,
    urlPortada: 'images/descubrimiento.webp',
    portadaAlt: 'Ilustración de un árbol del conocimiento con astronomía, arqueología y biología en sus ramas',
    fechaPublicacion: '2026-08-05',
  },
  {
    titulo: '¿Tuvo Venus una luna durante casi 2,000 millones de años?',
    seccion: 'revolucion-humana',
    tipoFormato: 'lectura_corta',
    categoria: 'descubrimientos',
    subtituloResumen: 'Simulaciones de la Universidad de California en Riverside sugieren que una antigua luna de Venus habría sido arrastrada hacia el planeta por su lentísima rotación, hasta desintegrarse. La teoría es difícil de comprobar: no queda evidencia física.',
    autor: 'Paul Scott Anderson',
    urlMedia: null,
    fuenteUrl: 'https://earthsky.org/space/venus-had-a-moon-moons-roche-limit/',
    fuenteTexto: 'EarthSky',
    duracionMin: 4,
    urlPortada: 'images/descubrimiento.webp',
    portadaAlt: 'Ilustración de un árbol del conocimiento con astronomía, arqueología y biología en sus ramas',
    fechaPublicacion: '2026-09-15',
  },
];

async function main() {
  let ok = 0;
  for (const pieza of PIEZAS) {
    const errors = validateContenido(pieza);
    if (errors.length) {
      console.error(`✗ "${pieza.titulo}": ${errors.join(' ')}`);
      continue;
    }
    const id = slugify(pieza.titulo);
    await pool.query(
      `INSERT INTO contenidos (id, seccion, tipo_formato, categoria, titulo, subtitulo_resumen, cuerpo, autor, url_media, fuente_url, fuente_texto, duracion_min, url_portada, portada_alt, fecha_publicacion, destacado)
       VALUES ($1,$2,$3,$4,$5,$6,NULL,$7,$8,$9,$10,$11,$12,$13,$14,false)
       ON CONFLICT (id) DO UPDATE SET
         seccion=EXCLUDED.seccion, tipo_formato=EXCLUDED.tipo_formato, categoria=EXCLUDED.categoria,
         titulo=EXCLUDED.titulo, subtitulo_resumen=EXCLUDED.subtitulo_resumen, autor=EXCLUDED.autor,
         url_media=EXCLUDED.url_media, fuente_url=EXCLUDED.fuente_url, fuente_texto=EXCLUDED.fuente_texto,
         duracion_min=EXCLUDED.duracion_min, url_portada=EXCLUDED.url_portada, portada_alt=EXCLUDED.portada_alt,
         fecha_publicacion=EXCLUDED.fecha_publicacion`,
      [id, pieza.seccion, pieza.tipoFormato, pieza.categoria, pieza.titulo, pieza.subtituloResumen,
        pieza.autor, pieza.urlMedia, pieza.fuenteUrl, pieza.fuenteTexto, pieza.duracionMin,
        pieza.urlPortada, pieza.portadaAlt, pieza.fechaPublicacion]
    );
    console.log(`✓ ${id}`);
    ok++;
  }
  console.log(`\n${ok}/${PIEZAS.length} piezas sembradas.`);
  await pool.end();
}

main().catch((err) => {
  console.error('Error sembrando contenidos:', err.message);
  process.exit(1);
});
