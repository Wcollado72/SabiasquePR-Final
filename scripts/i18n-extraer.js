// Extrae los textos visibles (nodos de texto + placeholder/aria-label/title/alt)
// de las paginas HTML generadas y lista los que aun NO estan en i18n/en.json.
// Uso:  node scripts/i18n-extraer.js [--chrome] [archivo.html ...]
//   --chrome  solo header/footer/modales/carrito (todo menos <main>)
// Salida: i18n/faltantes.json (clave = texto en espanol tal como lo ve el visitante).
const fs = require('fs');
const path = require('path');
const { normalizar } = require('../i18n.js');

const args = process.argv.slice(2);
const soloChrome = args.includes('--chrome');
let archivos = args.filter((a) => a.endsWith('.html'));
if (!archivos.length) {
  archivos = fs.readdirSync('.').filter((f) => f.endsWith('.html') && !['admin.html', '404.html'].includes(f));
}

function limpiarHtml(html) {
  let h = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  if (soloChrome) h = h.replace(/<main[\s\S]*?<\/main>/gi, '');
  return h;
}

function extraer(html) {
  const textos = new Set();
  const h = limpiarHtml(html);
  for (const m of h.matchAll(/>([^<>]+)</g)) textos.add(normalizar(m[1].replace(/&nbsp;/g, ' ')));
  for (const m of h.matchAll(/\s(?:placeholder|aria-label|title|alt)="([^"]+)"/g)) textos.add(normalizar(m[1]));
  const titulo = /<title>([^<]+)<\/title>/i.exec(html);
  if (titulo && !soloChrome) textos.add(normalizar(titulo[1]));
  const desc = /<meta name="description" content="([^"]+)"/i.exec(html);
  if (desc && !soloChrome) textos.add(normalizar(desc[1]));
  return [...textos].filter((t) => /\p{L}{2,}/u.test(t) && !/^[\d\s.,:;$%+\-–—/()]+$/u.test(t));
}

const todos = new Set();
for (const f of archivos) extraer(fs.readFileSync(f, 'utf8')).forEach((t) => todos.add(t));

let dic = {};
try { dic = JSON.parse(fs.readFileSync(path.join('i18n', 'en.json'), 'utf8')); } catch { /* aun no existe */ }
const faltantes = [...todos].filter((t) => !(t in dic)).sort((a, b) => a.localeCompare(b, 'es'));

fs.mkdirSync('i18n', { recursive: true });
fs.writeFileSync(path.join('i18n', 'faltantes.json'), JSON.stringify(faltantes, null, 2) + '\n');
console.log(`${todos.size} textos encontrados, ${faltantes.length} sin traducir -> i18n/faltantes.json`);
