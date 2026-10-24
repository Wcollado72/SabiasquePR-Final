// Arranca el panel de administracion (frontend/admin.html + sus scripts) en jsdom, con una sesion de admin y una
// API simuladas, y comprueba que NO hay errores de JavaScript y que las listas se pintan. Existe porque un error
// al iniciar (p. ej. una funcion borrada por accidente) deja el panel vacio y ninguna otra prueba lo detecta.
// Uso (desde backend/): node scripts/probar-panel.js        Sale con codigo 1 si algo falla.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const F = path.join(__dirname, '..', '..', 'frontend');
const html = fs.readFileSync(path.join(F, 'admin.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://sabiasquepr.com/admin.html', pretendToBeVisual: true });
const w = dom.window;
const errores = [];
w.addEventListener('error', (e) => errores.push('error: ' + e.message));
w.addEventListener('unhandledrejection', (e) => errores.push('rechazo: ' + ((e.reason && e.reason.stack) || e.reason)));
w.console.error = (...a) => errores.push('console.error: ' + a.join(' '));
w.alert = (m) => errores.push('alert: ' + m);
w.confirm = () => true;
w.HTMLElement.prototype.scrollIntoView = () => {};
w.SITE_CONFIG = { apiUrl: 'http://api.test', supabaseUrl: 'https://x.supabase.co', supabaseKey: 'k' };
w.supabase = {
  auth: { getSession: async () => ({ data: { session: { access_token: 't', user: { id: 'u1' } } } }), onAuthStateChange: () => {} },
};

