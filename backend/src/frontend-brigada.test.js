// La Brigada Coquí: mesa de agentes arriba de los formularios, una sola URL, una sola caja de idioma, cada función
// con una sola dueña (Investigadora, Clasificadora, Redactora, Resumidora, Bibliotecaria) y Doña Fichas.
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
const js = leer('admin.js');
const cuantos = (texto, id) => (texto.match(new RegExp(`id="${id}"`, 'g')) || []).length;
const niveles = (id) => {
  const nav = html.slice(html.indexOf(`id="${id}"`), html.indexOf('</nav>', html.indexOf(`id="${id}"`)));
  return [...nav.matchAll(/data-panel="([a-z]+)"/g)].map((m) => m[1]);
};

describe('orden de los niveles: los agentes primero', () => {
  test('Contenidos: Investigadora y Redactora, luego Clasificación, Contenido, Multimedia y Citación', () => {
    expect(niveles('synth-levels')).toEqual(['ia', 'clasificacion', 'contenido', 'multimedia', 'citacion']);
  });

  test('Noticias: la mesa de la Brigada hace de nivel de los agentes; Fuente (con «AL AIRE») va al final', () => {
    expect(niveles('news-levels')).toEqual(['clasificacion', 'contenido', 'multimedia', 'fuente']);
    expect(html).not.toContain('id="an-autocompletar-url"');
  });

  test('el panel visible al abrir una pieza nueva es el de los agentes y la numeración sigue el orden', () => {
    expect(html).toMatch(/<section class="synth-panel" data-panel="ia">/);
    expect(html).toMatch(/<section class="synth-panel" data-panel="clasificacion" hidden>/);
    ['NIVEL 1 — INVESTIGADORA Y REDACTORA', 'NIVEL 2 — CLASIFICACIÓN', 'NIVEL 3 — CONTENIDO', 'NIVEL 4 — MULTIMEDIA', 'NIVEL 5 — CITACIÓN']
      .forEach((t) => expect(html).toContain(t));
    expect(js).toContain("activarSynthPanel(item ? 'clasificacion' : 'ia')");
  });
});

describe('sin cajas repetidas: una sola URL y una sola caja de idioma', () => {
  test.each([
    ['contenido', ['ia-url', 'ia-titulo-sugerido', 'ia-idioma', 'ac-fuente-url']],
    ['noticia', ['an-autocompletar-url', 'an-fuente-url']],
  ])('%s: ya no existen las cajas viejas', (_, ids) => {
    ids.forEach((id) => expect(html).not.toContain(`id="${id}"`));
  });

  test('la URL de la fuente es una sola, la de la mesa (en Noticias sigue siendo obligatoria)', () => {
    expect(cuantos(html, 'brigada-url-contenido')).toBe(1);
    expect(cuantos(html, 'brigada-url-noticia')).toBe(1);
    expect(html).toMatch(/id="brigada-url-noticia" placeholder="https:\/\/\.\.\." required/);
  });

  test('el idioma de la pieza es una sola caja, en la mesa, y no está en la pestaña Clasificación', () => {
    ['ac-idioma-original', 'an-idioma-original'].forEach((id) => expect(cuantos(html, id)).toBe(1));
    const mesa = html.slice(html.indexOf('<section class="brigada-mesa"'), html.indexOf('id="synth-levels"'));
    expect(mesa).toContain('id="ac-idioma-original"');
    const clasif = html.slice(html.indexOf('<section class="synth-panel" data-panel="clasificacion"'), html.indexOf('<section class="synth-panel" data-panel="contenido"'));
    expect(clasif).not.toContain('idioma');
    expect(js).not.toContain("'ia-idioma'");
  });
});

