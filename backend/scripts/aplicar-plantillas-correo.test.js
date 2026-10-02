const fs = require('fs');
const path = require('path');
const { construirCambios } = require('./aplicar-plantillas-correo');

const plantillas = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', '..', 'docs', 'correos-supabase', 'plantillas.json'), 'utf8'
));

describe('construirCambios (plantillas de correo -> API de Supabase)', () => {
  test('usa los nombres de campo de la API para las 6 plantillas de autenticacion', () => {
    const c = construirCambios(plantillas);
    for (const k of ['confirmation', 'recovery', 'magic_link', 'email_change', 'invite', 'reauthentication']) {
      expect(typeof c[`mailer_subjects_${k}`]).toBe('string');
      expect(c[`mailer_templates_${k}_content`]).toMatch(/<html/);
    }
  });

  test('los avisos de seguridad usan el sufijo _notification y NO se activan por defecto', () => {
    const c = construirCambios(plantillas);
    expect(c.mailer_subjects_password_changed_notification).toBeTruthy();
    expect(c.mailer_templates_mfa_factor_enrolled_notification_content).toMatch(/\{\{ \.FactorType \}\}/);
    expect(Object.keys(c).some((k) => k.endsWith('_enabled'))).toBe(false);
  });

  test('--activar-notificaciones agrega solo los 6 interruptores', () => {
    const c = construirCambios(plantillas, { activarNotificaciones: true });
    const activados = Object.keys(c).filter((k) => k.endsWith('_enabled'));
    expect(activados).toHaveLength(6);
    expect(activados.every((k) => c[k] === true)).toBe(true);
  });

  test('conserva las variables de Supabase sin tocar y no hay secretos en las plantillas', () => {
    const c = construirCambios(plantillas);
    expect(c.mailer_templates_recovery_content).toMatch(/\{\{ \.ConfirmationURL \}\}/);
    expect(c.mailer_subjects_reauthentication).toContain('{{ .Token }}');
    expect(JSON.stringify(c)).not.toMatch(/sbp_|re_[A-Za-z0-9]{10}|service_role|sk_(live|test)/);
  });
});
