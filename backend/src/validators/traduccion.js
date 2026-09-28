// Traducciones de contenido publicado (Fase C2). Solo se pueden traducir los
// campos de TEXTO visibles al lector -- nunca ids, precios, enlaces, fechas ni
// clasificaciones (esos son los mismos en ambos idiomas). Los nombres son los
// de las columnas de cada tabla, para poder superponer la traduccion sobre la
// fila original sin mapeos intermedios.
const TIPOS_VALIDOS = ['noticia', 'contenido', 'producto'];
const IDIOMAS_VALIDOS = ['es', 'en'];

// tipo -> { campo: { max, lista? } }. `lista: true` = arreglo de textos (parrafos).
const CAMPOS_POR_TIPO = {
  noticia: {
    titulo: { max: 300 },
    parrafos: { lista: true, maxItems: 80, max: 6000 },
    imagen_alt: { max: 500 },
    imagen_caption: { max: 500 },
  },
  contenido: {
    titulo: { max: 300 },
    subtitulo_resumen: { max: 1200 },
    cuerpo: { max: 100000 },
    portada_alt: { max: 500 },
  },
  producto: {
    nombre: { max: 200 },
    descripcion: { max: 3000 },
    imagen_alt: { max: 500 },
  },
};

// Devuelve { errors, campos } -- `campos` es la version saneada (solo campos
// permitidos, textos recortados, vacios descartados). Un campo desconocido es
// un error (no se ignora en silencio) para detectar formularios desalineados.
function validateTraduccion(tipo, idioma, campos) {
  const errors = [];
  if (!TIPOS_VALIDOS.includes(tipo)) errors.push('Tipo de contenido no valido.');
  if (!IDIOMAS_VALIDOS.includes(idioma)) errors.push('Idioma no valido.');
  if (errors.length) return { errors, campos: {} };
  if (!campos || typeof campos !== 'object' || Array.isArray(campos)) {
    return { errors: ['Faltan los campos de la traduccion.'], campos: {} };
  }

  const permitidos = CAMPOS_POR_TIPO[tipo];
  const limpio = {};
  for (const [nombre, valor] of Object.entries(campos)) {
    const regla = permitidos[nombre];
    if (!regla) { errors.push(`El campo "${nombre}" no se puede traducir.`); continue; }
    if (regla.lista) {
      if (!Array.isArray(valor)) { errors.push(`"${nombre}" debe ser una lista de parrafos.`); continue; }
      if (valor.length > regla.maxItems) { errors.push(`"${nombre}" tiene demasiados parrafos (maximo ${regla.maxItems}).`); continue; }
      if (valor.some((p) => typeof p !== 'string' || p.length > regla.max)) {
        errors.push(`Cada parrafo de "${nombre}" debe ser texto de maximo ${regla.max} caracteres.`);
        continue;
      }
      const parrafos = valor.map((p) => p.trim()).filter(Boolean);
      if (parrafos.length) limpio[nombre] = parrafos;
    } else {
      if (typeof valor !== 'string') { errors.push(`"${nombre}" debe ser texto.`); continue; }
      if (valor.length > regla.max) { errors.push(`"${nombre}" supera ${regla.max} caracteres.`); continue; }
      const texto = valor.trim();
      if (texto) limpio[nombre] = texto;
    }
  }

  if (!errors.length && Object.keys(limpio).length === 0) {
    errors.push('La traduccion no tiene ningun texto.');
  }
  return { errors, campos: limpio };
}

module.exports = { validateTraduccion, TIPOS_VALIDOS, IDIOMAS_VALIDOS, CAMPOS_POR_TIPO };