describe('cada función tiene una sola dueña', () => {
  test('hay una mesa con la URL y las agentes en Contenidos y en Noticias', () => {
    ['contenido', 'noticia'].forEach((clave) => {
      expect(html).toContain(`id="brigada-url-${clave}"`);
      expect(html).toContain(`id="brigada-deshacer-${clave}"`);
      expect(html.indexOf(`id="brigada-url-${clave}"`)).toBeLessThan(html.indexOf(clave === 'contenido' ? 'id="synth-levels"' : 'id="news-levels"'));
    });
    ['investigar', 'clasificar', 'redactar', 'resumir', 'citar'].forEach((a) => expect(html).toMatch(new RegExp(`<button type="button" class="brigada-agente" id="brigada-${a}-contenido"`)));
    ['clasificar', 'redactar'].forEach((a) => expect(html).toMatch(new RegExp(`<button type="button" class="brigada-agente" id="brigada-${a}-noticia"`)));
  });

  test('la Investigadora no llena la cita ni la URL: solo guarda notas y detecta el idioma de la fuente', () => {
    const investigar = js.slice(js.indexOf('async function investigarFuente'), js.indexOf('function mostrarCorreccionesIa'));
    ['ac-cita-autor', 'ac-cita-anio', 'ac-cita-titulo-original', 'ac-cita-estilo', 'ac-fuente-texto', "'brigada-url-contenido').value ="]
      .forEach((trozo) => expect(investigar).not.toContain(trozo));
    expect(investigar).toContain("mostrarIdiomaFuente('contenido', data.idiomaDetectado)");
  });

  test('la Redactora escribe en el idioma de la pieza y no escribe el resumen: lo hace Doña Breve después', () => {
    const redactar = js.slice(js.indexOf('async function redactarConIA'), js.indexOf('function toggleCitationFields'));
    expect(redactar).toContain("idioma: document.getElementById('ac-idioma-original').value");
    expect(redactar).not.toContain("getElementById('ac-subtitulo').value =");
    expect(redactar).toContain('await resumirConIa(true)');
  });

  test('Resumir desde un clic sí pide confirmación si ya hay resumen; después de redactar no', () => {
    expect(js).toContain("addEventListener('click', () => resumirConIa(false))");
    expect(js).toContain('if (!automatico && resumen.value.trim() && !confirm(');
  });

  test('la Clasificadora ya no sugiere el idioma (ni en el panel ni en el servidor)', () => {
    const clasificadora = fs.readFileSync(path.join(__dirname, 'services', 'clasificadora.js'), 'utf8');
    expect(clasificadora).not.toMatch(/sugerencias\.idioma/);
    expect(js).toContain("const ORDEN_CLASIFICACION = ['seccion', 'clasificacion', 'region', 'formato', 'subformato'];");
  });

  test('los botones de la mesa llaman a las mismas funciones que ya existían', () => {
    expect(js).toContain("document.getElementById('brigada-investigar-contenido').addEventListener('click', () => { activarSynthPanel('ia'); investigarFuente(); });");
    expect(js).toContain("document.getElementById('brigada-citar-contenido').addEventListener('click', () => rellenarDesdeUrl(false));");
    expect(js).toContain("document.getElementById('brigada-redactar-noticia').addEventListener('click', autocompletarNoticiaConIA);");
    expect(js).toContain('/api/admin/brigada/clasificar');
  });
});

