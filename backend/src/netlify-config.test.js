// Guarda de la configuracion de publicacion (netlify.toml): el sitio se construye y publica SOLO desde frontend/,
// y los archivos internos de frontend/ (generador, notas legales, datos de origen) no se sirven al publico.
const fs = require('fs');
const path = require('path');

const toml = fs.readFileSync(path.join(__dirname, '..', '..', 'netlify.toml'), 'utf8');

// Busca una regla de redireccion "from -> /404.html, 404, force" sin usar expresiones regulares con la ruta.
function tieneRegla404(ruta) {
  const bloques = toml.split('[[redirects]]').slice(1);
  return bloques.some((b) => b.includes(`from = "${ruta}"`)
    && b.includes('to = "/404.html"') && b.includes('status = 404') && b.includes('force = true'));
}

describe('netlify.toml', () => {
  test('construye y publica solo la carpeta frontend/', () => {
    expect(toml).toMatch(/^\s*base = "frontend"/m);
    expect(toml).toMatch(/^\s*command = "node build\.js"/m);
    expect(toml).toMatch(/^\s*publish = "\."/m);
  });

  test.each(['/build.js', '/package.json', '/scripts/*', '/_content/*', '/i18n/revisar-legal.md'])(
    'el archivo interno "%s" se devuelve como 404',
    (ruta) => {
      expect(tieneRegla404(ruta)).toBe(true);
    }
  );

  test('un cambio en netlify.toml tambien dispara el build (la regla ignore lo incluye)', () => {
    expect(toml).toMatch(/ignore = "git diff --quiet \$CACHED_COMMIT_REF \$COMMIT_REF -- \. \.\.\/netlify\.toml"/);
  });

  test('las vistas previas de PR solo se construyen en ramas preview/* (cada build cuesta creditos)', () => {
    const bloque = toml.slice(toml.indexOf('[context.deploy-preview]'));
    expect(bloque).toMatch(/\[context\.deploy-preview\]\s+ignore = 'case "\$HEAD" in preview\/\*\) exit 1 ;; \*\) exit 0 ;; esac'/);
  });

  test('la redireccion de la direccion de netlify.app a sabiasquepr.com sigue primero', () => {
    const primero = toml.indexOf('[[redirects]]');
    expect(toml.slice(primero, primero + 200)).toMatch(/fabulous-tartufo-fcb839\.netlify\.app/);
  });
});
