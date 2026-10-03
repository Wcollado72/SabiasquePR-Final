// Uso (desde la carpeta backend):
//   node scripts/restaurar-respaldo.js --solo-lista            (solo muestra que se restauraria; no conecta)
//   node scripts/restaurar-respaldo.js [ruta\respaldo.dump]    (restaura en el proyecto NUEVO de Supabase)
//   Opcion extra: --forzar  (permite restaurar aunque el proyecto nuevo ya tenga tablas o usuarios)
//
// Restaura el respaldo (ya descifrado con `age`) en el proyecto nuevo de Supabase:
//   - esquema `public` completo + datos, y los usuarios (auth.users / auth.identities); ver lib/filtrar-toc.js
//   - todo dentro de UNA transaccion: si algo falla, no queda nada a medias y se puede repetir
// La contrasena de la base se escribe aqui (oculta) -- nunca pasa por el chat, un archivo ni la linea de comandos.
// NO toca backend/.env ni el proyecto viejo (solo lo LEE, para comparar conteos).
const readline = require('readline');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { Client, Pool } = require('pg');
const { filtrarToc } = require('./lib/filtrar-toc');

const REF_NUEVO = 'ldhlayiblphzyvakliaz';
const USUARIO = `postgres.${REF_NUEVO}`;
const PUERTO = '5432';
const BASE = 'postgres';
const PG_BIN = process.env.PG_BIN || 'C:\\Program Files\\PostgreSQL\\17\\bin';

const args = process.argv.slice(2);
const soloLista = args.includes('--solo-lista');
const forzar = args.includes('--forzar');
const rutaDump = args.find((a) => !a.startsWith('--')) || path.join(os.tmpdir(), 'restore-test', 'respaldo.dump');

function preguntar(pregunta, oculto) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    if (oculto) {
      rl._writeToOutput = function (str) { if (str.includes('\n')) rl.output.write('\n'); };
    }
    rl.question(pregunta, (r) => { rl.close(); resolve(r.trim()); });
  });
}

function herramienta(nombre) {
  const p = path.join(PG_BIN, nombre + '.exe');
  if (!fs.existsSync(p)) throw new Error(`No encuentro ${p}. Instala PostgreSQL 17 (solo herramientas) o define PG_BIN.`);
  return p;
}

async function conteos(db, etiqueta) {
  const t = await db.query("select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1");
  const out = {};
  for (const { table_name } of t.rows) {
    const r = await db.query(`select count(*)::int as n from public."${table_name}"`);
    out[`public.${table_name}`] = r.rows[0].n;
  }
  for (const tabla of ['users', 'identities']) {
    const r = await db.query(`select count(*)::int as n from auth.${tabla}`);
    out[`auth.${tabla}`] = r.rows[0].n;
  }
  console.log(`  (${etiqueta}: ${Object.keys(out).length} tablas contadas)`);
  return out;
}

