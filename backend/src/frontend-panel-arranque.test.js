// El panel de administracion debe ARRANCAR: sin errores de JavaScript y con las listas pintadas.
// Corre scripts/probar-panel.js (jsdom, sesion y API simuladas) en un proceso aparte.
const { spawnSync } = require('child_process');
const path = require('path');

test('el panel arranca sin errores y pinta noticias, contenidos, productos y reportes', () => {
  const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'probar-panel.js')], { encoding: 'utf8', timeout: 60000 });
  expect(r.stdout + r.stderr).toContain('OK: el panel arranca sin errores');
  expect(r.status).toBe(0);
}, 70000);
