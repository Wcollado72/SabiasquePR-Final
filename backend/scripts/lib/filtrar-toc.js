// Filtra el indice (TOC) de un respaldo pg_dump para restaurarlo en un proyecto NUEVO de Supabase.
//
// Un proyecto nuevo ya trae su propio esquema `auth`, las extensiones, los triggers de eventos y la
// funcion `rls_auto_enable`. Restaurar el respaldo completo chocaria con todo eso, asi que de el solo
// se toma lo que es nuestro:
//   - todo lo del esquema `public` (tablas, indices, restricciones, RLS, datos, comentarios),
//     salvo la funcion `rls_auto_enable` (el proyecto nuevo ya la crea con "Enable automatic RLS"), y
//   - los DATOS de auth.users y auth.identities (para conservar los mismos usuarios y UUID).
// No se restauran sesiones, tokens ni factores MFA (se inscriben de nuevo).

const TABLAS_AUTH_CON_DATOS = new Set(['users', 'identities']);

// Lineas del indice: "4477; 0 18086 TABLE DATA public comentarios postgres"
const LINEA = /^\d+; \d+ \d+ (TABLE DATA|FK CONSTRAINT|ROW SECURITY|SEQUENCE OWNED BY|SEQUENCE SET|EVENT TRIGGER|[A-Z]+) (\S+) (.*)$/;

function analizarLinea(linea) {
  const m = LINEA.exec(linea);
  if (!m) return null;
  return { tipo: m[1], esquema: m[2], resto: m[3] };
}

function debeRestaurarse(linea) {
  const e = analizarLinea(linea);
  if (!e) return false;
  if (e.tipo === 'TABLE DATA' && e.esquema === 'auth') {
    const tabla = e.resto.split(/\s+/)[0];
    return TABLAS_AUTH_CON_DATOS.has(tabla);
  }
  if (e.esquema !== 'public') return false;
  if (e.tipo === 'SCHEMA' || e.tipo === 'ACL' || e.tipo === 'EVENT TRIGGER') return false;
  if (/rls_auto_enable/.test(e.resto)) return false;
  return true;
}

// Devuelve { lista, incluidas, excluidas } a partir del texto de `pg_restore --list`.
function filtrarToc(textoToc) {
  const incluidas = [];
  let excluidas = 0;
  for (const linea of textoToc.split(/\r?\n/)) {
    if (!linea || linea.startsWith(';')) continue;
    if (debeRestaurarse(linea)) incluidas.push(linea);
    else excluidas += 1;
  }
  // En un proyecto nuevo auth.identities YA tiene su llave foranea hacia auth.users (no se difiere como
  // en un respaldo completo), asi que los datos de users deben ir ANTES que los de identities.
  const iUsers = incluidas.findIndex((l) => /TABLE DATA auth users /.test(l));
  const iIdent = incluidas.findIndex((l) => /TABLE DATA auth identities /.test(l));
  if (iUsers > iIdent && iIdent !== -1) {
    const [linea] = incluidas.splice(iUsers, 1);
    incluidas.splice(iIdent, 0, linea);
  }
  return { lista: incluidas.join('\n') + '\n', incluidas, excluidas };
}

module.exports = { filtrarToc, debeRestaurarse, analizarLinea };
