// Recoge la evidencia REAL de las pruebas automaticas y la guarda en
// docs/entrega/evidencia-pruebas.json (la lee docs/generate_evidencia_pruebas.py).
//
// Uso (desde backend/):  node scripts/recoger-evidencia.js
//
// Ejecuta Jest UNA vez con salida JSON y cobertura (json-summary). Todo lo
// temporal (resultados y cobertura) va a una carpeta temporal del sistema,
// asi que no se ensucia el repositorio. No se inventa ninguna cifra: si Jest
// falla al arrancar, el script termina con error y no escribe el JSON.

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BACKEND = path.resolve(__dirname, '..');
const SALIDA = path.resolve(BACKEND, '..', 'docs', 'entrega', 'evidencia-pruebas.json');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'evidencia-'));
const jsonJest = path.join(tmp, 'jest.json');
const dirCobertura = path.join(tmp, 'coverage');

const inicio = Date.now();
const r = spawnSync(
  'npx',
  ['jest', '--json', `--outputFile=${jsonJest}`, '--coverage',
    '--coverageReporters=json-summary', `--coverageDirectory=${dirCobertura}`],
  { cwd: BACKEND, shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
);
const duracionSeg = (Date.now() - inicio) / 1000;

if (!fs.existsSync(jsonJest)) {
  console.error('Jest no produjo resultados.\n', r.stdout, r.stderr);
  process.exit(1);
}

const jest = JSON.parse(fs.readFileSync(jsonJest, 'utf8'));
const resumenCov = JSON.parse(fs.readFileSync(path.join(dirCobertura, 'coverage-summary.json'), 'utf8'));

const rel = (p) => path.relative(BACKEND, p).split(path.sep).join('/');

const suites = jest.testResults.map((s) => ({
  archivo: rel(s.name),
  estado: s.status,
  pruebas: s.assertionResults.length,
  pasadas: s.assertionResults.filter((a) => a.status === 'passed').length,
  falladas: s.assertionResults.filter((a) => a.status === 'failed').length,
  duracion_ms: s.endTime - s.startTime,
  nombres: s.assertionResults.map((a) => ({ titulo: a.fullName, estado: a.status })),
})).sort((a, b) => a.archivo.localeCompare(b.archivo));

// Cobertura por carpeta (suma de lineas/sentencias/funciones/ramas de cada archivo).
const porCarpeta = {};
for (const [archivo, c] of Object.entries(resumenCov)) {
  if (archivo === 'total') continue;
  const carpeta = path.dirname(rel(archivo));
  const acc = porCarpeta[carpeta] || (porCarpeta[carpeta] = {
    archivos: 0, lines: [0, 0], statements: [0, 0], functions: [0, 0], branches: [0, 0],
  });
  acc.archivos += 1;
  for (const k of ['lines', 'statements', 'functions', 'branches']) {
    acc[k][0] += c[k].covered;
    acc[k][1] += c[k].total;
  }
}
const pct = ([cub, tot]) => (tot === 0 ? 100 : Math.round((cub / tot) * 1000) / 10);
const cobertura_por_carpeta = Object.entries(porCarpeta).sort(([a], [b]) => a.localeCompare(b))
  .map(([carpeta, a]) => ({
    carpeta,
    archivos: a.archivos,
    lineas: pct(a.lines),
    sentencias: pct(a.statements),
    funciones: pct(a.functions),
    ramas: pct(a.branches),
  }));

const t = resumenCov.total;
const evidencia = {
  generado: new Date().toISOString(),
  comando: 'cd backend && npx jest --json --outputFile=<tmp> --coverage --coverageReporters=json-summary',
  node: process.version,
  suites_total: jest.numTotalTestSuites,
  suites_pasadas: jest.numPassedTestSuites,
  suites_falladas: jest.numFailedTestSuites,
  pruebas_total: jest.numTotalTests,
  pruebas_pasadas: jest.numPassedTests,
  pruebas_falladas: jest.numFailedTests,
  pruebas_omitidas: jest.numPendingTests + jest.numTodoTests,
  exito: jest.success,
  duracion_seg: Math.round(duracionSeg * 10) / 10,
  cobertura_global: {
    lineas: t.lines.pct,
    sentencias: t.statements.pct,
    funciones: t.functions.pct,
    ramas: t.branches.pct,
    lineas_cubiertas: t.lines.covered,
    lineas_total: t.lines.total,
  },
  cobertura_por_carpeta,
  suites,
};

fs.mkdirSync(path.dirname(SALIDA), { recursive: true });
fs.writeFileSync(SALIDA, `${JSON.stringify(evidencia, null, 2)}\n`);
fs.rmSync(tmp, { recursive: true, force: true });

console.log(`Suites: ${evidencia.suites_pasadas}/${evidencia.suites_total} OK`);
console.log(`Pruebas: ${evidencia.pruebas_pasadas}/${evidencia.pruebas_total} OK, ${evidencia.pruebas_falladas} falladas`);
console.log(`Cobertura: lineas ${t.lines.pct}% sentencias ${t.statements.pct}% funciones ${t.functions.pct}% ramas ${t.branches.pct}%`);
console.log(`Guardado en ${SALIDA}`);
process.exit(evidencia.exito ? 0 : 2);
