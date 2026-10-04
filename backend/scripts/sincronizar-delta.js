// Uso (desde la carpeta backend):
//   node scripts/sincronizar-delta.js                  INFORME: compara viejo vs nuevo, no cambia nada
//   node scripts/sincronizar-delta.js --aplicar        inserta en el NUEVO lo que solo existe en el VIEJO
//   Opciones (solo con --aplicar):
//     --sin-guardar                      ejecuta todo y al final revierte (prueba segura: no queda ningun cambio)
//     --incluir-auth                     tambien copia auth.users / auth.identities que falten (cuentas nuevas)
//     --borrar-extras=foro_posts,...     borra del NUEVO las filas que no existen en el viejo, SOLO de esas tablas public
//                                        (para quitar las publicaciones de prueba del ensayo)
//
// Antes del corte: pone al dia el proyecto NUEVO con lo que se creo en el VIEJO despues de la copia del 2026-10-03
// (ordenes, mensajes, registros...). Garantias:
//   - El proyecto VIEJO solo se LEE (transaccion de solo lectura): este script no puede modificarlo.
//   - Nunca sobrescribe filas existentes del nuevo ni toca contrasenas, sesiones o factores 2FA del nuevo.
//   - Todo lo que escribe va en UNA transaccion en el nuevo: si algo falla, no queda nada a medias.
// Conexiones: viejo = backend/.env (DATABASE_URL); nuevo = backend/.env.ensayo.local (crear con crear-env-ensayo.js).
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');
const { calcularDelta, ORDEN_TABLAS_PUBLIC, TABLAS_AUTH, enTandas } = require('./lib/delta');

const args = process.argv.slice(2);
const aplicar = args.includes('--aplicar');
const incluirAuth = args.includes('--incluir-auth');
const sinGuardar = args.includes('--sin-guardar'); // ensaya todo y al final REVIERTE (prueba segura)
const borrarExtras = ((args.find((a) => a.startsWith('--borrar-extras=')) || '').split('=')[1] || '').split(',').filter(Boolean);

function conectarViejo() {
  const env = dotenv.parse(fs.readFileSync(path.join(__dirname, '..', '.env')));
  const ca = fs.readFileSync(path.join(__dirname, '..', 'certs', 'supabase-ca.crt'), 'utf8');
  return new Client({ connectionString: env.DATABASE_URL, ssl: { ca, rejectUnauthorized: true }, connectionTimeoutMillis: 15000 });
}

function conectarNuevo() {
  const ruta = path.join(__dirname, '..', '.env.ensayo.local');
  if (!fs.existsSync(ruta)) throw new Error('Falta backend/.env.ensayo.local (se crea con: node scripts/crear-env-ensayo.js).');
  const env = dotenv.parse(fs.readFileSync(ruta));
  return new Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
}