describe('Doña Fichas: qué se aplica y qué solo se avisa', () => {
  const f = new Function(`${entre(js, 'brigada-clasificadora')}
    return { planClasificacion, resumenClasificacion };`)();
  const s = {
    seccion: { valor: 'noticias', motivo: 'Es actualidad.', confianza: 'alta' },
    clasificacion: { valor: 'ciencia', motivo: 'Es ciencia.', confianza: 'media' },
    region: { valor: null, motivo: 'No se encontró en la fuente.', confianza: 'baja' },
    formato: { valor: null, duda: 'video', motivo: 'Quizá.', confianza: 'baja' },
    subformato: { valor: null, motivo: 'Ninguno aplica.', confianza: 'baja' },
  };

  test('aplica lo que tiene valor, en el orden de la pestaña, y avisa lo demás', () => {
    const plan = f.planClasificacion(s, []);
    expect(plan.aplicar.map((a) => a.campo)).toEqual(['seccion', 'clasificacion']);
    expect(plan.avisos.map((a) => [a.campo, a.tipo])).toEqual([
      ['region', 'no_encontrado'], ['formato', 'duda'], ['subformato', 'no_encontrado'],
    ]);
    expect(plan.avisos[1].texto).toContain('podría ser «video»');
  });

  test('no pisa lo que la persona ya eligió a mano', () => {
    const plan = f.planClasificacion(s, ['seccion']);
    expect(plan.aplicar.map((a) => a.campo)).toEqual(['clasificacion']);
    expect(plan.avisos.filter((a) => a.tipo === 'respetado').map((a) => a.campo)).toEqual(['seccion']);
  });

  test('en una noticia rápida solo existe la categoría', () => {
    const plan = f.planClasificacion({ clasificacion: s.clasificacion }, []);
    expect(plan.aplicar.map((a) => a.campo)).toEqual(['clasificacion']);
    expect(plan.avisos).toEqual([]);
  });

  test('el resumen cuenta lo sugerido, el formato de la fuente y lo que quedó sin sugerencia', () => {
    const plan = f.planClasificacion(s, []);
    const msg = f.resumenClasificacion(plan, 'video');
    expect(msg).toContain('Doña Fichas sugirió 2 campos: Sección, Sub-sección.');
    expect(msg).toContain('Formato de la fuente: video.');
    expect(msg).toContain('Sin sugerencia: Región, Tipo de formato, Subformato.');
    expect(f.resumenClasificacion({ aplicar: [], avisos: [] }, null)).toContain('no pudo sugerir ningún campo');
  });
});

describe('el elenco de La Brigada Coquí: una dueña por función', () => {
  const { ELENCO_BRIGADA, htmlElenco } = new Function(`${entre(js, 'elenco-brigada')}
    return { ELENCO_BRIGADA, htmlElenco };`)();
  const esc = (t) => String(t);

  test('cada agente es distinta y ninguna tarea se repite entre agentes', () => {
    const ids = ELENCO_BRIGADA.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    const tareas = ELENCO_BRIGADA.flatMap((a) => a.trabajo.map((t) => t.toLowerCase()));
    expect(new Set(tareas).size).toBe(tareas.length);
  });

  test('las agentes que ya trabajan tienen su pestaña; las que vienen después, no', () => {
    const niveles = ['ia', 'clasificacion', 'contenido', 'multimedia', 'citacion'];
    ELENCO_BRIGADA.filter((a) => a.estado === 'activa').forEach((a) => expect(niveles).toContain(a.nivel));
    ELENCO_BRIGADA.filter((a) => a.estado === 'proxima').forEach((a) => expect(a.nivel).toBeUndefined());
    expect(ELENCO_BRIGADA.filter((a) => a.estado === 'activa').map((a) => a.id)).toEqual(
      ['investigadora', 'clasificadora', 'redactora', 'resumidora', 'bibliotecaria', 'correctora', 'traductora', 'guardiana']
    );
  });

  test('el idioma se reparte: la Investigadora detecta el de la fuente, la Redactora usa el de la pieza, la Clasificadora no lo toca', () => {
    const por = (id) => ELENCO_BRIGADA.find((a) => a.id === id);
    expect(por('investigadora').trabajo.join(' ')).toContain('Detecta el idioma de la fuente');
    expect(por('redactora').trabajo.join(' ')).toContain('en el idioma de la pieza');
    expect(por('clasificadora').trabajo.join(' ')).not.toMatch(/idioma/i);
    expect(por('clasificadora').noHace).toContain('No decide el idioma');
  });

  test('se pinta una tarjeta por agente, con las próximas marcadas y el uso solo donde se mide', () => {
    const h = htmlElenco(ELENCO_BRIGADA, esc);
    expect((h.match(/data-agente=/g) || []).length).toBe(ELENCO_BRIGADA.length);
    expect((h.match(/próximamente/g) || []).length).toBe(2);
    expect(h).toContain('id="ag-ia-investigador-uso"');
    expect(h).toContain('id="ag-ia-redactor-uso"');
  });
});

