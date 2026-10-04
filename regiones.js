// regiones.js — filtro por región y armado del "collage" de la página Noticias.
// Funciones puras (se prueban con Jest, ver backend/src/regiones.test.js).
//
// COLLAGE: la cuadrícula de Noticias mezcla TODAS las secciones y subsecciones del sitio
// (Noticias, Revolución Humana, Educación...) con al menos una pieza de cada una, en cualquier
// formato. Por ahora el orden es automático y estable (no cambia en cada recarga); el agente que
// elige y varía al azar queda como pendiente (IDEAS-PENDIENTES.md).
//
// REGLAS (decisiones del usuario, 2026-10-03):
//  - Región: una pieza SIN región asignada se muestra en TODAS las regiones (así no desaparece
//    contenido ya publicado); una pieza CON región solo se muestra en la suya.
//  - 18+ (opción A): Corrupción Humana e Ilógica Humana NO entran al collage salvo que la edad
//    del visitante esté confirmada (política de edad: solo esas dos secciones son 18+).
//  - Premium: entra con su insignia y solo el adelanto, pero nunca más de 1 de cada
//    `cadaPremium` tarjetas ni dos seguidas.
(function () {
  const SUBSECCIONES_18_MAS = ['corrupcion-humana', 'ilogica-humana'];

  function filtrarPorRegion(items, region) {
    if (!region) return items;
    return items.filter((item) => !item.enfoque || item.enfoque === region);
  }

  function es18Mas(item) {
    return Boolean(item) && SUBSECCIONES_18_MAS.includes(item.subseccion);
  }

  function fechaDe(item) {
    return String(item.fecha_publicacion || '');
  }

  // Reparte las tarjetas premium para que no se amontonen: una premium solo entra si ya pasaron
  // al menos `cada` posiciones desde la anterior; las que sobran se guardan y se sueltan en cuanto
  // se puede (nada se descarta: lo que quede pendiente va al final).
  function espaciarPremium(lista, cada) {
    const salida = [];
    const pendientes = [];
    let ultima = -Infinity;
    const soltar = () => {
      while (pendientes.length && salida.length - ultima >= cada) {
        salida.push(pendientes.shift());
        ultima = salida.length - 1;
      }
    };
    for (const item of lista) {
      if (item.es_premium) {
        if (salida.length - ultima >= cada) { salida.push(item); ultima = salida.length - 1; } else pendientes.push(item);
      } else {
        salida.push(item);
      }
      soltar();
    }
    return salida.concat(pendientes);
  }

  // Une secciones en un orden "por turnos": primero la pieza más reciente de cada sección/subsección
  // (así cada una aparece al menos una vez), luego la segunda de cada una, y así sucesivamente.
  function armarCollage(items, opciones) {
    const { region = '', adultoVerificado = false, cadaPremium = 4 } = opciones || {};
    let lista = (items || []).filter((i) => adultoVerificado || !es18Mas(i));
    lista = filtrarPorRegion(lista, region);

    const ordenadas = lista
      .map((item, indice) => ({ item, indice }))
      .sort((a, b) => (fechaDe(a.item) < fechaDe(b.item) ? 1 : fechaDe(a.item) > fechaDe(b.item) ? -1 : a.indice - b.indice))
      .map((x) => x.item);

    const grupos = new Map(); // clave "seccion/subseccion" -> piezas (de más reciente a más antigua)
    for (const item of ordenadas) {
      const clave = (item.seccion || 'noticias') + '/' + (item.subseccion || '');
      if (!grupos.has(clave)) grupos.set(clave, []);
      grupos.get(clave).push(item);
    }
    // Los grupos quedan ordenados por su pieza más reciente (por el orden en que aparecieron).
    const listas = [...grupos.values()];
    const porTurnos = [];
    for (let ronda = 0; porTurnos.length < ordenadas.length; ronda += 1) {
      for (const g of listas) if (g[ronda]) porTurnos.push(g[ronda]);
    }
    return cadaPremium > 0 ? espaciarPremium(porTurnos, cadaPremium) : porTurnos;
  }

  const api = { SUBSECCIONES_18_MAS, filtrarPorRegion, es18Mas, espaciarPremium, armarCollage };
  if (typeof window !== 'undefined') window.sqprRegiones = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
