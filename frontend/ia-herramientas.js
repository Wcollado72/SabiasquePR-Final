// ia-herramientas.js — herramientas de IA usadas en una noticia o contenido (divulgación con iconos).
// Lo usan editorial.js (insignias públicas de tarjetas y artículos) y admin.js (selector del formulario).
// La parte pura (catálogo, normalizar, insigniasHtml) se prueba con Jest, ver backend/src/ia-herramientas.test.js.
//
// Las claves conocidas coinciden con CLAVES_IA_CONOCIDAS de backend/src/validators/iaHerramientas.js; cualquier otro
// texto es el nombre de otra IA escrita a mano. Los iconos (images/ia/) son de Simple Icons (CC0) salvo Copilot.
(function () {
  const CATALOGO = [
    { clave: 'claude', nombre: 'Claude' },
    { clave: 'gemini', nombre: 'Gemini' },
    { clave: 'perplexity', nombre: 'Perplexity' },
    { clave: 'chatgpt', nombre: 'ChatGPT' },
    { clave: 'copilot', nombre: 'Copilot' },
  ];
  const CLAVES_IA_CONOCIDAS = CATALOGO.map((c) => c.clave);
  const MAX_HERRAMIENTAS = 8;
  const MAX_NOMBRE = 40;

  function escapar(texto) {
    return String(texto).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function nombreDe(valor) {
    const conocida = CATALOGO.find((c) => c.clave === valor);
    return conocida ? conocida.nombre : valor;
  }

  function iconoDe(valor) {
    return CLAVES_IA_CONOCIDAS.includes(valor) ? 'images/ia/' + valor + '.svg' : null;
  }

  // Lista limpia: recorta, pasa las claves conocidas a minúscula, quita vacías y repetidas (sin distinguir mayúsculas)
  // y respeta el máximo. Igual que el backend, para que el formulario no mande lo que la API rechazaría.
  function normalizar(lista) {
    const vistos = new Set();
    const salida = [];
    for (const crudo of Array.isArray(lista) ? lista : []) {
      if (typeof crudo !== 'string') continue;
      const texto = crudo.trim().slice(0, MAX_NOMBRE);
      if (!texto) continue;
      const minuscula = texto.toLowerCase();
      const valor = CLAVES_IA_CONOCIDAS.includes(minuscula) ? minuscula : texto;
      if (vistos.has(valor.toLowerCase())) continue;
      vistos.add(valor.toLowerCase());
      salida.push(valor);
      if (salida.length >= MAX_HERRAMIENTAS) break;
    }
    return salida;
  }

  // Insignias públicas: icono + nombre de cada IA usada; las escritas a mano van solo con el nombre.
  function insigniasHtml(lista) {
    const items = normalizar(lista).map((valor) => {
      const icono = iconoDe(valor);
      const img = icono ? '<img src="' + icono + '" alt="" width="14" height="14" loading="lazy">' : '';
      return '<span class="ia-chip' + (icono ? '' : ' ia-chip-otra') + '">' + img + escapar(nombreDe(valor)) + '</span>';
    });
    return items.length ? '<span class="ia-usadas">' + items.join('') + '</span>' : '';
  }

  // Selector del formulario del admin: fichas con icono para las IA conocidas + campo para escribir otras.
  // `host` es un elemento vacío; `opciones.onChange(lista)` se llama con cada cambio hecho por la persona.
  function montarSelector(host, opciones) {
    const doc = host.ownerDocument;
    const alCambiar = (opciones && opciones.onChange) || function () {};
    let lista = [];
    let habilitado = true;
    const id = host.id || 'ia';

    host.classList.add('ia-selector');
    host.innerHTML = '<div class="ia-selector-fichas" role="group" aria-label="Herramientas de IA usadas"></div>'
      + '<div class="ia-selector-otra">'
      + '<label for="' + id + '-otra">Otra IA (escribe el nombre)</label>'
      + '<div class="ia-selector-fila">'
      + '<input type="text" id="' + id + '-otra" maxlength="' + MAX_NOMBRE + '" autocomplete="off" placeholder="Ej.: Mistral, Llama, DeepSeek">'
      + '<button type="button" class="admin-btn-cancel ia-selector-agregar">Agregar</button>'
      + '</div></div>'
      + '<div class="ia-selector-extras"></div>';
    const fichas = host.querySelector('.ia-selector-fichas');
    const extras = host.querySelector('.ia-selector-extras');
    const campo = host.querySelector('input');
    const agregar = host.querySelector('.ia-selector-agregar');

    function pintar() {
      fichas.innerHTML = '';
      for (const c of CATALOGO) {
        const activa = lista.includes(c.clave);
        const ficha = doc.createElement('button');
        ficha.type = 'button';
        ficha.className = 'ia-ficha' + (activa ? ' activa' : '');
        ficha.setAttribute('aria-pressed', String(activa));
        ficha.disabled = !habilitado;
        ficha.innerHTML = '<img src="' + iconoDe(c.clave) + '" alt="" width="18" height="18"><span>' + escapar(c.nombre) + '</span>';
        ficha.addEventListener('click', () => cambiar(activa ? lista.filter((x) => x !== c.clave) : lista.concat(c.clave)));
        fichas.appendChild(ficha);
      }
      extras.innerHTML = '';
      for (const valor of lista.filter((x) => !CLAVES_IA_CONOCIDAS.includes(x))) {
        const chip = doc.createElement('span');
        chip.className = 'ia-chip ia-chip-otra';
        chip.appendChild(doc.createTextNode(valor));
        const quitar = doc.createElement('button');
        quitar.type = 'button';
        quitar.className = 'ia-chip-quitar';
        quitar.setAttribute('aria-label', 'Quitar ' + valor);
        quitar.textContent = '×';
        quitar.disabled = !habilitado;
        quitar.addEventListener('click', () => cambiar(lista.filter((x) => x !== valor)));
        chip.appendChild(quitar);
        extras.appendChild(chip);
      }
      campo.disabled = !habilitado || lista.length >= MAX_HERRAMIENTAS;
      agregar.disabled = campo.disabled;
    }

    function cambiar(nueva) {
      lista = normalizar(nueva);
      pintar();
      alCambiar(lista.slice());
    }

    function agregarEscrita() {
      const texto = campo.value.trim();
      if (!texto) return;
      campo.value = '';
      cambiar(lista.concat(texto));
    }
    agregar.addEventListener('click', agregarEscrita);
    // Enter agrega la IA escrita; nunca envía el formulario.
    campo.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); agregarEscrita(); }
    });
    pintar();

    return {
      leer: () => lista.slice(),
      escribir: (nueva) => { lista = normalizar(nueva); pintar(); },
      habilitar: (si) => { habilitado = Boolean(si); pintar(); },
    };
  }

  const api = { CATALOGO, CLAVES_IA_CONOCIDAS, MAX_HERRAMIENTAS, MAX_NOMBRE, nombreDe, iconoDe, normalizar, insigniasHtml, montarSelector };
  if (typeof window !== 'undefined') window.sqprIa = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
