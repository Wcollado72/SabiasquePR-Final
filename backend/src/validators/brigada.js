// Validacion de los endpoints de la Brigada Coqui (agentes de contenido del panel).
const DESTINOS_VALIDOS = ['contenido', 'noticia'];

function validateClasificar(body) {
  const { url, destino } = body || {};
  if (typeof url !== 'string' || !url.trim()) return ['Pega la URL de la fuente para clasificarla.'];
  if (url.length > 2000) return ['La URL es demasiado larga.'];
  if (destino !== undefined && !DESTINOS_VALIDOS.includes(destino)) return ['Destino no válido.'];
  return [];
}

module.exports = { validateClasificar, DESTINOS_VALIDOS };
