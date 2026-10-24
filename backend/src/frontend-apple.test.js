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
