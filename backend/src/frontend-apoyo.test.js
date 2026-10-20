// Fase 1 del modelo de apoyo voluntario (docs/PLAN-APOYO-DONACIONES.md, docs/TEXTOS-APOYO.md):
// textos aprobados, nombres nuevos, secciones legales y protección contra dejar el enlace de PRUEBA en producción.
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..', '..'); // raiz del repositorio
const frontend = path.join(raiz, 'frontend'); // el sitio
// Los archivos del sitio salen de frontend/; docs/, backend/ y netlify.toml viven en la raiz del repositorio.
const leer = (f) => fs.readFileSync(path.join(/^(docs|backend)\/|^netlify\.toml$/.test(f) ? raiz : frontend, f), 'utf8');
const dic = JSON.parse(leer('i18n/en.json'));

describe('Página "Apoya el canal" (premium.html)', () => {
  const html = leer('premium.html');

  test('título, subtítulo y secciones aprobadas', () => {
    expect(html).toMatch(/<title>Sabías que PR — Apoya el canal<\/title>/);
    expect(html).toMatch(/Sabías que PR es gratis para todas las personas\. Si te sirve, ayúdanos a mantenerlo\./);
    expect(html).toMatch(/Por qué existe este apoyo/);
    expect(html).toMatch(/Cómo puedes apoyar/);
    expect(html).toMatch(/Lo que debes saber/);
  });

  test('la frase de costos que el usuario pidió eliminar no aparece', () => {
    expect(html).not.toMatch(/costos reales/i);
    expect(leer('docs/TEXTOS-APOYO.md')).not.toMatch(/costos reales|real costs/i);
  });

  test('avisos legales: voluntario, 18+, no deducible, Stripe, cancelación y reembolso', () => {
    expect(html).toMatch(/voluntario y para mayores de 18 años/);
    expect(html).toMatch(/No es una donación deducible de impuestos\./);
    expect(html).toMatch(/Los pagos los procesa Stripe/);
    expect(html).toMatch(/Puedes cancelar el apoyo mensual en cualquier momento/);
    expect(html).toMatch(/no son reembolsables, salvo error nuestro o cargo no autorizado/);
  });

  test('describe los beneficios del apoyo mensual y que el único no incluye insignia', () => {
    expect(html).toMatch(/insignia <strong>Colaborador<\/strong>/);
    expect(html).toMatch(/<strong>1000 palabras<\/strong>/);
    expect(html).toMatch(/no incluye insignia ni cambios en tu cuenta/);
  });

  test('ya no habla de premium ni de suscripción', () => {
    expect(html).not.toMatch(/Suscribirme|Beneficios premium|Hazte premium|miembro premium/i);
  });

  test('botón mensual presente; el botón de apoyo único NO está si no hay APOYO_UNICO_URL', () => {
    expect(html).toMatch(/id="premium-subscribe-btn"[^>]*>Apoyar cada mes</);
    expect(html).not.toMatch(/apoyo-unico-btn/);
  });
});

