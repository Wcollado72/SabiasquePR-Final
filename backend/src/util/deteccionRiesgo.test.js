const { detectarRiesgo } = require('./deteccionRiesgo');

describe('detectarRiesgo', () => {
  test('null con texto normal, sin patrones de riesgo', () => {
    expect(detectarRiesgo('Me parece un articulo muy interesante, gracias por compartirlo.')).toBeNull();
  });

  test('null si no hay texto', () => {
    expect(detectarRiesgo('')).toBeNull();
    expect(detectarRiesgo(null)).toBeNull();
    expect(detectarRiesgo(undefined)).toBeNull();
  });

  test('detecta solicitud de contacto fuera de la plataforma (whatsapp)', () => {
    expect(detectarRiesgo('agregame a whatsapp para seguir hablando')).toBe('Solicitud de contacto fuera de la plataforma');
  });

  test('detecta solicitud de contacto fuera de la plataforma (dame tu numero)', () => {
    expect(detectarRiesgo('dame tu numero y seguimos por ahi')).toBe('Solicitud de contacto fuera de la plataforma');
  });

  test('detecta solicitud de contacto en ingles (add me on snapchat)', () => {
    expect(detectarRiesgo('add me on snapchat if you want')).toBe('Solicitud de contacto fuera de la plataforma');
  });

  test('detecta lenguaje de secreto (no le digas a tus papas)', () => {
    expect(detectarRiesgo('esto es entre nosotros, no le digas a tus papas')).toBe('Lenguaje de secreto/aislamiento');
  });

  test('detecta lenguaje de secreto en ingles', () => {
    expect(detectarRiesgo("this is our little secret, don't tell your parents")).toBe('Lenguaje de secreto/aislamiento');
  });

  test('detecta solicitud de fotos', () => {
    expect(detectarRiesgo('mandame una foto tuya ahora')).toBe('Solicitud de fotos/contenido personal');
  });

  test('detecta solicitud de fotos en ingles', () => {
    expect(detectarRiesgo('send me a pic of you please')).toBe('Solicitud de fotos/contenido personal');
  });

  test('detecta combinacion edad + apariencia', () => {
    expect(detectarRiesgo('cuantos anos tienes? te ves muy linda en esa foto')).toBe('Combinación edad + apariencia');
  });

  test('no marca solo preguntar la edad sin el resto del patron (evita falso positivo obvio)', () => {
    expect(detectarRiesgo('cuantos anos tiene el proyecto sabias que pr?')).toBeNull();
  });

  test('devuelve la primera categoria que coincide cuando hay varias', () => {
    const resultado = detectarRiesgo('agregame a whatsapp, no le digas a tus papas');
    expect(resultado).toBe('Solicitud de contacto fuera de la plataforma');
  });
});
