const { nombreVisibleSql } = require('./autorVisible');

describe('nombreVisibleSql', () => {
  test('usa el nombre del perfil y, si no hay, un alias generico derivado del id', () => {
    const sql = nombreVisibleSql('pf');
    expect(sql).toContain("NULLIF(BTRIM(pf.nombre), '')");
    expect(sql).toContain("'Participante-' || SUBSTR(MD5(pf.id::text), 1, 4)");
  });

  test('nunca incluye el correo y respeta el alias de tabla pedido', () => {
    expect(nombreVisibleSql('x')).not.toMatch(/email/i);
    expect(nombreVisibleSql('x')).toContain('x.nombre');
  });
});
