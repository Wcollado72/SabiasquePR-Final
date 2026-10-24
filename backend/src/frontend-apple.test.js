// Safari / iPhone / iPad / Mac: tres ajustes que se encontraron probando con el motor WebKit (backend/scripts/probar-webkit.js).
const fs = require('fs');
const path = require('path');

const frontend = path.join(__dirname, '..', '..', 'frontend');
const leer = (f) => fs.readFileSync(path.join(frontend, f), 'utf8').replace(/\r\n/g, '\n');
const css = leer('styles.css');

describe('campos de formulario: 16 px para que el iPhone no haga zoom al tocarlos', () => {
  test('la regla base de input, textarea y select usa 1rem (16 px) y no 0.95rem', () => {
    const regla = css.slice(css.indexOf('input[type="text"],'), css.indexOf('input::placeholder'));
    expect(regla).toContain('select{');
    expect(regla).toMatch(/font-size:1rem;/);
    expect(regla).not.toMatch(/font-size:\.95rem/);
  });

  test('la letra base del documento es de 16 px (1rem = 16 px)', () => {
    expect(css).toMatch(/font-size:16px;/);
  });
});

describe('cajón del carrito: no queda tapado por la barra de Safari del iPhone', () => {
  test('mantiene 100vh como respaldo y agrega 100dvh justo después', () => {
    const bloque = css.slice(css.indexOf('.cart-drawer{'), css.indexOf('}', css.indexOf('.cart-drawer{')));
    expect(bloque).toMatch(/height:100vh;\n\s*height:100dvh;/);
  });
});

describe('la página no se arrastra de lado en el iPhone', () => {
  const bloque = css.slice(css.indexOf('.cart-drawer{'), css.indexOf('}', css.indexOf('.cart-drawer{')));

  test('el cajón del carrito cerrado no queda fuera de la pantalla: right:0, recortado y oculto', () => {
    expect(bloque).toMatch(/right:0;/);
    expect(bloque).not.toMatch(/right:\s*-\d+px/);
    expect(bloque).toMatch(/clip-path:inset\(0 0 0 100%\);/);
    expect(bloque).toMatch(/visibility:hidden;/);
    expect(css).toMatch(/\.cart-drawer\.open\{ clip-path:inset\(0 0 0 -40px\); visibility:visible;/);
  });

  test('html y body recortan el desborde horizontal (overflow-x:clip, que no rompe position:sticky)', () => {
    expect(css).toMatch(/html\{[^}]*overflow-x:clip;/);
    expect(css).toMatch(/body\{\n\s*overflow-x:clip;/);
  });

  test('ningún elemento del CSS se estaciona fuera de la pantalla con right o left negativos en un position:fixed', () => {
    const fijos = [...css.matchAll(/([^{}]+)\{([^{}]*position:\s*fixed[^{}]*)\}/g)].filter((m) => /(^|[;\s])(right|left):\s*-\d/.test(m[2]));
    expect(fijos.map((m) => m[1].trim())).toEqual([]);
  });
});

describe('cabecera en pantallas angostas: el botón de menú siempre cabe', () => {
  const bloque1200 = css.slice(css.indexOf('@media (max-width:1200px){'), css.indexOf('@media (max-width:1040px){'));
  const bloque560 = css.slice(css.indexOf('@media (max-width:560px){'), css.indexOf('@media (max-width:400px){'));

  test('el botón de menú no se encoge y el grupo de controles sí; lo único que se acorta es el botón de sesión, con «…»', () => {
    expect(bloque1200).toMatch(/\.nav-toggle\{ display:flex; order:3; flex-shrink:0; \}/);
    expect(bloque1200).toMatch(/\.header-controls\{ margin-left:auto; flex-shrink:1; min-width:0; \}/);
    expect(bloque1200).toMatch(/\.lang-toggle, \.theme-toggle, \.cart-btn\{ flex-shrink:0; \}/);
    expect(bloque1200).toMatch(/\.login-trigger-btn\{ flex:0 1 auto; min-width:0; overflow:hidden; \}/);
    expect(bloque1200).toMatch(/#login-trigger-label\{ display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; \}/);
  });

  test('en teléfono (≤560 px) se aprietan los espacios y se oculta el nombre junto al logo', () => {
    expect(bloque560).toMatch(/\.site-header-inner\{ gap:8px; \}/);
    expect(bloque560).toMatch(/\.brand-name\{ display:none; \}/);
    expect(bloque560).toMatch(/\.theme-toggle, \.cart-btn\{ width:36px; height:36px; \}/);
  });

  test('el script de WebKit también mide que el botón de menú quede dentro de la pantalla', () => {
    const script = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'probar-webkit.js'), 'utf8');
    expect(script).toContain('menuFueraDePantalla');
    expect(script).toContain('el botón de menú se sale de la pantalla');
  });
});

describe('sin almacenamiento (Safari con «Bloquear todas las cookies» lanza SecurityError)', () => {
  test('script.js lee y guarda el tema dentro de try/catch', () => {
    const js = leer('script.js');
    expect(js).toMatch(/try \{ temaGuardado = localStorage\.getItem\('sqpr-theme'\); \} catch/);
    expect(js).toMatch(/try \{ localStorage\.setItem\('sqpr-theme', next\); \} catch/);
    expect(js).not.toMatch(/^\s*const initTheme = localStorage/m);
  });

  test('debate.js confirma la edad con sessionStorage dentro de try/catch y la recuerda en memoria si no se puede', () => {
    const js = leer('debate.js');
    expect(js).toContain('const edadEnMemoria = new Set();');
    expect(js).toMatch(/try \{ if \(sessionStorage\.getItem\(sessionEdadKey\(\)\) === '1'\) return true; \} catch/);
    expect(js).toMatch(/try \{ sessionStorage\.setItem\(sessionEdadKey\(\), '1'\); \} catch/);
    expect(js).toContain(': edadDeSesionConfirmada());');
    expect(js).toContain('confirmarEdadDeSesion();');
    // ya no se toca sessionStorage fuera de esas dos funciones
    expect((js.match(/sessionStorage\./g) || []).length).toBe(2);
  });

  test('los demás usos de storage del sitio ya están protegidos con try/catch', () => {
    for (const f of ['i18n.js', 'correccion.js', 'auth.js']) {
      const js = leer(f);
      expect(js).toMatch(/try \{/);
    }
  });
});
