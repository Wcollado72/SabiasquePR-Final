// regiones.js — filtro por región (enfoque) para las tarjetas de la página Noticias.
// Función pura (se prueba con Jest). Regla: una tarjeta SIN región asignada (las noticias antiguas
// y el contenido que el admin todavía no clasificó) se muestra en TODAS las regiones, para que al
// activar un botón de región no desaparezca contenido ya publicado; una tarjeta CON región solo
// se muestra en su región. Si se quisiera el comportamiento estricto (solo la región elegida),
// bastaría quitar la condición `!item.enfoque`.
(function () {
  function filtrarPorRegion(items, region) {
    if (!region) return items;
    return items.filter((item) => !item.enfoque || item.enfoque === region);
  }

  if (typeof window !== 'undefined') window.sqprRegiones = { filtrarPorRegion };
  if (typeof module !== 'undefined' && module.exports) module.exports = { filtrarPorRegion };
})();
