// clasificacion.js — selector único de "Sub-sección" del formulario de Contenidos (panel admin).
// Funciones puras (se prueban con Jest, ver backend/src/clasificacion.test.js).
//
// REGLA (decisión del usuario, 2026-10-20): la lista de Sub-sección depende de la Sección elegida.
//  - Noticias y Educación: la sub-sección ES la categoría (obligatoria).
//  - Revolución Humana: la sub-sección es la de siempre (opcional); la categoría no se pregunta y
//    queda en un valor por defecto, o conserva la que ya tenía la pieza al editarla.
// Las listas de claves deben coincidir con backend/src/validators/contenido.js (hay prueba que lo vigila).
(function () {
  const CATEGORIAS_NOTICIAS = [
    'internacionales', 'crimen', 'salud', 'deportes', 'finanzas', 'tecnologia',
    'descubrimientos', 'politica', 'clima', 'cultura', 'ciencia',
  ];
  const CATEGORIAS_EDUCACION = [
    'leyes-educativas', 'estudiantes-sobresalientes', 'sistemas-mundiales', 'programas-educativos',
  ];
  const SUBSECCIONES_RH = [
    'nuevos-humanos', 'revolucion-mundial', 'logica-humana', 'corrupcion-humana', 'ilogica-humana',
  ];
  const CATEGORIA_POR_DEFECTO_RH = 'cultura';

  // Claves que se ofrecen en la lista de Sub-sección para cada Sección.
  function clavesDe(seccion) {
    if (seccion === 'educacion') return CATEGORIAS_EDUCACION;
    if (seccion === 'revolucion-humana') return SUBSECCIONES_RH;
    return CATEGORIAS_NOTICIAS;
  }

  // Solo Revolución Humana permite dejar la Sub-sección vacía.
  function esObligatoria(seccion) {
    return seccion !== 'revolucion-humana';
  }

  // De lo que eligió el admin a los campos que guarda la API.
  function aCampos(seccion, valor, categoriaActual) {
    if (seccion === 'revolucion-humana') {
      return { categoria: categoriaActual || CATEGORIA_POR_DEFECTO_RH, subseccion: valor || null };
    }
    return { categoria: valor || '', subseccion: null };
  }

  // De una pieza guardada al valor que debe mostrar la lista de Sub-sección.
  function aValor(seccion, subseccion, categoria) {
    if (seccion === 'revolucion-humana') return subseccion || '';
    return categoria || '';
  }

  const api = {
    CATEGORIAS_NOTICIAS, CATEGORIAS_EDUCACION, SUBSECCIONES_RH, CATEGORIA_POR_DEFECTO_RH,
    clavesDe, esObligatoria, aCampos, aValor,
  };
  if (typeof window !== 'undefined') window.sqprClasificacion = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
