// Superpone traducciones guardadas sobre filas de noticias/contenidos/productos
// cuando el visitante pide otro idioma (?lang=en). Si no hay traduccion, la fila
// se devuelve en su idioma original marcada con `sin_traduccion: true` para que
// el frontend muestre la etiqueta "Spanish only".
const { pool } = require('../db');
const { CAMPOS_POR_TIPO, IDIOMAS_VALIDOS } = require('../validators/traduccion');

function normalizarLang(valor) {
  return IDIOMAS_VALIDOS.includes(valor) ? valor : null;
}

// Productos no tienen `idioma_original`: siempre se escriben en espanol.
function idiomaOriginalDe(fila) {
  return fila.idioma_original === 'en' ? 'en' : 'es';
}

// Mezcla solo los campos permitidos y con contenido; nunca pisa con vacios.
function mezclar(fila, tipo, campos) {
  const permitidos = CAMPOS_POR_TIPO[tipo];
  const resultado = { ...fila };
  for (const nombre of Object.keys(permitidos)) {
    const v = campos ? campos[nombre] : undefined;
    if (Array.isArray(v) ? v.length : (typeof v === 'string' && v.trim())) resultado[nombre] = v;
  }
  return resultado;
}

async function buscarTraducciones(tipo, ids, lang) {
  const { rows } = await pool.query(
    'SELECT item_id, campos FROM traducciones WHERE tipo = $1 AND idioma = $2 AND item_id = ANY($3)',
    [tipo, lang, ids]
  );
  return new Map(rows.map((r) => [r.item_id, r.campos]));
}

// Sin `lang` (o invalido) devuelve las filas tal cual -- comportamiento previo
// intacto. Si la consulta falla (p. ej. la migracion aun no se aplico en la
// base de datos) se degrada al idioma original en vez de romper el listado.
async function aplicarTraducciones(tipo, filas, lang) {
  const destino = normalizarLang(lang);
  if (!destino || !filas.length) return filas;

  const pendientes = filas.filter((f) => idiomaOriginalDe(f) !== destino);
  let encontradas = new Map();
  if (pendientes.length) {
    try {
      encontradas = await buscarTraducciones(tipo, pendientes.map((f) => f.id), destino);
    } catch (err) {
      console.error('No se pudieron leer traducciones:', err.message);
    }
  }

  return filas.map((fila) => {
    const original = idiomaOriginalDe(fila);
    if (original === destino) return { ...fila, idioma_mostrado: destino, sin_traduccion: false };
    const campos = encontradas.get(fila.id);
    if (!campos) return { ...fila, idioma_mostrado: original, sin_traduccion: true };
    return { ...mezclar(fila, tipo, campos), idioma_mostrado: destino, sin_traduccion: false };
  });
}

module.exports = { aplicarTraducciones, normalizarLang, mezclar, idiomaOriginalDe };
