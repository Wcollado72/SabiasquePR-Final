// auth-errores.js — traduce los errores de Supabase Auth al español.
// Supabase devuelve `error.code` (estable) y `error.message` (en inglés). Antes las
// pantallas mostraban el mensaje en inglés tal cual (ej. "New password should be
// different from the old password" al restablecer la contrasena). Aqui se
// mapea por CODIGO; si el codigo no esta en la lista, se muestra el mensaje original
// (mejor un mensaje en ingles que ninguno).
(function () {
  const POR_CODIGO = {
    invalid_credentials: 'Correo o contraseña incorrectos.',
    email_not_confirmed: 'Todavía no confirmas tu correo. Revisa tu bandeja de entrada (y la carpeta de spam).',
    user_already_exists: 'Ya existe una cuenta con ese correo. Prueba iniciando sesión.',
    email_exists: 'Ya existe una cuenta con ese correo. Prueba iniciando sesión.',
    weak_password: 'Esa contraseña es demasiado débil. Usa 8 o más caracteres con mayúsculas, minúsculas, números y símbolos.',
    same_password: 'La contraseña nueva debe ser diferente a la anterior.',
    over_email_send_rate_limit: 'Pediste demasiados correos seguidos. Espera unos minutos e inténtalo de nuevo.',
    over_request_rate_limit: 'Demasiados intentos seguidos. Espera unos minutos e inténtalo de nuevo.',
    captcha_failed: 'No se pudo completar la verificación de seguridad. Inténtalo de nuevo.',
    otp_expired: 'El enlace o el código expiró. Pide uno nuevo.',
    signup_disabled: 'Los registros están desactivados por ahora.',
    insufficient_aal: 'Falta la verificación en dos pasos.',
    mfa_verification_failed: 'Ese código no es correcto. Revisa tu app de autenticación e inténtalo de nuevo.',
    mfa_challenge_expired: 'El código expiró. Escribe el nuevo que muestra tu app.',
  };

  function errorAuthEnEspanol(error) {
    if (!error) return '';
    const codigo = error.code || error.error_code;
    return POR_CODIGO[codigo] || error.message || 'Ocurrió un error inesperado. Inténtalo de nuevo.';
  }

  if (typeof window !== 'undefined') window.sqprErrorAuth = errorAuthEnEspanol;
  if (typeof module !== 'undefined' && module.exports) module.exports = { errorAuthEnEspanol, POR_CODIGO };
})();
