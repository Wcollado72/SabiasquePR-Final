const { fijarVariable, construirEnvEnsayo, armarDatabaseUrl } = require('./env-ensayo');

describe('env-ensayo', () => {
  const ORIGINAL = [
    'PORT=3000',
    'DATABASE_URL=postgresql://viejo',
    'SUPABASE_URL=https://viejo.supabase.co',
    'FRONTEND_ORIGIN=https://sabiasquepr.com',
    'STRIPE_SECRET_KEY=sk_test_algo',
    '',
  ].join('\n');

  test('cambia solo DATABASE_URL, SUPABASE_URL y FRONTEND_ORIGIN y conserva lo demas', () => {
    const r = construirEnvEnsayo(ORIGINAL, { databaseUrl: 'postgresql://nuevo', supabaseUrl: 'https://nuevo.supabase.co', frontendOrigin: 'http://localhost:8080' });
    expect(r).toMatch(/^DATABASE_URL=postgresql:\/\/nuevo$/m);
    expect(r).toMatch(/^SUPABASE_URL=https:\/\/nuevo\.supabase\.co$/m);
    expect(r).toMatch(/^FRONTEND_ORIGIN=http:\/\/localhost:8080$/m);
    expect(r).toMatch(/^PORT=3000$/m);
    expect(r).toMatch(/^STRIPE_SECRET_KEY=sk_test_algo$/m);
    expect(r).not.toMatch(/viejo/);
  });

  test('agrega las variables que no existian', () => {
    const r = fijarVariable('PORT=3000', 'SUPABASE_URL', 'https://x.supabase.co');
    expect(r).toBe('PORT=3000\nSUPABASE_URL=https://x.supabase.co\n');
  });

  test('un valor con $ o & no se interpreta como patron de reemplazo', () => {
    const r = fijarVariable('A=1\n', 'A', 'x$&y$1z');
    expect(r).toBe('A=x$&y$1z\n');
  });

  test('armarDatabaseUrl codifica la contrasena y usa el usuario postgres.<ref>', () => {
    const url = armarDatabaseUrl({ ref: 'abc', host: 'h.pooler.supabase.com', password: 'p@ss:w/rd' });
    expect(url).toBe('postgresql://postgres.abc:p%40ss%3Aw%2Frd@h.pooler.supabase.com:5432/postgres');
  });
});
