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
w.fetch = async (url) => {
  const u = String(url);
  const json = (o) => ({ ok: true, status: 200, json: async () => o });
  if (u.endsWith('/api/me')) return json({ ok: true, user: { id: 'u1', rol: 'admin' } });
  if (u.endsWith('/contenido-ia/resumir')) return json({ ok: true, resumen: 'Resumen escrito por la IA.' });
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

for (const f of ['ia-herramientas.js', 'editorial.js', 'citas.js', 'clasificacion.js', 'correccion.js', 'admin.js']) {
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
    ['La Brigada Coquí pinta su elenco y existe la pestaña Seguridad', d.querySelectorAll('#brigada-elenco .ag-agente').length === 10 && !!d.getElementById('admin-panel-seguridad')],
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
  }, 700);
}, 1500);