const comillas = (id) => '"' + String(id).replace(/"/g, '""') + '"';

async function llavePrimaria(db, esquema, tabla) {
  const r = await db.query(
    `SELECT a.attname FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
     WHERE i.indisprimary AND i.indrelid = ($1 || '.' || $2)::regclass ORDER BY array_position(i.indkey, a.attnum)`,
    [comillas(esquema), comillas(tabla)]);
  return r.rows.map((x) => x.attname);
}

// Mapa llave -> huella del contenido de cada fila.
async function huellas(db, esquema, tabla, pk) {
  const clave = pk.map((c) => `t.${comillas(c)}::text`).join(` || '|' || `);
  const r = await db.query(`SELECT ${clave} AS llave, md5(t::text) AS huella FROM ${comillas(esquema)}.${comillas(tabla)} t`);
  return new Map(r.rows.map((x) => [x.llave, x.huella]));
}

async function columnasInsertables(db, esquema, tabla) {
  const r = await db.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2 AND is_generated = 'NEVER' AND (is_identity = 'NO' OR identity_generation = 'BY DEFAULT')
     ORDER BY ordinal_position`, [esquema, tabla]);
  return r.rows.map((x) => x.column_name);
}

async function main() {
  const viejo = conectarViejo();
  const nuevo = conectarNuevo();
  await viejo.connect();
  await nuevo.connect();
  await viejo.query('BEGIN READ ONLY'); // el viejo NO se puede modificar desde aqui

  console.log(aplicar ? 'MODO: APLICAR (escribe en el proyecto NUEVO)' : 'MODO: INFORME (no cambia nada)');
  const tablas = [
    ...TABLAS_AUTH.map((t) => ({ esquema: 'auth', tabla: t })),
    ...ORDEN_TABLAS_PUBLIC.map((t) => ({ esquema: 'public', tabla: t })),
  ];

  const plan = [];
  console.log('\n' + 'tabla'.padEnd(26) + 'viejo'.padStart(7) + 'nuevo'.padStart(7) + 'faltan'.padStart(8) + 'extras'.padStart(8) + 'cambiadas'.padStart(11));
  for (const { esquema, tabla } of tablas) {
    const nombre = esquema === 'auth' ? `auth.${tabla}` : tabla;
    const pk = await llavePrimaria(viejo, esquema, tabla);
    if (pk.length === 0) { console.log(nombre.padEnd(26) + '  (sin llave primaria: se omite)'); continue; }
    const [mv, mn] = [await huellas(viejo, esquema, tabla, pk), await huellas(nuevo, esquema, tabla, pk)];
    const d = calcularDelta(mv, mn);
    // En auth las diferencias de "cambiadas" son normales (contrasena nueva, ultimo inicio de sesion): solo informativo.
    console.log(nombre.padEnd(26) + String(mv.size).padStart(7) + String(mn.size).padStart(7) + String(d.faltantes.length).padStart(8) + String(d.extras.length).padStart(8) + String(d.modificadas.length).padStart(11));
    plan.push({ esquema, tabla, nombre, pk, ...d });
  }

  const conFaltantes = plan.filter((p) => p.faltantes.length);
  const conExtras = plan.filter((p) => p.extras.length && p.esquema === 'public');
  const conCambios = plan.filter((p) => p.modificadas.length && p.esquema === 'public');
  console.log('\nResumen:');
  console.log(conFaltantes.length ? '  - Faltan en el nuevo: ' + conFaltantes.map((p) => `${p.nombre} (${p.faltantes.length})`).join(', ') : '  - No falta nada en el nuevo.');
  console.log(conExtras.length ? '  - Solo en el nuevo (pruebas del ensayo u otras): ' + conExtras.map((p) => `${p.nombre} (${p.extras.length})`).join(', ') : '  - No hay filas extra en el nuevo.');
  console.log(conCambios.length ? '  - Filas que cambiaron en el viejo despues de la copia (NO se sincronizan, revisar a mano): ' + conCambios.map((p) => `${p.nombre} (${p.modificadas.length})`).join(', ') : '  - Ninguna fila de public cambio despues de la copia.');
  const authFalta = conFaltantes.filter((p) => p.esquema === 'auth');
  if (authFalta.length && !incluirAuth) console.log('  ! Hay cuentas nuevas en el viejo (auth). Para copiarlas use --incluir-auth junto con --aplicar.');

  if (!aplicar) { await viejo.query('ROLLBACK'); await viejo.end(); await nuevo.end(); console.log('\n(Informe terminado: no se cambio nada.)'); return; }

  // ── APLICAR ────────────────────────────────────────────────────────────
  for (const t of borrarExtras) {
    if (!ORDEN_TABLAS_PUBLIC.includes(t)) throw new Error(`--borrar-extras solo admite tablas de public conocidas (recibi "${t}").`);
  }
  await nuevo.query('BEGIN');
  try {
    let insertadas = 0;
    for (const p of plan) {
      if (!p.faltantes.length) continue;
      if (p.esquema === 'auth' && !incluirAuth) continue;
      const cols = (await columnasInsertables(nuevo, p.esquema, p.tabla));
      const lista = cols.map(comillas).join(', ');
      for (const tanda of enTandas(p.faltantes, 100)) {
        const clave = p.pk.map((c) => `t.${comillas(c)}::text`).join(` || '|' || `);
        const filas = await viejo.query(`SELECT row_to_json(t) AS fila FROM ${comillas(p.esquema)}.${comillas(p.tabla)} t WHERE ${clave} = ANY($1)`, [tanda]);
        for (const { fila } of filas.rows) {
          await nuevo.query(
            `INSERT INTO ${comillas(p.esquema)}.${comillas(p.tabla)} (${lista}) SELECT ${lista} FROM json_populate_record(NULL::${comillas(p.esquema)}.${comillas(p.tabla)}, $1::json) ON CONFLICT DO NOTHING`,
            [JSON.stringify(fila)]);
          insertadas += 1;
        }
      }
      console.log(`  + ${p.nombre}: ${p.faltantes.length} fila(s) copiada(s)`);
    }
    for (const t of borrarExtras) {
      const p = plan.find((x) => x.tabla === t && x.esquema === 'public');
      if (!p || !p.extras.length) { console.log(`  - ${t}: no hay extras que borrar`); continue; }
      const clave = p.pk.map((c) => `${comillas(c)}::text`).join(` || '|' || `);
      const r = await nuevo.query(`DELETE FROM public.${comillas(t)} WHERE ${clave} = ANY($1)`, [p.extras]);
      console.log(`  - ${t}: ${r.rowCount} fila(s) de prueba borrada(s) del nuevo`);
    }
    if (sinGuardar) {
      await nuevo.query('ROLLBACK');
      console.log(`\n--sin-guardar: ${insertadas} fila(s) se insertarian sin error; se REVIRTIO todo (no cambio nada).`);
    } else {
      await nuevo.query('COMMIT');
      console.log(`\nListo: ${insertadas} fila(s) insertada(s) en el proyecto nuevo. Vuelva a correr el informe: debe mostrar 0 faltantes.`);
    }
  } catch (e) {
    await nuevo.query('ROLLBACK').catch(() => {});
    throw new Error('No se aplico nada (transaccion revertida): ' + e.message);
  } finally {
    await viejo.query('ROLLBACK').catch(() => {});
    await viejo.end(); await nuevo.end();
  }
}

main().catch((e) => { console.error('\nERROR: ' + e.message); process.exit(1); });
