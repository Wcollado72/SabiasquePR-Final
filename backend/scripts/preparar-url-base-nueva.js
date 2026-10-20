// Uso (desde la carpeta backend), el DIA DEL CORTE:
//   node scripts/preparar-url-base-nueva.js --github        fija el secreto DATABASE_URL de GitHub Actions (respaldos)
//   node scripts/preparar-url-base-nueva.js --portapapeles  deja la DATABASE_URL en el portapapeles, para pegarla en Render
//   (se pueden combinar las dos opciones; sin opciones solo comprueba que la contrasena sirve)
//
// Arma la cadena de conexion del proyecto NUEVO (Session pooler) con la contrasena que escribas/pegues AQUI (veras un *
// por caracter). Nunca se imprime: ni la contrasena ni la cadena. Antes de usarla comprueba que conecta de verdad.
//   --github         -> `gh secret set DATABASE_URL` (la cadena viaja por entrada estandar, no por la linea de comandos)
//   --portapapeles   -> la copia al portapapeles y la BORRA solo a los 90 segundos (copiar luego otra cosa tambien la borra)
// Regla de oro: copia la contrasena desde Bitwarden y pegala en el cuadro del script; no copies nada mas hasta terminar.
const { spawnSync, spawn } = require('child_process');
const { Client } = require('pg');
const { armarDatabaseUrl } = require('./lib/env-ensayo');

const REF_NUEVO = 'ldhlayiblphzyvakliaz';
const HOST = 'aws-0-us-east-1.pooler.supabase.com';
const args = process.argv.slice(2);
const aGithub = args.includes('--github');
const aPortapapeles = args.includes('--portapapeles');

function preguntarOculto(pregunta) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) return reject(new Error('Hace falta una terminal interactiva.'));
    process.stdout.write(pregunta);
    let valor = '';
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    const fin = () => { process.stdin.removeListener('data', alRecibir); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n'); };
    function alRecibir(trozo) {
      for (const ch of trozo) {
        if (ch === '\r' || ch === '\n') { fin(); return resolve(valor); }
        if (ch === '\u0003') { fin(); return reject(new Error('Cancelado (Ctrl+C).')); }
        if (ch === '\u007f' || ch === '\b') { if (valor.length) { valor = valor.slice(0, -1); process.stdout.write('\b \b'); } continue; }
        if (ch >= ' ') { valor += ch; process.stdout.write('*'); }
      }
    }
    process.stdin.on('data', alRecibir);
  });
}

async function main() {
  console.log(`Proyecto NUEVO: ${REF_NUEVO}. Opciones: ${[aGithub && 'GitHub', aPortapapeles && 'portapapeles'].filter(Boolean).join(' + ') || '(solo comprobar)'}`);
  const password = await preguntarOculto('Contrasena de la base del proyecto NUEVO: ');
  if (!/^[A-Za-z0-9]{32}$/.test(password)) {
    throw new Error(`Eso no parece la contrasena (se esperan 32 letras/numeros; recibi ${password.length} caracteres). No intento conectar.`);
  }
  const url = armarDatabaseUrl({ ref: REF_NUEVO, host: HOST, password });

  const db = new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  await db.connect();
  const r = await db.query("select (select count(*) from auth.users)::int as usuarios, (select count(*) from public.contenidos)::int as contenidos");
  await db.end();
  console.log(`Conexion OK al proyecto nuevo (${r.rows[0].usuarios} usuarios, ${r.rows[0].contenidos} contenidos). La contrasena es correcta.`);

  if (aGithub) {
    const gh = spawnSync('gh', ['secret', 'set', 'DATABASE_URL'], { input: url, encoding: 'utf8' });
    if (gh.status !== 0) throw new Error('gh no pudo fijar el secreto: ' + String(gh.stderr || '').split('\n')[0]);
    console.log('GitHub: secreto DATABASE_URL actualizado (los respaldos usaran el proyecto nuevo).');
  }
  if (aPortapapeles) {
    const ps = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', 'Set-Clipboard -Value ([Console]::In.ReadToEnd().TrimEnd())'], { input: url, encoding: 'utf8' });
    if (ps.status !== 0) throw new Error('No pude copiar al portapapeles.');
    // Borra el portapapeles a los 90 s (proceso aparte, sin la cadena en su linea de comandos).
    spawn('powershell', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', 'Start-Sleep -Seconds 90; Set-Clipboard -Value " "'], { detached: true, stdio: 'ignore' }).unref();
    console.log(`Portapapeles: la DATABASE_URL (${url.length} caracteres) esta copiada. PEGALA YA en Render (Ctrl+V en el valor de DATABASE_URL). Se borra sola en 90 s.`);
  }
  console.log('Nada secreto se imprimio.');
}

main().catch((e) => { console.error('\nERROR: ' + e.message); process.exit(1); });
