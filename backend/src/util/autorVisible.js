// Nombre con el que se muestra a un autor en el debate y en los comentarios (publico).
// Nunca devuelve el correo: usa el nombre del perfil (Mi cuenta) o, si no lo tiene, un alias generico
// estable derivado del id ("Participante-a3f9"). Los avatares (alias e imagen elegidos) vienen despues.
// `alias` es el alias SQL de la tabla perfiles en la consulta.
function nombreVisibleSql(alias = 'pf') {
  return `COALESCE(NULLIF(BTRIM(${alias}.nombre), ''), 'Participante-' || SUBSTR(MD5(${alias}.id::text), 1, 4))`;
}

module.exports = { nombreVisibleSql };
