// taller.js — Taller de Aliado Imperfekto (panel de administración).
// Un cuaderno de «semillas» (ideas propias del autor) guardadas en la base de datos, y los agentes del Taller que las
// analizan. Hoy trabaja La Grieta; La Cazadora de Ecos, El Contrapunto y La Farolera vienen después.
// Las funciones puras (sin DOM) se prueban con Jest (backend/src/taller.test.js).
(function () {
  const ESTADOS = {
    semilla: '🌱 Semilla', explorada: '🔎 Explorada', en_desarrollo: '✍️ En desarrollo', lista: '✅ Lista', pasada: '📤 Pasada a Contenidos',
  };
  const FORMATOS = { ensayo: 'Ensayo', reflexion: 'Reflexión', columna: 'Columna', lectura_corta: 'Lectura corta' };

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
        <small>${esc(String(s.actualizado_en || '').slice(0, 10))}${(s.agentes_que_la_analizaron || []).length ? ' · 🏺' : ''}</small>
      </button>`).join('');
  }

  function lista(titulo, items, esc) {
    return items.length ? `<p><strong>${esc(titulo)}</strong></p><ul>${items.join('')}</ul>` : '';
  }

  // Informe de La Grieta. `desactualizado`: la idea cambió después de este análisis.
  function htmlAnalisisGrieta(entrada, desactualizado, esc) {
    const a = entrada.resultado;
    const cita = (f) => (f ? `<br><em>«${esc(f)}»</em>` : '');
    const aviso = desactualizado
      ? '<p class="brigada-bandera brigada-bandera-media"><strong>Cambiaste la idea después de este análisis.</strong> Vuelve a pulsar «Analizar» para actualizarlo.</p>' : '';
    return `<h5>🏺 La Grieta</h5>${aviso}
      ${a.tema ? `<p><strong>Tema:</strong> ${esc(a.tema)}${a.etiquetas.length ? ` · <small>${a.etiquetas.map(esc).join(', ')}</small>` : ''}</p>` : ''}
      <p><strong>Tu tesis</strong></p><p class="taller-tesis">${esc(a.tesis)}</p>
      ${lista('Lo que das por hecho', a.suposiciones.map((x) => `<li>${esc(x)}</li>`), esc)}
      ${lista('Las grietas', a.grietas.map((g) => `<li class="brigada-bandera brigada-bandera-media"><strong>${esc(g.grieta)}</strong><br>${esc(g.por_que)}${cita(g.fragmento)}</li>`), esc)}
      ${lista('El oro', a.oro.map((o) => `<li class="brigada-bandera brigada-bandera-baja"><strong>${esc(o.oro)}</strong>${cita(o.fragmento)}</li>`), esc)}
      ${lista('Preguntas que quedan abiertas', a.preguntas.map((x) => `<li>${esc(x)}</li>`), esc)}
      ${lista('Caminos para desarrollarla', a.direcciones.map((d) => `<li><strong>${esc(FORMATOS[d.formato] || d.formato)}</strong>: ${esc(d.enfoque)}</li>`), esc)}
      <p class="admin-hint">La Grieta solo trabaja con lo que escribiste: no agrega ideas ni datos, y cada cita se comprueba contra tu texto. Tú decides qué hacer con el análisis.</p>`;
  }

  const api = { ESTADOS, FORMATOS, etiquetasDeTexto, tituloDe, htmlListaSemillas, htmlAnalisisGrieta };
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
  }

  async function abrirSemilla(id) {
    try {
      const data = await apiFetch(`/api/semillas/${encodeURIComponent(id)}`);
      mostrarFormulario(data.semilla);
    } catch (err) { estado(err.message, 'error'); }
  }

  function pintarResultados() {
    const caja = $('taller-resultados');
    const grieta = actual && actual.analisis && actual.analisis.grieta;
    if (!grieta) { caja.hidden = true; caja.innerHTML = ''; return; }
    caja.innerHTML = htmlAnalisisGrieta(grieta, (actual.desactualizados || []).includes('grieta'), esc);
    caja.hidden = false;
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

  // La Grieta: guarda primero lo que hay en el cuadro (para que analice EXACTAMENTE ese texto) y luego analiza.
  async function analizarConGrieta() {
    const mesa = $('taller-estado');
    const boton = $('taller-grieta');
    if (!$('ts-texto').value.trim()) { mesa.textContent = '🏺 La Grieta necesita una idea: escribe primero tu semilla.'; return; }
    boton.disabled = true;
    mesa.textContent = '🏺 La Grieta está leyendo tu idea...';
    try {
      const guardada = await guardar();
      if (!guardada) { mesa.textContent = 'No se pudo guardar la semilla, así que La Grieta no analizó.'; return; }
      const data = await apiFetch(`/api/semillas/${encodeURIComponent(guardada.id)}/agentes/grieta`, { method: 'POST' });
      actual = { ...guardada, estado: data.estado, analisis: { ...(guardada.analisis || {}), grieta: data.analisis }, desactualizados: [] };
      $('ts-estado').value = actual.estado;
      pintarResultados();
      await cargarLista();
      mesa.textContent = '🏺 La Grieta terminó: mira su análisis abajo. Tú decides qué hacer con él.';
    } catch (err) {
      mesa.textContent = 'La Grieta no pudo analizar: ' + err.message;
    } finally {
      boton.disabled = false;
    }
  }

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
      $('taller-grieta').addEventListener('click', analizarConGrieta);
      return cargarLista();
    },
  };
})();