const DATOS = {
  noticias: [{ id: 'n1', titulo: 'Noticia de prueba', fecha: '2026-10-01', categoria: 'ciencia', publicado: false, parrafos: ['x'], imagen: 'i.webp', imagen_alt: 'a' }],
  contenidos: [{ id: 'c1', titulo: 'Contenido de prueba', seccion: 'educacion', tipo_formato: 'ensayo', fecha_publicacion: '2026-10-01', publicado: false, url_portada: 'p.webp' }],
  productos: [{ id: 'p1', nombre: 'Producto de prueba', precio: 10, imagen: 'x.webp', activo: true }],
  reportes: [
    { id: 'r1', tipo: 'debate_post', item_id: 'a', motivo: 'Insulta', estado: 'pendiente', automatico: false, creado_en: '2026-10-02', reportado_por_email: 'x@y.com', contenido_existe: true, contenido_titulo: 'Titulo reportado', contenido_cuerpo: 'Texto reportado', contenido_autor_nombre: 'Participante-ab12' },
    { id: 'r2', tipo: 'articulo_comentario', item_id: 'b', motivo: 'Spam', estado: 'revisado', automatico: true, creado_en: '2026-10-02', contenido_existe: false },
  ],
  gastos: [], ordenes: [], traducciones: {},
};
const SEMILLA = { id: '11111111-1111-4111-8111-111111111111', titulo: 'Vergüenza', texto: 'La gente cambia por vergüenza.', etiquetas: ['cambio'], estado: 'semilla', analisis: {}, desarrollos: [], desactualizados: [], actualizado_en: '2026-10-23' };
w.confirm = () => true; // la Cazadora pide confirmar antes de gastar en busquedas
const fetchBase = async (url, opts = {}) => {
  const u = String(url);
  if (/\/api\/semillas\/[^/]+\/desarrollar$/.test(u)) {
    const d = { id: '33333333-3333-4333-8333-333333333333', formato: 'columna', titulo: 'La verguenza que mueve', resumen: 'Un resumen.', idioma: 'es', texto_hash: 'h', parrafos: [[{ texto: 'La gente cambia por verguenza.', origen: 'autor' }, { texto: ' Imagina que si.', origen: 'farolera' }]], notas: ['Falta una fuente.'], datos_a_verificar: [], palabras: { autor: 5, farolera: 3, porcentaje_autor: 63 } };
    DESARROLLOS.push(d);
    return { ok: true, status: 200, json: async () => ({ ok: true, estado: 'en_desarrollo', desarrollo: d }) };
  }
  if (/\/api\/semillas\/[^/]+\/pasar-a-contenidos$/.test(u)) {
    CONTENIDO_DE_LA_SEMILLA.id = 'la-verguenza-que-mueve';
    return { ok: true, status: 201, json: async () => ({ ok: true, estado: 'pasada', contenido: { id: 'la-verguenza-que-mueve', titulo: 'La verguenza que mueve', publicado: false } }) };
  }
  if (/\/api\/semillas\/[^/]+\/agentes\/cazadora$/.test(u)) {
    return { ok: true, status: 200, json: async () => ({ ok: true, agente: 'cazadora', estado: 'explorada', analisis: { texto_hash: 'h', creado_en: '2026-10-24', resultado: { consultas: ['verguenza'], busquedas: 1, descartadas: 1, ecos: [{ autor: 'Autora Real', titulo: 'Sobre la verguenza', anio: '2010', url: 'https://editorial.com/obra', cita: 'La verguenza es un sentimiento revolucionario', relacion: 'coincide', porque: 'Comparte la tesis.', verificada: true }] } } }) };
  }
  if (/\/api\/semillas\/[^/]+\/agentes\/contrapunto$/.test(u)) {
    return { ok: true, status: 200, json: async () => ({ ok: true, agente: 'contrapunto', estado: 'explorada', analisis: { texto_hash: 'h', creado_en: '2026-10-24', resultado: { postura_contraria: 'Los argumentos si convencen.', objeciones: [{ objecion: 'Generaliza', fuerza: 'alta', fragmento: '', respuesta_posible: 'Matizar.' }], casos_limite: [], lo_que_resiste: [], preguntas_incomodas: ['¿Que evidencia tienes?'] } } }) };
  }
  if (/\/api\/semillas\/[^/]+\/agentes\/grieta$/.test(u)) {
    return { ok: true, status: 200, json: async () => ({ ok: true, agente: 'grieta', estado: 'explorada', analisis: { texto_hash: 'h', creado_en: '2026-10-23', resultado: { tema: 'Vergüenza', etiquetas: [], tesis: 'La gente cambia por vergüenza.', suposiciones: [], grietas: [{ grieta: 'Se contradice', por_que: 'Paraliza.', fragmento: '' }], oro: [], preguntas: [], direcciones: [] } } }) };
  }
  if (/\/api\/semillas\/[^/]+$/.test(u) && !opts.method) return { ok: true, status: 200, json: async () => ({ ok: true, semilla: SEMILLA }) };
  if (/\/api\/semillas\/[^/]+$/.test(u) && opts.method === 'PUT') return { ok: true, status: 200, json: async () => ({ ok: true, semilla: { ...SEMILLA, ...JSON.parse(opts.body) } }) };
  if (u.endsWith('/api/semillas') && opts.method === 'POST') return { ok: true, status: 201, json: async () => ({ ok: true, semilla: SEMILLA }) };
  if (u.includes('/api/semillas')) return { ok: true, status: 200, json: async () => ({ ok: true, semillas: [{ id: SEMILLA.id, titulo: 'Vergüenza', extracto: 'La gente cambia...', etiquetas: [], estado: 'semilla', actualizado_en: '2026-10-23', agentes_que_la_analizaron: [] }] }) };
  const json = (o) => ({ ok: true, status: 200, json: async () => o });
  if (u.endsWith('/api/me')) return json({ ok: true, user: { id: 'u1', rol: 'admin' } });
  if (u.endsWith('/contenido-ia/resumir')) return json({ ok: true, resumen: 'Resumen escrito por la IA.' });
  if (u.endsWith('/corregir/varios')) {
    const items = JSON.parse(opts.body).items;
    return json({
      ok: true,
      resultados: items.map((it) => (it.id === 'ac-titulo'
        ? { id: it.id, textoCorregido: 'Un título corregido', cambios: [{ antes: 'titulo', despues: 'título', motivo: 'tilde' }] }
        : { id: it.id, textoCorregido: it.texto, cambios: [] })),
    });
  }
  if (u.endsWith('/brigada/duplicados')) {
    return json({
      ok: true, revisadas: 3,
      candidatas: [{ tipo: 'noticia', id: 'n1', titulo: 'Noticia de prueba', publicado: false, fecha: '2026-10-01', similitud: 0.9, nivel: 'muy_probable', razones: ['Usa la misma fuente (la misma página).'] }],
    });
  }
  if (u.endsWith('/brigada/pintar')) {
    return json({ ok: true, textoAlternativo: 'Un farol encendido sobre la Luna.', escena: 'A lantern on the moon.', promptImagen: 'A lantern on the moon. Estilo fijo.' });
  }
  if (u.endsWith('/brigada/revisar')) {
    return json({
      ok: true,
      copia: { evaluable: true, porcentaje: 31, nivel: 'alto', pasajes: [{ texto: 'una frase copiada de la fuente', palabras: 12 }] },
      revision: { banderas: [{ tipo: 'persona_real', gravedad: 'media', motivo: 'Nombra a una persona.', fragmento: 'Juan Pérez' }], requiere18: false, motivo18: 'No es explícito.' },
    });
  }
  if (u.endsWith('/brigada/clasificar')) {
    return json({
      ok: true, url: 'https://medio.com/nota', formatoOriginal: 'video',
      sugerencias: {
        seccion: { valor: 'educacion', motivo: 'Trata de leyes escolares.', confianza: 'alta' },
        clasificacion: { valor: 'leyes-educativas', motivo: 'Habla de una ley.', confianza: 'media' },
        region: { valor: null, motivo: 'No se encontró en la fuente.', confianza: 'baja' },
        formato: { valor: 'ensayo', motivo: 'Versión propia.', confianza: 'media' },
        subformato: { valor: null, duda: 'opinion', motivo: 'Quizá.', confianza: 'baja' },
      },
    });
  }
  if (u.endsWith('/contenido-ia/metadatos-fuente')) return json({ ok: true, autorFuente: 'Ana Pérez', anio: '2025', tituloOriginal: '', nombreFuente: 'BBC' });
  return json({ ok: true, ...DATOS });
};

