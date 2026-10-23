// Aplica las plantillas de correo en español (docs/interno/correos-supabase/plantillas.json,
// generadas con docs/interno/generate_correos_supabase.py) al proyecto de Supabase usando la
// API de gestion, en vez de pegar 12 plantillas a mano en el panel.
//
// SEGURIDAD: el token de acceso personal lo pones TU en tu propia terminal
// (variable SUPABASE_ACCESS_TOKEN); este script nunca lo imprime ni lo guarda, y no
// hace falta compartirlo con nadie. Crealo en https://supabase.com/dashboard/account/tokens
// y revocalo cuando termines.
//
// Uso (desde backend/):
//   $env:SUPABASE_ACCESS_TOKEN = "sbp_..."        (PowerShell)   |   export SUPABASE_ACCESS_TOKEN=sbp_...
//   node scripts/aplicar-plantillas-correo.js                 -> simulacro: solo muestra que cambiaria
//   node scripts/aplicar-plantillas-correo.js --aplicar       -> aplica las 6 plantillas de autenticacion
//   node scripts/aplicar-plantillas-correo.js --aplicar --activar-notificaciones
//                                                             -> ademas activa los 6 avisos de seguridad
// Antes de aplicar guarda una copia de las plantillas actuales en la carpeta temporal.
const fs = require('fs');
const os = require('os');
const path = require('path');

const PROJECT_REF = process.env.PROJECT_REF || 'qmlhjacduuvptxglqxqn';
const API = `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`;
const PLANTILLAS = path.join(__dirname, '..', '..', 'docs', 'interno', 'correos-supabase', 'plantillas.json');

// Convierte plantillas.json en el cuerpo del PATCH. Nombres de campo segun la
// documentacion de Supabase (Management API, "Email Templates").
function construirCambios(plantillas, { activarNotificaciones = false } = {}) {
  const cambios = {};
  for (const [clave, t] of Object.entries(plantillas.autenticacion || {})) {
    cambios[`mailer_subjects_${clave}`] = t.asunto;
    cambios[`mailer_templates_${clave}_content`] = t.html;
  }
  for (const [clave, t] of Object.entries(plantillas.notificaciones || {})) {
    cambios[`mailer_subjects_${clave}_notification`] = t.asunto;
    cambios[`mailer_templates_${clave}_notification_content`] = t.html;
    if (activarNotificaciones) cambios[`mailer_notifications_${clave}_enabled`] = true;
  }
  return cambios;
}

async function llamar(metodo, cuerpo) {
  const res = await fetch(API, {
    method: metodo,
    headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  if (!res.ok) {
    // El cuerpo del error de Supabase explica el motivo (por ejemplo, que permiso
    // le falta al token). No incluye el token, asi que es seguro mostrarlo.
    const detalle = (await res.text().catch(() => '')).slice(0, 400);
    throw new Error(
      `La API de Supabase respondio ${res.status} al hacer ${metodo}`
      + `${res.status === 401 ? ' (revisa que el token sea valido y no haya caducado)' : ''}`
      + `${res.status === 403 ? ' (el token no tiene permiso para esta accion)' : ''}.`
      + `${detalle ? `\nMensaje de Supabase: ${detalle}` : ''}`
    );
  }
  return res.json();
}

async function main() {
  const aplicar = process.argv.includes('--aplicar');
  const activarNotificaciones = process.argv.includes('--activar-notificaciones');
  if (!process.env.SUPABASE_ACCESS_TOKEN) {
    console.error('Falta la variable SUPABASE_ACCESS_TOKEN (ver las instrucciones al inicio de este archivo).');
    process.exit(1);
  }
  const plantillas = JSON.parse(fs.readFileSync(PLANTILLAS, 'utf8'));
  const cambios = construirCambios(plantillas, { activarNotificaciones });

  console.log(`${aplicar ? 'APLICANDO' : 'SIMULACRO (no se cambia nada)'} -- proyecto ${PROJECT_REF}`);
  for (const [campo, valor] of Object.entries(cambios)) {
    console.log(`  ${campo.padEnd(62)} ${typeof valor === 'string' ? valor.length + ' caracteres' : String(valor)}`);
  }
  if (!aplicar) {
    console.log('\nAgrega --aplicar para escribirlos de verdad.');
    return;
  }

  const actual = await llamar('GET');
  const respaldo = path.join(os.tmpdir(), `supabase-plantillas-anteriores-${Date.now()}.json`);
  const previas = Object.fromEntries(Object.entries(actual).filter(([k]) => k.startsWith('mailer_')));
  fs.writeFileSync(respaldo, JSON.stringify(previas, null, 2));
  console.log(`\nCopia de las plantillas anteriores: ${respaldo}`);

  await llamar('PATCH', cambios);
  console.log('Listo: plantillas aplicadas. Pruebalo con "¿Olvidaste tu contraseña?" y revoca el token si ya no lo necesitas.');
}

if (require.main === module) {
  main().catch((err) => { console.error('Error:', err.message); process.exit(1); });
}

module.exports = { construirCambios };
