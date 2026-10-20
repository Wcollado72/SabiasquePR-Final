// La fecha "Última actualización" de Términos y Privacidad debe ser fija (se cambia a mano
// cuando cambia el texto legal), no la fecha del build: si no, cada deploy re-fecharía
// documentos legales que no cambiaron.
const fs = require('fs');
const path = require('path');

const build = fs.readFileSync(path.join(__dirname, '../../frontend/build.js'), 'utf8');

describe('fecha de actualización de las páginas legales', () => {
  test('no se calcula con new Date()', () => {
    expect(build).not.toMatch(/Última actualización:\s*\$\{\s*new Date\(/);
  });

  test('usa la constante fija LEGAL_ACTUALIZADO en Términos y en Privacidad', () => {
    const usos = build.match(/Última actualización: \$\{LEGAL_ACTUALIZADO\}/g) || [];
    expect(usos).toHaveLength(2);
    expect(build).toMatch(/const LEGAL_ACTUALIZADO = '\d{1,2} de [a-záéíóú]+ de \d{4}';/);
  });
});