// El servidor simulado recuerda los analisis de las agentes del Taller, como la base de datos real: los siguientes
// GET/PUT de la semilla los devuelven.
const GUARDADO = {};
const DESARROLLOS = [];
const CONTENIDO_DE_LA_SEMILLA = { id: null };
w.fetch = async (url, opts = {}) => {
  const r = await fetchBase(url, opts);
  const cuerpo = await r.json();
  const agente = /\/api\/semillas\/[^/]+\/agentes\/(\w+)$/.exec(String(url));
  if (agente) GUARDADO[agente[1]] = cuerpo.analisis;
  if (cuerpo.semilla) cuerpo.semilla = { ...cuerpo.semilla, analisis: { ...GUARDADO }, desarrollos: [...DESARROLLOS], desarrollos_desactualizados: [], contenido_id: CONTENIDO_DE_LA_SEMILLA.id };
  return { ok: r.ok, status: r.status, json: async () => cuerpo };
};

for (const f of ['ia-herramientas.js', 'editorial.js', 'citas.js', 'clasificacion.js', 'correccion.js', 'taller.js', 'admin.js']) {
  try { w.eval(fs.readFileSync(path.join(F, f), 'utf8')); } catch (e) { errores.push(`carga ${f}: ${e.message}`); }
}
// jsdom dispara DOMContentLoaded por si solo al terminar de leer el documento: no se dispara a mano (se iniciaria dos veces).

