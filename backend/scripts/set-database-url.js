// Uso: node scripts/set-database-url.js
// Arma la linea DATABASE_URL= en .env sin que la contraseña pase por el
// portapapeles, el Bloc de notas, ni el chat -- se escribe directo en esta
// terminal (oculta mientras se escribe) y el script hace el
// encodeURIComponent y el ensamblado por ti, eliminando los errores de
// transcripcion manual que hemos visto (titulo pegado, prefijo cortado,
// ":" vs ".", host equivocado).
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const HOST_PREGUNTA = 'Pega el host del Session pooler (ej. aws-0-us-east-1.pooler.supabase.com), sin "postgresql://" ni usuario: ';
const USER_FIJO = 'postgres.qmlhjacduuvptxglqxqn';
const PUERTO = '5432';
const DB = 'postgres';

function preguntar(pregunta, oculto) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    if (oculto) {
      // Oculta lo que se escribe (como sudo) -- no queda visible en la terminal.
      rl._writeToOutput = function (str) {
        if (str.includes('\n')) rl.output.write('\n');
      };
    }
    rl.question(pregunta, (respuesta) => { rl.close(); resolve(respuesta.trim()); });
  });
}

async function main() {
  const host = await preguntar(HOST_PREGUNTA, false);
  console.log('Ahora la contraseña (no se va a ver en pantalla mientras escribes):');
  const password = await preguntar('Contraseña: ', true);

  const passwordCodificada = encodeURIComponent(password);
  const url = `postgresql://${USER_FIJO}:${passwordCodificada}@${host}:${PUERTO}/${DB}`;

  const envPath = path.join(__dirname, '..', '.env');
  let contenido = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const lineaNueva = `DATABASE_URL=${url}`;

  if (/^DATABASE_URL=.*$/m.test(contenido)) {
    contenido = contenido.replace(/^DATABASE_URL=.*$/m, lineaNueva);
  } else {
    contenido += (contenido.endsWith('\n') || contenido === '' ? '' : '\n') + lineaNueva + '\n';
  }
  fs.writeFileSync(envPath, contenido);

  console.log('\nListo. DATABASE_URL actualizado en .env (longitud final: ' + url.length + ' caracteres).');
  console.log('Nada de esto se imprimio en texto plano.');
}

main();
