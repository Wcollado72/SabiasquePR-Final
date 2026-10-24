// «Pasar a Contenidos» (Taller de Aliado Imperfekto): convierte un desarrollo de La Farolera en el BORRADOR de una pieza de
// Contenidos, en Revolución Humana / Lógica Humana, firmada por Aliado Imperfekto. Nada se publica: la pieza queda sin
// publicar para que la revise y la edite en Contenidos (con todas las herramientas de la Brigada) antes de publicarla.
const { textoPlano, contarPalabras } = require('../services/farolera');

const AUTOR = 'Aliado Imperfekto';
// Imagen generica de la categoria «cultura» (la misma del boton «Usar imagen genérica»); luego se puede pintar otra.
const PORTADA = {
  url: 'images/categoria-cultura.webp',
  alt: 'Ilustración de un vejigante, un cuatro y una pandereta, símbolo de la categoría Cultura',
};
// formato del Taller -> tipo_formato y subformato de Contenidos
const FORMATOS = {
  ensayo: { tipo: 'ensayo', subformato: null },
  reflexion: { tipo: 'ensayo', subformato: 'opinion' },
  columna: { tipo: 'ensayo', subformato: 'columna' },
  lectura_corta: { tipo: 'lectura_corta', subformato: null },
};

// Los valores de la fila de `contenidos` (sin id: lo elige quien llama, porque tiene que ser unico).
function construirContenido(semilla, desarrollo, hoy) {
  const cuerpo = textoPlano(desarrollo.parrafos);
  const formato = FORMATOS[desarrollo.formato] || FORMATOS.ensayo;
  const titulo = (desarrollo.titulo || semilla.titulo || '').trim() || 'Sin título';
  const resumen = (desarrollo.resumen || '').trim().length >= 10 ? desarrollo.resumen.trim() : cuerpo.replace(/\s+/g, ' ').slice(0, 200);
  const usoIa = desarrollo.parrafos.some((p) => p.some((t) => t.origen === 'farolera'));
  return {
    seccion: 'revolucion-humana',
    subseccion: 'logica-humana',
    tipo_formato: formato.tipo,
    subformato: formato.subformato,
    categoria: 'cultura',
    titulo,
    subtitulo_resumen: resumen,
    cuerpo,
    autor: AUTOR,
    url_portada: PORTADA.url,
    portada_alt: PORTADA.alt,
    fecha_publicacion: hoy,
    duracion_min: Math.max(1, Math.ceil(contarPalabras(cuerpo) / 200)),
    // Si La Farolera escribio algo, la pieza lo dice (divulgacion parcial); si es 100% del autor, no hay IA que declarar.
    divulgacion_ia: usoIa ? 'parcial' : 'no',
    ia_herramientas: usoIa ? ['claude'] : [],
    // Es una idea propia: no tiene fuente externa que citar (se marca para que el formulario no la exija).
    cita_sin_fuente_externa: true,
    es_premium: false,
    destacado: false,
    publicado: false,
    idioma_original: desarrollo.idioma === 'en' ? 'en' : 'es',
  };
}

// La fecha de hoy en Puerto Rico (AAAA-MM-DD).
const hoyEnPuertoRico = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Puerto_Rico' });

module.exports = { construirContenido, hoyEnPuertoRico, AUTOR, PORTADA, FORMATOS };
