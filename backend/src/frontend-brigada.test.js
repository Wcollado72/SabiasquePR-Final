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
    // Las agentes del Contenido tienen su nivel; las del Taller viven en su propia pestaña.
    ELENCO_BRIGADA.filter((a) => a.estado === 'activa' && a.lugar !== 'taller').forEach((a) => expect(niveles).toContain(a.nivel));
    ELENCO_BRIGADA.filter((a) => a.lugar === 'taller').forEach((a) => expect(a.nivel).toBeUndefined());
    ELENCO_BRIGADA.filter((a) => a.estado === 'proxima').forEach((a) => expect(a.nivel).toBeUndefined());
    expect(ELENCO_BRIGADA.filter((a) => a.estado === 'activa').map((a) => a.id)).toEqual(
      ['investigadora', 'clasificadora', 'redactora', 'resumidora', 'bibliotecaria', 'correctora', 'traductora', 'guardiana', 'detective', 'pintora', 'grieta']
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
    expect((h.match(/próximamente/g) || []).length).toBe(3); // las otras tres agentes del Taller
    const conIa = ELENCO_BRIGADA.filter((a) => a.uso);
    expect(conIa.map((a) => a.id)).toEqual(['investigadora', 'clasificadora', 'redactora', 'resumidora', 'correctora', 'traductora', 'guardiana', 'pintora', 'grieta', 'cazadora', 'contrapunto', 'farolera']);
    conIa.forEach((a) => expect(h).toContain(`id="ag-uso-${a.id}" data-uso="${a.uso}"`));
    expect((h.match(/Sin IA: no gasta\./g) || []).length).toBe(2); // Bibliotecaria y Detective
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
    expect(r.agentes).toEqual(['detective', 'investigadora', 'clasificadora', 'redactora', 'correctora', 'bibliotecaria', 'pintora', 'guardiana']);
    expect(r.mensaje).toContain('equipo completo');
  });

  test('un video o un audio sin texto pegado: solo lo que se puede hacer con la URL, y se explica por qué', () => {
    const r = f.recomendarBrigada('https://www.youtube.com/watch?v=abc', '');
    expect(r.agentes).toEqual(['detective', 'clasificadora', 'bibliotecaria']);
    expect(r.formato).toBe('video');
    expect(r.mensaje).toContain('Pega su transcripción');
    expect(f.recomendarBrigada('https://open.spotify.com/episode/1', '').formato).toBe('audio');
  });

  test('un video con su transcripción pegada: equipo completo', () => {
    expect(f.recomendarBrigada('https://youtu.be/abc', 'Texto de la transcripción').agentes).toHaveLength(8);
  });

  test('solo texto pegado, sin URL: las que no necesitan una URL (Doña Fichas y La Bibliotecaria sí la necesitan)', () => {
    expect(f.recomendarBrigada('', 'Un texto').agentes).toEqual(['detective', 'investigadora', 'redactora', 'correctora', 'pintora', 'guardiana']);
  });

  test('sin nada no hay recomendación, y una URL inválida se avisa', () => {
    expect(f.recomendarBrigada('', '  ')).toBeNull();
    expect(f.recomendarBrigada('no es una url', '').agentes).toEqual([]);
  });

  test('los pasos siempre salen en el orden de trabajo y ninguna agente se repite', () => {
    expect(f.pasosEquipo(['guardiana', 'pintora', 'bibliotecaria', 'investigadora', 'detective'])).toEqual(['detective', 'investigadora', 'bibliotecaria', 'pintora', 'guardiana']);
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

describe('El Detective en el panel', () => {
  const { htmlDuplicados, hayCoincidenciaFuerte } = new Function(`${entre(js, 'brigada-detective-pintora')}
    return { htmlDuplicados, hayCoincidenciaFuerte };`)();
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');

  test('lista las parecidas con nivel, tipo, estado y razones, y deja abrir la existente (sin HTML peligroso)', () => {
    const h = htmlDuplicados({
      revisadas: 12,
      candidatas: [
        { tipo: 'noticia', id: 'luna', titulo: 'La NASA <b>halla</b> un cráter', publicado: true, fecha: '2026-09-16', similitud: 0.92, nivel: 'muy_probable', razones: ['Usa la misma fuente (la misma página).'] },
        { tipo: 'contenido', id: 'ensayo', titulo: 'Otro', publicado: false, fecha: null, similitud: 0.45, nivel: 'posible', razones: ['El título es muy parecido (45%).'] },
      ],
    }, esc);
    expect(h).toContain('Muy probable (92%)');
    expect(h).toContain('Noticia · Publicada');
    expect(h).toContain('Contenido · Borrador');
    expect(h).toContain('La NASA &lt;b>halla&lt;/b> un cráter');
    expect(h).toContain('data-abrir-tipo="noticia" data-abrir-id="luna"');
    expect(h).toContain('brigada-bandera-alta');
    expect(h).toContain('solo avisa');
  });

  test('sin parecidas lo dice, con cuántas piezas revisó', () => {
    expect(htmlDuplicados({ revisadas: 40, candidatas: [] }, esc)).toContain('entre las 40 piezas');
  });

  test('solo una coincidencia «muy probable» detiene el equipo para preguntar', () => {
    expect(hayCoincidenciaFuerte([{ nivel: 'posible' }, { nivel: 'probable' }])).toBe(false);
    expect(hayCoincidenciaFuerte([{ nivel: 'probable' }, { nivel: 'muy_probable' }])).toBe(true);
    expect(hayCoincidenciaFuerte([])).toBe(false);
  });

  test('hay un botón en cada mesa, llama al servidor, excluye la pieza que se edita y abre la existente con confirmación', () => {
    ['contenido', 'noticia'].forEach((c) => {
      expect(html).toMatch(new RegExp(`<button type="button" class="brigada-agente" id="brigada-duplicados-btn-${c}"`));
      expect(html).toContain(`id="brigada-duplicados-${c}"`);
    });
    expect(js).toContain('/api/admin/brigada/duplicados');
    expect(js).toContain('cuerpo.excluir = { tipo: cfg.detective.tipo, id: idActual }');
    expect(js).toMatch(/function abrirExistente\(tipo, id\) \{\s+if \(!confirm\(/);
  });

  test('en el equipo va primero y, si hay una coincidencia muy probable, pregunta antes de gastar IA', () => {
    expect(js).toContain("detective: () => detectiveAntesDelEquipo()");
    const antes = js.slice(js.indexOf('async function detectiveAntesDelEquipo'), js.indexOf('// Cierra el formulario actual'));
    expect(antes).toContain('hayCoincidenciaFuerte(data.candidatas)');
    expect(antes).toContain('return confirm(');
  });
});

describe('La Pintora en el panel', () => {
  const { htmlPintora } = new Function(`${entre(js, 'brigada-detective-pintora')}
    return { htmlPintora };`)();
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');

  test('muestra el texto alternativo, la escena y el prompt completo con sus botones, sin escribir nada solo', () => {
    const h = htmlPintora({ textoAlternativo: 'Un farol <i>encendido</i>.', escena: 'A lantern.', promptImagen: 'A lantern. Estilo.' }, esc);
    expect(h).toContain('Un farol &lt;i>encendido&lt;/i>.');
    expect(h).toContain('data-accion="usar-alt"');
    expect(h).toContain('data-accion="copiar-prompt"');
    expect(h).toContain('<textarea class="brigada-pintora-prompt" rows="5" readonly>A lantern. Estilo.</textarea>');
    expect(h).toContain('no genera la imagen');
    expect(h).toContain('Nada se escribe en el formulario hasta que pulses');
  });

  test('hay botón en cada mesa y una mini-tarjeta junto al texto alternativo; «Usar» pide confirmación si ya hay uno escrito', () => {
    ['contenido', 'noticia'].forEach((c) => {
      expect(html).toMatch(new RegExp(`<button type="button" class="brigada-agente" id="brigada-pintar-${c}"`));
      expect(html).toContain(`id="brigada-pintora-${c}"`);
    });
    expect(html).toContain('id="ac-pintora-alt"');
    expect(html).toContain('id="an-pintora-alt"');
    expect(js).toContain('/api/admin/brigada/pintar');
    expect(js).toContain("if (alt.value.trim() && !confirm('Ya hay un texto alternativo escrito.");
  });

  test('va en el equipo justo antes de la Guardiana, y usa el idioma de la pieza', () => {
    expect(js).toContain("pintora: () => pintarConPintora('contenido')");
    expect(js).toContain('idioma: document.getElementById(cfg.idiomaPieza).value');
  });
});

describe('Doña Tilde: «Corregir todo»', () => {
  const { resumenCorreccionTodo, htmlCorreccionTodo } = new Function(`${entre(js, 'brigada-correctora')}
    return { resumenCorreccionTodo, htmlCorreccionTodo };`)();
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const etiquetas = { 'ac-titulo': 'Título', 'ac-cuerpo': 'Cuerpo del texto', 'ac-subtitulo': 'Resumen' };
  const resultados = [
    { id: 'ac-titulo', textoCorregido: 'La guagua llegó', cambios: [{ antes: 'llego', despues: 'llegó', motivo: 'tilde' }] },
    { id: 'ac-subtitulo', textoCorregido: 'Igual.', cambios: [] },
    { id: 'ac-cuerpo', textoCorregido: 'B', cambios: [{ antes: 'a<b', despues: 'a', motivo: '' }, { antes: 'x', despues: 'y', motivo: 'm' }] },
  ];

  test('el resumen cuenta los campos revisados, los que tienen correcciones y los que fallaron', () => {
    expect(resumenCorreccionTodo(resultados)).toBe('Doña Tilde revisó 3 campos: 2 con correcciones.');
    expect(resumenCorreccionTodo([{ id: 'a', cambios: [] }])).toBe('Doña Tilde revisó 1 campo: ninguno necesita correcciones.');
    expect(resumenCorreccionTodo([{ id: 'a', cambios: [] }, { id: 'b', error: 'x' }, { id: 'c', error: 'y' }])).toContain('2 no se pudieron revisar.');
  });

  test('solo lista los campos con cambios, con antes → después y motivo, y un «Aplicar» por campo y «Aplicar todo»', () => {
    const h = htmlCorreccionTodo(resultados, etiquetas, esc);
    expect(h).toContain('data-aplicar="ac-titulo"');
    expect(h).toContain('data-aplicar="ac-cuerpo"');
    expect(h).not.toContain('data-aplicar="ac-subtitulo"');
    expect(h).toContain('<del>llego</del> → <ins>llegó</ins>');
    expect(h).toContain('(tilde)');
    expect(h).toContain('<del>a&lt;b</del>');
    expect(h).toContain('data-aplicar-todo');
    expect(h).toContain('nada cambia hasta que pulses');
  });

  test('con un solo campo corregido no ofrece «Aplicar todo»; un campo que falló se muestra con su motivo', () => {
    const h = htmlCorreccionTodo([resultados[0], { id: 'ac-cuerpo', error: 'El texto es demasiado largo.' }], etiquetas, esc);
    expect(h).not.toContain('data-aplicar-todo');
    expect(h).toContain('Cuerpo del texto</strong>: El texto es demasiado largo.');
  });

  test('hay un botón en cada mesa, llama al servidor con la variante de cada campo y no pisa lo que cambió mientras corregía', () => {
    ['contenido', 'noticia'].forEach((c) => {
      expect(html).toMatch(new RegExp(`<button type="button" class="brigada-agente" id="brigada-corregir-${c}"`));
      expect(html).toContain(`id="brigada-correccion-${c}"`);
    });
    expect(js).toContain('/api/admin/corregir/varios');
    expect(js).toContain('ui.varianteDe(id, idioma)');
    expect(js).toContain('if (el.value !== enviados[id]) { alert(');
    expect(js).toContain("correctora: () => corregirTodoConTilde('contenido')");
  });

  test('la variante sigue al idioma de la pieza mientras la persona no haya elegido otra a mano', () => {
    const corr = fs.readFileSync(path.join(frontend, 'correccion.js'), 'utf8');
    expect(corr).toContain('varianteDe(id, idiomaPieza)');
    expect(corr).toContain("if (select.dataset.manual || leerLS(LS_VAR + id, '')) return select.value;");
  });
});

describe('cada agente trae una pequeña descripción de sus funciones', () => {
  const { ELENCO_BRIGADA, htmlElenco } = new Function(`${entre(js, 'elenco-brigada')}
    return { ELENCO_BRIGADA, htmlElenco };`)();

  test('todas las agentes del elenco tienen una descripción corta y propia', () => {
    ELENCO_BRIGADA.forEach((a) => {
      expect(typeof a.descripcion).toBe('string');
      expect(a.descripcion.length).toBeGreaterThan(20);
      expect(a.descripcion.length).toBeLessThanOrEqual(120);
    });
    const descripciones = ELENCO_BRIGADA.map((a) => a.descripcion);
    expect(new Set(descripciones).size).toBe(descripciones.length);
  });

  test('la tarjeta del elenco la muestra encima de sus tareas', () => {
    const h = htmlElenco(ELENCO_BRIGADA, (t) => String(t));
    ELENCO_BRIGADA.forEach((a) => expect(h).toContain(a.descripcion));
    expect(h.indexOf('ag-agente-resumen')).toBeLessThan(h.indexOf('ag-agente-tareas'));
  });

  test('en la mesa, cada botón de agente va dentro de una tarjeta con su descripción, que sale del elenco', () => {
    ['contenido', 'noticia'].forEach((clave) => {
      const mesa = html.slice(html.indexOf(`id="brigada-agentes-${clave}"`), html.indexOf(`id="brigada-estado-${clave}"`));
      const botones = (mesa.match(/class="brigada-agente" id="/g) || []).length;
      const tarjetas = (mesa.match(/class="brigada-agente-card"/g) || []).length;
      const descripciones = (mesa.match(/class="brigada-agente-desc" data-desc="/g) || []).length;
      expect(botones).toBeGreaterThan(0);
      expect(tarjetas).toBe(botones);
      expect(descripciones).toBe(botones);
      // cada descripción apunta a una agente que existe
      [...mesa.matchAll(/data-desc="([a-z]+)"/g)].forEach((m) => expect(ELENCO_BRIGADA.map((a) => a.id)).toContain(m[1]));
    });
    expect(js).toContain("document.querySelectorAll(`#brigada-agentes-${clave} [data-desc]`)");
  });

  test('en Noticias la descripción se adapta a una noticia rápida', () => {
    const por = (id) => ELENCO_BRIGADA.find((a) => a.id === id);
    expect(por('clasificadora').descripcionNoticia).toContain('categoría');
    expect(por('redactora').descripcionNoticia).toContain('primer borrador');
    expect(js).toContain("(clave === 'noticia' && agente.descripcionNoticia) || agente.descripcion");
  });
});

describe('el gasto de cada agente se cuenta con su propio nombre', () => {
  const { ELENCO_BRIGADA } = new Function(`${entre(js, 'elenco-brigada')}
    return { ELENCO_BRIGADA };`)();
  const { AGENTES_CON_REGISTRO } = require('./util/usoIa');

  test('cada nombre de uso del elenco es uno que la base de datos admite, y ninguno se repite', () => {
    const usos = ELENCO_BRIGADA.filter((a) => a.uso).map((a) => a.uso);
    expect(new Set(usos).size).toBe(usos.length);
    usos.forEach((u) => expect(AGENTES_CON_REGISTRO).toContain(u));
  });

  test('el panel de Gastos y el de uso tienen nombre para cada agente que gasta', () => {
    AGENTES_CON_REGISTRO.forEach((a) => expect(js).toContain(`${a}:`));
    expect(js).toContain("document.querySelectorAll('#brigada-elenco [data-uso]')");
    expect(js).toContain('incluye usos anteriores de otras agentes');
  });
});
