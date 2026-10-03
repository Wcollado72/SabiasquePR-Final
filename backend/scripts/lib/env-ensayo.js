// Arma el texto de un archivo .env para el ENSAYO local contra el proyecto nuevo de Supabase:
// copia todas las variables del .env actual y cambia solo las que apuntan al proyecto viejo.
// (Funcion pura: no lee ni escribe archivos, no imprime valores; se prueba con Jest.)

// Reemplaza (o agrega) KEY=valor en un texto estilo .env, conservando lo demas tal cual.
function fijarVariable(texto, clave, valor) {
  const linea = `${clave}=${valor}`;
  const re = new RegExp(`^${clave}=.*$`, 'm');
  if (re.test(texto)) return texto.replace(re, () => linea);
  return texto + (texto === '' || texto.endsWith('\n') ? '' : '\n') + linea + '\n';
}

function construirEnvEnsayo(textoEnv, { databaseUrl, supabaseUrl, frontendOrigin }) {
  let out = textoEnv;
  out = fijarVariable(out, 'DATABASE_URL', databaseUrl);
  out = fijarVariable(out, 'SUPABASE_URL', supabaseUrl);
  out = fijarVariable(out, 'FRONTEND_ORIGIN', frontendOrigin);
  return out;
}

// Cadena de conexion del Session pooler; la contrasena se codifica para que cualquier caracter sea valido.
function armarDatabaseUrl({ ref, host, password, puerto = '5432', base = 'postgres' }) {
  return `postgresql://postgres.${ref}:${encodeURIComponent(password)}@${host}:${puerto}/${base}`;
}

module.exports = { fijarVariable, construirEnvEnsayo, armarDatabaseUrl };
