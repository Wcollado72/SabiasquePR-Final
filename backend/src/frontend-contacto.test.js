// Formulario de contacto + relleno con la sesion (2026-10-05).
// 1) Bug real encontrado en produccion: el formulario envia con fetch() a Formspree, pero el CSP no
//    traia formspree.io en connect-src, asi que el navegador bloqueaba el envio y la pagina decia
//    "Sin conexion". 2) Con sesion iniciada, el correo (y el nombre, si se conoce) vienen escritos
//    pero se pueden cambiar.
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..', '..'); // raiz del repositorio
const frontend = path.join(raiz, 'frontend'); // el sitio
// Los archivos del sitio salen de frontend/; docs/, backend/ y netlify.toml viven en la raiz del repositorio.
const leer = (f) => fs.readFileSync(path.join(/^(docs|backend)\/|^netlify\.toml$/.test(f) ? raiz : frontend, f), 'utf8');
const dic = JSON.parse(leer('i18n/en.json'));

describe('El CSP deja que el formulario de contacto se envíe', () => {
  const headers = leer('_headers');
  const directiva = (nombre) => ((headers.match(new RegExp(`${nombre} ([^;\\n]*)`)) || [])[1] || '');

  test('script.js envía el formulario con fetch al "action" (Formspree)', () => {
    const js = leer('script.js');
    expect(js).toMatch(/fetch\(action, \{\s*method: 'POST',\s*body: new FormData\(contactForm\)/);
  });

  test('el "action" del formulario apunta a formspree.io', () => {
    expect(leer('contacto.html')).toMatch(/action="https:\/\/formspree\.io\/f\/[A-Za-z0-9]+"/);
  });

  test('connect-src del _headers permite formspree.io (sin esto sale "Sin conexión")', () => {
    expect(directiva('connect-src')).toMatch(/https:\/\/formspree\.io/);
  });

  test('form-action sigue permitiendo formspree.io (respaldo sin JavaScript)', () => {
    expect(directiva('form-action')).toMatch(/https:\/\/formspree\.io/);
  });

  test('build.js (la fuente del _headers) también lo trae', () => {
    expect(leer('build.js')).toMatch(/connect-src [^"]*https:\/\/formspree\.io/);
  });
});

describe('Relleno del correo con la sesión: marcado y textos', () => {
  const contacto = leer('contacto.html');

  test('el campo de correo sigue siendo editable (ni readonly ni disabled)', () => {
    const campo = /<input type="email" id="email"[^>]*>/.exec(contacto)[0];
    expect(campo).not.toMatch(/readonly|disabled/i);
  });

  test('la pista existe, empieza oculta y está después del correo', () => {
    expect(contacto).toMatch(/<p id="email-hint" class="form-hint" hidden>Usaremos este correo para responderte; puedes cambiarlo\.<\/p>/);
    expect(contacto.indexOf('id="email-hint"')).toBeGreaterThan(contacto.indexOf('id="email" name="email"'));
  });

  test('la pista está traducida al inglés', () => {
    expect(typeof dic['Usaremos este correo para responderte; puedes cambiarlo.']).toBe('string');
  });

  test('el código escribe con .value y nunca como HTML', () => {
    const js = leer('script.js');
    const seccion = js.slice(js.indexOf('// INICIO relleno-sesion'), js.indexOf('// FIN relleno-sesion'));
    expect(seccion.length).toBeGreaterThan(200);
    expect(seccion).not.toMatch(/innerHTML|insertAdjacentHTML|outerHTML/);
    expect(seccion).toMatch(/campo\.value = valor/);
  });
});

// Comportamiento: se ejecuta SOLO el trozo de relleno de script.js contra un "documento" falso mínimo
// (sin jsdom: sus dependencias ES-module no las carga Jest en este proyecto).
describe('Relleno del correo con la sesión: comportamiento', () => {
  const js = leer('script.js');
  const codigo = js.slice(js.indexOf('// INICIO relleno-sesion'), js.indexOf('// FIN relleno-sesion'));

  function elemento(id) {
    const oyentes = {};
    return {
      id, value: '', dataset: {}, hidden: id === 'email-hint',
      addEventListener: (tipo, fn) => { (oyentes[tipo] = oyentes[tipo] || []).push(fn); },
      escribir(valor) { this.value = valor; (oyentes.input || []).forEach((fn) => fn()); },
    };
  }

  function montar({ sesion }) {
    const email = elemento('email');
    const nombre = elemento('nombre');
    const boletin = elemento('home-email');
    const pista = elemento('email-hint');
    // Formulario falso: reset() avisa a los oyentes ANTES de vaciar los campos, como el navegador.
    const oyentesForm = [];
    const formulario = {
      addEventListener: (tipo, fn) => { if (tipo === 'reset') oyentesForm.push(fn); },
      reset() { oyentesForm.forEach((fn) => fn()); email.value = ''; nombre.value = ''; },
    };
    const documento = {
      querySelectorAll: () => [boletin, email],
      querySelector: (sel) => (sel === '#contact-form' ? formulario : sel.endsWith('#nombre') ? nombre : sel.endsWith('#email') ? email : null),
      getElementById: (id) => (id === 'email-hint' ? pista : null),
    };
    const oyentes = [];
    const cliente = {
      auth: {
        getSession: async () => ({ data: { session: sesion } }),
        onAuthStateChange: (fn) => { oyentes.push(fn); },
      },
    };
    new Function('document', 'waitForSharedSupabase', codigo)(documento, async () => cliente);
    return { email, nombre, boletin, pista, oyentes, formulario };
  }

  const esperar = () => new Promise((r) => setTimeout(r, 10));
  const SESION = { user: { email: 'ana@ejemplo.com', user_metadata: { full_name: 'Ana Pérez' } } };

  test('con sesión rellena correo (contacto y boletín) y nombre, y muestra la pista', async () => {
    const t = montar({ sesion: SESION });
    await esperar();
    expect(t.email.value).toBe('ana@ejemplo.com');
    expect(t.boletin.value).toBe('ana@ejemplo.com');
    expect(t.nombre.value).toBe('Ana Pérez');
    expect(t.pista.hidden).toBe(false);
  });

  test('sin sesión no toca nada', async () => {
    const t = montar({ sesion: null });
    await esperar();
    expect(t.email.value).toBe('');
    expect(t.nombre.value).toBe('');
    expect(t.pista.hidden).toBe(true);
  });

  test('si la persona ya escribió otro correo, no se lo pisa', async () => {
    const t = montar({ sesion: null });
    await esperar();
    t.email.escribir('otra@ejemplo.com');
    t.oyentes.forEach((fn) => fn('SIGNED_IN', SESION));
    expect(t.email.value).toBe('otra@ejemplo.com');
    expect(t.pista.hidden).toBe(true);
  });

  test('si el navegador ya autocompletó el campo (no vacío), se respeta', async () => {
    const t = montar({ sesion: null });
    await esperar();
    t.boletin.value = 'autocompletado@ejemplo.com'; // lo puso el navegador, sin evento 'input'
    t.oyentes.forEach((fn) => fn('SIGNED_IN', SESION));
    expect(t.boletin.value).toBe('autocompletado@ejemplo.com');
    expect(t.email.value).toBe('ana@ejemplo.com');
  });

  test('si la persona editó el correo después de rellenarse, la pista se oculta y se conserva su texto', async () => {
    const t = montar({ sesion: SESION });
    await esperar();
    expect(t.pista.hidden).toBe(false);
    t.email.escribir('nuevo@ejemplo.com');
    expect(t.pista.hidden).toBe(true);
    expect(t.email.value).toBe('nuevo@ejemplo.com');
  });

  test('al cerrar sesión vacía lo que rellenó el sitio, pero no lo que escribió la persona', async () => {
    const t = montar({ sesion: SESION });
    await esperar();
    t.boletin.escribir('mio@ejemplo.com');
    t.oyentes.forEach((fn) => fn('SIGNED_OUT', null));
    expect(t.email.value).toBe('');
    expect(t.nombre.value).toBe('');
    expect(t.pista.hidden).toBe(true);
    expect(t.boletin.value).toBe('mio@ejemplo.com');
  });

  test('el nombre queda vacío si la cuenta no tiene nombre conocido', async () => {
    const t = montar({ sesion: { user: { email: 'sin@nombre.com', user_metadata: {} } } });
    await esperar();
    expect(t.email.value).toBe('sin@nombre.com');
    expect(t.nombre.value).toBe('');
  });

  test('tras enviar (reset) con sesión, se vuelve a rellenar y la pista reaparece', async () => {
    const t = montar({ sesion: SESION });
    await esperar();
    t.email.escribir('otro@ejemplo.com'); // la persona lo cambió: pista oculta, marca "editado"
    t.nombre.escribir('Otro Nombre');
    t.formulario.reset();
    expect(t.email.value).toBe(''); // el reset ya vació los campos
    await esperar();
    expect(t.email.value).toBe('ana@ejemplo.com');
    expect(t.nombre.value).toBe('Ana Pérez');
    expect(t.pista.hidden).toBe(false);
  });

  test('tras enviar (reset) sin sesión, la pista obsoleta se oculta y los campos quedan vacíos', async () => {
    const t = montar({ sesion: SESION });
    await esperar();
    t.oyentes.forEach((fn) => fn('SIGNED_OUT', null)); // cierra sesión; la persona escribe y envía
    t.email.escribir('x@ejemplo.com');
    t.pista.hidden = false; // pista que había quedado visible
    t.formulario.reset();
    await esperar();
    expect(t.email.value).toBe('');
    expect(t.nombre.value).toBe('');
    expect(t.pista.hidden).toBe(true);
  });
});