describe('pestañas: La Brigada Coquí y Seguridad', () => {
  test('la pestaña de agentes se llama La Brigada Coquí y aparece Seguridad aparte', () => {
    expect(html).toContain('data-tab="agentes">🐸 La Brigada Coquí</button>');
    expect(html).toContain('data-tab="seguridad">Seguridad</button>');
    expect(html).toContain('id="admin-panel-seguridad"');
  });

  test('los agentes de seguridad y la moderación viven en Seguridad, no en la Brigada', () => {
    const brigada = html.slice(html.indexOf('id="admin-panel-agentes"'), html.indexOf('id="admin-panel-seguridad"'));
    const seguridad = html.slice(html.indexOf('id="admin-panel-seguridad"'), html.indexOf('id="admin-panel-gastos"'));
    expect(brigada).not.toContain('ag-seguridad-grid');
    expect(brigada).toContain('id="brigada-elenco"');
    expect(seguridad).toContain('id="ag-seguridad-grid"');
    expect(seguridad).toContain('id="ag-ir-reportes"');
    expect(seguridad).toContain('id="ag-reportes-resumen"');
  });

  test('el moderador ve Seguridad y Reportes, pero no la Brigada (son agentes de contenido)', () => {
    expect(js).toContain('.admin-tabs [data-tab="agentes"]');
    expect(js).toContain("document.getElementById('admin-panel-seguridad').style.display = tab === 'seguridad'");
  });
});

describe('recomendación y «Equipo completo»', () => {
  const f = new Function(`${entre(js, 'brigada-equipo')}
    return { recomendarBrigada, pasosEquipo, formatoDeHost };`)();

  test('un artículo: se recomienda el equipo completo, en orden de trabajo', () => {
    const r = f.recomendarBrigada('https://www.bbc.com/mundo/noticias-123', '');
    expect(r.agentes).toEqual(['investigadora', 'clasificadora', 'redactora', 'bibliotecaria', 'guardiana']);
    expect(r.mensaje).toContain('equipo completo');
  });

  test('un video o un audio sin texto pegado: solo lo que se puede hacer con la URL, y se explica por qué', () => {
    const r = f.recomendarBrigada('https://www.youtube.com/watch?v=abc', '');
    expect(r.agentes).toEqual(['clasificadora', 'bibliotecaria']);
    expect(r.formato).toBe('video');
    expect(r.mensaje).toContain('Pega su transcripción');
    expect(f.recomendarBrigada('https://open.spotify.com/episode/1', '').formato).toBe('audio');
  });

  test('un video con su transcripción pegada: equipo completo', () => {
    expect(f.recomendarBrigada('https://youtu.be/abc', 'Texto de la transcripción').agentes).toHaveLength(5);
  });

  test('solo texto pegado, sin URL: investigadora, redactora y guardiana (las otras necesitan una URL)', () => {
    expect(f.recomendarBrigada('', 'Un texto').agentes).toEqual(['investigadora', 'redactora', 'guardiana']);
  });

  test('sin nada no hay recomendación, y una URL inválida se avisa', () => {
    expect(f.recomendarBrigada('', '  ')).toBeNull();
    expect(f.recomendarBrigada('no es una url', '').agentes).toEqual([]);
  });

  test('los pasos siempre salen en el orden de trabajo y ninguna agente se repite', () => {
    expect(f.pasosEquipo(['guardiana', 'bibliotecaria', 'investigadora'])).toEqual(['investigadora', 'bibliotecaria', 'guardiana']);
    expect(f.formatoDeHost('m.youtube.com')).toBe('video');
    expect(f.formatoDeHost('notyoutube.com')).toBeNull();
  });

  test('el botón existe, pide confirmación (gasta IA) y se detiene si una agente falla', () => {
    expect(html).toMatch(/<button type="button" class="brigada-agente brigada-equipo" id="brigada-equipo-contenido"/);
    const equipo = js.slice(js.indexOf('async function equipoCompleto'), js.indexOf('// ── LA BRIGADA COQUÍ · La Guardiana'));
    expect(equipo).toContain('if (!confirm(');
    expect(equipo).toContain('if (!bien) {');
    expect(equipo).toContain('equipoEnMarcha');
  });

  test('cada agente avisa si terminó bien (así se pueden encadenar)', () => {
    ['async function investigarFuente', 'async function redactarConIA', 'async function resumirConIa', 'async function rellenarDesdeUrl', 'async function clasificarConBrigada'].forEach((nombre) => {
      const i = js.indexOf(nombre);
      const cuerpo = js.slice(i, js.indexOf('\n  }\n', i));
      expect(cuerpo).toContain('return true;');
      expect(cuerpo).toContain('return false;');
    });
  });
});

