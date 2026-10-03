// Uso (desde la carpeta backend):   node scripts/crear-env-ensayo.js [--portapapeles]
//
// Crea backend/.env.ensayo.local: una copia de tu .env actual donde SOLO cambian
//   DATABASE_URL     -> la del proyecto NUEVO de Supabase (Session pooler)
//   SUPABASE_URL     -> la del proyecto NUEVO
//   FRONTEND_ORIGIN  -> http://localhost:8080 (el sitio de ensayo)
// Ese archivo esta en .gitignore (patron .env.*.local) y NO sustituye a tu .env: el .env sigue apuntando al proyecto viejo.
// La contrasena se escribe/pega aqui (veras un * por caracter) o se toma del portapapeles con --portapapeles;
// nunca se imprime ni se guarda en otro lugar que ese archivo local.
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { Client } = require('pg');
const { construirEnvEnsayo, armarDatabaseUrl } = require('./lib/env-ensayo');

const REF_NUEVO = 'ldhlayiblphzyvakliaz';
const SUPABASE_URL_NUEVA = `https://${REF_NUEVO}.supabase.co`;
const HOST_POR_DEFECTO = 'aws-0-us-east-1.pooler.supabase.com';
const ORIGEN_ENSAYO = 'http://localhost:8080';

const usarPortapapeles = process.argv.includes('--portapapeles');
const RUTA_ENV = path.join(__dirname, '..', '.env');
const RUTA_SALIDA = path.join(__dirname, '..', '.env.ensayo.local');

function preguntar(pregunta) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(pregunta, (r) => { rl.close(); resolve(r.trim()); });
  });
}

function preguntarOculto(pregunta) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) return reject(new Error('Hace falta una terminal interactiva.'));
    process.stdout.write(pregunta);
    let valor = '';
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    const fin = () => {
      process.stdin.removeListener('data', alRecibir);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
    };
    function alRecibir(trozo) {
      for (const ch of trozo) {
        if (ch === '\r' || ch === '\n') { fin(); return resolve(valor); }
        if (ch === '\u0003') { fin(); return reject(new Error('Cancelado (Ctrl+C).')); }
        if (ch === '\u007f' || ch === '\b') {
          if (valor.length) { valor = valor.slice(0, -1); process.stdout.write('\b \b'); }
          continue;
        }
        if (ch >= ' ') { valor += ch; process.stdout.write('*'); }
      }
    }
    process.stdin.on('data', alRecibir);
  });
}

function leerPortapapeles() {
  const s = execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', 'Get-Clipboard -Raw'], { encoding: 'utf8' });
  return s.replace(/[\r\n]+$/, '');
}

async function main() {
  if (!fs.existsSync(RUTA_ENV)) throw new Error('No existe backend/.env (se usa como base).');
  const base = fs.readFileSync(RUTA_ENV, 'utf8');

  const hostEscrito = await preguntar(`Host del Session pooler (Enter = ${HOST_POR_DEFECTO}): `);
  const host = hostEscrito || HOST_POR_DEFECTO;
  if (!/^[a-z0-9.-]+\.supabase\.com$/i.test(host)) throw new Error('Ese host no parece un host del pooler de Supabase.');

  let password;
  if (usarPortapapeles) {
    password = leerPortapapeles();
    console.log('Contrasena tomada del portapapeles.');
  } else {
    console.log('Contrasena de la base del proyecto NUEVO (veras un * por cada caracter):');
    password = await preguntarOculto('Contrasena: ');
  }
  const letras = (password.match(/[A-Za-z]/g) || []).length;
  const numeros = (password.match(/[0-9]/g) || []).length;
  const otros = password.length - letras - numeros;
  console.log(`  Recibi ${password.length} caracteres: ${letras} letras, ${numeros} numeros, ${otros} otros.`);
  if (!/^[A-Za-z0-9]{32}$/.test(password) && !process.argv.includes('--aceptar-clave-rara')) {
    throw new Error('Esto no parece la contrasena de la base (32 letras/numeros). No intento conectar. Usa --aceptar-clave-rara si es correcta.');
  }

  const databaseUrl = armarDatabaseUrl({ ref: REF_NUEVO, host, password });

  // Comprobar que la contrasena es la correcta ANTES de escribir nada.
  const db = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await db.connect();
  const r = await db.query("select (select count(*) from auth.users)::int as usuarios, (select count(*) from public.perfiles)::int as perfiles, (select count(*) from public.contenidos)::int as contenidos");
  await db.end();
  console.log(`Conexion OK al proyecto nuevo: ${r.rows[0].usuarios} usuarios, ${r.rows[0].perfiles} perfiles, ${r.rows[0].contenidos} contenidos.`);

  const salida = construirEnvEnsayo(base, { databaseUrl, supabaseUrl: SUPABASE_URL_NUEVA, frontendOrigin: ORIGEN_ENSAYO });
  fs.writeFileSync(RUTA_SALIDA, salida, { mode: 0o600 });
  console.log(`\nListo: ${path.relative(process.cwd(), RUTA_SALIDA)} creado (variables cambiadas: DATABASE_URL, SUPABASE_URL, FRONTEND_ORIGIN).`);
  console.log('Tu .env NO se modifico. Nada secreto se imprimio.');
}

main().catch((e) => { console.error('\nERROR: ' + e.message); process.exit(1); });
