// Prueba automatica en navegadores y tamanos de pantalla, contra el sitio publicado.
// Controla Chrome y Edge SIN pantalla por el protocolo DevTools (CDP) y, para cada
// navegador x tamano x pagina, mide:
//   - que la pagina carga (el documento principal responde 2xx y se dispara "load"),
//   - que NO hay desbordamiento horizontal (scrollWidth <= innerWidth),
//   - que no hay errores de consola (excepciones, console.error, errores del navegador).
// Guarda los datos medidos en docs/entrega/evidencia-navegadores.json (los lee
// docs/generate_evidencia_pruebas.py).
//
// Uso (desde backend/):  node scripts/probar-navegadores.js [urlBase]
// Requiere Node 22+ (WebSocket y fetch globales) y Chrome/Edge instalados en Windows.

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = (process.argv[2] || 'https://sabiasquepr.com').replace(/\/$/, '');
const SALIDA = path.resolve(__dirname, '..', '..', 'docs', 'entrega', 'evidencia-navegadores.json');

const NAVEGADORES = [
  { nombre: 'Google Chrome', ruta: 'C:/Program Files/Google/Chrome/Application/chrome.exe' },
  { nombre: 'Microsoft Edge', ruta: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' },
  { nombre: 'Mozilla Firefox', ruta: 'C:/Program Files/Mozilla Firefox/firefox.exe', motor: 'gecko' },
];
const TAMANOS = [
  { nombre: 'Escritorio', ancho: 1280, alto: 800, movil: false },
  { nombre: 'Tableta', ancho: 768, alto: 1024, movil: true },
  { nombre: 'Móvil', ancho: 390, alto: 844, movil: true },
];
const PAGINAS = [
  ['Inicio', '/index.html'],
  ['Noticias', '/noticias.html'],
  ['Revolución Humana', '/revolucion-humana.html'],
  ['Educación', '/educacion.html'],
  ['Tienda', '/tienda.html'],
  ['Premium (apoyo)', '/premium.html'],
  ['Contacto', '/contacto.html'],
];

const espera = (ms) => new Promise((r) => { setTimeout(r, ms); });

async function conectar(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let n = 0;
  const pend = new Map();
  const oyentes = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } else oyentes.forEach((f) => f(d));
  };
  const cmd = (method, params = {}) => new Promise((r) => { n += 1; pend.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
  return { ws, cmd, on: (f) => oyentes.push(f), cerrar: () => ws.close() };
}

async function probarPagina(puerto, tam, ruta) {
  const url = BASE + ruta;
  const meta = await (await fetch(`http://127.0.0.1:${puerto}/json/new?about:blank`, { method: 'PUT' })).json();
  const c = await conectar(meta.webSocketDebuggerUrl);
  const res = { url, estadoHttp: null, cargo: false, errores: [], erroresBadgeNetlify: [], avisosRed: [] };
  let cargado = null;
  const promesaLoad = new Promise((r) => { cargado = r; });
  c.on((d) => {
    if (d.method === 'Page.loadEventFired') cargado();
    if (d.method === 'Network.responseReceived' && d.params.type === 'Document' && res.estadoHttp === null) res.estadoHttp = d.params.response.status;
    if (d.method === 'Network.responseReceived' && d.params.response.status >= 400) {
      res.avisosRed.push(`${d.params.response.status} ${d.params.response.url.slice(0, 120)}`);
    }
    if (d.method === 'Network.loadingFailed' && !d.params.canceled) res.avisosRed.push(`falló: ${d.params.errorText} (${d.params.type})`);
    if (d.method === 'Runtime.exceptionThrown') {
      const e = d.params.exceptionDetails;
      res.errores.push(`excepción: ${(e.exception && e.exception.description) || e.text}`.slice(0, 200));
    }
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') {
      res.errores.push(`console.error: ${d.params.args.map((a) => a.value || a.description || '').join(' ')}`.slice(0, 200));
    }
    if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') {
      // about:srcdoc = el iframe "Powered by Netlify" (nl-badge-frame) que Netlify inyecta en el sitio;
      // su codigo en linea lo bloquea la CSP del sitio. No es codigo propio y se cuenta aparte.
      const entrada = `${d.params.entry.source}: ${d.params.entry.text}`.slice(0, 200);
      if (d.params.entry.url === 'about:srcdoc') res.erroresBadgeNetlify.push(entrada);
      else res.errores.push(`${entrada} ${d.params.entry.url || ''}`.slice(0, 220));
    }
  });
  await c.cmd('Page.enable');
  await c.cmd('Network.enable');
  await c.cmd('Runtime.enable');
  await c.cmd('Log.enable');
  await c.cmd('Emulation.setDeviceMetricsOverride', { width: tam.ancho, height: tam.alto, deviceScaleFactor: 1, mobile: tam.movil });
  if (tam.movil) await c.cmd('Emulation.setTouchEmulationEnabled', { enabled: true });
  await c.cmd('Page.navigate', { url });
  const limite = await Promise.race([promesaLoad.then(() => 'ok'), espera(45000).then(() => 'tiempo')]);
  res.cargo = limite === 'ok';
  await espera(3500); // tiempo para que el JavaScript pida datos al API y pinte
  const m = await c.cmd('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const de = document.documentElement;
      const sw = Math.max(de.scrollWidth, document.body ? document.body.scrollWidth : 0);
      let culpable = null;
      if (sw > window.innerWidth) {
        let max = 0;
        document.querySelectorAll('body *').forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.right > window.innerWidth + 1 && r.right > max) { max = r.right; culpable = el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''); }
        });
      }
      return { titulo: document.title, anchoVentana: window.innerWidth, anchoContenido: sw,
        h1: !!document.querySelector('h1'), textoLen: (document.body.innerText || '').trim().length,
        tieneViewportMeta: !!document.querySelector('meta[name=viewport]'), culpable };
    })()`,
  });
  res.medidas = (m.result && m.result.result && m.result.result.value) || null;
  c.cerrar();
  await fetch(`http://127.0.0.1:${puerto}/json/close/${meta.id}`).catch(() => {});
  return res;
}

