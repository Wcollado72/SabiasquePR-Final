// ============================================================
// i18n.js — Sabías que PR · interfaz bilingüe (español / inglés)
// ============================================================
// El HTML del sitio siempre está en español (SEO, sin JS, respaldo). Si el
// visitante eligió inglés, este script carga i18n/en.json — un diccionario
// { "texto en español": "English text" } — y reemplaza los nodos de texto y
// atributos (placeholder, aria-label, title, alt) de la página. Un
// MutationObserver traduce también lo que otros scripts pintan después, sin
// tener que editarlos. Claves con {variables} sirven de patrón:
//   "Hace {n} días": "{n} days ago"
// La elección se guarda en localStorage ('sqpr-lang'); cambiar idioma
// recarga la página para que los datos dinámicos (?lang=) se pidan de nuevo.
// admin.html siempre se queda en español.
// ============================================================

(function (root) {
  'use strict';

  const CLAVE_LS = 'sqpr-lang';
  const ATRIBUTOS = ['placeholder', 'aria-label', 'title', 'alt'];
  const ETIQUETAS_OMITIDAS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'CODE', 'PRE', 'SVG']);

  // ── Funciones puras (se prueban con Jest, ver backend/src/i18n) ──────
  function normalizar(s) {
    return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  }

  function idiomaGuardado(valor) {
    return valor === 'en' ? 'en' : 'es';
  }

  function esPaginaAdmin(pathname) {
    return /(^|\/)admin(\.html)?$/.test(pathname || '');
  }

  function esPaginaLegal(pathname) {
    return /(^|\/)(terminos|privacidad)(\.html)?$/.test(pathname || '');
  }

  function localeFecha(lang) {
    return lang === 'en' ? 'en-US' : 'es-PR';
  }

  function formatear(plantilla, vars) {
    return String(plantilla).replace(/\{(\w+)\}/g, (m, k) => (vars && k in vars ? String(vars[k]) : m));
  }

  function escaparRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Convierte las claves con {variables} en expresiones regulares.
  function compilarPatrones(dic) {
    const patrones = [];
    for (const clave of Object.keys(dic || {})) {
      if (!/\{\w+\}/.test(clave) || typeof dic[clave] !== 'string') continue;
      const nombres = [];
      const fuente = escaparRegex(clave).replace(/\\\{(\w+)\\\}/g, (m, n) => { nombres.push(n); return '(.+?)'; });
      patrones.push({ re: new RegExp('^' + fuente + '$'), nombres, destino: dic[clave] });
    }
    return patrones;
  }

  // Traduce una cadena normalizada; devuelve null si no hay traducción.
  function buscar(dic, patrones, normalizado) {
    if (Object.prototype.hasOwnProperty.call(dic, normalizado) && typeof dic[normalizado] === 'string') {
      return formatear(dic[normalizado], {});
    }
    for (const p of patrones || []) {
      const m = p.re.exec(normalizado);
      if (!m) continue;
      const vars = {};
      p.nombres.forEach((n, i) => { vars[n] = m[i + 1]; });
      return formatear(p.destino, vars);
    }
    return null;
  }

  // Traduce un nodo de texto conservando los espacios de los extremos.
  function traducirTexto(dic, texto, patrones) {
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(String(texto));
    if (!m || !m[2]) return texto;
    const t = buscar(dic || {}, patrones, normalizar(m[2]));
    return t === null ? texto : m[1] + t + m[3];
  }

  // Para textos armados en JS (alert, confirm, lógica): t('Hola {n}', {n: 3}).
  function traducir(dic, clave, vars, patrones) {
    const t = buscar(dic || {}, patrones, normalizar(clave));
    return formatear(t === null ? clave : t, vars);
  }

  const puras = {
    normalizar, idiomaGuardado, esPaginaAdmin, esPaginaLegal, localeFecha, formatear,
    compilarPatrones, traducirTexto, traducir,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = puras;
  if (typeof document === 'undefined') return;

  // ── Navegador ────────────────────────────────────────────────────────
  const html = document.documentElement;
  let lang = 'es';
  try { lang = idiomaGuardado(localStorage.getItem(CLAVE_LS)); } catch { /* sin storage: español */ }
  const enAdmin = esPaginaAdmin(location.pathname);
  if (enAdmin) lang = 'es';

  let dic = {};
  let patrones = [];

  root.SQPR = root.SQPR || {};
  root.SQPR.lang = lang;
  root.SQPR.locale = localeFecha(lang);
  root.SQPR.t = (clave, vars) => traducir(dic, clave, vars, patrones);
  root.SQPR_LANG = lang;
  root.SQPR_LOCALE = root.SQPR.locale;

  function omitido(el) {
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      if (ETIQUETAS_OMITIDAS.has(e.tagName.toUpperCase()) || e.hasAttribute('data-no-i18n')) return true;
    }
    return false;
  }

  function traducirNodoTexto(nodo) {
    if (!nodo.parentElement || omitido(nodo.parentElement)) return;
    const nuevo = traducirTexto(dic, nodo.nodeValue, patrones);
    if (nuevo !== nodo.nodeValue) nodo.nodeValue = nuevo;
  }

  function traducirAtributos(el) {
    if (omitido(el)) return;
    for (const a of ATRIBUTOS) {
      if (!el.hasAttribute(a)) continue;
      const actual = el.getAttribute(a);
      const nuevo = traducirTexto(dic, actual, patrones);
      if (nuevo !== actual) el.setAttribute(a, nuevo);
    }
  }

  function traducirArbol(raiz) {
    if (raiz.nodeType === 3) { traducirNodoTexto(raiz); return; }
    if (raiz.nodeType !== 1) return;
    if (omitido(raiz)) return;
    const paseo = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
    const nodos = [];
    while (paseo.nextNode()) nodos.push(paseo.currentNode);
    nodos.forEach(traducirNodoTexto);
    traducirAtributos(raiz);
    raiz.querySelectorAll('[placeholder],[aria-label],[title],[alt]').forEach(traducirAtributos);
  }

  function traducirMeta() {
    document.title = traducirTexto(dic, document.title, patrones);
    document.querySelectorAll('meta[name="description"],meta[property="og:title"],meta[property="og:description"],meta[name="twitter:title"],meta[name="twitter:description"]').forEach((m) => {
      const c = m.getAttribute('content');
      const nuevo = traducirTexto(dic, c, patrones);
      if (nuevo !== c) m.setAttribute('content', nuevo);
    });
    const loc = document.querySelector('meta[property="og:locale"]');
    if (loc) loc.setAttribute('content', 'en_US');
  }

  // Aviso de cortesia en Terminos/Privacidad: la traduccion no reemplaza el
  // valor legal del espanol. Se agrega directo en ingles (no hay version en
  // espanol de este aviso, asi que no pasa por el diccionario).
  function agregarAvisoLegal() {
    if (!esPaginaLegal(location.pathname)) return;
    const caja = document.querySelector('.contact-box');
    if (!caja || document.getElementById('aviso-traduccion-cortesia')) return;
    const p = document.createElement('p');
    p.id = 'aviso-traduccion-cortesia';
    p.className = 'idioma-aviso';
    p.setAttribute('data-no-i18n', '');
    p.textContent = 'Courtesy translation — the Spanish version of this page prevails in case of any discrepancy.';
    caja.insertBefore(p, caja.firstChild);
  }

  let observador = null;
  function vigilar() {
    observador = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'characterData') traducirNodoTexto(m.target);
        else if (m.type === 'attributes') traducirAtributos(m.target);
        else m.addedNodes.forEach(traducirArbol);
      }
      observador.takeRecords(); // descarta los cambios que acabamos de hacer nosotros
    });
    observador.observe(document.body, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ATRIBUTOS,
    });
  }

  function marcarBoton() {
    const boton = document.getElementById('lang-toggle');
    if (!boton) return;
    if (enAdmin) { boton.hidden = true; return; }
    boton.querySelectorAll('[data-l]').forEach((s) => s.classList.toggle('active', s.dataset.l === lang));
    boton.setAttribute('aria-pressed', lang === 'en' ? 'true' : 'false');
    boton.addEventListener('click', () => {
      try { localStorage.setItem(CLAVE_LS, lang === 'en' ? 'es' : 'en'); } catch { /* sin storage */ }
      location.reload();
    });
  }

  function liberarPantalla() { html.classList.remove('i18n-pending'); }

  async function iniciar() {
    marcarBoton();
    if (lang !== 'en') { liberarPantalla(); return; }
    html.lang = 'en';
    // Si algo falla, nunca dejar la pantalla oculta ni la página rota.
    const seguro = setTimeout(liberarPantalla, 2500);
    try {
      const v = (root.SITE_CONFIG && root.SITE_CONFIG.i18nVersion) || '';
      const res = await fetch('/i18n/en.json' + (v ? '?v=' + encodeURIComponent(v) : ''));
      if (res.ok) dic = await res.json();
    } catch { /* sin diccionario: se queda en español */ }
    patrones = compilarPatrones(dic);
    traducirArbol(document.body);
    traducirMeta();
    agregarAvisoLegal();
    vigilar();
    clearTimeout(seguro);
    liberarPantalla();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})(typeof window !== 'undefined' ? window : globalThis);
