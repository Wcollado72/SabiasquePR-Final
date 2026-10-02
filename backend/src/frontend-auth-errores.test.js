// Prueba del traductor de errores de Supabase Auth (auth-errores.js, raiz del repo).
const { errorAuthEnEspanol, POR_CODIGO } = require('../../auth-errores.js');

describe('errorAuthEnEspanol', () => {
  test.each([
    ['same_password', 'La contraseña nueva debe ser diferente a la anterior.'],
    ['invalid_credentials', 'Correo o contraseña incorrectos.'],
    ['mfa_verification_failed', 'Ese código no es correcto. Revisa tu app de autenticación e inténtalo de nuevo.'],
  ])('traduce el codigo %s', (code, esperado) => {
    expect(errorAuthEnEspanol({ code, message: 'English message' })).toBe(esperado);
  });

  test('tambien acepta error_code (otro nombre que usa la API)', () => {
    expect(errorAuthEnEspanol({ error_code: 'weak_password', message: 'x' })).toBe(POR_CODIGO.weak_password);
  });

  test('un codigo desconocido muestra el mensaje original (mejor ingles que nada)', () => {
    expect(errorAuthEnEspanol({ code: 'algo_nuevo', message: 'Something new happened' })).toBe('Something new happened');
  });

  test('sin codigo ni mensaje, un texto generico en espanol; sin error, vacio', () => {
    expect(errorAuthEnEspanol({})).toBe('Ocurrió un error inesperado. Inténtalo de nuevo.');
    expect(errorAuthEnEspanol(null)).toBe('');
  });

  test('todas las traducciones estan en espanol y ninguna filtra detalles tecnicos', () => {
    for (const texto of Object.values(POR_CODIGO)) {
      expect(texto).toMatch(/[áéíóúñ.]/);
      expect(texto).not.toMatch(/supabase|jwt|token/i);
    }
  });

  test('el mensaje exacto que vio el usuario al cambiar contraseña ya no sale en ingles', () => {
    const lo_que_devuelve_supabase = { code: 'same_password', message: 'New password should be different from the old password.' };
    expect(errorAuthEnEspanol(lo_que_devuelve_supabase)).not.toMatch(/New password/);
  });
});
