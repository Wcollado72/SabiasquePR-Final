// ENSAYO LOCAL del sitio contra el proyecto NUEVO de Supabase (no toca produccion ni el repo).
//
// Uso (desde la raiz del repo):   node tools/ensayo/servir-web.js
//
// Hace una COPIA temporal del sitio (en %TEMP%\ensayo-web), le cambia la direccion y la clave publica de
// Supabase por las del proyecto nuevo, la construye con build.js (asi se regenera tambien el CSP en
// _headers) y la sirve en http://localhost:8080 aplicando esos encabezados. El API local
// (http://localhost:3000, ver backend/scripts/crear-env-ensayo.js) es el que atiende las llamadas.
// El repositorio NO se modifica: todo ocurre en la copia.
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');

const RAIZ = path.resolve(__dirname, '..', '..');
const DESTINO = path.join(os.tmpdir(), 'ensayo-web');
const PUERTO = 8080;

const VIEJO_URL = 'https://qmlhjacduuvptxglqxqn.supabase.co';
const NUEVO_URL = 'https://ldhlayiblphzyvakliaz.supabase.co';
const NUEVO_KEY = 'sb_publishable_W2y2ewCNYGJDlfSKd8dSaw_KRNZNYlz'; // clave PUBLICA (no es secreta)

const EXCLUIR = new Set(['.git', 'node_modules', 'backend', 'docs', 'coverage', 'tools', 'scripts', '.github']);

function prepararCopia() {
  fs.rmSync(DESTINO, { recursive: true, force: true });
  fs.cpSync(RAIZ, DESTINO, {
    recursive: true,
    filter: (src) => !EXCLUIR.has(path.relative(RAIZ, src).split(path.sep)[0]),
  });
  const rutaBuild = path.join(DESTINO, 'build.js');
  let build = fs.readFileSync(rutaBuild, 'utf8');
  if (!build.includes(VIEJO_URL)) throw new Error('No encuentro la direccion vieja de Supabase en build.js (¿ya se hizo el corte?).');
  const clave = /supabaseKey:\s*'[^']+'/;
  if (!clave.test(build)) throw new Error('No encuentro supabaseKey en build.js.');
  build = build.split(VIEJO_URL).join(NUEVO_URL).replace(clave, `supabaseKey:     '${NUEVO_KEY}'`);
  fs.writeFileSync(rutaBuild, build);
  execFileSync(process.execPath, ['build.js'], { cwd: DESTINO, stdio: 'pipe', env: { ...process.env, API_URL: 'http://localhost:3000' } });
}

// Lee los encabezados del bloque "/*" del archivo _headers generado.
function leerEncabezados() {
  const ruta = path.join(DESTINO, '_headers');
  if (!fs.existsSync(ruta)) return {};
  const out = {};
  let dentro = false;
  for (const linea of fs.readFileSync(ruta, 'utf8').split(/\r?\n/)) {
    if (!linea.trim()) continue;
    if (!/^\s/.test(linea)) { dentro = linea.trim() === '/*'; continue; }
    if (!dentro) continue;
    const i = linea.indexOf(':');
    if (i > 0) out[linea.slice(0, i).trim()] = linea.slice(i + 1).trim();
  }
  return out;
}

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

function servir(encabezados) {
  return http.createServer((req, res) => {
    let ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (ruta.endsWith('/')) ruta += 'index.html';
    let archivo = path.join(DESTINO, ruta);
    if (!archivo.startsWith(DESTINO)) { res.writeHead(403); return res.end('prohibido'); }
    if (!path.extname(archivo) && fs.existsSync(archivo + '.html')) archivo += '.html';
    if (!fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404');
    }
    res.writeHead(200, { ...encabezados, 'Content-Type': TIPOS[path.extname(archivo)] || 'application/octet-stream' });
    fs.createReadStream(archivo).pipe(res);
  });
}

prepararCopia();
const enc = leerEncabezados();
const csp = enc['Content-Security-Policy'] || '';
console.log(`Copia lista en ${DESTINO}`);
console.log(`CSP aplicado: ${csp ? 'si' : 'NO (no se encontro)'} | incluye el Supabase NUEVO: ${csp.includes('ldhlayiblphzyvakliaz')} | incluye el VIEJO: ${csp.includes('qmlhjacduuvptxglqxqn')}`);
servir(enc).listen(PUERTO, () => console.log(`Sitio de ensayo en http://localhost:${PUERTO}  (Ctrl+C para detener)`));
