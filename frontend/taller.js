// taller.js — Taller de Aliado Imperfekto (panel de administración).
// Un cuaderno de «semillas» (ideas propias del autor) guardadas en la base de datos, y los agentes del Taller que las
// analizan: La Grieta (analiza la idea), La Cazadora de Ecos (busca pensamientos parecidos con fuentes verificadas) y
// El Contrapunto (le da su mejor adversario). La Farolera (desarrollar) viene después.
// Las funciones puras (sin DOM) se prueban con Jest (backend/src/taller.test.js).
(function () {
  const ESTADOS = {
    semilla: '🌱 Semilla', explorada: '🔎 Explorada', en_desarrollo: '✍️ En desarrollo', lista: '✅ Lista', pasada: '📤 Pasada a Contenidos',
  };
  const FORMATOS = { ensayo: 'Ensayo', reflexion: 'Reflexión', columna: 'Columna', lectura_corta: 'Lectura corta' };
  const RELACIONES = { coincide: 'Coincide', matiza: 'Matiza', contradice: 'Contradice' };
  const FUERZAS = { alta: 'Fuerte', media: 'Media', baja: 'Leve' };
  // Orden en que se muestran los informes y cómo se llama cada agente del Taller.
  const AGENTES = [
    { id: 'grieta', emoji: '🏺', nombre: 'La Grieta' },
    { id: 'cazadora', emoji: '📡', nombre: 'La Cazadora de Ecos' },
    { id: 'contrapunto', emoji: '⚖️', nombre: 'El Contrapunto' },
  ];

  // «Cambio, empatía ,, cambio» -> ['cambio', 'empatía'] (minúscula, sin repetir, máximo 10).
  function etiquetasDeTexto(texto) {
    return [...new Set(String(texto || '').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 10);
  }

  function tituloDe(s) {
    if (s.titulo && s.titulo.trim()) return s.titulo.trim();
    const base = String(s.extracto || s.texto || '').replace(/\s+/g, ' ').trim();
    return base ? (base.length > 60 ? `${base.slice(0, 60).replace(/\s+\S*$/, '')}…` : base) : '(sin título)';
  }

  function htmlListaSemillas(semillas, seleccionadaId, esc) {
    if (!semillas.length) return '<p class="foro-empty">Todavía no hay semillas. Escribe la primera idea con «＋ Nueva semilla».</p>';
    return semillas.map((s) => `
      <button type="button" class="taller-semilla${s.id === seleccionadaId ? ' activa' : ''}" data-id="${esc(s.id)}">
        <strong>${esc(tituloDe(s))}</strong>
        <span class="taller-semilla-estado">${esc(ESTADOS[s.estado] || s.estado)}</span>
        <small>${esc(String(s.actualizado_en || '').slice(0, 10))}${(s.agentes_que_la_analizaron || []).length ? ` · ${AGENTES.filter((a) => s.agentes_que_la_analizaron.includes(a.id)).map((a) => a.emoji).join('')}` : ''}</small>
      </button>`).join('');
  }

  function lista(titulo, items, esc) {
    return items.length ? `<div><p><strong>${esc(titulo)}</strong></p><ul>${items.join('')}</ul></div>` : '';
  }
  const avisoViejo = (desactualizado) => (desactualizado
    ? '<p class="brigada-bandera brigada-bandera-media"><strong>Cambiaste la idea después de este análisis.</strong> Vuelve a pulsar el botón de la agente para actualizarlo.</p>' : '');
  const cita = (f, esc) => (f ? `<br><em>«${esc(f)}»</em>` : '');

  // Informe de La Grieta.
  function htmlAnalisisGrieta(entrada, desactualizado, esc) {
    const a = entrada.resultado;
    return `<h5>🏺 La Grieta</h5>${avisoViejo(desactualizado)}
      ${a.tema ? `<p><strong>Tema:</strong> ${esc(a.tema)}${a.etiquetas.length ? ` · <small>${a.etiquetas.map(esc).join(', ')}</small>` : ''}</p>` : ''}
      <p><strong>Tu tesis</strong></p><p class="taller-tesis">${esc(a.tesis)}</p>
      <div class="taller-informe-cols">
      ${lista('Lo que das por hecho', a.suposiciones.map((x) => `<li>${esc(x)}</li>`), esc)}
      ${lista('Las grietas', a.grietas.map((g) => `<li class="brigada-bandera brigada-bandera-media"><strong>${esc(g.grieta)}</strong><br>${esc(g.por_que)}${cita(g.fragmento, esc)}</li>`), esc)}
      ${lista('El oro', a.oro.map((o) => `<li class="brigada-bandera brigada-bandera-baja"><strong>${esc(o.oro)}</strong>${cita(o.fragmento, esc)}</li>`), esc)}
      ${lista('Preguntas que quedan abiertas', a.preguntas.map((x) => `<li>${esc(x)}</li>`), esc)}
      ${lista('Caminos para desarrollarla', a.direcciones.map((d) => `<li><strong>${esc(FORMATOS[d.formato] || d.formato)}</strong>: ${esc(d.enfoque)}</li>`), esc)}
      </div>
      <p class="admin-hint">La Grieta solo trabaja con lo que escribiste: no agrega ideas ni datos, y cada cita se comprueba contra tu texto. Tú decides qué hacer con el análisis.</p>`;
  }

  // Informe de La Cazadora de Ecos: solo fuentes comprobadas (la página se leyó y la cita aparece en ella).
  function htmlEcos(entrada, desactualizado, esc) {
    const r = entrada.resultado;
    const consultas = r.consultas.length ? ` Búsquedas: ${r.consultas.map((q) => `«${esc(q)}»`).join(', ')}.` : '';
    const descartadas = r.descartadas ? ` Descartó ${r.descartadas} fuente${r.descartadas === 1 ? '' : 's'} que no pudo comprobar.` : '';
    const tarjetas = r.ecos.map((e) => {
      const segura = /^https?:\/\//i.test(e.url);
      const titulo = segura ? `<a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">${esc(e.titulo)}</a>` : esc(e.titulo);
      return `<div class="taller-eco taller-eco-${esc(e.relacion)}">
        <p><strong>${esc(e.autor)}</strong> — ${titulo}${e.anio ? ` (${esc(e.anio)})` : ''} <span class="taller-eco-relacion">${esc(RELACIONES[e.relacion] || e.relacion)}</span></p>
        <blockquote>«${esc(e.cita)}»</blockquote>
        <p class="taller-eco-verif">✔ Cita verificada: está en la página.</p>
        <p>${esc(e.porque)}</p>
      </div>`;
    }).join('');
    const vacio = '<p class="brigada-bandera brigada-bandera-media"><strong>No encontré ecos que pudiera comprobar.</strong> Prefiero no traerte nada antes que traerte algo inventado: prueba con la idea más concreta o vuelve a intentarlo.</p>';
    return `<h5>📡 La Cazadora de Ecos</h5>${avisoViejo(desactualizado)}
      <p class="admin-hint">Buscó en la web (${esc(r.busquedas)} búsqueda${r.busquedas === 1 ? '' : 's'}).${consultas}${descartadas}</p>
      <div class="taller-informe-cols">${tarjetas || vacio}</div>
      <p class="admin-hint">Solo ves fuentes que la búsqueda devolvió de verdad, cuya página se volvió a leer y donde la cita aparece palabra por palabra. Una cita corta está sacada de su contexto: léela completa antes de usarla.</p>`;
  }

  // Informe de El Contrapunto.
  function htmlContrapunto(entrada, desactualizado, esc) {
    const c = entrada.resultado;
    return `<h5>⚖️ El Contrapunto</h5>${avisoViejo(desactualizado)}
      <p><strong>La postura contraria, en su versión más fuerte</strong></p><p class="taller-tesis">${esc(c.postura_contraria)}</p>
      <div class="taller-informe-cols">
      ${lista('Las objeciones', c.objeciones.map((o) => `<li class="brigada-bandera brigada-bandera-${o.fuerza === 'alta' ? 'alta' : o.fuerza === 'media' ? 'media' : 'baja'}"><strong>${esc(o.objecion)}</strong> <small>${esc(FUERZAS[o.fuerza] || o.fuerza)}</small>${cita(o.fragmento, esc)}${o.respuesta_posible ? `<br>Podrías responder: ${esc(o.respuesta_posible)}` : ''}</li>`), esc)}
      ${lista('Casos límite', c.casos_limite.map((x) => `<li>${esc(x)}</li>`), esc)}
      ${lista('Lo que resiste', c.lo_que_resiste.map((x) => `<li>${esc(x)}</li>`), esc)}
      ${lista('Preguntas incómodas', c.preguntas_incomodas.map((x) => `<li>${esc(x)}</li>`), esc)}
      </div>
      <p class="admin-hint">El Contrapunto solo razona: no trae datos ni estudios (eso lo hace La Cazadora). Su objetivo es fortalecer tu idea, no derrotarla.</p>`;
  }

  const CONSTRUCTORES = { grieta: htmlAnalisisGrieta, cazadora: htmlEcos, contrapunto: htmlContrapunto };

  // Todos los informes de una semilla, en orden, cada uno en su cuadro.
  function htmlInformes(analisis, desactualizados, esc) {
    return AGENTES.filter((a) => analisis && analisis[a.id])
      .map((a) => `<section class="taller-informe brigada-revision" data-agente="${a.id}">${CONSTRUCTORES[a.id](analisis[a.id], (desactualizados || []).includes(a.id), esc)}</section>`)
      .join('');
  }

  const api = {
    ESTADOS, FORMATOS, AGENTES, etiquetasDeTexto, tituloDe, htmlListaSemillas, htmlAnalisisGrieta, htmlEcos, htmlContrapunto, htmlInformes,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window === 'undefined') return;
  window.sqprTallerPuro = api;

  // ─── Interfaz (solo en el navegador) ────────────────────────────────────────────
  let apiFetch = null;
  let descripcionDe = () => '';
  let semillas = [];
  let actual = null; // la semilla abierta (completa), o null si es nueva
  let filtro = '';

  const $ = (id) => document.getElementById(id);
  const esc = (s) => {
    const d = document.createElement('div');
    d.textContent = String(s == null ? '' : s);
    return d.innerHTML.replace(/"/g, '&quot;');
  };
  const estado = (msg, tipo) => {
    const el = $('ts-status');
    el.textContent = msg || '';
    el.className = `form-status ${tipo || ''}`;
  };

  async function cargarLista() {
    $('taller-lista').innerHTML = '<p class="foro-loading">Cargando...</p>';
    try {
      const data = await apiFetch(`/api/semillas${filtro ? `?estado=${encodeURIComponent(filtro)}` : ''}`);
      semillas = data.semillas || [];
      pintarLista();
    } catch (err) {
      $('taller-lista').innerHTML = `<p class="foro-error">${esc(err.message)}</p>`;
    }
  }

  function pintarLista() {
    const caja = $('taller-lista');
    caja.innerHTML = htmlListaSemillas(semillas, actual && actual.id, esc);
    caja.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', () => abrirSemilla(b.dataset.id)));
  }

  function mostrarFormulario(semilla) {
    actual = semilla;
    $('taller-editor').hidden = false;
    $('ts-titulo').value = semilla ? semilla.titulo : '';
    $('ts-texto').value = semilla ? semilla.texto : '';
    $('ts-etiquetas').value = semilla ? semilla.etiquetas.join(', ') : '';
    $('ts-estado').value = semilla ? semilla.estado : 'semilla';
    $('ts-borrar').hidden = !semilla;
    $('taller-editor-titulo').textContent = semilla ? 'Tu semilla' : 'Nueva semilla';
    contarLetras();
    pintarResultados();
    pintarLista();
    estado('');
    $('taller-estado').textContent = '';
  }

  async function abrirSemilla(id) {
    try {
      const data = await apiFetch(`/api/semillas/${encodeURIComponent(id)}`);
      mostrarFormulario(data.semilla);
      $('taller-editor').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) { estado(err.message, 'error'); }
  }

  function pintarResultados() {
    const caja = $('taller-resultados');
    const html = actual ? htmlInformes(actual.analisis, actual.desactualizados, esc) : '';
    caja.innerHTML = html;
    caja.hidden = !html;
  }

  function contarLetras() {
    const n = $('ts-texto').value.length;
    $('ts-contador').textContent = `${n.toLocaleString('es-PR')} / 20 000 caracteres`;
  }

  function leerFormulario() {
    return { titulo: $('ts-titulo').value.trim(), texto: $('ts-texto').value, etiquetas: etiquetasDeTexto($('ts-etiquetas').value), estado: $('ts-estado').value };
  }

  async function guardar() {
    const datos = leerFormulario();
    if (!datos.texto.trim()) { estado('Escribe la idea: la semilla no puede estar vacía.', 'error'); return null; }
    estado('Guardando...', 'info');
    try {
      const data = actual
        ? await apiFetch(`/api/semillas/${encodeURIComponent(actual.id)}`, { method: 'PUT', body: JSON.stringify(datos) })
        : await apiFetch('/api/semillas', { method: 'POST', body: JSON.stringify({ titulo: datos.titulo, texto: datos.texto, etiquetas: datos.etiquetas }) });
      actual = data.semilla;
      $('ts-estado').value = actual.estado;
      $('ts-borrar').hidden = false;
      $('taller-editor-titulo').textContent = 'Tu semilla';
      estado('Semilla guardada ✔', 'ok tr-status-grande');
      pintarResultados();
      await cargarLista();
      return actual;
    } catch (err) {
      estado('No se pudo guardar: ' + err.message, 'error');
      return null;
    }
  }

  async function borrar() {
    if (!actual) return;
    if (!confirm('¿Borrar esta semilla y sus análisis? No se puede deshacer. (Si ya pasó a Contenidos, esa pieza no se toca.)')) return;
    try {
      await apiFetch(`/api/semillas/${encodeURIComponent(actual.id)}`, { method: 'DELETE' });
      actual = null;
      $('taller-editor').hidden = true;
      estado('');
      await cargarLista();
    } catch (err) { estado('No se pudo borrar: ' + err.message, 'error'); }
  }

  // Una agente del Taller trabaja sobre la semilla: guarda primero lo que hay en el cuadro (para que lea EXACTAMENTE ese
  // texto), le pide su trabajo al servidor y muestra el informe. Nunca cambia el texto del autor.
  async function trabajarConAgente(agente) {
    const mesa = $('taller-estado');
    const boton = $(`taller-${agente.id}`);
    if (!$('ts-texto').value.trim()) { mesa.textContent = `${agente.emoji} ${agente.nombre} necesita una idea: escribe primero tu semilla.`; return; }
    if (agente.confirmacion && !confirm(agente.confirmacion)) return;
    boton.disabled = true;
    mesa.textContent = `${agente.emoji} ${agente.espera}`;
    try {
      const guardada = await guardar();
      if (!guardada) { mesa.textContent = `No se pudo guardar la semilla, así que ${agente.nombre} no trabajó.`; return; }
      const data = await apiFetch(`/api/semillas/${encodeURIComponent(guardada.id)}/agentes/${agente.id}`, { method: 'POST' });
      actual = {
        ...guardada, estado: data.estado, analisis: { ...(guardada.analisis || {}), [agente.id]: data.analisis },
        desactualizados: (guardada.desactualizados || []).filter((x) => x !== agente.id),
      };
      $('ts-estado').value = actual.estado;
      pintarResultados();
      await cargarLista();
      mesa.textContent = `${agente.emoji} ${agente.nombre} terminó: mira su informe abajo. Tú decides qué hacer con él.`;
    } catch (err) {
      mesa.textContent = `${agente.nombre} no pudo trabajar: ${err.message}`;
    } finally {
      boton.disabled = false;
    }
  }

  const TRABAJO = {
    grieta: { espera: 'La Grieta está leyendo tu idea...' },
    contrapunto: { espera: 'El Contrapunto está pensando en la mejor objeción...' },
    cazadora: {
      espera: 'La Cazadora está buscando ecos en la web y comprobando cada cita (puede tardar hasta un minuto)...',
      confirmacion: 'La Cazadora de Ecos busca en la web (hasta 3 búsquedas) y vuelve a leer cada página para comprobar las citas. Gasta unos centavos de IA y puede tardar hasta un minuto. ¿Seguir?',
    },
  };

  window.sqprTaller = {
    iniciar(opts) {
      apiFetch = opts.apiFetch;
      if (opts.descripcion) descripcionDe = opts.descripcion;
      document.querySelectorAll('#taller-agentes [data-desc]').forEach((el) => { el.textContent = descripcionDe(el.dataset.desc); });
      $('taller-nueva').addEventListener('click', () => mostrarFormulario(null));
      $('taller-filtro').addEventListener('change', (e) => { filtro = e.target.value; cargarLista(); });
      $('ts-texto').addEventListener('input', contarLetras);
      $('taller-form').addEventListener('submit', (e) => { e.preventDefault(); guardar(); });
      $('ts-borrar').addEventListener('click', borrar);
      $('ts-cerrar').addEventListener('click', () => { actual = null; $('taller-editor').hidden = true; pintarLista(); });
      AGENTES.forEach((a) => {
        const boton = $(`taller-${a.id}`);
        if (boton) boton.addEventListener('click', () => trabajarConAgente({ ...a, ...TRABAJO[a.id] }));
      });
      return cargarLista();
    },
  };
})();
