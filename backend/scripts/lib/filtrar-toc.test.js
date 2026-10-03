const { filtrarToc, debeRestaurarse } = require('./filtrar-toc');

const MUESTRA = [
  '; Archive created at 2026-10-03',
  '2; 3079 16393 EXTENSION - pg_stat_statements ',
  '28; 2615 16498 SCHEMA - auth supabase_admin',
  '448; 1255 17483 FUNCTION public rls_auto_enable() postgres',
  '3722; 3466 17484 EVENT TRIGGER - ensure_rls postgres',
  '327; 1259 17503 TABLE public perfiles postgres',
  '4466; 0 17503 TABLE DATA public perfiles postgres',
  '4131; 2606 17512 CONSTRAINT public perfiles perfiles_pkey postgres',
  '4217; 2606 17513 FK CONSTRAINT public perfiles perfiles_id_fkey postgres',
  '3900; 0 0 ROW SECURITY public perfiles postgres',
  '4400; 0 16510 TABLE DATA auth identities supabase_auth_admin',
  '4401; 0 16500 TABLE DATA auth users supabase_auth_admin',
  '4402; 0 16520 TABLE DATA auth sessions supabase_auth_admin',
  '4403; 0 16530 TABLE DATA auth mfa_factors supabase_auth_admin',
  '4404; 0 16540 TABLE DATA auth refresh_tokens supabase_auth_admin',
  '4405; 0 16550 TABLE DATA storage buckets supabase_storage_admin',
  '406; 1255 16542 FUNCTION auth uid() supabase_auth_admin',
].join('\n');

describe('filtrarToc (restauracion en proyecto nuevo)', () => {
  test('conserva lo de public (tablas, datos, restricciones, FK, RLS)', () => {
    const { incluidas } = filtrarToc(MUESTRA);
    const texto = incluidas.join('\n');
    expect(texto).toMatch(/TABLE public perfiles/);
    expect(texto).toMatch(/TABLE DATA public perfiles/);
    expect(texto).toMatch(/CONSTRAINT public perfiles perfiles_pkey/);
    expect(texto).toMatch(/FK CONSTRAINT public perfiles perfiles_id_fkey/);
    expect(texto).toMatch(/ROW SECURITY public perfiles/);
  });

  test('conserva solo los DATOS de auth.users y auth.identities', () => {
    const { incluidas } = filtrarToc(MUESTRA);
    const texto = incluidas.join('\n');
    expect(texto).toMatch(/TABLE DATA auth users/);
    expect(texto).toMatch(/TABLE DATA auth identities/);
    expect(texto).not.toMatch(/sessions|mfa_factors|refresh_tokens/);
  });

  test('descarta esquemas gestionados, extensiones, event triggers y rls_auto_enable', () => {
    const { incluidas } = filtrarToc(MUESTRA);
    const texto = incluidas.join('\n');
    expect(texto).not.toMatch(/EXTENSION|SCHEMA|EVENT TRIGGER|rls_auto_enable|storage|FUNCTION auth/);
  });

  test('ignora comentarios y lineas vacias, y cuenta las excluidas', () => {
    const { incluidas, excluidas } = filtrarToc(MUESTRA);
    expect(incluidas).toHaveLength(7);
    expect(excluidas).toBe(9);
    expect(debeRestaurarse('esto no es una linea del indice')).toBe(false);
  });

  test('los datos de auth.users van ANTES que los de auth.identities (llave foranea)', () => {
    const { incluidas } = filtrarToc(MUESTRA);
    const iU = incluidas.findIndex((l) => /TABLE DATA auth users /.test(l));
    const iI = incluidas.findIndex((l) => /TABLE DATA auth identities /.test(l));
    expect(iU).toBeGreaterThanOrEqual(0);
    expect(iU).toBeLessThan(iI);
  });
});
