// ============================================================
// citas.js — Sabías que PR · Generador de citas académicas
// ============================================================
// Módulo puro (sin DOM) que arma una cita formateada a partir de campos
// estructurados, en 10 estilos (APA, MLA, Chicago, Turabian, AMA,
// Vancouver, ABNT, ICONTEC, IEEE, Bluebook), enfocados en Estados Unidos,
// sus territorios y Latinoamérica. Caso simple: un artículo web con un
// solo autor (o ninguno), no libros ni múltiples autores.
// Lo usan admin.js (vista previa en vivo) y recurso.js (cita pública).
// ============================================================

(function () {
  function formatCitation(estilo, f) {
    f = f || {};
    const autor = (f.autor || '').trim();
    const anio = (f.anio || '').trim() || 's.f.';
    const titulo = (f.tituloOriginal || '').trim();
    const pub = (f.publicacion || '').trim();
    const url = (f.url || '').trim();
    const fecha = f.fechaAcceso ? String(f.fechaAcceso).slice(0, 10) : '';
    const who = autor || pub || 'Autor desconocido';

    const templates = {
      apa: () => `${who}. (${anio}). ${titulo}. ${pub}. ${url}`,
      mla: () => `${who}. "${titulo}." ${pub}, ${anio}, ${url}.` + (fecha ? ` Accessed ${fecha}.` : ''),
      chicago: () => `${who}. ${anio}. "${titulo}." ${pub}. ${url}.`,
      turabian: () => `${who}. "${titulo}." ${pub} (${anio}). ${url}.`,
      ama: () => `${who}. ${titulo}. ${pub}. ${anio}.` + (fecha ? ` Accessed ${fecha}.` : '') + ` ${url}`,
      vancouver: () => `${who}. ${titulo} [Internet]. ${pub}; ${anio}` + (fecha ? ` [cited ${fecha}]` : '') + `. Available from: ${url}`,
      abnt: () => `${who.toUpperCase()}. ${titulo}. ${pub}, ${anio}. Disponível em: ${url}.` + (fecha ? ` Acesso em: ${fecha}.` : ''),
      icontec: () => `${who}. ${titulo}. ${pub}. ${anio}. Disponible en: ${url}`,
      ieee: () => `${who}, "${titulo}," ${pub}, ${anio}. [Online]. Available: ${url}.` + (fecha ? ` [Accessed: ${fecha}].` : ''),
      bluebook: () => `${who}, ${titulo}, ${pub} (${anio}), ${url}` + (fecha ? ` (last visited ${fecha}).` : '.'),
    };

    const build = templates[estilo];
    if (!build) return '';
    return build().replace(/\s+/g, ' ').trim();
  }

  window.SQPR = Object.assign(window.SQPR || {}, { formatCitation: formatCitation });
})();
