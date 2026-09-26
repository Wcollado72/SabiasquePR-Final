// Uso: node scripts/copy-database-url.js
// Copia el DATABASE_URL de tu .env local directo al portapapeles de Windows
// (via clip.exe) -- para pegarlo en Render sin volver a transcribirlo a
// mano. No se imprime en ningun lado, ni en esta terminal ni en ningun log.
require('dotenv').config();
const { execSync } = require('child_process');

const v = process.env.DATABASE_URL;
if (!v) {
  console.log('No hay DATABASE_URL en .env. Corre primero set-database-url.js.');
  process.exit(1);
}

execSync('clip', { input: v });
console.log('Copiado al portapapeles (' + v.length + ' caracteres). Pégalo en Render con Ctrl+V.');
