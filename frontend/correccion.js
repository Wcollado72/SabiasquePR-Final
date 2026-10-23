// correccion.js — correctores de idioma del panel de administración.
// Cada campo de texto del panel recibe una barra con: [Idioma / variante] [Revisar] [Corregir con IA].
//  - Revisar: LanguageTool (API pública) con un diccionario propio de Puerto Rico y del proyecto, para
//    que palabras como "guagua" o "Loíza" no salgan como errores. Solo sugiere; el admin decide.
//  - Corregir con IA: Claude Haiku vía POST /api/admin/corregir. Muestra la lista de cambios y solo
//    modifica el campo cuando el admin pulsa "Aplicar" (y se puede deshacer).
// Las funciones puras se prueban con Jest (backend/src/correccion.test.js).
(function () {
  const VARIANTES = [
    { codigo: 'es-PR', nombre: 'Español (Puerto Rico)', lt: 'es' },
    { codigo: 'es-MX', nombre: 'Español (México)', lt: 'es' },
    { codigo: 'es-ES', nombre: 'Español (España)', lt: 'es' },
    { codigo: 'es-419', nombre: 'Español (neutro)', lt: 'es' },
    { codigo: 'en-US', nombre: 'English (US)', lt: 'en-US' },
    { codigo: 'en-GB', nombre: 'English (UK)', lt: 'en-GB' },
  ];

  // Campos del panel que llevan la barra. Los de traducción (tr-<tipo>-<campo>) se detectan por su id.
  const CAMPOS = [
    'an-titulo', 'an-parrafos', 'an-imagen-alt', 'an-imagen-caption',
    'ac-titulo', 'ac-subtitulo', 'ac-cuerpo', 'ac-portada-alt',
    'ap-nombre', 'ap-descripcion',
  ];

  // Palabras válidas que LanguageTool no conoce: puertorriqueñismos y nombres del proyecto/isla.
  const PALABRAS_PR = [
    'guagua', 'guaguas', 'chavo', 'chavos', 'boricua', 'boricuas', 'borinqueño', 'borinqueña', 'borinqueños',
    'coquí', 'coquíes', 'pana', 'panas', 'janguear', 'jangueo', 'wepa', 'mofongo', 'pastelillo', 'pastelillos',
    'alcapurria', 'alcapurrias', 'bacalaíto', 'bacalaítos', 'piragua', 'piraguas', 'jíbaro', 'jíbara', 'jíbaros',
    'cuchifrito', 'tostones', 'pasteles', 'arroz', 'pitorro', 'abuelita', 'puertorriqueñismo', 'puertorriqueñismos',
    'sabiasquepr', 'sabías', 'imperfekto', 'imperfektos', 'aliado',
    'Vieques', 'Culebra', 'Loíza', 'Mayagüez', 'Humacao', 'Naguabo', 'Ceiba', 'Luquillo', 'Fajardo', 'Rincón',
    'Yauco', 'Utuado', 'Jayuya', 'Arecibo', 'Guánica', 'Caguas', 'Bayamón', 'Carolina', 'Ponce', 'Aguadilla',
    'Isabela', 'Manatí', 'Vega Baja', 'Cayey', 'Aibonito', 'Orocovis', 'Adjuntas', 'Lares', 'Maricao', 'Hormigueros',
    'Barranquitas', 'Comerío', 'Toa Baja', 'Toa Alta', 'Dorado', 'Cataño', 'Guaynabo', 'Trujillo Alto', 'Canóvanas',
    'Río Grande', 'Juncos', 'Gurabo', 'Las Piedras', 'Maunabo', 'Patillas', 'Arroyo', 'Guayama', 'Salinas', 'Santa Isabel',
    'Coamo', 'Juana Díaz', 'Villalba', 'Peñuelas', 'Guayanilla', 'Sabana Grande', 'San Germán', 'Cabo Rojo', 'Lajas',
    'Añasco', 'Rincón', 'Moca', 'Quebradillas', 'Camuy', 'Hatillo', 'Florida', 'Ciales', 'Morovis', 'Corozal', 'Naranjito',
    'Cidra', 'Aguas Buenas', 'Yabucoa', 'Las Marías', 'Maricao', 'Santurce', 'Condado', 'Hato Rey', 'Ocean Park',
    'Lógica Humana', 'Revolución Humana', 'Corrupción Humana', 'Ilógica Humana',
  ];

  function codigoLanguageTool(variante) {
    const v = VARIANTES.find((x) => x.codigo === variante);
    return v ? v.lt : 'es';
  }

  function normalizar(palabra) {
    return String(palabra || '').trim().toLowerCase();
  }

  // Conjunto de palabras (en minúscula) que no deben marcarse como error de ortografía.
  function conjuntoDiccionario(extra) {
    const set = new Set();
    PALABRAS_PR.concat(Array.isArray(extra) ? extra : []).forEach((p) => {
      const n = normalizar(p);
      if (n) set.add(n);
      n.split(/\s+/).forEach((parte) => { if (parte.length > 2) set.add(parte); });
    });
    return set;
  }

  function esErrorOrtografico(m) {
    const tipo = m && m.rule && m.rule.issueType;
    return tipo === 'misspelling' || (m && m.rule && /MORFOLOGIK|SPELL|HUNSPELL/i.test(m.rule.id || ''));
  }

  // Quita las coincidencias de ortografía que sean palabras del diccionario propio.
  function filtrarCoincidencias(texto, matches, extra) {
    const dic = conjuntoDiccionario(extra);
    return (matches || []).filter((m) => {
      if (!esErrorOrtografico(m)) return true;
      const palabra = normalizar(texto.slice(m.offset, m.offset + m.length));
      return !dic.has(palabra);
    });
  }

  function aplicarReemplazo(texto, offset, longitud, reemplazo) {
    return texto.slice(0, offset) + reemplazo + texto.slice(offset + longitud);
  }

  // Variante inicial: las traducciones usan el idioma de destino; el resto, español de Puerto Rico.
  function varianteInicial(idioma) {
    return idioma === 'en' ? 'en-US' : 'es-PR';
  }

  const api = {
    VARIANTES, CAMPOS, PALABRAS_PR, codigoLanguageTool, conjuntoDiccionario, filtrarCoincidencias,
    aplicarReemplazo, varianteInicial,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window === 'undefined') return;
  window.sqprCorreccion = api;

  // ─── Interfaz (solo en el navegador) ────────────────────────────────────────────
  const LS_DIC = 'sqpr-dic-extra';
  const LS_VAR = 'sqpr-corr-var:';
  let apiFetch = null;

  function leerLS(clave, defecto) {
    try { const v = window.localStorage.getItem(clave); return v === null ? defecto : v; } catch { return defecto; }
  }
  function escribirLS(clave, valor) {
    try { window.localStorage.setItem(clave, valor); } catch { /* sin almacenamiento: sigue funcionando */ }
  }
  function diccionarioExtra() {
    try { return JSON.parse(leerLS(LS_DIC, '[]')) || []; } catch { return []; }
  }
  function agregarAlDiccionario(palabra) {
    const lista = diccionarioExtra();
    if (!lista.includes(palabra)) lista.push(palabra);
    escribirLS(LS_DIC, JSON.stringify(lista));
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = String(s == null ? '' : s);
    return d.innerHTML.replace(/"/g, '&quot;');
  }

  // Para campos de traducción: el idioma de destino se lee del título del panel («inglés» / «español»).
  function idiomaDeCampo(el) {
    const m = /^tr-(\w+?)-/.exec(el.id);
    if (!m) return 'es';
    const dest = document.getElementById(`tr-${m[1]}-destino`);
    return dest && /ingl/i.test(dest.textContent) ? 'en' : 'es';
  }

  function crearBarra(el) {
    const barra = document.createElement('div');
    barra.className = 'corr-barra';
    const opciones = VARIANTES.map((v) => `<option value="${v.codigo}">${v.nombre}</option>`).join('');
    barra.innerHTML = `
      <label class="corr-idioma">Idioma <select class="corr-select" aria-label="Idioma o variante para corregir">${opciones}</select></label>
      <button type="button" class="admin-btn-cancel corr-revisar">Revisar</button>
      <button type="button" class="admin-btn-cancel corr-ia">Corregir con IA</button>
      <span class="corr-estado" aria-live="polite"></span>`;
    const lista = document.createElement('ul');
    lista.className = 'suggestion-list corr-resultados';
    el.insertAdjacentElement('afterend', barra);
    barra.insertAdjacentElement('afterend', lista);
    const select = barra.querySelector('.corr-select');
    const guardada = leerLS(LS_VAR + el.id, '');
    select.value = guardada || varianteInicial(idiomaDeCampo(el));
    select.addEventListener('change', () => { select.dataset.manual = '1'; escribirLS(LS_VAR + el.id, select.value); });
    // En traducciones, el idioma de destino cambia al abrir otra pieza: se reajusta mientras no se haya elegido a mano.
    const reajustar = () => { if (!select.dataset.manual && !guardada) select.value = varianteInicial(idiomaDeCampo(el)); };
    barra.addEventListener('pointerenter', reajustar);
    barra.addEventListener('focusin', reajustar);
    barra.querySelector('.corr-revisar').addEventListener('click', () => revisar(el, select.value, barra, lista));
    barra.querySelector('.corr-ia').addEventListener('click', () => corregirConIa(el, select.value, barra, lista));
  }

  function estado(barra, msg) { barra.querySelector('.corr-estado').textContent = msg || ''; }

  async function revisar(el, variante, barra, lista) {
    const texto = el.value;
    if (!texto.trim()) { lista.innerHTML = '<li class="foro-empty">Escribe algo para revisar.</li>'; return; }
    lista.innerHTML = '<li class="foro-loading">Revisando...</li>';
    try {
      const res = await fetch('https://api.languagetool.org/v2/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ text: texto, language: codigoLanguageTool(variante) }),
      });
      if (!res.ok) throw new Error('el servicio respondió ' + res.status);
      const data = await res.json();
      const matches = filtrarCoincidencias(texto, data.matches, diccionarioExtra());
      if (!matches.length) { lista.innerHTML = '<li class="foro-empty">Sin sugerencias.</li>'; return; }
      lista.innerHTML = matches.map((m) => {
        const frag = texto.slice(m.offset, m.offset + m.length);
        const repl = (m.replacements || [])[0] && m.replacements[0].value;
        const usar = repl
          ? `<button type="button" data-offset="${m.offset}" data-length="${m.length}" data-repl="${esc(repl)}">Usar "${esc(repl)}"</button>`
          : '';
        const dic = esErrorOrtografico(m)
          ? `<button type="button" class="corr-dic" data-palabra="${esc(frag)}">Agregar al diccionario</button>`
          : '';
        return `<li class="suggestion-item">"<mark>${esc(frag)}</mark>" — ${esc(m.message)}${usar}${dic}</li>`;
      }).join('');
      lista.querySelectorAll('button[data-offset]').forEach((b) => b.addEventListener('click', () => {
        el.value = aplicarReemplazo(el.value, Number(b.dataset.offset), Number(b.dataset.length), b.dataset.repl);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        // Los demás desplazamientos quedan invalidados al editar el texto.
        lista.innerHTML = '<li class="foro-empty">Texto actualizado — vuelve a revisar si quieres seguir corrigiendo.</li>';
      }));
      lista.querySelectorAll('.corr-dic').forEach((b) => b.addEventListener('click', () => {
        agregarAlDiccionario(b.dataset.palabra);
        b.closest('li').remove();
      }));
    } catch (err) {
      lista.innerHTML = `<li class="foro-error">No se pudo revisar: ${esc(err.message)}</li>`;
    }
  }

  async function corregirConIa(el, variante, barra, lista) {
    const texto = el.value;
    if (!texto.trim()) { lista.innerHTML = '<li class="foro-empty">Escribe algo para corregir.</li>'; return; }
    if (!apiFetch) { lista.innerHTML = '<li class="foro-error">Inicia sesión como administrador para usar la IA.</li>'; return; }
    const boton = barra.querySelector('.corr-ia');
    boton.disabled = true;
    estado(barra, 'Corrigiendo con IA...');
    lista.innerHTML = '';
    try {
      const data = await apiFetch('/api/admin/corregir', { method: 'POST', body: JSON.stringify({ texto, variante }) });
      const cambios = data.cambios || [];
      if (!cambios.length || data.textoCorregido === texto) {
        lista.innerHTML = '<li class="foro-empty">La IA no encontró nada que corregir.</li>';
        return;
      }
      const filas = cambios.map((c) =>
        `<li class="suggestion-item"><del>${esc(c.antes)}</del> → <ins>${esc(c.despues)}</ins>${c.motivo ? ` <span class="corr-motivo">(${esc(c.motivo)})</span>` : ''}</li>`).join('');
      lista.innerHTML = `${filas}
        <li class="suggestion-item corr-acciones">
          <button type="button" class="corr-aplicar">Aplicar ${cambios.length} cambio${cambios.length === 1 ? '' : 's'}</button>
          <button type="button" class="corr-descartar">Descartar</button>
        </li>`;
      lista.querySelector('.corr-aplicar').addEventListener('click', () => {
        const anterior = el.value;
        el.value = data.textoCorregido;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        lista.innerHTML = '<li class="suggestion-item corr-acciones">Cambios aplicados. <button type="button" class="corr-deshacer">Deshacer</button></li>';
        lista.querySelector('.corr-deshacer').addEventListener('click', () => {
          el.value = anterior;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          lista.innerHTML = '<li class="foro-empty">Cambios deshechos.</li>';
        });
      });
      lista.querySelector('.corr-descartar').addEventListener('click', () => { lista.innerHTML = ''; });
    } catch (err) {
      lista.innerHTML = `<li class="foro-error">No se pudo corregir con IA: ${esc(err.message)}</li>`;
    } finally {
      boton.disabled = false;
      estado(barra, '');
    }
  }

  function montarCampos() {
    const objetivos = CAMPOS.map((id) => document.getElementById(id)).filter(Boolean);
    document.querySelectorAll('[id^="tr-"]').forEach((el) => {
      if ((el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') && /^tr-\w+-\w+$/.test(el.id)) objetivos.push(el);
    });
    objetivos.forEach((el) => {
      if (el.dataset.corrMontado) return;
      el.dataset.corrMontado = '1';
      crearBarra(el);
    });
  }

  // admin.js llama a iniciar({ apiFetch }) cuando el panel está listo (y otra vez si dibuja campos nuevos).
  window.sqprCorreccionUI = {
    iniciar(opts) {
      if (opts && opts.apiFetch) apiFetch = opts.apiFetch;
      montarCampos();
    },
  };
})();
