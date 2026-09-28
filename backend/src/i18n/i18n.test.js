const {
  normalizar, idiomaGuardado, esPaginaAdmin, localeFecha, formatear,
  compilarPatrones, traducirTexto, traducir,
} = require('../../../i18n.js');

describe('normalizar', () => {
  test('colapsa espacios y saltos de linea, y recorta', () => {
    expect(normalizar('  Hola \n  mundo\t ')).toBe('Hola mundo');
    expect(normalizar(null)).toBe('');
  });
});

describe('idioma', () => {
  test('solo "en" es ingles; cualquier otra cosa cae a espanol', () => {
    expect(idiomaGuardado('en')).toBe('en');
    expect(idiomaGuardado('es')).toBe('es');
    expect(idiomaGuardado('fr')).toBe('es');
    expect(idiomaGuardado(null)).toBe('es');
  });

  test('locale de fechas por idioma', () => {
    expect(localeFecha('en')).toBe('en-US');
    expect(localeFecha('es')).toBe('es-PR');
  });

  test('detecta la pagina de administracion con y sin .html', () => {
    expect(esPaginaAdmin('/admin')).toBe(true);
    expect(esPaginaAdmin('/admin.html')).toBe(true);
    expect(esPaginaAdmin('/administrador.html')).toBe(false);
    expect(esPaginaAdmin('/index.html')).toBe(false);
  });
});

describe('formatear', () => {
  test('sustituye {variables} y deja las desconocidas intactas', () => {
    expect(formatear('Hace {n} dias por {quien}', { n: 3, quien: 'ti' })).toBe('Hace 3 dias por ti');
    expect(formatear('Hola {x}', {})).toBe('Hola {x}');
    expect(formatear('Sin variables')).toBe('Sin variables');
  });
});

describe('traducirTexto', () => {
  const dic = { Noticias: 'News', 'Iniciar sesión': 'Sign in', 'Hace {n} días': '{n} days ago', 'Total: {monto}': 'Total: {monto}' };
  const patrones = compilarPatrones(dic);

  test('traduce exacto conservando espacios de los extremos', () => {
    expect(traducirTexto(dic, '  Noticias\n ', patrones)).toBe('  News\n ');
  });

  test('normaliza espacios internos antes de buscar', () => {
    expect(traducirTexto(dic, 'Iniciar   \n sesión', patrones)).toBe('Sign in');
  });

  test('deja igual lo que no esta en el diccionario y el texto vacio', () => {
    expect(traducirTexto(dic, 'Texto desconocido', patrones)).toBe('Texto desconocido');
    expect(traducirTexto(dic, '   ', patrones)).toBe('   ');
  });

  test('usa claves con {variables} como patrones', () => {
    expect(traducirTexto(dic, 'Hace 5 días', patrones)).toBe('5 days ago');
    expect(traducirTexto(dic, 'Total: $12.00', patrones)).toBe('Total: $12.00');
  });

  test('no se confunde con claves del prototipo de Object', () => {
    expect(traducirTexto({}, 'constructor', [])).toBe('constructor');
    expect(traducirTexto({}, 'toString', [])).toBe('toString');
  });

  test('un texto en ingles (ya traducido) no cambia otra vez', () => {
    expect(traducirTexto(dic, 'News', patrones)).toBe('News');
  });
});

describe('traducir (t)', () => {
  test('traduce e interpola; sin diccionario devuelve el original interpolado', () => {
    const dic = { 'Hola {n}': 'Hello {n}' };
    const patrones = compilarPatrones(dic);
    expect(traducir(dic, 'Hola {n}', { n: 2 }, patrones)).toBe('Hello 2');
    expect(traducir({}, 'Hola {n}', { n: 2 }, [])).toBe('Hola 2');
  });
});

describe('compilarPatrones', () => {
  test('escapa caracteres especiales de la clave', () => {
    const dic = { '¿Seguro? (sí) {n}': 'Sure? (yes) {n}' };
    const p = compilarPatrones(dic);
    expect(traducirTexto(dic, '¿Seguro? (sí) 4', p)).toBe('Sure? (yes) 4');
    expect(traducirTexto(dic, 'Seguro sí 4', p)).toBe('Seguro sí 4');
  });

  test('ignora claves sin variables y valores que no son texto', () => {
    expect(compilarPatrones({ Hola: 'Hi', 'X {n}': 5 })).toEqual([]);
  });
});
