// Arreglos del panel de administracion y del debate (2026-10-23): publicar solo desde el ultimo paso, aviso del
// campo obligatorio que falta, seleccion visible, traduccion colapsable, y editar / reportar en el debate.
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..', '..');
const frontend = path.join(raiz, 'frontend');
const leer = (f) => fs.readFileSync(path.join(/^(docs|backend)\/|^netlify\.toml$/.test(f) ? raiz : frontend, f), 'utf8');
const entre = (texto, inicio) => {
  const a = texto.indexOf(`// INICIO ${inicio}`);
  const b = texto.indexOf(`// FIN ${inicio}`);
  if (a < 0 || b < 0) throw new Error(`Faltan las marcas ${inicio} en el archivo`);
  return texto.slice(a, b);
};
const dic = JSON.parse(leer('i18n/en.json'));

describe('Noticias rápidas: publicar solo desde el último paso', () => {
  const html = leer('admin.html');
  const panelFuente = () => {
    const i = html.indexOf('<section class="news-panel" data-panel="fuente"');
    return html.slice(i, html.indexOf('</section>', i));
  };

  test('«AL AIRE» y «Guardar borrador» están dentro del panel Fuente (último paso), no en una barra fija', () => {
    const p = panelFuente();
    expect(p).toContain('id="an-publicar"');
    expect(p).toContain('id="an-borrador"');
    expect(p).toContain('id="an-fecha"');
    expect(html).not.toContain('<footer class="news-publish-bar">');
  });

  test('los botones no son "submit": Enter dentro de un campo no publica por accidente', () => {
    expect(html).toMatch(/<button type="button" class="news-btn-guardar" id="an-publicar">/);
    expect(html).toMatch(/<button type="button" class="admin-btn-cancel" id="an-borrador">/);
    const form = html.slice(html.indexOf('id="admin-noticias-form"'), html.indexOf('id="tr-noticia"'));
    expect(form).not.toMatch(/type="submit"/);
  });

  test('el botón de Contenidos tampoco envía con Enter', () => {
    expect(html).toMatch(/<button type="button" class="synth-btn-guardar" id="ac-guardar">/);
    const form = html.slice(html.indexOf('id="admin-contenidos-form"'), html.indexOf('id="tr-contenido"'));
    expect(form).not.toMatch(/type="submit"/);
  });

  test('admin.js decide borrador o publicado según el botón y envía con requestSubmit', () => {
    const js = leer('admin.js');
    expect(js).toMatch(/an-publicado'\)\.checked = publicar/);
    expect(js).toMatch(/formNoticias\.requestSubmit\(\)/);
    expect(js).toMatch(/formContenidos\.requestSubmit\(\)/);
  });
});

describe('Aviso del campo obligatorio que falta (paneles ocultos)', () => {
  const codigo = entre(leer('admin.js'), 'aviso-campo-faltante');
  const fabricar = () => {
    const llamadas = [];
    const setStatus = (el, tipo, msg) => llamadas.push({ tipo, msg });
    const avisar = new Function('setStatus', `${codigo}\nreturn avisarCampoFaltante;`)(setStatus);
    return { avisar, llamadas };
  };

  function formFalso(panelOculto) {
    const panel = { hidden: panelOculto, dataset: { panel: 'multimedia' } };
    const campo = { id: 'ac-url-portada', closest: () => panel };
    let escucha;
    const form = {
      addEventListener: (tipo, fn, captura) => { if (tipo === 'invalid') escucha = { fn, captura }; },
      querySelector: (sel) => (sel === 'label[for="ac-url-portada"]' ? { textContent: 'Imagen de portada (ruta o URL)' } : null),
    };
    return { form, campo, disparar: () => escucha.fn({ target: campo }), escucha: () => escucha };
  }

  test('abre el panel que contiene el primer campo inválido y dice cuál falta', () => {
    const { avisar, llamadas } = fabricar();
    const f = formFalso(true);
    const abiertos = [];
    avisar(f.form, (nombre) => abiertos.push(nombre), {});
    expect(f.escucha().captura).toBe(true); // "invalid" no burbujea: hay que escucharlo en captura
    f.disparar();
    expect(abiertos).toEqual(['multimedia']);
    expect(llamadas[0]).toEqual({ tipo: 'error', msg: 'Falta completar: Imagen de portada.' });
  });

  test('si el panel ya está visible no lo vuelve a abrir, pero igual avisa', () => {
    const { avisar, llamadas } = fabricar();
    const f = formFalso(false);
    const abiertos = [];
    avisar(f.form, (nombre) => abiertos.push(nombre), {});
    f.disparar();
    expect(abiertos).toEqual([]);
    expect(llamadas).toHaveLength(1);
  });

  test('con varios campos inválidos en la misma validación solo atiende el primero', () => {
    const { avisar, llamadas } = fabricar();
    const f = formFalso(true);
    avisar(f.form, () => {}, {});
    f.disparar();
    f.disparar();
    expect(llamadas).toHaveLength(1);
  });
});

describe('Panel de administración: selección visible y traducción', () => {
  const css = leer('styles.css');
  test('la selección de texto en los campos del panel no usa el color del ::selection global', () => {
    expect(css).toMatch(/\.admin-tab-panel input::selection,\s*\.admin-tab-panel textarea::selection\{\s*background:#3b82f6;\s*color:#fff;/);
  });

  test('la traducción es un bloque colapsable con estado visible', () => {
    const js = leer('admin.js');
    expect(js).toContain('<details class="tr-details"');
    expect(js).toContain('class="tr-chip"');
    expect(js).not.toContain('🌐');
    for (const estado of ['Guardada', 'Pendiente', 'Guarda primero']) expect(js).toContain(estado);
    expect(css).toMatch(/\.tr-chip-ok\{/);
  });
});

describe('Debate: editar y reportar', () => {
  const js = leer('debate.js');
  const { datosEdicionPost } = new Function(`${entre(js, 'edicion-debate')}\nreturn { datosEdicionPost };`)();

  test('la edición reenvía lo que la API reemplaza (sub-sección, región, enlace) y recorta el texto', () => {
    const post = { subseccion: 'nuevos-humanos', enfoque: 'puerto-rico', enlace_media: 'https://x.test/a', enlace_media_tipo: 'video' };
    expect(datosEdicionPost(post, '  Hola  ', '  Cuerpo largo de prueba  ', false)).toEqual({
      titulo: 'Hola', cuerpo: 'Cuerpo largo de prueba', subseccion: 'nuevos-humanos',
      enfoque: 'puerto-rico', enlaceMedia: 'https://x.test/a', enlaceMediaTipo: 'video',
    });
  });

  test('sin región ni enlace no manda esos campos; el administrador conserva destacado y tema', () => {
    const post = { subseccion: 'educacion', destacado: true, tema_contenido_id: 'mi-tema' };
    expect(datosEdicionPost(post, 'Titulo', 'Cuerpo largo de prueba', false)).toEqual({
      titulo: 'Titulo', cuerpo: 'Cuerpo largo de prueba', subseccion: 'educacion',
    });
    expect(datosEdicionPost(post, 'Titulo', 'Cuerpo largo de prueba', true)).toMatchObject({ destacado: true, temaContenidoId: 'mi-tema' });
  });

  test('Editar llama a PATCH /api/foro/posts/:id y solo lo ve el dueño o el administrador', () => {
    expect(js).toMatch(/method: 'PATCH'/);
    expect(js).toMatch(/\$\{isOwner \|\| isAdmin \? '<button type="button" class="btn-alt debate-editar-post">Editar<\/button>'/);
  });

  test('Reportar usa un cuadro propio (no prompt) y no aparece en lo propio', () => {
    expect(js).not.toMatch(/\bprompt\(/);
    expect(js).toContain('pedirMotivoReporte');
    expect(js).toContain("document.createElement('dialog')");
    expect(js).toMatch(/\$\{isOwner \? '' : `<button[^`]*debate-reportar" data-tipo="debate_post"/);
    expect(js).toMatch(/currentUser\.id === c\.autor_id \? '' : `<button[^`]*debate-reportar" data-tipo="debate_comentario"/);
  });

  test('los textos nuevos del debate tienen traducción al inglés', () => {
    for (const t of ['Editar', 'Reportar contenido', 'Enviar reporte', 'Escribe al menos 5 caracteres.', 'Reporte enviado', 'editada', 'palabras']) {
      expect(dic[t]).toBeTruthy();
    }
  });
});

describe('2FA del panel: verifica solo al escribir el sexto dígito', () => {
  const js = leer('admin.js');
  const { soloDigitos, codigoCompleto } = new Function(`${entre(js, 'codigo-automatico')}\nreturn { soloDigitos, codigoCompleto };`)();

  test('deja solo números (también al pegar) y recorta a 6', () => {
    expect(soloDigitos('123 456')).toBe('123456');
    expect(soloDigitos('12a3-4b5c6d7')).toBe('123456');
    expect(soloDigitos('')).toBe('');
  });

  test('el código está completo solo con exactamente 6 dígitos', () => {
    expect(codigoCompleto('123456')).toBe(true);
    expect(codigoCompleto('12345')).toBe(false);
    expect(codigoCompleto('1234567')).toBe(false);
    expect(codigoCompleto('12345a')).toBe(false);
  });

  test('el campo envía el formulario al completar el código y no si ya se está verificando', () => {
    expect(js).toMatch(/input\.addEventListener\('input', \(\) => \{\s*input\.value = soloDigitos\(input\.value\);\s*if \(codigoCompleto\(input\.value\) && !boton\.disabled\) form\.requestSubmit\(\);/);
  });
});

describe('Guardado continuo: texto alternativo opcional y formulario que sigue abierto', () => {
  const js = leer('admin.js');
  const html = leer('admin.html');
  const { textoAlternativo, destacadoPermitido } = new Function(`${entre(js, 'guardado-continuo')}\nreturn { textoAlternativo, destacadoPermitido };`)();

  test('el texto alternativo es opcional: vacío se reemplaza por el título', () => {
    expect(textoAlternativo('', 'Mi título')).toBe('Mi título');
    expect(textoAlternativo('   ', '  Otro  ')).toBe('Otro');
    expect(textoAlternativo(' Una foto ', 'Mi título')).toBe('Una foto');
    expect(textoAlternativo('', 'x'.repeat(300))).toHaveLength(160);
  });

  test.each(['an-imagen-alt', 'ac-portada-alt', 'ap-imagen-alt'])('%s ya no es obligatorio y dice que es opcional', (id) => {
    expect(html).toMatch(new RegExp(`<input type="text" id="${id}">`));
    expect(html).toContain(`<label for="${id}">Texto alternativo de la imagen (opcional)</label>`);
  });

  test('un borrador no puede ser la noticia destacada', () => {
    expect(destacadoPermitido(true, true)).toBe(true);
    expect(destacadoPermitido(true, false)).toBe(false);
    expect(destacadoPermitido(false, true)).toBe(false);
  });

  test('guardar noticia, contenido o producto deja el formulario abierto y usa despuesDeGuardar', () => {
    for (const tipo of ['noticia', 'contenido', 'producto']) expect(js).toContain(`tipo: '${tipo}', pieza: res.${tipo}`);
    expect(js).not.toMatch(/closeNoticiaForm\(\);\s*loadNoticias\(\);/);
    expect(js).not.toMatch(/closeContenidoForm\(\);\s*loadContenidos\(\);/);
    expect(js).not.toMatch(/closeProductoForm\(\);\s*loadProductos\(\);/);
    expect(js).toMatch(/botonCerrar\)\.textContent = 'Cerrar'/);
  });

  test('una traducción sin guardar se guarda junto con la pieza y puede pedirse al guardar', () => {
    expect(js).toMatch(/if \(traduccionSinGuardar\[o\.tipo\]\) \{\s*await guardarTraduccion\(o\.tipo\);/);
    expect(js).toMatch(/traduccionSinGuardar\[tipo\] = true;\s*marcarChipTraduccion\(tipo, 'Borrador sin guardar'/);
    expect(html).toContain('id="an-traducir-al-guardar"');
    expect(html).toContain('id="ac-traducir-al-guardar"');
  });

  test('el mensaje del autocompletar ya no habla del casillero «Publicado» ni dice que se guardó', () => {
    expect(js).not.toMatch(/marca "Publicado"/);
    expect(js).toContain('todavía NO se ha guardado');
  });
});
