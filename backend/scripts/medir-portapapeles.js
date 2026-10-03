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
if (/^GOCSPX-[A-Za-z0-9_-]{28}$/.test(t)) pistas.push('TIENE EL ASPECTO de un secreto de cliente de Google (GOCSPX-, 35 caracteres)');
else if (/^GOCSPX-/.test(t)) pistas.push('empieza como un secreto de Google pero NO mide 35 caracteres');
if (/^re_[A-Za-z0-9_]{20,}$/.test(t)) pistas.push('TIENE EL ASPECTO de una clave de API de Resend (re_...)');
if (/^0x4[A-Za-z0-9_-]{20,}$/.test(t)) pistas.push('TIENE EL ASPECTO de una clave de Cloudflare Turnstile (0x4...)');
if (/^[a-z0-9]{20}$/.test(t)) pistas.push('mide 20 letras/numeros en minuscula: podria ser el identificador (ref) de un proyecto de Supabase');
console.log(`  pistas: ${pistas.length ? pistas.join('; ') : '(ninguna)'}`);
console.log('(No se muestra el contenido.)');
