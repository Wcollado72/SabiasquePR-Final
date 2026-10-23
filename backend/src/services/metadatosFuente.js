// Lee los datos que una pagina web DECLARA de si misma (autor, fecha de publicacion, titulo original, nombre del
// medio) para rellenar la cita de la fuente. No usa IA y no deduce nada: si la pagina no lo declara, el dato
// queda vacio. Lee las etiquetas <meta> (Open Graph, Dublin Core, Google Scholar), el JSON-LD (schema.org) y
// <title>; nunca ejecuta el JavaScript de la pagina.
const { descargarHtml } = require('./articleExtractor');

const ENTIDADES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ' };

function decodificar(texto) {
  return String(texto || '')
    .replace(/&(amp|lt|gt|quot|apos|nbsp|#39);/g, (m) => ENTIDADES[m] || m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\s+/g, ' ')
    .trim();
}

// Todas las etiquetas <meta> como { clave(minuscula): [valores] }, usando name, property o itemprop como clave.
function leerMetas(html) {
  const metas = {};
  for (const etiqueta of html.match(/<meta\b[^>]*>/gi) || []) {
    const attr = {};
    for (const m of etiqueta.matchAll(/([a-zA-Z:_-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) attr[m[1].toLowerCase()] = m[3] !== undefined ? m[3] : m[4];
    const clave = (attr.name || attr.property || attr.itemprop || '').toLowerCase();
    if (!clave || attr.content === undefined) continue;
    const valor = decodificar(attr.content);
    if (valor) (metas[clave] = metas[clave] || []).push(valor);
  }
  return metas;
}

// Objetos de los bloques <script type="application/ld+json">, aplanados (incluye @graph y listas).
function leerJsonLd(html) {
  const objetos = [];
  const visitar = (nodo) => {
    if (Array.isArray(nodo)) nodo.forEach(visitar);
    else if (nodo && typeof nodo === 'object') {
      objetos.push(nodo);
      if (nodo['@graph']) visitar(nodo['@graph']);
    }
  };
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { visitar(JSON.parse(m[1])); } catch { /* JSON-LD mal formado: se ignora */ }
  }
  return objetos;
}

function nombresDe(valor) {
  if (!valor) return [];
  if (typeof valor === 'string') return [decodificar(valor)];
  if (Array.isArray(valor)) return valor.flatMap(nombresDe);
  if (typeof valor === 'object' && valor.name) return nombresDe(valor.name);
  return [];
}

// "Apellido, Nombre" no se toca; una URL (algunas paginas ponen el perfil del autor) no es un nombre.
const esNombre = (s) => Boolean(s) && !/^https?:\/\//i.test(s) && s.length <= 150;
const unicos = (lista) => [...new Set(lista)];
const primero = (...valores) => valores.flat().find((v) => v && String(v).trim()) || '';

function extraerMetadatos(html) {
  const metas = leerMetas(html);
  const ld = leerJsonLd(html);
  const m = (...claves) => claves.flatMap((c) => metas[c] || []);

  const autores = unicos([
    ...m('citation_author', 'dc.creator', 'dcterms.creator', 'author', 'article:author', 'parsely-author', 'twitter:creator').filter(esNombre),
    ...ld.flatMap((o) => nombresDe(o.author)).filter(esNombre),
  ]).filter((a) => !a.startsWith('@'));

  const fecha = primero(
    m('citation_publication_date', 'citation_date', 'article:published_time', 'dc.date', 'dc.date.issued', 'dcterms.date', 'datepublished'),
    ld.map((o) => o.datePublished)
  );
  const anio = (String(fecha).match(/\b(1[5-9]\d{2}|20\d{2})\b/) || [])[1] || '';

  let titulo = primero(
    m('citation_title', 'og:title', 'twitter:title', 'dc.title'),
    ld.map((o) => o.headline)
  );
  if (!titulo) titulo = decodificar((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]);

  const medio = primero(
    m('og:site_name', 'citation_journal_title', 'application-name', 'dc.publisher'),
    ld.flatMap((o) => nombresDe(o.publisher))
  );

  return {
    autorFuente: autores.slice(0, 6).join('; '),
    anio,
    tituloOriginal: decodificar(titulo),
    nombreFuente: decodificar(medio),
  };
}

async function leerMetadatosDeUrl(urlStr) {
  const { html, url } = await descargarHtml(urlStr);
  return { ...extraerMetadatos(html), url };
}

module.exports = { extraerMetadatos, leerMetadatosDeUrl };