setTimeout(() => {
  const d = w.document;
  const texto = (id) => (d.getElementById(id) ? d.getElementById(id).textContent : '');
  const comprobaciones = [
    ['el panel se muestra', d.getElementById('admin-panel').style.display === 'block'],
    ['la lista de noticias se pinta', texto('admin-noticias-list').includes('Noticia de prueba')],
    ['la lista de contenidos se pinta y marca el borrador', texto('admin-contenidos-list').includes('Contenido de prueba') && texto('admin-contenidos-list').includes('Borrador')],
    ['la lista de productos se pinta', texto('admin-productos-list').includes('Producto de prueba')],
    ['Reportes muestra el pendiente con su texto', texto('admin-reportes-list').includes('Texto reportado') && !texto('admin-reportes-list').includes('Spam')],
    ['los filtros de Reportes llevan contador', d.querySelector('#admin-reportes-filtros [data-filtro="todos"] .reportes-cuenta').textContent === '2'],
    ['los campos llevan la barra de correctores', d.querySelectorAll('.corr-barra').length >= 10],
    ['La Brigada Coquí pinta su elenco y existe la pestaña Seguridad', d.querySelectorAll('#brigada-elenco .ag-agente').length === 14 && !!d.getElementById('admin-panel-seguridad')],
  ];
  // Botones de IA del formulario de Contenidos: «Resumir con IA» y «Rellenar desde la URL».
  d.getElementById('ac-cuerpo').value = 'Un texto largo para resumir.';
  d.getElementById('ac-resumir-ia').click();
  d.getElementById('brigada-url-contenido').value = 'https://medio.com/nota';
  d.getElementById('brigada-citar-contenido').click();
  // Doña Fichas (Brigada Coquí): abre el formulario, la persona elige el formato a mano y luego pide clasificar.
  d.getElementById('admin-contenidos-new').click();
  const formato = d.getElementById('ac-tipo-formato');
  formato.value = 'audio';
  formato.dispatchEvent(new w.Event('change', { bubbles: true }));
  d.getElementById('brigada-url-contenido').value = 'https://medio.com/nota';
  d.getElementById('brigada-clasificar-contenido').click();
  setTimeout(() => {
    const marcaDe = (id) => { const m = d.getElementById(id).parentElement.querySelector(`.brigada-marca[data-campo="${id}"]`); return m ? m.textContent : ''; };
    comprobaciones.push(
      ['Doña Fichas rellena sección y sub-sección con su marca 🤖 y no toca el idioma de la pieza',
        d.getElementById('ac-idioma-original').value === 'es' && d.getElementById('ac-seccion').value === 'educacion'
        && d.getElementById('ac-clasificacion').value === 'leyes-educativas' && marcaDe('ac-seccion').includes('🤖 Doña Fichas sugirió')],
      ['no pisa lo que la persona eligió a mano', formato.value === 'audio' && marcaDe('ac-tipo-formato').includes('lo elegiste tú')],
      ['avisa «no encontrado» en lo que no sabe y la duda en lo inseguro', marcaDe('ac-enfoque').includes('⚠️') && marcaDe('ac-subformato').includes('hay duda')],
      ['ofrece deshacer y lo muestra', d.getElementById('brigada-deshacer-contenido').hidden === false],
    );
    d.getElementById('brigada-deshacer-contenido').click();
    comprobaciones.push(
      ['Deshacer devuelve los campos y quita las marcas',
        d.getElementById('ac-seccion').value === 'noticias' && marcaDe('ac-seccion') === ''],
    );
  }, 300);
  // Recomendacion de la mesa y La Guardiana (informe con parecido y banderas).
  // Taller de Aliado: la lista se pinta, se escribe una semilla nueva y La Grieta la guarda y la analiza.
  d.getElementById('taller-nueva').click();
  d.getElementById('ts-texto').value = 'La gente cambia por vergüenza.';
  d.getElementById('taller-grieta').click();
  d.getElementById('brigada-url-contenido').value = 'https://www.youtube.com/watch?v=abc';
  d.getElementById('brigada-url-contenido').dispatchEvent(new w.Event('blur'));
  d.getElementById('ac-cuerpo').value = 'Un cuerpo con texto para revisar.';
  d.getElementById('brigada-revisar-contenido').click();
  d.getElementById('brigada-duplicados-btn-contenido').click();
  d.getElementById('brigada-pintar-contenido').click();
  d.getElementById('ac-titulo').value = 'Un titulo sin tilde';
  d.getElementById('brigada-corregir-contenido').click();
  setTimeout(() => {
    comprobaciones.push(
      ['la mesa recomienda según la URL (video: solo clasificar y citar)', d.getElementById('brigada-recomendacion-contenido').textContent.includes('Pega su transcripción')],
      ['La Guardiana muestra el parecido con la fuente y las banderas',
        !d.getElementById('brigada-revision-contenido').hidden && d.getElementById('brigada-revision-contenido').textContent.includes('31% de la pieza')
        && d.getElementById('brigada-revision-contenido').textContent.includes('Persona real')],
    );
    comprobaciones.push(
      ['El Taller pinta la lista de semillas', d.getElementById('taller-lista').textContent.includes('Vergüenza')],
      ['La Grieta guarda la semilla y muestra su análisis', !d.getElementById('taller-resultados').hidden && d.getElementById('taller-resultados').textContent.includes('Se contradice')
        && d.getElementById('taller-estado').textContent.includes('La Grieta terminó')],
    );
    comprobaciones.push(
      ['Doña Tilde propone la corrección del título y «Aplicar» la pone', (() => {
        const boton = d.querySelector('#brigada-correccion-contenido [data-aplicar="ac-titulo"]');
        if (!boton) return false;
        boton.click();
        return d.getElementById('ac-titulo').value === 'Un título corregido';
      })()],
      ['cada agente de la mesa muestra su descripción', [...d.querySelectorAll('#brigada-agentes-contenido .brigada-agente-desc')].every((p) => p.textContent.length > 20)
        && d.querySelectorAll('#brigada-agentes-contenido .brigada-agente-desc').length === 9],
      ['El Detective lista la pieza parecida y deja abrirla', d.getElementById('brigada-duplicados-contenido').textContent.includes('Muy probable (90%)') && !!d.querySelector('#brigada-duplicados-contenido [data-abrir-id="n1"]')],
      ['La Pintora muestra su propuesta y «Usar» la pone en el texto alternativo', (() => {
        d.querySelector('#brigada-pintora-contenido [data-accion="usar-alt"]').click();
        return d.getElementById('brigada-pintora-contenido').textContent.includes('A lantern on the moon') && d.getElementById('ac-portada-alt').value === 'Un farol encendido sobre la Luna.';
      })()],
    );
  }, 600);
  setTimeout(() => {
    comprobaciones.push(
      ['Resumir con IA escribe el resumen', d.getElementById('ac-subtitulo').value === 'Resumen escrito por la IA.'],
      ['Rellenar desde la URL llena autor, año y medio, y deja vacío lo que la página no declara',
        d.getElementById('ac-cita-autor').value === 'Ana Pérez' && d.getElementById('ac-cita-anio').value === '2025'
        && d.getElementById('ac-fuente-texto').value === 'BBC' && d.getElementById('ac-cita-titulo-original').value === ''],
    );
    const fallos = comprobaciones.filter(([, ok]) => !ok).map(([n]) => `FALLA: ${n}`);
    const todo = fallos.concat(errores);
    console.log(todo.length ? todo.join('\n') : 'OK: el panel arranca sin errores');
    process.exit(todo.length ? 1 : 0);
  }, 1400);
  // Las otras dos agentes del Taller, una despues de otra (comparten la semilla abierta).
  setTimeout(() => d.getElementById('taller-contrapunto').click(), 650);
  setTimeout(() => d.getElementById('taller-cazadora').click(), 750);
  setTimeout(() => {
    const r = texto('taller-resultados');
    comprobaciones.push(
      ['El Contrapunto muestra la postura contraria y sus objeciones', r.includes('Los argumentos si convencen.') && r.includes('Generaliza') && r.includes('Fuerte')],
      ['La Cazadora muestra el eco verificado con su enlace y el informe de La Grieta sigue ahi',
        r.includes('Autora Real') && r.includes('Cita verificada') && !!d.querySelector('#taller-resultados a[href="https://editorial.com/obra"]') && r.includes('Se contradice')],
      ['hay un cuadro de informe por agente', d.querySelectorAll('#taller-resultados .taller-informe').length === 3],
    );
  }, 880);
  // La Farolera desarrolla la idea (borrador con lo suyo marcado) y el borrador se pasa a Contenidos.
  setTimeout(() => d.getElementById('taller-farolera').click(), 900);
  setTimeout(() => {
    const b = d.getElementById('taller-desarrollos');
    comprobaciones.push(
      ['La Farolera deja su borrador con lo del autor y lo suyo marcado, y avisa que falta una fuente',
        b.textContent.includes('La gente cambia por verguenza.') && b.querySelectorAll('.taller-del-autor').length >= 1 && b.querySelectorAll('.taller-borrador mark.taller-de-farolera').length === 1 && b.textContent.includes('Falta una fuente.')],
    );
    const pasar = b.querySelector('[data-accion=pasar]');
    if (pasar) pasar.click();
  }, 1100);
  setTimeout(() => {
    const b = d.getElementById('taller-desarrollos');
    comprobaciones.push(
      ['«Pasar a Contenidos» crea el borrador y la semilla queda como pasada, sin botón para pasarla otra vez',
        b.textContent.includes('ya pasó a Contenidos') && !b.querySelector('[data-accion=pasar]') && d.getElementById('ts-estado').value === 'pasada' && texto('taller-estado').includes('quedó como borrador')],
    );
  }, 1300);
  // Otras fuentes del formulario de Contenidos: se agregan (hasta 4), se llenan y se leen limpias, y se quitan.
  setTimeout(() => {
    const agregar = d.getElementById('fuentes-extra-agregar-contenido');
    for (let i = 0; i < 6; i += 1) agregar.click();
    const filas = () => d.querySelectorAll('#fuentes-extra-lista-contenido .fuente-extra-fila');
    const tope = filas().length === 4 && agregar.disabled;
    filas()[0].querySelector('.fe-url').value = 'https://www.bbc.com/mundo/nota';
    filas()[1].querySelector('.fe-nombre').value = 'Libro de Freire';
    filas()[0].querySelector('.fe-quitar').click();
    comprobaciones.push(
      ['Otras fuentes: se agregan hasta 4, el botón se desactiva y se pueden quitar', tope && filas().length === 3 && !agregar.disabled],
      ['Otras fuentes: las filas se llenan y quedan en el formulario', filas()[0].querySelector('.fe-nombre').value === 'Libro de Freire'],
    );
  }, 1350);
}, 1500);
