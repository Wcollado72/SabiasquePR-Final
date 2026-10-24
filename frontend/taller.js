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

  // El borrador de La Farolera en texto corrido (párrafos separados por una línea en blanco), sin marcas de color.
  function textoDeDesarrollo(d) {
    return (d.parrafos || []).map((p) => p.map((t) => t.texto).join('')).join('\n\n');
  }

  // Un borrador de La Farolera: lo del autor en tinta normal y lo que ella agregó marcado en otro color (y subrayado,
  // para que no dependa solo del color). `hecho` = la semilla ya pasó a Contenidos.
  function htmlDesarrollo(d, { desactualizado, hecho }, esc) {
    const parrafos = d.parrafos.map((p) => `<p>${p.map((t) => (t.origen === 'autor'
      ? `<span class="taller-del-autor">${esc(t.texto)}</span>`
      : `<mark class="taller-de-farolera">${esc(t.texto)}</mark>`)).join('')}</p>`).join('');
    const pal = d.palabras || { autor: 0, farolera: 0, porcentaje_autor: 0 };
    const botones = hecho ? '' : `<button type="button" data-accion="pasar" data-did="${esc(d.id)}">📤 Pasar a Contenidos</button>`;
    return `<article class="taller-desarrollo brigada-revision" data-did="${esc(d.id)}">
      <h5>🏮 ${esc(FORMATOS[d.formato] || d.formato)}: ${esc(d.titulo || '(sin título)')}</h5>${avisoViejo(desactualizado)}
      ${d.resumen ? `<p><em>${esc(d.resumen)}</em></p>` : ''}
      <p class="admin-hint">${esc(pal.porcentaje_autor)}% de las palabras son tuyas (${esc(pal.autor)}) · ${esc(pal.farolera)} las agregó La Farolera.
        <span class="taller-leyenda"><span class="taller-del-autor">Tus palabras</span> <mark class="taller-de-farolera">Lo que agregó La Farolera</mark></span></p>
      <div class="taller-borrador">${parrafos}</div>
      ${d.datos_a_verificar && d.datos_a_verificar.length ? `<p class="brigada-bandera brigada-bandera-alta"><strong>Verifica estos datos:</strong> La Farolera escribió ${d.datos_a_verificar.map((x) => `«${esc(x)}»`).join(', ')}, que no aparece en tu texto. Compruébalos con una fuente o quítalos.</p>` : ''}
      ${d.notas && d.notas.length ? lista('Avisos de La Farolera para ti', d.notas.map((n) => `<li>${esc(n)}</li>`), esc) : ''}
      <div class="admin-form-actions">${botones}
        <button type="button" class="admin-btn-cancel" data-accion="copiar" data-did="${esc(d.id)}">📋 Copiar texto</button>
        <button type="button" class="tr-enlace-peligro" data-accion="descartar" data-did="${esc(d.id)}">Descartar borrador</button>
      </div>
    </article>`;
  }

  // Todos los borradores de La Farolera de una semilla (el más nuevo primero) y, si ya pasó a Contenidos, el aviso con su pieza.
  function htmlDesarrollos(semilla, esc) {
    const lista_ = semilla && semilla.desarrollos ? semilla.desarrollos : [];
    const pieza = semilla && semilla.contenido_id
      ? `<p class="brigada-bandera brigada-bandera-baja"><strong>Esta semilla ya pasó a Contenidos</strong> como borrador sin publicar («${esc(semilla.contenido_id)}»). Revísala y edítala allá antes de publicar.
         <button type="button" data-accion="abrir-contenido" data-id="${esc(semilla.contenido_id)}">Abrir en Contenidos</button></p>` : '';
    if (!lista_.length) return pieza;
    return pieza + lista_.slice().reverse().map((d) => htmlDesarrollo(d, {
      desactualizado: (semilla.desarrollos_desactualizados || []).includes(d.id), hecho: Boolean(semilla.contenido_id),
    }, esc)).join('');
  }

  const api = {
    ESTADOS, FORMATOS, AGENTES, etiquetasDeTexto, tituloDe, htmlListaSemillas, htmlAnalisisGrieta, htmlEcos, htmlContrapunto, htmlInformes,
    textoDeDesarrollo, htmlDesarrollo, htmlDesarrollos,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window === 'undefined') return;
  window.sqprTallerPuro = api;

  // ─── Interfaz (solo en el navegador) ────────────────────────────────────────────
  let apiFetch = null;
  let descripcionDe = () => '';
  let abrirContenido = null; // la pantalla de Contenidos la da el panel (admin.js)
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
    $('taller-formato').value = formatoSugerido(semilla);
    $('taller-indicaciones').value = '';
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
    const borradores = $('taller-desarrollos');
    const htmlBorradores = actual ? htmlDesarrollos(actual, esc) : '';
    borradores.innerHTML = htmlBorradores;
    borradores.hidden = !htmlBorradores;
  }

  // El formato que La Grieta recomendó primero, si ya analizó la idea; si no, ensayo.
  function formatoSugerido(semilla) {
    const g = semilla && semilla.analisis && semilla.analisis.grieta && semilla.analisis.grieta.resultado;
    return g && g.direcciones && g.direcciones[0] ? g.direcciones[0].formato : 'ensayo';
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

  // La Farolera desarrolla la idea en el formato elegido (guarda primero, para leer EXACTAMENTE el texto del cuadro) y deja
  // el borrador a la vista, con lo suyo marcado en otro color. No publica nada.
  async function desarrollar() {
    const mesa = $('taller-estado');
    const boton = $('taller-farolera');
    if (!$('ts-texto').value.trim()) { mesa.textContent = '🏮 La Farolera necesita una idea: escribe primero tu semilla.'; return; }
    boton.disabled = true;
    mesa.textContent = '🏮 La Farolera está desarrollando tu idea (puede tardar un minuto)...';
    try {
      const guardada = await guardar();
      if (!guardada) { mesa.textContent = 'No se pudo guardar la semilla, así que La Farolera no trabajó.'; return; }
      const data = await apiFetch(`/api/semillas/${encodeURIComponent(guardada.id)}/desarrollar`, {
        method: 'POST', body: JSON.stringify({ formato: $('taller-formato').value, indicaciones: $('taller-indicaciones').value.trim() }),
      });
      actual = { ...guardada, estado: data.estado, desarrollos: [...(guardada.desarrollos || []), data.desarrollo].slice(-5) };
      $('ts-estado').value = actual.estado;
      pintarResultados();
      await cargarLista();
      mesa.textContent = '🏮 La Farolera terminó: tu borrador está abajo. Lo tuyo va en tinta normal y lo que ella agregó, marcado. Tú decides si lo pasas a Contenidos.';
      $('taller-desarrollos').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      mesa.textContent = `La Farolera no pudo trabajar: ${err.message}`;
    } finally {
      boton.disabled = false;
    }
  }

  async function copiarTexto(desarrollo) {
    try {
      await navigator.clipboard.writeText(textoDeDesarrollo(desarrollo));
      $('taller-estado').textContent = '📋 Texto copiado (sin las marcas de color).';
    } catch {
      $('taller-estado').textContent = 'No se pudo copiar automáticamente: selecciona el texto del borrador y cópialo a mano.';
    }
  }

  async function descartarDesarrollo(did) {
    if (!confirm('¿Descartar este borrador de La Farolera? No se puede deshacer (tu idea y los demás borradores no se tocan).')) return;
    try {
      await apiFetch(`/api/semillas/${encodeURIComponent(actual.id)}/desarrollos/${encodeURIComponent(did)}`, { method: 'DELETE' });
      actual = { ...actual, desarrollos: (actual.desarrollos || []).filter((d) => d.id !== did) };
      pintarResultados();
      $('taller-estado').textContent = 'Borrador descartado.';
    } catch (err) { $('taller-estado').textContent = `No se pudo descartar: ${err.message}`; }
  }

  async function pasarAContenidos(did) {
    if (!confirm('Se creará un BORRADOR en Contenidos (Revolución Humana › Lógica Humana), firmado por Aliado Imperfekto, con la divulgación de IA «parcial» y marcado «sin fuente externa». No se publica: lo revisas y lo editas allá antes de publicar. ¿Seguir?')) return;
    const mesa = $('taller-estado');
    mesa.textContent = '📤 Creando el borrador en Contenidos...';
    try {
      const data = await apiFetch(`/api/semillas/${encodeURIComponent(actual.id)}/pasar-a-contenidos`, { method: 'POST', body: JSON.stringify({ desarrolloId: did }) });
      actual = { ...actual, estado: data.estado, contenido_id: data.contenido.id };
      $('ts-estado').value = actual.estado;
      pintarResultados();
      await cargarLista();
      mesa.textContent = `📤 Listo: la pieza «${data.contenido.titulo}» quedó como borrador en Contenidos. Ábrela para revisarla, ponerle portada y publicarla cuando quieras.`;
    } catch (err) { mesa.textContent = `No se pudo pasar a Contenidos: ${err.message}`; }
  }

  function alHacerClicEnBorradores(e) {
    const boton = e.target.closest('[data-accion]');
    if (!boton || !actual) return;
    if (boton.dataset.accion === 'abrir-contenido') { if (abrirContenido) abrirContenido(boton.dataset.id); return; }
    const desarrollo = (actual.desarrollos || []).find((d) => d.id === boton.dataset.did);
    if (!desarrollo) return;
    if (boton.dataset.accion === 'copiar') copiarTexto(desarrollo);
    else if (boton.dataset.accion === 'descartar') descartarDesarrollo(desarrollo.id);
    else if (boton.dataset.accion === 'pasar') pasarAContenidos(desarrollo.id);
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
      if (opts.abrirContenido) abrirContenido = opts.abrirContenido;
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
      $('taller-farolera').addEventListener('click', desarrollar);
      $('taller-desarrollos').addEventListener('click', alHacerClicEnBorradores);
      return cargarLista();
    },
  };
})();
