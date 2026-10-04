// Cálculo (puro, con pruebas) de la diferencia entre dos copias de una tabla, identificando cada fila por su
// llave primaria y comparando una huella (hash) de su contenido. Lo usa sincronizar-delta.js.
//   viejo / nuevo: Map<llave, huella>
// Devuelve las llaves que están SOLO en el viejo (faltantes en el nuevo), SOLO en el nuevo (extras) y las
// que están en ambos pero con huella distinta (modificadas).
function calcularDelta(viejo, nuevo) {
  const faltantes = [];
  const modificadas = [];
  for (const [llave, huella] of viejo) {
    if (!nuevo.has(llave)) faltantes.push(llave);
    else if (nuevo.get(llave) !== huella) modificadas.push(llave);
  }
  const extras = [];
  for (const llave of nuevo.keys()) if (!viejo.has(llave)) extras.push(llave);
  return { faltantes, extras, modificadas };
}

// Orden en que se insertan las tablas para respetar las llaves foráneas (padres antes que hijos).
const ORDEN_TABLAS_PUBLIC = [
  'perfiles', 'productos', 'noticias', 'contenidos', 'suscriptores', 'mensajes_contacto',
  'ordenes', 'foro_posts', 'foro_comentarios', 'comentarios', 'reportes',
  'ia_generaciones', 'traducciones', 'gastos_servicios',
];
const TABLAS_AUTH = ['users', 'identities'];

// Divide una lista en tandas (para no armar consultas gigantes).
function enTandas(lista, tamano) {
  const out = [];
  for (let i = 0; i < lista.length; i += tamano) out.push(lista.slice(i, i + tamano));
  return out;
}

module.exports = { calcularDelta, ORDEN_TABLAS_PUBLIC, TABLAS_AUTH, enTandas };