describe('Enlace de apoyo único (Payment Link)', () => {
  test('el enlace de PRUEBA de Stripe no queda en ningún archivo publicado', () => {
    for (const f of ['premium.html', 'index.html', 'build.js', 'premium.js', 'sw.js', 'terminos.html', 'privacidad.html', 'tienda.html']) {
      expect(leer(f)).not.toMatch(/buy\.stripe\.com\/test_/);
    }
  });
  test('el botón solo se genera si existe la variable de entorno', () => {
    const build = leer('build.js');
    expect(build).toMatch(/apoyoUnicoUrl: process\.env\.APOYO_UNICO_URL \|\| ''/);
    expect(build).toMatch(/\$\{SITE\.apoyoUnicoUrl \? /);
  });
});

describe('Nombres en la interfaz', () => {
  test('el menú dice "Apoya el canal" y no "Hazte premium" en ninguna página', () => {
    for (const f of fs.readdirSync(frontend).filter((x) => x.endsWith('.html'))) {
      const html = leer(f);
      expect(html).not.toMatch(/Hazte premium/i);
      if (f !== 'admin.html') expect(html).toMatch(/Apoya el canal/);
    }
  });
  test('el rol premium se muestra como "Colaborador"', () => {
    for (const f of ['mi-cuenta.js', 'auth.js']) {
      expect(leer(f)).toMatch(/premium: 'Colaborador'/);
      expect(leer(f)).not.toMatch(/Premium activo/);
    }
  });
  test('mensajes tras el pago aprobados', () => {
    const js = leer('premium.js');
    expect(js).toMatch(/¡Gracias por apoyar a Sabías que PR!/);
    expect(js).toMatch(/Cancelaste el proceso\. No se hizo ningún cargo\./);
  });
});

describe('Términos y Privacidad', () => {
  const terminos = leer('terminos.html');
  const privacidad = leer('privacidad.html');

  test('Términos tiene la sección "Apoyo voluntario al canal" y la numeración sigue de 1 a 9 sin saltos', () => {
    expect(terminos).toMatch(/<h3>5\. Apoyo voluntario al canal<\/h3>/);
    const nums = [...terminos.matchAll(/<h3>(\d+)\. /g)].map((m) => Number(m[1]));
    expect(nums).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  test('la sección dice 18+, no deducible, insignia, 1000 palabras y cancelación', () => {
    const i = terminos.indexOf('5. Apoyo voluntario al canal');
    const sec = terminos.slice(i, terminos.indexOf('<h3>6.', i));
    expect(sec).toMatch(/mayores de 18 años/);
    expect(sec).toMatch(/no son donaciones deducibles de impuestos/);
    expect(sec).toMatch(/insignia "Colaborador"/);
    expect(sec).toMatch(/1000 palabras/);
    expect(sec).toMatch(/cancelar el apoyo mensual en cualquier momento/);
  });

  test('Privacidad cubre compras y apoyo voluntario y qué se guarda', () => {
    expect(privacidad).toMatch(/Compras y apoyo voluntario:/);
    expect(privacidad).toMatch(/el identificador de cliente de Stripe y el estado de tu apoyo mensual/);
  });

  test('la fecha de actualización de los textos legales tiene traducción al inglés', () => {
    const fecha = /const LEGAL_ACTUALIZADO = '([^']+)'/.exec(leer('build.js'))[1];
    expect(typeof dic[`Última actualización: ${fecha}`]).toBe('string');
  });
});

describe('Traducciones de la Fase 1', () => {
  const claves = [
    'Apoya el canal', 'Sabías que PR — Apoya el canal', 'Por qué existe este apoyo', 'Cómo puedes apoyar',
    'Apoyo mensual:', 'Apoyo único:', 'La tienda:', 'Apoyar cada mes', 'Apoyar una vez', 'Lo que debes saber',
    'No es una donación deducible de impuestos.', 'Colaborador', '5. Apoyo voluntario al canal',
    '6. Conducta del usuario', '9. Ley aplicable', 'Compras y apoyo voluntario:',
  ];
  test.each(claves)('"%s" está en inglés', (k) => {
    expect(typeof dic[k]).toBe('string');
    expect(dic[k].length).toBeGreaterThan(1);
  });
  test('el apoyo no se llama "donation" en inglés salvo para decir que NO es deducible', () => {
    const ingles = [dic['Los pagos los procesa Stripe; nosotros no vemos ni guardamos los datos de tu tarjeta.'], dic['Cómo puedes apoyar']].join(' ');
    expect(ingles).not.toMatch(/donat/i);
  });
});

describe('Muro de agradecimiento', () => {
  const premium = leer('premium.html');
  const cuenta = leer('mi-cuenta.html');

  test('"Apoya el canal" tiene la sección y su mensaje mientras no haya nombres', () => {
    expect(premium).toMatch(/id="agradecimientos"/);
    expect(premium).toMatch(/Gracias a quienes apoyan/);
    expect(premium).toMatch(/id="agradecimientos-lista"/);
    expect(premium).toMatch(/Todavía no hay nombres aquí\./);
  });

  test('premium.js pinta los nombres con textContent (nunca como HTML) y sin traducirlos', () => {
    const js = leer('premium.js');
    const fn = js.slice(js.indexOf('async function loadAgradecimientos'), js.indexOf('function setStatus'));
    expect(fn).toMatch(/li\.textContent = n/);
    expect(fn).not.toMatch(/li\.innerHTML|insertAdjacentHTML/);
    expect(fn).toMatch(/data-no-i18n/);
    expect(fn).toMatch(/\/api\/agradecimientos/);
  });

  test('Mi cuenta: formulario opt-in con casilla de autorización SIN marcar, y oculto por defecto', () => {
    expect(cuenta).toMatch(/id="cuenta-agradecimiento"[^>]*display:none/);
    expect(cuenta).toMatch(/<input type="checkbox" id="agradecimiento-acepto">/);
    expect(cuenta).not.toMatch(/id="agradecimiento-acepto"[^>]*checked/);
    expect(cuenta).toMatch(/Autorizo que este nombre se muestre públicamente/);
    expect(cuenta).toMatch(/id="agradecimiento-retirar"/);
    expect(cuenta).toMatch(/maxlength="40"/);
  });

  test('mi-cuenta.js solo muestra la sección a quien puede, exige la casilla y permite retirar', () => {
    const js = leer('mi-cuenta.js');
    expect(js).toMatch(/if \(!d\.puede\) return;/);
    expect(js).toMatch(/agradecimiento-acepto'\)\.checked/);
    expect(js).toMatch(/method: 'DELETE'/);
    expect(js).toMatch(/method: 'PUT'/);
  });

  test('Privacidad explica el reconocimiento opcional y cómo retirarlo', () => {
    const priv = leer('privacidad.html');
    expect(priv).toMatch(/Reconocimiento de colaboradores \(opcional\):/);
    expect(priv).toMatch(/puedes retirar tu autorización en Mi cuenta o escribiéndonos/);
  });

  test('textos del muro traducidos al inglés', () => {
    for (const k of ['Gracias a quienes apoyan', 'Muro de agradecimiento', 'Retirar mi nombre', 'Nombre que aparecerá',
      'Reconocimiento de colaboradores (opcional):', 'Tu nombre se retiró del muro.']) {
      expect(typeof dic[k]).toBe('string');
    }
  });

  test('las migraciones del muro existen y agregan solo columnas opcionales con límite de largo', () => {
    const sql = leer('backend/sql/migraciones/2026-10-04-agradecimientos.sql');
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS agradecimiento_nombre text NULL/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS agradecimiento_autorizado_en timestamptz NULL/);
    expect(sql).toMatch(/char_length\(agradecimiento_nombre\) BETWEEN 2 AND 40/);
    expect(leer('backend/sql/schema.sql')).toMatch(/agradecimiento_autorizado_en/);
  });
});
