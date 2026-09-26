// Respuesta generica para errores 500 (inesperados). Nunca se manda err.message
// al cliente en un 500 -- a veces incluye detalles internos de Postgres (nombres
// de tablas/columnas/constraints) que no le sirven al usuario y si le sirven a
// quien intente atacar el sitio. El error completo se registra igual en el log
// del servidor para poder depurar. Los errores de validacion (400) NO pasan por
// aqui -- esos ya traen su propio mensaje pensado para mostrarse al usuario.
function enviarError500(res, err) {
  console.error(err);
  res.status(500).json({ ok: false, error: 'Ocurrió un error inesperado. Intenta de nuevo.' });
}

module.exports = { enviarError500 };
