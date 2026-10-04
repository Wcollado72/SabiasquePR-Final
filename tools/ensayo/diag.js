// DIAGNOSTICO solo para el ensayo local (se carga con `node -r`): no modifica el codigo del proyecto.
// Registra en la consola del API el error EXACTO cuando falla la verificacion del JWT o una consulta SQL,
// que el middleware de autenticacion normalmente oculta bajo "Token invalido o expirado".
// Nunca imprime tokens ni contrasenas: solo el tipo de error y su mensaje.
const Module = require('module');
const cargar = Module._load;
Module._load = function (request) {
  const modulo = cargar.apply(this, arguments);
  if (request === 'jose' && !modulo.__diag) {
    const original = modulo.jwtVerify;
    return Object.assign({}, modulo, {
      __diag: true,
      jwtVerify: async (...args) => {
        try { return await original(...args); } catch (e) {
          console.error(`[diag] jwtVerify FALLO: ${e.code || e.name} - ${String(e.message).slice(0, 200)}`);
          throw e;
        }
      },
    });
  }
  return modulo;
};
// `pg` vive en backend/node_modules: se resuelve desde la carpeta de trabajo (backend), no desde tools/.
const pg = require(require.resolve('pg', { paths: [process.cwd()] }));
const consulta = pg.Pool.prototype.query;
pg.Pool.prototype.query = function (...args) {
  const r = consulta.apply(this, args);
  if (r && typeof r.catch === 'function') r.catch((e) => console.error(`[diag] SQL FALLO: ${String(e.message).slice(0, 200)}`));
  return r;
};
// Que proyecto y que base esta usando ESTE proceso (solo direccion y usuario; la contrasena nunca se imprime).
// Requiere cargar dotenv ANTES que este archivo: node -r dotenv/config -r ../tools/ensayo/diag.js ...
try {
  const u = new URL(process.env.DATABASE_URL || 'postgresql://sin-definir@sin-definir/');
  console.error(`[diag] SUPABASE_URL=${process.env.SUPABASE_URL || '(sin definir)'} | base: usuario=${decodeURIComponent(u.username)} host=${u.hostname}`);
} catch { console.error('[diag] no pude leer DATABASE_URL'); }
console.error('[diag] diagnostico del ensayo activo');
