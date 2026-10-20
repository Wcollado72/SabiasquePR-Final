// Genera docs/entrega/documentacion-tecnica.md a partir del codigo real (rutas montadas en app.js y
// middlewares de cada ruta), para que la lista de endpoints de la entrega nunca se desactualice.
// Uso (desde backend/): node scripts/generar-doc-tecnica.js
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(raiz, 'src', 'app.js'), 'utf8');

const modulos = {};
for (const m of app.matchAll(/const (\w+) = require\('\.\/routes\/([\w.]+)'\)/g)) modulos[m[1]] = m[2];

const montajes = [];
for (const m of app.matchAll(/app\.use\('(\/api[^']*)',\s*(\w+)\)/g)) {
  if (modulos[m[2]]) montajes.push([m[1], modulos[m[2]]]);
}

const filas = [];
for (const [base, archivo] of montajes) {
  const fuente = fs.readFileSync(path.join(raiz, 'src', 'routes', archivo + '.js'), 'utf8');
  for (const linea of fuente.split('\n')) {
    const m = linea.match(/router\.(get|post|put|patch|delete)\(\s*'([^']*)'\s*,(.*)/);
    if (!m) continue;
    const mw = m[3];
    let acceso = 'Público';
    if (mw.includes('requireAdmin')) acceso = 'Admin';
    else if (mw.includes('requireModerador')) acceso = 'Moderador/Admin';
    else if (mw.includes('requireAuth')) acceso = 'Sesión';
    else if (mw.includes('tryAuth')) acceso = 'Opcional';
    const ruta = base + (m[2] === '/' ? '' : m[2]);
    if (ruta === '/api/stripe/webhook') acceso = 'Firma de Stripe (sin sesión)';
    filas.push([m[1].toUpperCase(), ruta, acceso, archivo]);
  }
}

const cuenta = {};
for (const f of filas) cuenta[f[2]] = (cuenta[f[2]] || 0) + 1;

const L = [];
const p = (s = '') => L.push(s);
p('# Documentación técnica — Sabías que PR');
p();
p('Borrador generado automáticamente a partir del código (`backend/scripts/generar-doc-tecnica.js`) para la parte 4 de la entrega: estructura del proyecto, rutas API, endpoints, configuración del entorno, autenticación y dependencias. Se vuelve a generar con `node backend/scripts/generar-doc-tecnica.js`.');
p();
p('## 1. Estructura del proyecto');
p('Estructura del repositorio (la pide el PDF de la rúbrica):');
p();
p('```');
p('/frontend   sitio estático: páginas HTML generadas por build.js, scripts JS, CSS, imágenes, i18n, service worker');
p('/backend    API REST (Node.js + Express): src/routes, src/middleware, src/validators, src/services, sql/, scripts/');
p('README.md   descripción, requisitos, instalación, ejecución y estructura');
p('docs/       documentación, PDFs y guiones');
p('```');
p();
p('## 2. Rutas API y endpoints');
p('La API es REST, responde JSON y está publicada en `https://sabiasquepr-backend-uufz.onrender.com`. **Acceso:** *Público* = sin sesión; *Opcional* = funciona con o sin sesión; *Sesión* = requiere un JWT válido; *Moderador/Admin* y *Admin* = además exigen ese rol guardado en la tabla `perfiles`.');
p();
p('| Método | Ruta | Acceso | Módulo |');
p('|---|---|---|---|');
for (const [m, r, a, f] of filas) p('| ' + m + ' | `' + r + '` | ' + a + ' | ' + f + '.js |');
p();
p('Total: ' + filas.length + ' endpoints (' + Object.entries(cuenta).map(([k, v]) => k + ': ' + v).join(', ') + '). Además existe `GET /api/health`.');
p();
p('## 3. Configuración del entorno');
p('Variables de entorno del backend (solo nombres; los valores nunca van en el repositorio, ver `backend/.env.example`):');
p();
p('| Variable | Para qué sirve |');
p('|---|---|');
const vars = [
  ['DATABASE_URL', 'Conexión a PostgreSQL (Supabase, pooler de sesión)'],
  ['PORT', 'Puerto de la API'],
  ['SUPABASE_URL', 'Dirección del proyecto Supabase; de ahí salen las llaves públicas (JWKS) para verificar el JWT'],
  ['FRONTEND_ORIGIN', 'Orígenes permitidos por CORS (separados por coma)'],
  ['STRIPE_SECRET_KEY', 'Llave secreta de Stripe (modo de prueba)'],
  ['STRIPE_WEBHOOK_SECRET', 'Secreto para verificar la firma del webhook de Stripe'],
  ['STRIPE_PREMIUM_PRICE_ID', 'Precio del apoyo mensual en Stripe'],
  ['TURNSTILE_SECRET_KEY', 'Verificación anti-robots (Cloudflare Turnstile)'],
  ['ANTHROPIC_API_KEY', 'API de Claude para los agentes del panel de administración'],
  ['BEEHIIV_API_KEY, BEEHIIV_PUBLICATION_ID', 'Alta de suscriptores al boletín (Beehiiv)'],
];
for (const [a, b] of vars) p('| `' + a + '` | ' + b + ' |');
p();
p('Comandos (dentro de `backend/`): `npm install`, `npm run dev` (desarrollo), `npm start`, `npm run db:schema` (crear las tablas), `npm test` y `npm run test:coverage`.');
p();
p('## 4. Autenticación y autorización');
p('- **Registro e inicio de sesión:** Supabase Auth (correo y contraseña, y Google). El panel de administración exige además verificación en dos pasos (TOTP).');
p('- **JWT:** el navegador envía `Authorization: Bearer <token>`. El backend lo **verifica en el servidor** con la librería `jose` contra las llaves públicas de Supabase (JWKS, algoritmo ES256); no confía en nada que venga del cliente. Un token falso o vencido devuelve 401.');
p('- **Roles:** guardados en la tabla `perfiles` (`usuario`, `premium`, `moderador`, `admin`). Los middlewares `requireAuth`, `requireAdmin` y `requireModerador` protegen cada ruta.');
p('- **Otras medidas:** límite de peticiones por IP, `helmet`, cabeceras CSP en el frontend, validación centralizada de datos (`src/validators`), mensajes de error genéricos y comprobación de contraseñas filtradas.');
p();
p('## 5. Dependencias');
p('Backend:');
p();
p('| Paquete | Uso |');
p('|---|---|');
const deps = [['express', 'Servidor y rutas de la API'], ['pg', 'Cliente de PostgreSQL'], ['jose', 'Verificación del JWT (JWKS)'], ['cors', 'CORS'], ['helmet', 'Cabeceras de seguridad'], ['express-rate-limit', 'Límite de peticiones'], ['stripe', 'Pagos y webhook'], ['dotenv', 'Variables de entorno'], ['@mozilla/readability + jsdom', 'Extraer el texto de artículos (agentes del panel)'], ['jest + supertest', 'Pruebas automáticas (solo desarrollo)']];
for (const [a, b] of deps) p('| ' + a + ' | ' + b + ' |');
p();
p('Frontend: HTML5, CSS3 y JavaScript sin framework; cliente `supabase-js` incluido localmente (`vendor/`).');

const destino = path.join(raiz, '..', 'docs', 'entrega', 'documentacion-tecnica.md');
fs.mkdirSync(path.dirname(destino), { recursive: true });
fs.writeFileSync(destino, L.join('\n') + '\n');
console.log('escrito:', destino, '| endpoints:', filas.length, JSON.stringify(cuenta));
