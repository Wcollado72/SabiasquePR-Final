// Comprueba que backend/sql/schema.sql (el "script de creacion de la base de datos" de la entrega) reproduce la
// base de datos REAL: ejecuta el script en un esquema temporal vacio, dentro de una transaccion que SIEMPRE se
// revierte (ROLLBACK), y compara columnas (tipo, nulos, valor por defecto), restricciones CHECK/UNIQUE, indices
// y seguridad por fila (RLS) contra el esquema `public`. No cambia nada: al terminar el esquema temporal no existe.
//
// Uso (desde backend/):  node scripts/probar-schema.js                 usa DATABASE_URL de backend/.env
//                        node scripts/probar-schema.js --env=.env.ensayo.local   usa otro archivo de variables
// Sale con codigo 0 si son identicos y 1 si hay diferencias o falla el script.
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');

const argEnv = (process.argv.find((a) => a.startsWith('--env=')) || '').split('=')[1] || '.env';
const raiz = path.join(__dirname, '..');
const env = dotenv.parse(fs.readFileSync(path.join(raiz, argEnv)));
const ca = fs.existsSync(path.join(raiz, 'certs', 'supabase-ca.crt')) ? fs.readFileSync(path.join(raiz, 'certs', 'supabase-ca.crt'), 'utf8') : null;
const db = new Client({
  connectionString: env.DATABASE_URL,
  ssl: ca ? { ca, rejectUnauthorized: false } : { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
});
const sql = fs.readFileSync(path.join(raiz, 'sql', 'schema.sql'), 'utf8');

const foto = (esq) => `
  select 'columna' k, table_name||'.'||column_name||':'||data_type||':'||is_nullable||':'||coalesce(regexp_replace(column_default,'[^a-zA-Z0-9_(),: ''-]','','g'),'') v
    from information_schema.columns where table_schema='${esq}'
  union all select 'restriccion', c.conrelid::regclass::text||'.'||c.conname||':'||regexp_replace(pg_get_constraintdef(c.oid),'\\s+',' ','g')
    from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='${esq}' and c.contype in ('c','u')
  union all select 'indice', indexname from pg_indexes where schemaname='${esq}'
  union all select 'rls', c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='${esq}' and c.relkind='r' and c.relrowsecurity`;

(async () => {
  await db.connect();
  await db.query('BEGIN');
  let diferencias = -1;
  try {
    await db.query('CREATE SCHEMA prueba_schema');
    await db.query('SET LOCAL search_path = prueba_schema');
    await db.query(sql);
    const viva = (await db.query(foto('public'))).rows.map((x) => `${x.k}|${x.v.replace(/public\./g, '')}`);
    const script = (await db.query(foto('prueba_schema'))).rows.map((x) => `${x.k}|${x.v.replace(/prueba_schema\./g, '')}`);
    const setViva = new Set(viva), setScript = new Set(script);
    const soloViva = viva.filter((x) => !setScript.has(x));
    const soloScript = script.filter((x) => !setViva.has(x));
    console.log(`Elementos en la base viva: ${viva.length} | creados por schema.sql en un esquema limpio: ${script.length}`);
    console.log(`Solo en la base viva (le falta al script): ${soloViva.length}`);
    soloViva.slice(0, 15).forEach((x) => console.log('   -', x.slice(0, 160)));
    console.log(`Solo en el script (no existe en la base viva): ${soloScript.length}`);
    soloScript.slice(0, 15).forEach((x) => console.log('   -', x.slice(0, 160)));
    diferencias = soloViva.length + soloScript.length;
  } catch (e) {
    console.log('FALLO schema.sql en un esquema limpio:', e.code || e.name, String(e.message).slice(0, 200));
  }
  await db.query('ROLLBACK');
  await db.end();
  console.log(diferencias === 0 ? 'RESULTADO: schema.sql reproduce la base de datos real (0 diferencias).' : 'RESULTADO: HAY DIFERENCIAS o fallo (ver arriba).');
  process.exit(diferencias === 0 ? 0 : 1);
})().catch((e) => { console.error('ERROR:', e.code || e.name, String(e.message).slice(0, 160)); process.exit(1); });
