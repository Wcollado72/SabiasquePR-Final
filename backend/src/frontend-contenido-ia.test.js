// Formulario de Contenidos: «Resumir con IA», «Rellenar desde la URL» y etiquetas sin parentesis.
const fs = require('fs');
const path = require('path');

const frontend = path.join(__dirname, '..', '..', 'frontend');
const leer = (f) => fs.readFileSync(path.join(frontend, f), 'utf8');
const entre = (texto, inicio) => {
  const a = texto.indexOf(`// INICIO ${inicio}`);
  const b = texto.indexOf(`// FIN ${inicio}`);
  if (a < 0 || b < 0) throw new Error(`Faltan las marcas ${inicio}`);
  return texto.slice(a, b);
};
const html = leer('admin.html');

describe('etiquetas del formulario de Contenidos', () => {
  test.each([
    ['ac-subtitulo', 'Resumen'],
    ['ac-cuerpo', 'Cuerpo del texto'],
    ['ac-autor', 'Autor'],
    ['ac-fuente-texto', 'Nombre de la fuente'],
  ])('«%s» no lleva texto entre paréntesis', (id, etiqueta) => {
    expect(html).toContain(`<label for="${id}">${etiqueta}</label>`);
  });

  test('el Resumen no tiene tope de largo (solo un mínimo para que no se guarde vacío)', () => {
    const t = html.match(/<textarea id="ac-subtitulo"[^>]*>/)[0];
    expect(t).not.toMatch(/maxlength/i);
    expect(t).toContain('minlength="10"');
  });
});

describe('Rellenar desde la URL: qué se escribe', () => {
  const f = new Function(`${entre(leer('admin.js'), 'metadatos-fuente')}
    return { planRellenado, mensajeRellenado };`)();
  const vacias = { 'ac-cita-autor': '', 'ac-cita-anio': '', 'ac-cita-titulo-original': '', 'ac-fuente-texto': '' };

  test('rellena lo que la página trae y deja vacío (y avisa) lo que no', () => {
    const plan = f.planRellenado({ autorFuente: 'Ana', anio: '2025', tituloOriginal: '', nombreFuente: 'BBC' }, vacias, {});
    expect(plan.rellenar.map((r) => r.id)).toEqual(['ac-cita-autor', 'ac-cita-anio', 'ac-fuente-texto']);
    expect(plan.sinDato).toEqual(['Título del artículo original']);
    expect(f.mensajeRellenado(plan)).toContain('La página no lo declara (queda vacío): Título del artículo original.');
  });

  test('no pisa lo que escribió la persona, pero sí actualiza lo que puso el propio botón', () => {
    const actuales = { ...vacias, 'ac-cita-autor': 'Escrito por mí', 'ac-cita-anio': '2020' };
    const plan = f.planRellenado({ autorFuente: 'Ana', anio: '2025', tituloOriginal: 'T', nombreFuente: 'BBC' }, actuales, { 'ac-cita-anio': '2020' });
    expect(plan.respetadas).toEqual(['Autor de la fuente']);
    expect(plan.rellenar.map((r) => r.id)).toEqual(['ac-cita-anio', 'ac-cita-titulo-original', 'ac-fuente-texto']);
  });

  test('si la página no trae nada, no escribe nada', () => {
    const plan = f.planRellenado({}, vacias, {});
    expect(plan.rellenar).toEqual([]);
    expect(plan.sinDato).toHaveLength(4);
  });
});

describe('botones de IA del formulario', () => {
  test('existen y no envían el formulario', () => {
    expect(html).toMatch(/<button type="button" class="admin-btn-cancel" id="ac-resumir-ia"/);
    expect(html).toMatch(/<button type="button" class="admin-btn-cancel" id="ac-leer-url"/);
  });

  test('llaman a los endpoints del servidor y «Resumir» no pisa un resumen sin confirmar', () => {
    const js = leer('admin.js');
    expect(js).toContain('/api/admin/contenido-ia/resumir');
    expect(js).toContain('/api/admin/contenido-ia/metadatos-fuente');
    expect(js).toContain('Ya hay un resumen escrito. ¿Reemplazarlo por el que escriba la IA?');
  });
});
