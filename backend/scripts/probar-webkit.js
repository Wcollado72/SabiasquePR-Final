/* global document, window, getComputedStyle */
// Prueba el sitio con el MOTOR DE SAFARI (WebKit, via Playwright) en tamaños de iPhone, iPad y Mac, y guarda
// docs/entrega/evidencia-webkit.json. No es Safari real en un iPhone o un Mac (eso se prueba a mano): es el mismo motor,
// controlado desde Windows. Por cada página y dispositivo mide: respuesta HTTP, errores de JavaScript, desbordamiento
// horizontal, campos de formulario con letra menor de 16 px (en iPhone, Safari hace zoom solo al tocarlos) y la altura
// del cajón del carrito. Con --bloquear-storage simula Safari con «Bloquear todas las cookies» (tocar localStorage o
// sessionStorage lanza SecurityError).
//
// Playwright NO es dependencia del proyecto (pesa mucho): se instala aparte, en otra carpeta:
//   mkdir ../playwright-webkit && cd ../playwright-webkit && npm init -y && npm install playwright
//   PLAYWRIGHT_BROWSERS_PATH=./browsers npx playwright install webkit
// Uso (desde backend/):
//   PLAYWRIGHT_DIR=../playwright-webkit node scripts/probar-webkit.js [urlBase] [salida.json] [--bloquear-storage]
const fs = require('fs');
const path = require('path');

const DIR = path.resolve(process.env.PLAYWRIGHT_DIR || '../playwright-webkit');
if (!process.env.PLAYWRIGHT_BROWSERS_PATH) process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(DIR, 'browsers');
const { webkit } = require(path.join(DIR, 'node_modules', 'playwright'));

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const BASE = (args[0] || 'https://sabiasquepr.com').replace(/\/$/, '');
const SALIDA = args[1] || path.join(__dirname, '..', '..', 'docs', 'entrega', 'evidencia-webkit.json');
const BLOQUEAR = process.argv.includes('--bloquear-storage');

const PAGINAS = [
  ['Inicio', '/index.html'], ['Noticias', '/noticias.html'], ['Revolución Humana', '/revolucion-humana.html'],
  ['Educación', '/educacion.html'], ['Tienda', '/tienda.html'], ['Premium (apoyo)', '/premium.html'], ['Contacto', '/contacto.html'],
];
const DISPOSITIVOS = [
  { nombre: 'iPhone (Safari iOS)', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1' },
  { nombre: 'iPad (Safari iPadOS)', viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1' },
  { nombre: 'Mac (Safari macOS)', viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15' },
];

function medir() {
  const ancho = document.documentElement.clientWidth;
  const campos = [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button]), select, textarea')]
    .filter((e) => e.offsetParent !== null && parseFloat(getComputedStyle(e).fontSize) < 16)
    .map((e) => `${e.tagName.toLowerCase()}#${e.id || e.name || e.className} ${getComputedStyle(e).fontSize}`);
  const cajon = document.querySelector('.cart-drawer');
  return {
    desborde: document.documentElement.scrollWidth > ancho + 1,
    camposConLetraMenorDe16px: campos,
    cajonCarrito: cajon ? { alturaCss: getComputedStyle(cajon).height, alturaVentana: window.innerHeight } : null,
  };
}

(async () => {
  const navegador = await webkit.launch();
  const resultado = { generado: new Date().toISOString(), base: BASE, motor: `WebKit ${navegador.version()} (Playwright)`, bloqueoStorage: BLOQUEAR, resultados: [] };
  for (const d of DISPOSITIVOS) {
    const { nombre, ...opciones } = d;
    const ctx = await navegador.newContext({ ...opciones, locale: 'es-PR' });
    if (BLOQUEAR) {
      await ctx.addInitScript(() => {
        const err = () => { throw new DOMException('The operation is insecure.', 'SecurityError'); };
        Object.defineProperty(window, 'localStorage', { get: err, configurable: true });
        Object.defineProperty(window, 'sessionStorage', { get: err, configurable: true });
      });
    }
    for (const [pagina, ruta] of PAGINAS) {
      const p = await ctx.newPage();
      const errores = [];
      const badge = [];
      const red = [];
      p.on('pageerror', (e) => errores.push(`pageerror: ${String(e.message).slice(0, 80)} @ ${String(e.stack || '').split('\n').slice(0, 2).join(' > ').slice(0, 160)}`));
      p.on('console', (m) => {
        if (m.type() !== 'error') return;
        const donde = m.location().url || '';
        // El distintivo «Powered by Netlify» (un iframe about:srcdoc) trae avisos de CSP que no vienen del código del proyecto.
        (donde.startsWith('about:srcdoc') || /netlify/i.test(donde) ? badge : errores).push(`console: ${m.text().slice(0, 110)} [${donde.slice(0, 50)}]`);
      });
      p.on('response', (r) => { if (r.status() >= 400) red.push(`${r.status()} ${r.url().slice(0, 100)}`); });
      let estado = null;
      try {
        const r = await p.goto(BASE + ruta, { waitUntil: 'load', timeout: 45000 });
        estado = r ? r.status() : null;
        await p.waitForTimeout(2500);
      } catch (e) { errores.push(`navegacion: ${e.message.slice(0, 120)}`); }
      const medidas = await p.evaluate(medir).catch((e) => ({ errorDeMedicion: e.message }));
      resultado.resultados.push({ dispositivo: nombre, pagina, ruta, estadoHttp: estado, errores, erroresBadgeNetlify: badge, red, ...medidas });
      await p.close();
    }
    await ctx.close();
  }
  await navegador.close();
  fs.writeFileSync(SALIDA, JSON.stringify(resultado, null, 1));

  let conObservaciones = 0;
  for (const r of resultado.resultados) {
    const problemas = [];
    if (r.estadoHttp !== 200) problemas.push(`HTTP ${r.estadoHttp}`);
    if (r.errores.length) problemas.push(`errores: ${r.errores.join(' | ')}`);
    if (r.desborde) problemas.push('desborde horizontal');
    if (r.camposConLetraMenorDe16px && r.camposConLetraMenorDe16px.length) problemas.push(`campos <16px: ${r.camposConLetraMenorDe16px.join(', ')}`);
    if (r.red.length) problemas.push(`red: ${r.red.join(' | ')}`);
    if (problemas.length) { conObservaciones += 1; console.log(`${r.dispositivo} · ${r.pagina}: ${problemas.join(' ; ')}`); }
  }
  console.log(`${resultado.motor}: ${resultado.resultados.length} páginas probadas, ${conObservaciones} con observaciones. Guardado en ${SALIDA}`);
})();