async function probarNavegador(nav) {
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'nav-'));
  const puerto = 9500 + Math.floor(Math.random() * 400);
  const proc = spawn(nav.ruta, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${puerto}`, `--user-data-dir=${perfil}`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
  let version = null;
  for (let i = 0; i < 60 && !version; i += 1) {
    try { version = await (await fetch(`http://127.0.0.1:${puerto}/json/version`)).json(); } catch { await espera(250); }
  }
  if (!version) { proc.kill(); throw new Error(`No arrancó ${nav.nombre}`); }
  const filas = [];
  for (const tam of TAMANOS) {
    for (const [nombrePag, ruta] of PAGINAS) {
      let r;
      try { r = await probarPagina(puerto, tam, ruta); } catch (e) { r = { url: BASE + ruta, cargo: false, errores: [`fallo de la prueba: ${e.message}`], avisosRed: [] }; }
      const med = r.medidas || {};
      const sinDesborde = med.anchoContenido !== undefined && med.anchoContenido <= med.anchoVentana;
      const fila = {
        navegador: nav.nombre, tamano: tam.nombre, resolucion: `${tam.ancho}x${tam.alto}`, pagina: nombrePag, ruta,
        carga: r.cargo && r.estadoHttp >= 200 && r.estadoHttp < 300 && (med.textoLen || 0) > 100,
        estadoHttp: r.estadoHttp, sinDesborde, anchoVentana: med.anchoVentana, anchoContenido: med.anchoContenido,
        elementoQueDesborda: med.culpable || null, sinErroresConsola: r.errores.length === 0,
        errores: r.errores, erroresBadgeNetlify: r.erroresBadgeNetlify || [], avisosRed: r.avisosRed, titulo: med.titulo, tieneH1: med.h1, tieneViewportMeta: med.tieneViewportMeta,
      };
      filas.push(fila);
      console.log(`${nav.nombre} ${tam.nombre} ${nombrePag}: carga=${fila.carga} desborde=${!sinDesborde} (${med.anchoContenido}/${med.anchoVentana}) errores=${r.errores.length} badgeNetlify=${(r.erroresBadgeNetlify || []).length} red>=400=${r.avisosRed.length}`);
    }
  }
  proc.kill();
  await espera(500);
  try { fs.rmSync(perfil, { recursive: true, force: true }); } catch { /* perfil aun en uso: no importa */ }
  return { navegador: nav.nombre, version: version.Browser, userAgent: version['User-Agent'], filas };
}

(async () => {
  const resultado = { generado: new Date().toISOString(), base: BASE, noInstalados: [], navegadores: [] };
  for (const nav of NAVEGADORES) {
    if (!fs.existsSync(nav.ruta)) { resultado.noInstalados.push(nav.nombre); continue; }
    if (nav.motor === 'gecko') { resultado.noInstalados.push(`${nav.nombre} (instalado, pero este script solo maneja Chromium)`); continue; }
    resultado.navegadores.push(await probarNavegador(nav));
  }
  fs.writeFileSync(SALIDA, `${JSON.stringify(resultado, null, 2)}\n`);
  console.log(`Guardado en ${SALIDA}`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