async function main() {
  if (!fs.existsSync(rutaDump)) throw new Error(`No existe el respaldo descifrado: ${rutaDump}`);
  console.log('Respaldo:', rutaDump);

  const toc = execFileSync(herramienta('pg_restore'), ['--list', rutaDump], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const { lista, incluidas, excluidas } = filtrarToc(toc);
  const listaPath = path.join(os.tmpdir(), 'restore-lista.txt');
  fs.writeFileSync(listaPath, lista);
  console.log(`Indice filtrado: ${incluidas.length} elementos se restauran, ${excluidas} se omiten (esquemas gestionados por Supabase).`);
  if (soloLista) {
    console.log('\n--solo-lista: no se conecta a nada. Elementos que se restaurarian:');
    for (const l of incluidas) console.log('  ' + l.replace(/^\d+; \d+ \d+ /, ''));
    return;
  }

  console.log(`\nDestino: proyecto NUEVO ${REF_NUEVO} (usuario ${USUARIO}, base ${BASE}, puerto ${PUERTO}).`);
  const host = await preguntar('Host del Session pooler (ej. aws-0-us-east-1.pooler.supabase.com), sin "postgresql://" ni usuario: ', false);
  if (!/^[a-z0-9.-]+\.supabase\.com$/i.test(host)) throw new Error('Ese host no parece un host del pooler de Supabase (debe terminar en .supabase.com).');
  console.log('Contrasena de la base del proyecto NUEVO (se copia desde Bitwarden; no se vera al pegarla):');
  const password = await preguntar('Contrasena: ', true);
  if (!password) throw new Error('La contrasena esta vacia.');

  const db = new Client({ host, port: Number(PUERTO), user: USUARIO, password, database: BASE, ssl: { rejectUnauthorized: false } });
  await db.connect();
  const info = await db.query("select current_user as usuario, current_setting('server_version') as version");
  console.log(`\nConexion OK: usuario ${info.rows[0].usuario}, PostgreSQL ${info.rows[0].version}.`);
  const previas = await db.query("select (select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE')::int as tablas, (select count(*) from auth.users)::int as usuarios");
  console.log(`Estado previo del proyecto nuevo: ${previas.rows[0].tablas} tablas en public, ${previas.rows[0].usuarios} usuarios.`);
  if ((previas.rows[0].tablas > 0 || previas.rows[0].usuarios > 0) && !forzar) {
    await db.end();
    throw new Error('El proyecto nuevo YA tiene tablas o usuarios. No se restaura encima. (Usa --forzar solo si sabes lo que haces.)');
  }
  await db.end();

  const confirmar = await preguntar('\nEscribe SI (en mayusculas) para restaurar en el proyecto NUEVO: ', false);
  if (confirmar !== 'SI') throw new Error('Cancelado: no se escribio SI.');

  console.log('\nRestaurando (una sola transaccion)...');
  const r = spawnSync(herramienta('pg_restore'), [
    '--no-owner', '--no-privileges', '--single-transaction', '--exit-on-error',
    '-L', listaPath, '-h', host, '-p', PUERTO, '-U', USUARIO, '-d', BASE, rutaDump,
  ], { env: { ...process.env, PGPASSWORD: password, PGSSLMODE: 'require' }, encoding: 'utf8' });
  if (r.status !== 0) {
    console.log((r.stderr || '').split('\n').slice(0, 15).join('\n'));
    throw new Error('pg_restore fallo. No se aplico nada (transaccion unica); se puede corregir y repetir.');
  }
  console.log('pg_restore terminado sin errores.');

  const nuevo = new Client({ host, port: Number(PUERTO), user: USUARIO, password, database: BASE, ssl: { rejectUnauthorized: false } });
  await nuevo.connect();
  console.log('\nEndureciendo permisos (la Data API esta cerrada; el respaldo no trae permisos):');
  await nuevo.query('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated');
  await nuevo.query('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated');
  await nuevo.query('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated');
  const sinRls = await nuevo.query("select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity");
  const grants = await nuevo.query("select count(*)::int as n from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated')");
  console.log(`  tablas de public SIN RLS: ${sinRls.rows.length}${sinRls.rows.length ? ' -> ' + sinRls.rows.map((x) => x.relname).join(', ') : ' (bien)'}`);
  console.log(`  permisos que quedan para anon/authenticated sobre public: ${grants.rows[0].n} (debe ser 0)`);

  console.log('\nComparando filas (proyecto VIEJO vs NUEVO):');
  const cuentasNuevo = await conteos(nuevo, 'nuevo');
  await nuevo.end();
  let cuentasViejo = null;
  try {
    require('dotenv').config({ quiet: true });
    if (process.env.DATABASE_URL) {
      const ca = fs.readFileSync(path.join(__dirname, '../certs/supabase-ca.crt'), 'utf8');
      const viejo = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { ca, rejectUnauthorized: true }, connectionTimeoutMillis: 10000 });
      cuentasViejo = await conteos(viejo, 'viejo');
      await viejo.end();
    }
  } catch (e) {
    console.log('  (No se pudo leer el proyecto viejo para comparar: ' + e.message.split('\n')[0] + ')');
  }
  let diferencias = 0;
  console.log('\n  tabla'.padEnd(34) + 'viejo'.padStart(8) + 'nuevo'.padStart(8));
  for (const k of Object.keys(cuentasNuevo)) {
    const v = cuentasViejo ? cuentasViejo[k] : '?';
    const marca = cuentasViejo && v !== cuentasNuevo[k] ? '  <-- DIFERENTE' : '';
    if (marca) diferencias += 1;
    console.log(('  ' + k).padEnd(34) + String(v).padStart(8) + String(cuentasNuevo[k]).padStart(8) + marca);
  }
  console.log(diferencias ? `\nHay ${diferencias} diferencia(s). Pueden ser datos nuevos en el viejo desde el respaldo.` : '\nTodo coincide.');
  console.log('\nListo. Nada secreto se imprimio. Puedes copiar este resultado completo al chat.');
}

main().catch((e) => { console.error('\nERROR: ' + e.message); process.exit(1); });