describe('La Guardiana en el panel', () => {
  const { veredictoCopia, htmlRevision } = new Function(`${entre(js, 'brigada-guardiana')}
    return { veredictoCopia, htmlRevision };`)();
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');

  test('el veredicto del parecido explica qué hacer según el nivel', () => {
    expect(veredictoCopia({ evaluable: true, nivel: 'bajo', porcentaje: 3 }).texto).toContain('con palabras propias');
    expect(veredictoCopia({ evaluable: true, nivel: 'medio', porcentaje: 14 }).texto).toContain('reescríbelos');
    expect(veredictoCopia({ evaluable: true, nivel: 'alto', porcentaje: 60 }).texto).toContain('Se parece demasiado');
    expect(veredictoCopia({ evaluable: false, motivo: 'La fuente es un video.' })).toEqual({ nivel: 'nd', texto: 'La fuente es un video.' });
  });

  test('el informe muestra banderas por gravedad, los pasajes copiados y el aviso de 18+, sin HTML peligroso', () => {
    const h = htmlRevision({
      copia: { evaluable: true, nivel: 'alto', porcentaje: 40, pasajes: [{ texto: 'frase <b>copiada</b>', palabras: 12 }] },
      revision: { banderas: [{ tipo: 'menores', gravedad: 'alta', motivo: 'Habla de un menor.', fragmento: 'un niño de 10' }], requiere18: true, motivo18: 'Es explícito.' },
    }, esc);
    expect(h).toContain('brigada-copia-alto');
    expect(h).toContain('frase &lt;b>copiada&lt;/b>');
    expect(h).toContain('brigada-bandera-alta');
    expect(h).toContain('Menores de edad');
    expect(h).toContain('Podría requerir 18+');
    expect(h).toContain('no sustituye a un abogado');
  });

  test('sin banderas lo dice; con parecido bajo no lista pasajes', () => {
    const h = htmlRevision({ copia: { evaluable: true, nivel: 'bajo', porcentaje: 2, pasajes: [{ texto: 'x', palabras: 8 }] }, revision: { banderas: [], requiere18: false, motivo18: '' } }, esc);
    expect(h).toContain('Sin banderas de contenido sensible');
    expect(h).not.toContain('brigada-revision-pasajes');
  });

  test('hay un botón de La Guardiana en la mesa de Contenidos y de Noticias, con su informe, y llama al servidor', () => {
    ['contenido', 'noticia'].forEach((c) => {
      expect(html).toMatch(new RegExp(`<button type="button" class="brigada-agente" id="brigada-revisar-${c}"`));
      expect(html).toContain(`id="brigada-revision-${c}"`);
    });
    expect(js).toContain('/api/admin/brigada/revisar');
  });
});

describe('La Bibliotecaria: formato de la cita', () => {
  test('propone el estilo y se puede copiar la cita; el formato lo arma citas.js (código, sin IA)', () => {
    expect(js).toContain("{ dato: 'estiloSugerido', id: 'ac-cita-estilo', nombre: 'Estilo de citación' }");
    expect(html).toContain('id="ac-cita-copiar"');
    expect(js).toContain('navigator.clipboard.writeText');
    expect(fs.readFileSync(path.join(frontend, 'citas.js'), 'utf8')).toContain('vancouver');
  });
});
