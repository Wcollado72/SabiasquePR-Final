// Vuelca la estructura real de la base (columnas, restricciones, indices, RLS) a JSON para generar el
// diccionario de datos de la documentacion. Solo lee catalogos del sistema; no toca datos.
// Uso (desde backend/): node scripts/volcar-diccionario.js [salida.json]
require('dotenv').config();
const fs = require('fs');
const { Pool } = require('pg');

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const q = (sql) => pool.query(sql).then((r) => r.rows);
  const columnas = await q(`select c.table_name t, c.column_name col,
      case when c.data_type='USER-DEFINED' then c.udt_name
           when c.data_type='numeric' then 'numeric('||c.numeric_precision||','||c.numeric_scale||')'
           when c.data_type='timestamp with time zone' then 'timestamptz'
           when c.data_type='character varying' then 'varchar'
           else c.data_type end tipo,
      c.is_nullable nulo, c.column_default def
    from information_schema.columns c
    join information_schema.tables tb on tb.table_schema=c.table_schema and tb.table_name=c.table_name and tb.table_type='BASE TABLE'
    where c.table_schema='public' order by c.table_name, c.ordinal_position`);
  const restricciones = await q(`select conrelid::regclass::text t, contype tipo, conname nombre, pg_get_constraintdef(oid) def
    from pg_constraint where connamespace='public'::regnamespace and contype in ('p','f','u','c') order by 1, contype desc, 3`);
  const indices = await q(`select tablename t, indexname nombre, indexdef def from pg_indexes where schemaname='public' order by 1, 2`);
  const rls = await q(`select relname t, relrowsecurity rls from pg_class where relnamespace='public'::regnamespace and relkind='r' order by 1`);
  await pool.end();
  const salida = process.argv[2] || 'diccionario.json';
  fs.writeFileSync(salida, JSON.stringify({ columnas, restricciones, indices, rls }, null, 1));
  console.log('tablas:', rls.length, '| columnas:', columnas.length, '| restricciones:', restricciones.length, '| indices:', indices.length, '->', salida);
})().catch((e) => { console.error('error:', e.message); process.exit(1); });
