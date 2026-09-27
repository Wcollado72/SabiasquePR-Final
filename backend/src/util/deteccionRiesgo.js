// Deteccion automatica de lenguaje de riesgo en posts/comentarios publicos
// del foro (2026-09-27, ver AUDITORIA-LEGAL-MENORES.md). Capa gratis,
// deliberadamente simple: una lista de frases/patrones de alta senal, no un
// clasificador de IA -- el objetivo es que un moderador humano revise mas
// rapido, NUNCA borrar o bloquear contenido automaticamente. Un falso
// positivo aqui solo cuesta una revision extra; un falso negativo lo sigue
// cubriendo el sistema de reportes manual que ya existe.
//
// Categorias basadas en los patrones reales que aparecen en los casos de
// corte investigados (Omegle, Internet Brands, etc.): empujar el contacto
// fuera de la plataforma, pedir secreto/aislamiento, y pedir fotos.

const PATRONES = [
  {
    categoria: 'Solicitud de contacto fuera de la plataforma',
    regex: /\b(agr[eé]game|escr[íi]beme|habl(a|emos)|contacta(me)?)\s+(a|al|por|en)?\s*(whatsapp|snapchat|snap|instagram|insta|telegram|discord|kik|n[uú]mero|tel[eé]fono)\b/i,
  },
  {
    categoria: 'Solicitud de contacto fuera de la plataforma',
    regex: /\b(dame|te doy|pasame|te paso)\s+(mi|tu)\s+(n[uú]mero|whatsapp|snap|instagram|telegram)\b/i,
  },
  {
    categoria: 'Solicitud de contacto fuera de la plataforma',
    regex: /\b(add|dm|message)\s+me\s+(on|at)\s+(whatsapp|snapchat|snap|instagram|telegram|discord|kik)\b/i,
  },
  {
    categoria: 'Lenguaje de secreto/aislamiento',
    regex: /\b(no\s+(le\s+)?(digas|cuentes|comentes)\s+(a\s+)?(tus?\s+)?(pap[aá]s?|mam[aá]|padres|nadie))\b/i,
  },
  {
    categoria: 'Lenguaje de secreto/aislamiento',
    regex: /\b(es\s+)?(nuestro\s+secreto|nadie\s+(m[aá]s\s+)?(tiene|debe)\s+que\s+saber)\b/i,
  },
  {
    categoria: 'Lenguaje de secreto/aislamiento',
    regex: /\b(don'?t\s+tell\s+your\s+(parents|mom|dad)|our\s+little\s+secret|just\s+between\s+us)\b/i,
  },
  {
    categoria: 'Solicitud de fotos/contenido personal',
    regex: /\b(mandame|env[ií]ame|mand[aá]\s*me|pasame|manda)\s+(una\s+)?(foto|fotos|video)\s+(tuya|tuyo|de\s+ti|sin\s+ropa)\b/i,
  },
  {
    categoria: 'Solicitud de fotos/contenido personal',
    regex: /\b(send|share)\s+(me\s+)?(a\s+)?(pic|pics|photo|photos|picture|video)s?\s+of\s+you\b/i,
  },
  {
    categoria: 'Combinación edad + apariencia',
    regex: /\b(cu[aá]ntos\s+a[ñn]os\s+tienes|how\s+old\s+are\s+you)\b.{0,80}\b(linda|bonita|guapa|guapo|hermosa|sexy|cute|hot)\b/i,
  },
];

// Devuelve la categoria del primer patron que coincide, o null si no
// coincide ninguno. `texto` puede ser cualquier combinacion de titulo+cuerpo.
function detectarRiesgo(texto) {
  if (!texto) return null;
  for (const { categoria, regex } of PATRONES) {
    if (regex.test(texto)) return categoria;
  }
  return null;
}

module.exports = { detectarRiesgo };
