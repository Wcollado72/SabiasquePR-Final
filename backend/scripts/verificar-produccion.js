// Verificacion DESDE FUERA contra produccion, con curl. Guarda el resultado literal en
// docs/entrega/evidencia-produccion.json (lo lee docs/generate_evidencia_pruebas.py).
//
// Uso (desde backend/):  node scripts/verificar-produccion.js
//
// Solo hace peticiones inofensivas: lecturas publicas y peticiones SIN credenciales validas
// que el servidor debe rechazar (401/400). No crea, edita ni borra nada: los cuerpos de las
// peticiones de escritura son "{}" y se rechazan antes de llegar a la base de datos.

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const API = 'https://sabiasquepr-backend-uufz.onrender.com';
const SITIO = 'https://sabiasquepr.com';
const SALIDA = path.resolve(__dirname, '..', '..', 'docs', 'entrega', 'evidencia-produccion.json');
// JWT inventado a proposito: firma falsa, ningun emisor real.
const TOKEN_FALSO = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJpbnZlbnRhZG8ifQ.firma-falsa';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prod-'));

function curl({ metodo = 'GET', url, token, cuerpo, soloCabeceras = false }) {
  const bodyFile = path.join(tmp, 'cuerpo.txt');
  const args = ['-s', '-m', '90', '-D', '-', '-o', bodyFile, '-w', '\n__FIN__%{http_code}|%{time_total}'];
  if (soloCabeceras) args.push('-I');
  else args.push('-X', metodo);
  if (cuerpo !== undefined) args.push('-H', 'Content-Type: application/json', '-d', cuerpo);
  if (token) args.push('-H', `Authorization: Bearer ${token}`);
  args.push(url);
  let salida;
  try {
    salida = execFileSync('curl', args, { encoding: 'utf8' });
  } catch (e) {
    return { metodo, url, error: `curl fallo: ${e.message}` };
  }
  const [cabs, fin] = salida.split('__FIN__');
  const [codigo, tiempo] = fin.trim().split('|');
  let cuerpoTxt = '';
  try { cuerpoTxt = fs.readFileSync(bodyFile, 'utf8'); } catch { /* HEAD: sin cuerpo */ }
  fs.rmSync(bodyFile, { force: true });
  const cabeceras = {};
  for (const linea of cabs.split(/\r?\n/)) {
    const i = linea.indexOf(':');
    if (i > 0) cabeceras[linea.slice(0, i).trim().toLowerCase()] = linea.slice(i + 1).trim();
  }
  return {
    metodo: soloCabeceras ? 'HEAD' : metodo,
    url,
    estado: Number(codigo),
    segundos: Number(tiempo),
    cuerpo: cuerpoTxt.slice(0, 200),
    cuerpo_bytes: Buffer.byteLength(cuerpoTxt),
    cabeceras,
  };
}

