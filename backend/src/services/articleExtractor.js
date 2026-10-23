const dns = require('dns').promises;
// jsdom se carga de forma perezosa (dentro de extraerArticulo) en vez de
// aqui arriba: una dependencia transitiva suya usa sintaxis ESM que rompe
// Jest en CUALQUIER prueba que solo cargue app.js, aunque nunca llame a
// esta funcion. Cargandolo solo cuando de verdad se usa evita el problema
// para todas las demas rutas.
const FETCH_TIMEOUT_MS = 10000;
const MAX_BYTES = 5 * 1024 * 1024; // 5MB, de sobra para un articulo de texto

// Bloquea direcciones privadas/internas para que este endpoint no se pueda
// usar para escanear o acceder a la red interna del servidor (SSRF) --
// el admin puede pegar cualquier URL, incluida una apuntando a localhost
// o a la red interna de Render/AWS por error o intencionalmente.
function isPrivateIp(ip) {
  if (ip.includes(':')) {
    // IPv6: loopback, link-local y ULA (fc00::/7)
    const lower = ip.toLowerCase();
    return lower === '::1' || lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd');
  }
  const parts = ip.split('.').map(Number);
  const [a, b] = parts;
  if (a === 127 || a === 10 || a === 0) return true;
  if (a === 169 && b === 254) return true; // link-local, incluye metadata de nube (169.254.169.254)
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

async function assertUrlEsSegura(urlStr) {
  let url;
  try {
    url = new URL(urlStr);
  } catch {
    throw new Error('La URL no es valida.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Solo se permiten URLs http o https.');
  }
  const addresses = await dns.lookup(url.hostname, { all: true });
  if (addresses.some((a) => isPrivateIp(a.address))) {
    throw new Error('Esa direccion no esta permitida.');
  }
  return url;
}

// Descarga una pagina de forma segura (solo http/https, sin direcciones internas, con tiempo y tamano maximos)
// y devuelve su HTML. Lo comparten la extraccion del articulo y la lectura de metadatos de la fuente.
async function descargarHtml(urlStr) {
  const url = await assertUrlEsSegura(urlStr);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SabiasQuePRBot/1.0)' },
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`No se pudo descargar el articulo (HTTP ${res.status}).`);

  const contentLength = Number(res.headers.get('content-length') || 0);
  if (contentLength > MAX_BYTES) throw new Error('El articulo es demasiado grande.');

  const html = await res.text();
  if (html.length > MAX_BYTES) throw new Error('El articulo es demasiado grande.');
  return { html, url };
}

// Descarga la URL y extrae el texto legible del articulo (igual tecnologia
// que el "modo lectura" de Firefox) -- gratis, sin costo de API.
async function extraerArticulo(urlStr) {
  const { JSDOM } = require('jsdom');
  const { Readability } = require('@mozilla/readability');
  const { html, url } = await descargarHtml(urlStr);

  const dom = new JSDOM(html, { url: url.toString() }); // runScripts NO se activa: nunca ejecuta el JS de la pagina
  const reader = new Readability(dom.window.document);
  const article = reader.parse();
  if (!article || !article.textContent || article.textContent.trim().length < 200) {
    throw new Error('No se pudo extraer el texto del articulo (puede que la pagina bloquee lectura automatica).');
  }

  return {
    titulo: article.title || '',
    texto: article.textContent.trim().slice(0, 15000), // limite razonable de contexto
    sitio: article.siteName || url.hostname,
    autor: article.byline || '',
    url: url.toString(),
  };
}

module.exports = { extraerArticulo, descargarHtml, isPrivateIp, assertUrlEsSegura };
