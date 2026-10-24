// Agente "Detective" (El Detective): avisa si la historia que se esta escribiendo YA esta publicada (o guardada como
// borrador) en el sitio, para no duplicarla. Es un calculo determinista, sin IA y sin costo: compara la URL de la
// fuente (la misma pagina) y el parecido del titulo y del resumen con las noticias y los contenidos existentes.
// Solo avisa y ofrece abrir la pieza que ya existe; nunca borra ni fusiona nada por su cuenta.

const UMBRAL_REPORTAR = 0.4;
const MAX_CANDIDATAS = 5;

const PARAMS_RASTREO = /^(utm_|fbclid$|gclid$|igshid$|ref$|ref_src$|si$|feature$)/i;
const PALABRAS_VACIAS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al', 'y', 'o', 'u', 'e', 'en', 'a', 'por', 'para', 'con', 'sin', 'sobre', 'que', 'se', 'su', 'sus', 'es', 'son', 'ser', 'fue', 'ha', 'han', 'lo', 'le', 'les', 'como', 'mas', 'pero', 'este', 'esta', 'estos', 'estas', 'ese', 'esa',
  'the', 'of', 'and', 'to', 'in', 'for', 'on', 'with', 'is', 'are', 'was', 'were', 'be', 'by', 'at', 'an', 'as', 'it', 'its', 'that', 'this', 'from', 'or', 'has', 'have',
]);

// Misma pagina aunque cambien http/https, www, la barra final, el # o los parametros de rastreo (utm_*, fbclid...).
function normalizarUrl(valor) {
  try {
    const u = new URL(String(valor || '').trim());
    if (!/^https?:$/.test(u.protocol)) return '';
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const params = [...u.searchParams.entries()].filter(([k]) => !PARAMS_RASTREO.test(k)).sort(([a], [b]) => a.localeCompare(b));
    const consulta = params.map(([k, v]) => `${k}=${v}`).join('&');
    return `${host}${u.pathname.replace(/\/+$/, '')}${consulta ? `?${consulta}` : ''}`;
  } catch {
    return '';
  }
}

function tokens(texto) {
  return new Set(
    String(texto || '')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2 && !PALABRAS_VACIAS.has(t))
  );
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let comunes = 0;
  a.forEach((t) => { if (b.has(t)) comunes += 1; });
  return comunes / (a.size + b.size - comunes);
}

// Parecido entre la pieza nueva y una existente: 0 a 1, con las razones en palabras.
function compararPiezas(nueva, existente) {
  const razones = [];
  const urlNueva = normalizarUrl(nueva.fuenteUrl);
  const urlIgual = Boolean(urlNueva) && urlNueva === normalizarUrl(existente.fuenteUrl);
  if (urlIgual) razones.push('Usa la misma fuente (la misma página).');

  const tituloSim = jaccard(tokens(nueva.titulo), tokens(existente.titulo));
  if (tituloSim >= 0.5) razones.push(`El título es muy parecido (${Math.round(tituloSim * 100)}%).`);
  const resumenSim = jaccard(tokens(nueva.resumen), tokens(existente.resumen));
  if (resumenSim >= 0.3) razones.push(`El resumen trata de lo mismo (${Math.round(resumenSim * 100)}% de palabras en común).`);

  const similitud = Math.max(urlIgual ? 1 : 0, tituloSim, 0.5 * tituloSim + 0.5 * resumenSim);
  return { similitud: Math.round(similitud * 100) / 100, razones };
}

function nivelDe(similitud) {
  if (similitud >= 0.8) return 'muy_probable';
  if (similitud >= 0.55) return 'probable';
  return 'posible';
}

// `existentes`: [{ tipo, id, titulo, resumen, fuenteUrl, publicado, fecha }]. Devuelve las mas parecidas.
function buscarDuplicados(nueva, existentes, excluir = null) {
  return existentes
    .filter((e) => !(excluir && e.tipo === excluir.tipo && e.id === excluir.id))
    .map((e) => ({ e, ...compararPiezas(nueva, e) }))
    .filter((r) => r.similitud >= UMBRAL_REPORTAR)
    .sort((a, b) => b.similitud - a.similitud)
    .slice(0, MAX_CANDIDATAS)
    .map((r) => ({
      tipo: r.e.tipo,
      id: r.e.id,
      titulo: r.e.titulo,
      publicado: r.e.publicado !== false,
      fecha: r.e.fecha ? String(r.e.fecha).slice(0, 10) : null,
      similitud: r.similitud,
      nivel: nivelDe(r.similitud),
      razones: r.razones,
    }));
}

module.exports = { buscarDuplicados, compararPiezas, normalizarUrl, tokens, jaccard, nivelDe, UMBRAL_REPORTAR, MAX_CANDIDATAS };