const casos = [
  // Lecturas publicas: deben dar 200 con datos
  { id: 'health', desc: 'Salud del API', esperado: 200, req: { url: `${API}/api/health` } },
  { id: 'noticias', desc: 'Lista pública de noticias', esperado: 200, req: { url: `${API}/api/noticias` } },
  { id: 'cont-educacion', desc: 'Contenidos de Educación', esperado: 200, req: { url: `${API}/api/contenidos?seccion=educacion` } },
  { id: 'cont-revolucion', desc: 'Contenidos de Revolución Humana', esperado: 200, req: { url: `${API}/api/contenidos?seccion=revolucion-humana` } },
  { id: 'productos', desc: 'Productos de la tienda', esperado: 200, req: { url: `${API}/api/productos` } },
  // Rutas protegidas SIN token: 401
  { id: 'post-noticias-sin', desc: 'Crear noticia sin token', esperado: 401, req: { metodo: 'POST', url: `${API}/api/noticias`, cuerpo: '{}' } },
  { id: 'put-noticias-sin', desc: 'Editar noticia sin token', esperado: 401, req: { metodo: 'PUT', url: `${API}/api/noticias/x`, cuerpo: '{}' } },
  { id: 'del-noticias-sin', desc: 'Borrar noticia sin token', esperado: 401, req: { metodo: 'DELETE', url: `${API}/api/noticias/x` } },
  { id: 'admin-gastos-sin', desc: 'Panel admin: gastos, sin token', esperado: 401, req: { url: `${API}/api/admin/gastos` } },
  { id: 'admin-uso-sin', desc: 'Panel admin: uso de IA, sin token', esperado: 401, req: { url: `${API}/api/admin/uso-ia` } },
  { id: 'foro-post-sin', desc: 'Publicar en el debate sin token', esperado: 401, req: { metodo: 'POST', url: `${API}/api/foro/posts`, cuerpo: '{}' } },
  { id: 'me-sin', desc: 'Perfil propio (/api/me) sin token', esperado: 401, req: { url: `${API}/api/me` } },
  // Rutas protegidas con token INVENTADO: 401
  { id: 'post-noticias-falso', desc: 'Crear noticia con token inventado', esperado: 401, req: { metodo: 'POST', url: `${API}/api/noticias`, cuerpo: '{}', token: TOKEN_FALSO } },
  { id: 'admin-gastos-falso', desc: 'Panel admin: gastos, token inventado', esperado: 401, req: { url: `${API}/api/admin/gastos`, token: TOKEN_FALSO } },
  { id: 'me-falso', desc: 'Perfil propio con token inventado', esperado: 401, req: { url: `${API}/api/me`, token: TOKEN_FALSO } },
  // Webhook de Stripe sin firma valida: 400
  { id: 'stripe-webhook', desc: 'Webhook de Stripe con firma falsa', esperado: 400, req: { metodo: 'POST', url: `${API}/api/stripe/webhook`, cuerpo: '{}' } },
  // Sitio estatico
  { id: 'sitio-cabeceras', desc: 'Cabeceras de seguridad del sitio (HEAD /)', esperado: 200, req: { url: `${SITIO}/`, soloCabeceras: true } },
  { id: 'sitio-build-js', desc: 'Archivo interno /build.js', esperado: 404, req: { url: `${SITIO}/build.js` } },
  { id: 'sitio-package-json', desc: 'Archivo interno /package.json', esperado: 404, req: { url: `${SITIO}/package.json` } },
  { id: 'sitio-http', desc: 'http:// redirige a https://', esperado: 301, req: { url: 'http://sabiasquepr.com/', soloCabeceras: true } },
  { id: 'sitio-netlify-app', desc: 'La dirección de netlify.app redirige al dominio propio', esperado: 301, req: { url: 'https://fabulous-tartufo-fcb839.netlify.app/', soloCabeceras: true } },
  { id: 'api-cabeceras', desc: 'Cabeceras de seguridad del API (HEAD /api/health)', esperado: 200, req: { url: `${API}/api/health`, soloCabeceras: true } },
];

const resultados = casos.map((c) => {
  const r = curl(c.req);
  // Los HEAD de cabeceras no guardan cuerpo; en el resto se acorta lo que se publica.
  const ok = r.estado === c.esperado;
  console.log(`${ok ? 'OK ' : 'FALLA'} ${c.id}: esperado ${c.esperado}, obtenido ${r.estado} (${r.segundos}s)`);
  return { id: c.id, descripcion: c.desc, esperado: c.esperado, ok, ...r };
});

// Conteos de datos reales (para demostrar que los 200 traen datos, no listas vacias).
function contar(id, clave) {
  const c = casos.find((x) => x.id === id);
  try {
    const bodyFile = path.join(tmp, 'c.json');
    execFileSync('curl', ['-s', '-m', '90', '-o', bodyFile, c.req.url]);
    const j = JSON.parse(fs.readFileSync(bodyFile, 'utf8'));
    return Array.isArray(j[clave]) ? j[clave].length : null;
  } catch { return null; }
}
const conteos = {
  noticias: contar('noticias', 'noticias'),
  contenidos_educacion: contar('cont-educacion', 'contenidos'),
  contenidos_revolucion_humana: contar('cont-revolucion', 'contenidos'),
  productos: contar('productos', 'productos'),
};

fs.writeFileSync(SALIDA, `${JSON.stringify({
  generado: new Date().toISOString(),
  herramienta: execFileSync('curl', ['--version'], { encoding: 'utf8' }).split('\n')[0],
  conteos,
  resultados,
}, null, 2)}\n`);
fs.rmSync(tmp, { recursive: true, force: true });
console.log('Conteos:', JSON.stringify(conteos));
console.log(`Guardado en ${SALIDA}`);
