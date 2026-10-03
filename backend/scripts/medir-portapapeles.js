// Uso (desde la carpeta backend):  node scripts/medir-portapapeles.js
// Mide el portapapeles de Windows SIN mostrar su contenido: cuantos caracteres, de que tipo y cuantas lineas.
// Sirve para saber si lo que copiaste (por ejemplo desde Bitwarden) es de verdad una contrasena.
const { execFileSync } = require('child_process');

const crudo = execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', 'Get-Clipboard -Raw'], { encoding: 'utf8' });
const t = crudo.replace(/[\r\n]+$/, '');
const cuenta = (re) => (t.match(re) || []).length;

const lineas = t === '' ? 0 : t.split(/\r?\n/).length;
console.log(`Portapapeles: ${t.length} caracteres en ${lineas} linea(s).`);
console.log(`  letras: ${cuenta(/[A-Za-z]/g)} | numeros: ${cuenta(/[0-9]/g)} | espacios: ${cuenta(/[ \t]/g)} | otros simbolos: ${t.length - cuenta(/[A-Za-z0-9]/g) - cuenta(/\s/g)}`);
const pistas = [];
if (/^https?:\/\//i.test(t)) pistas.push('empieza como una direccion web');
if (/^postgres(ql)?:\/\//i.test(t)) pistas.push('parece una cadena de conexion');
if (/@/.test(t)) pistas.push('contiene @');
if (/^[A-Za-z0-9]{32}$/.test(t)) pistas.push('TIENE EL ASPECTO de la contrasena de la base (32 letras/numeros)');
console.log(`  pistas: ${pistas.length ? pistas.join('; ') : '(ninguna)'}`);
console.log('(No se muestra el contenido.)');
