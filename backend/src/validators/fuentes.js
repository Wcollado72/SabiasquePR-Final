// «Otras fuentes» de una noticia o un contenido (columna `fuentes`): ademas de la fuente principal (fuente_url + fuente_texto),
// hasta 4 fuentes mas, cada una con un nombre visible y, si la tiene, su enlace. Solo se guarda la referencia (nombre y
// enlace): nunca el texto de la fuente.
const MAX_FUENTES = 4;
const MAX_NOMBRE = 200;
const MAX_URL = 2000;

function esUrlHttp(valor) {
  try { return ['http:', 'https:'].includes(new URL(valor).protocol); } catch { return false; }
}

// Errores de la lista (vacio si es valida). `undefined` = no se envio (se conserva lo que ya habia).
function validarFuentes(valor) {
  if (valor === undefined) return [];
  if (!Array.isArray(valor)) return ['Las otras fuentes deben enviarse como una lista.'];
  const errors = [];
  if (valor.length > MAX_FUENTES) errors.push(`Puedes agregar hasta ${MAX_FUENTES} fuentes más además de la principal.`);
  valor.forEach((f, i) => {
    const n = i + 1;
    if (!f || typeof f !== 'object' || Array.isArray(f)) { errors.push(`La fuente ${n} no es válida.`); return; }
    if (typeof f.nombre !== 'string' || !f.nombre.trim() || f.nombre.trim().length > MAX_NOMBRE) {
      errors.push(`La fuente ${n} necesita un nombre de hasta ${MAX_NOMBRE} caracteres.`);
    }
    if (f.url !== undefined && f.url !== null && f.url !== '') {
      if (typeof f.url !== 'string' || f.url.length > MAX_URL || !esUrlHttp(f.url.trim())) {
        errors.push(`El enlace de la fuente ${n} debe ser una URL http:// o https:// válida.`);
      }
    }
  });
  return errors;
}

// La lista limpia que se guarda: solo {nombre, url}, sin espacios sobrantes y sin repetir enlaces. Solo con una lista ya validada.
function normalizarFuentes(valor) {
  const vistos = new Set();
  const resultado = [];
  for (const f of Array.isArray(valor) ? valor : []) {
    const nombre = f.nombre.trim();
    const url = typeof f.url === 'string' ? f.url.trim() : '';
    const llave = (url || nombre).toLowerCase();
    if (vistos.has(llave)) continue;
    vistos.add(llave);
    resultado.push({ nombre, url });
  }
  return resultado;
}

// Las URLs de las otras fuentes que le llegan a una agente (Investigadora, Guardiana, Detective): una lista de textos (o de
// objetos con `url`), de hasta 4 enlaces http(s) validos. Devuelve { urls } limpias y sin repetir, o { error }.
function limpiarUrlsExtra(valor) {
  if (valor === undefined || valor === null) return { urls: [] };
  if (!Array.isArray(valor)) return { error: 'Las otras fuentes deben enviarse como una lista.' };
  if (valor.length > MAX_FUENTES) return { error: `Puedes usar hasta ${MAX_FUENTES} fuentes más además de la principal.` };
  const urls = [];
  for (const item of valor) {
    const url = (typeof item === 'string' ? item : item && item.url) || '';
    if (typeof url !== 'string' || !url.trim()) continue; // una fuente sin enlace (un libro) no se puede leer: se omite
    if (url.length > MAX_URL || !esUrlHttp(url.trim())) return { error: 'Una de las otras fuentes no tiene una URL http:// o https:// válida.' };
    if (!urls.includes(url.trim())) urls.push(url.trim());
  }
  return { urls };
}

// Valor final de `fuentes` al guardar: omitido = se conserva lo que ya habia.
function resolverFuentes(body, existing = {}) {
  return body.fuentes !== undefined ? normalizarFuentes(body.fuentes) : (existing.fuentes ?? []);
}

module.exports = { validarFuentes, normalizarFuentes, resolverFuentes, limpiarUrlsExtra, MAX_FUENTES, MAX_NOMBRE, MAX_URL };
