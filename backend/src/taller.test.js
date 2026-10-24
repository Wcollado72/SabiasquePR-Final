// Taller de Aliado Imperfekto (frontend/taller.js): funciones puras, markup y cableado en el panel.
const fs = require('fs');
const path = require('path');
const T = require('../../frontend/taller.js');

const frontend = path.join(__dirname, '..', '..', 'frontend');
const leer = (f) => fs.readFileSync(path.join(frontend, f), 'utf8');
const html = leer('admin.html');
const js = leer('admin.js');
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

describe('etiquetasDeTexto y tituloDe', () => {
  test('las etiquetas salen en minúscula, sin vacías ni repetidas, máximo 10', () => {
    expect(T.etiquetasDeTexto('Cambio, empatía ,, CAMBIO,  ')).toEqual(['cambio', 'empatía']);
    expect(T.etiquetasDeTexto('')).toEqual([]);
    expect(T.etiquetasDeTexto(Array.from({ length: 15 }, (_, i) => `e${i}`).join(','))).toHaveLength(10);
  });

  test('el título es el que se escribió, o el inicio de la idea, o «(sin título)»', () => {
    expect(T.tituloDe({ titulo: '  Vergüenza ' })).toBe('Vergüenza');
    expect(T.tituloDe({ titulo: '', extracto: 'La gente no cambia por argumentos sino por vergüenza, y eso es parte del problema que quiero explorar' })).toBe('La gente no cambia por argumentos sino por vergüenza, y eso…');
    expect(T.tituloDe({ titulo: '', texto: 'Corta' })).toBe('Corta');
    expect(T.tituloDe({})).toBe('(sin título)');
  });
});

describe('htmlListaSemillas', () => {
  const semillas = [
    { id: 'a1', titulo: 'Vergüenza <b>', estado: 'explorada', actualizado_en: '2026-10-23T10:00:00Z', agentes_que_la_analizaron: ['grieta'] },
    { id: 'b2', titulo: '', extracto: 'Otra idea', estado: 'semilla', actualizado_en: '2026-10-22', agentes_que_la_analizaron: [] },
  ];

  test('una tarjeta por semilla, con su estado, la fecha y una marca si La Grieta ya la analizó (sin HTML peligroso)', () => {
    const h = T.htmlListaSemillas(semillas, 'b2', esc);
    expect((h.match(/class="taller-semilla( activa)?"/g) || []).length).toBe(2);
    expect(h).toContain('Vergüenza &lt;b>');
    expect(h).toContain('🔎 Explorada');
    expect(h).toContain('2026-10-23 · 🏺');
    expect(h).toContain('class="taller-semilla activa" data-id="b2"');
    expect(h).toContain('data-id="a1"');
  });

  test('sin semillas invita a escribir la primera', () => {
    expect(T.htmlListaSemillas([], null, esc)).toContain('Nueva semilla');
  });
});

describe('htmlAnalisisGrieta', () => {
  const entrada = {
    resultado: {
      tema: 'Vergüenza y cambio', etiquetas: ['vergüenza', 'cambio'], tesis: 'La gente cambia por vergüenza.',
      suposiciones: ['Que los argumentos no sirven'],
      grietas: [{ grieta: 'Se contradice', por_que: 'Paraliza y mueve.', fragmento: 'la vergüenza también paraliza' }, { grieta: 'Vaga', por_que: 'Falta definir.', fragmento: '' }],
      oro: [{ oro: 'Un camino sin humillación', fragmento: 'un camino sin humillarnos' }],
      preguntas: ['¿Vergüenza o culpa?'],
      direcciones: [{ formato: 'ensayo', enfoque: 'La tensión vergüenza-parálisis.' }],
    },
  };

  test('muestra tesis, suposiciones, grietas con su cita, oro, preguntas y caminos', () => {
    const h = T.htmlAnalisisGrieta(entrada, false, esc);
    ['La gente cambia por vergüenza.', 'Que los argumentos no sirven', 'Se contradice', '«la vergüenza también paraliza»', 'Un camino sin humillación', '¿Vergüenza o culpa?', '<strong>Ensayo</strong>: La tensión vergüenza-parálisis.']
      .forEach((trozo) => expect(h).toContain(trozo));
    expect(h).not.toContain('Cambiaste la idea');
    expect(h).toContain('cada cita se comprueba contra tu texto');
  });

  test('una grieta sin cita no pone una cita vacía', () => {
    expect(T.htmlAnalisisGrieta(entrada, false, esc)).not.toContain('<em>«»</em>');
  });

  test('si la idea cambió después del análisis, lo avisa', () => {
    expect(T.htmlAnalisisGrieta(entrada, true, esc)).toContain('Cambiaste la idea después de este análisis');
  });

  test('escapa el HTML que venga en el análisis', () => {
    const peligrosa = JSON.parse(JSON.stringify(entrada));
    peligrosa.resultado.tesis = '<img src=x onerror=alert(1)>';
    expect(T.htmlAnalisisGrieta(peligrosa, false, esc)).not.toContain('<img');
  });
});

