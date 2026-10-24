// La Brigada Coquí, fase A: mesa de agentes arriba de los formularios, Investigador/Redactor primero y Doña Fichas
// (la Clasificadora) que sugiere los campos de la pestaña Clasificación.
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
const niveles = (id) => {
  const nav = html.slice(html.indexOf(`id="${id}"`), html.indexOf('</nav>', html.indexOf(`id="${id}"`)));
  return [...nav.matchAll(/data-panel="([a-z]+)"/g)].map((m) => m[1]);
};

describe('orden de los niveles: los agentes primero', () => {
  test('Contenidos: Investigador + Redactor, luego Clasificación, Contenido, Multimedia y Citación', () => {
    expect(niveles('synth-levels')).toEqual(['ia', 'clasificacion', 'contenido', 'multimedia', 'citacion']);
  });

  test('Noticias: Asistente IA primero y Fuente (donde está «AL AIRE») al final', () => {
    expect(niveles('news-levels')).toEqual(['ia', 'clasificacion', 'contenido', 'multimedia', 'fuente']);
  });

  test('el panel visible al abrir es el de los agentes y la numeración sigue el orden', () => {
    expect(html).toMatch(/<section class="synth-panel" data-panel="ia">/);
    expect(html).toMatch(/<section class="synth-panel" data-panel="clasificacion" hidden>/);
    ['NIVEL 1 — INVESTIGADOR + REDACTOR', 'NIVEL 2 — CLASIFICACIÓN', 'NIVEL 3 — CONTENIDO', 'NIVEL 4 — MULTIMEDIA', 'NIVEL 5 — CITACIÓN']
      .forEach((t) => expect(html).toContain(t));
    const js = leer('admin.js');
    expect(js).toContain("activarSynthPanel(item ? 'clasificacion' : 'ia')");
    expect(js).toContain("activarNewsPanel(item ? 'clasificacion' : 'ia')");
  });
});

describe('mesa de la Brigada Coquí', () => {
  test.each(['contenido', 'noticia'])('hay una mesa arriba del formulario de %s, con su URL y a Doña Fichas', (clave) => {
    expect(html).toContain(`id="brigada-url-${clave}"`);
    expect(html).toMatch(new RegExp(`<button type="button" class="brigada-agente" id="brigada-clasificar-${clave}"`));
    expect(html).toContain(`id="brigada-deshacer-${clave}"`);
    const mesa = html.indexOf(`id="brigada-url-${clave}"`);
    const nav = html.indexOf(clave === 'contenido' ? 'id="synth-levels"' : 'id="news-levels"');
    expect(mesa).toBeGreaterThan(-1);
    expect(mesa).toBeLessThan(nav);
  });

  test('llama al endpoint de la Clasificadora con el destino correcto', () => {
    const js = leer('admin.js');
    expect(js).toContain('/api/admin/brigada/clasificar');
    expect(js).toContain("destino: 'contenido'");
    expect(js).toContain("destino: 'noticia'");
  });
});

describe('Doña Fichas: qué se aplica y qué solo se avisa', () => {
  const f = new Function(`${entre(leer('admin.js'), 'brigada-clasificadora')}
    return { planClasificacion, resumenClasificacion };`)();
  const s = {
    idioma: { valor: 'es', motivo: 'La página declara el idioma «es».', confianza: 'alta' },
    seccion: { valor: 'noticias', motivo: 'Es actualidad.', confianza: 'alta' },
    clasificacion: { valor: 'ciencia', motivo: 'Es ciencia.', confianza: 'media' },
    region: { valor: null, motivo: 'No se encontró en la fuente.', confianza: 'baja' },
    formato: { valor: null, duda: 'video', motivo: 'Quizá.', confianza: 'baja' },
    subformato: { valor: null, motivo: 'Ninguno aplica.', confianza: 'baja' },
  };

  test('aplica lo que tiene valor, en el orden de la pestaña, y avisa lo demás', () => {
    const plan = f.planClasificacion(s, []);
    expect(plan.aplicar.map((a) => a.campo)).toEqual(['idioma', 'seccion', 'clasificacion']);
    expect(plan.avisos.map((a) => [a.campo, a.tipo])).toEqual([
      ['region', 'no_encontrado'], ['formato', 'duda'], ['subformato', 'no_encontrado'],
    ]);
    expect(plan.avisos[1].texto).toContain('podría ser «video»');
  });

  test('no pisa lo que la persona ya eligió a mano', () => {
    const plan = f.planClasificacion(s, ['idioma', 'clasificacion']);
    expect(plan.aplicar.map((a) => a.campo)).toEqual(['seccion']);
    expect(plan.avisos.filter((a) => a.tipo === 'respetado').map((a) => a.campo)).toEqual(['idioma', 'clasificacion']);
  });

  test('en una noticia rápida solo existen idioma y categoría', () => {
    const plan = f.planClasificacion({ idioma: s.idioma, clasificacion: s.clasificacion }, []);
    expect(plan.aplicar.map((a) => a.campo)).toEqual(['idioma', 'clasificacion']);
    expect(plan.avisos).toEqual([]);
  });

  test('el resumen cuenta lo sugerido, el formato de la fuente y lo que quedó sin sugerencia', () => {
    const plan = f.planClasificacion(s, []);
    const msg = f.resumenClasificacion(plan, 'video');
    expect(msg).toContain('Doña Fichas sugirió 3 campos: Idioma original, Sección, Sub-sección.');
    expect(msg).toContain('Formato de la fuente: video.');
    expect(msg).toContain('Sin sugerencia: Región, Tipo de formato, Subformato.');
    expect(f.resumenClasificacion({ aplicar: [], avisos: [] }, null)).toContain('no pudo sugerir ningún campo');
  });
});