describe('htmlEcos', () => {
  const eco = { autor: 'Autora <b>', titulo: 'Sobre la vergüenza', anio: '2010', url: 'https://editorial.com/obra', cita: 'La vergüenza es un sentimiento revolucionario', relacion: 'matiza', porque: 'Agrega un matiz.', verificada: true };
  const entrada = { resultado: { consultas: ['vergüenza cambio'], busquedas: 2, descartadas: 3, ecos: [eco] } };

  test('muestra autor, obra con enlace seguro, año, relación, cita verificada y lo descartado', () => {
    const h = T.htmlEcos(entrada, false, esc);
    ['Autora &lt;b>', 'href="https://editorial.com/obra"', 'rel="noopener noreferrer"', '(2010)', 'Matiza', '«La vergüenza es un sentimiento revolucionario»', 'Cita verificada', 'Descartó 3 fuentes', '2 búsquedas', 'taller-eco-matiza']
      .forEach((trozo) => expect(h).toContain(trozo));
  });

  test('una URL que no es http(s) no se vuelve enlace', () => {
    const h = T.htmlEcos({ resultado: { ...entrada.resultado, ecos: [{ ...eco, url: 'javascript:alert(1)' }] } }, false, esc);
    expect(h).not.toContain('<a href');
  });

  test('sin ecos comprobados lo dice en vez de inventar, y avisa si la idea cambió', () => {
    const h = T.htmlEcos({ resultado: { consultas: [], busquedas: 1, descartadas: 0, ecos: [] } }, true, esc);
    expect(h).toContain('No encontré ecos que pudiera comprobar');
    expect(h).toContain('Cambiaste la idea después de este análisis');
    expect(h).toContain('1 búsqueda)');
  });
});

describe('htmlContrapunto', () => {
  const entrada = {
    resultado: {
      postura_contraria: 'Los argumentos sí convencen.',
      objeciones: [{ objecion: 'Generaliza', fuerza: 'alta', fragmento: 'la gente no cambia', respuesta_posible: 'Matizar con «a veces».' }, { objecion: 'Vaga', fuerza: 'baja', fragmento: '', respuesta_posible: '' }],
      casos_limite: ['Sin vínculos sociales'], lo_que_resiste: ['La tensión es real'], preguntas_incomodas: ['¿Qué evidencia tienes?'],
    },
  };

  test('muestra la postura, las objeciones con su fuerza, la cita y la respuesta posible, y el resto de secciones', () => {
    const h = T.htmlContrapunto(entrada, false, esc);
    ['Los argumentos sí convencen.', 'Generaliza', 'Fuerte', 'Leve', '«la gente no cambia»', 'Podrías responder: Matizar', 'Sin vínculos sociales', 'La tensión es real', '¿Qué evidencia tienes?', 'brigada-bandera-alta']
      .forEach((trozo) => expect(h).toContain(trozo));
    expect(h).not.toContain('<em>«»</em>');
  });

  test('escapa el HTML del análisis', () => {
    const h = T.htmlContrapunto({ resultado: { ...entrada.resultado, postura_contraria: '<img src=x onerror=alert(1)>' } }, false, esc);
    expect(h).not.toContain('<img');
  });
});

describe('htmlInformes', () => {
  const analisis = {
    contrapunto: { resultado: { postura_contraria: 'P', objeciones: [], casos_limite: [], lo_que_resiste: [], preguntas_incomodas: [] } },
    cazadora: { resultado: { consultas: [], busquedas: 0, descartadas: 0, ecos: [] } },
  };

  test('un cuadro por agente que ya trabajó, en orden, y marca solo los desactualizados', () => {
    const h = T.htmlInformes(analisis, ['cazadora'], esc);
    expect((h.match(/class="taller-informe /g) || []).length).toBe(2);
    expect(h.indexOf('data-agente="cazadora"')).toBeLessThan(h.indexOf('data-agente="contrapunto"'));
    expect((h.match(/Cambiaste la idea/g) || []).length).toBe(1);
  });

  test('sin análisis no pinta nada', () => {
    expect(T.htmlInformes({}, [], esc)).toBe('');
    expect(T.htmlInformes(null, [], esc)).toBe('');
  });
});

describe('el Taller en el panel', () => {
  test('hay una pestaña y un panel solo para el administrador, con su editor, su lista y sus agentes', () => {
    expect(html).toContain('data-tab="taller">🏮 Taller de Aliado</button>');
    expect(html).toContain('id="admin-panel-taller"');
    ['taller-nueva', 'taller-filtro', 'taller-lista', 'taller-editor', 'ts-titulo', 'ts-texto', 'ts-etiquetas', 'ts-estado', 'ts-borrar', 'taller-grieta', 'taller-resultados']
      .forEach((id) => expect(html).toContain(`id="${id}"`));
    expect(js).toContain('.admin-tabs [data-tab="taller"]'); // el moderador no la ve
    expect(js).toContain("document.getElementById('admin-panel-taller').style.display = tab === 'taller'");
  });

  test('La Grieta, La Cazadora y El Contrapunto trabajan; La Farolera está a la vista pero todavía deshabilitada', () => {
    ['grieta', 'cazadora', 'contrapunto'].forEach((a) => expect(html).toMatch(new RegExp(`id="taller-${a}"><span`)));
    expect(html).toMatch(/id="taller-farolera" disabled/);
    expect((html.match(/data-desc="(grieta|cazadora|contrapunto|farolera)"/g) || []).length).toBe(4);
  });

  test('guardar manda la semilla, La Grieta guarda primero y analiza ese texto, y borrar pide confirmación', () => {
    const taller = leer('taller.js');
    expect(taller).toContain("/api/semillas/${encodeURIComponent(guardada.id)}/agentes/${agente.id}");
    expect(taller).toContain('const guardada = await guardar();');
    expect(taller).toContain("if (!confirm('¿Borrar esta semilla");
    expect(taller).toContain("method: 'PUT'");
    expect(taller).toContain("method: 'DELETE'");
  });

  test('taller.js se carga antes que admin.js, se precarga y el panel lo inicia solo para admin', () => {
    expect(html.indexOf('taller.js')).toBeGreaterThan(-1);
    expect(html.indexOf('taller.js')).toBeLessThan(html.indexOf('admin.js'));
    expect(leer('sw.js')).toContain("'/taller.js'");
    expect(js).toContain('window.sqprTaller.iniciar({ apiFetch, descripcion:');
  });

  test('el elenco de la Brigada incluye a las cuatro agentes del Taller y las lleva a su pestaña', () => {
    ['grieta', 'cazadora', 'contrapunto', 'farolera'].forEach((a) => expect(js).toContain(`id: '${a}'`));
    expect(js).toContain("lugar: 'taller'");
    expect(js).toContain("document.querySelectorAll('#brigada-elenco [data-taller]')");
  });
});

describe('sintaxis', () => {
  test('taller.js se puede interpretar sin errores', () => {
    expect(() => new (require('vm').Script)(leer('taller.js'), { filename: 'taller.js' })).not.toThrow();
  });
});
