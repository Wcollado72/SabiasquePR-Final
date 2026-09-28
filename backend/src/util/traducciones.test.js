jest.mock('../db', () => ({ pool: { query: jest.fn() } }));

const { pool } = require('../db');
const { aplicarTraducciones, normalizarLang, mezclar, idiomaOriginalDe } = require('./traducciones');

beforeEach(() => pool.query.mockReset());

describe('normalizarLang / idiomaOriginalDe', () => {
  test('solo acepta es/en; el idioma original por defecto es espanol', () => {
    expect(normalizarLang('en')).toBe('en');
    expect(normalizarLang('es')).toBe('es');
    expect(normalizarLang('fr')).toBeNull();
    expect(normalizarLang(undefined)).toBeNull();
    expect(idiomaOriginalDe({})).toBe('es');
    expect(idiomaOriginalDe({ idioma_original: 'en' })).toBe('en');
  });
});

describe('mezclar', () => {
  test('superpone solo campos permitidos y con contenido', () => {
    const fila = { id: 'a', titulo: 'Titulo', parrafos: ['uno'], precio: 5, imagen_alt: 'alt es' };
    const r = mezclar(fila, 'noticia', { titulo: 'Title', parrafos: [], imagen_alt: '  ', precio: 99 });
    expect(r).toEqual({ id: 'a', titulo: 'Title', parrafos: ['uno'], precio: 5, imagen_alt: 'alt es' });
  });
});

describe('aplicarTraducciones', () => {
  const filas = [{ id: 'a', titulo: 'Hola' }, { id: 'b', titulo: 'Adios' }];

  test('sin lang valido devuelve las filas intactas y no consulta la base', async () => {
    expect(await aplicarTraducciones('noticia', filas, undefined)).toBe(filas);
    expect(await aplicarTraducciones('noticia', filas, 'fr')).toBe(filas);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('en el idioma original no consulta y marca sin_traduccion=false', async () => {
    const r = await aplicarTraducciones('noticia', filas, 'es');
    expect(pool.query).not.toHaveBeenCalled();
    expect(r.every((f) => f.sin_traduccion === false && f.idioma_mostrado === 'es')).toBe(true);
  });

  test('superpone la traduccion existente y marca la que falta', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ item_id: 'a', campos: { titulo: 'Hello' } }] });
    const r = await aplicarTraducciones('noticia', filas, 'en');
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query.mock.calls[0][1]).toEqual(['noticia', 'en', ['a', 'b']]);
    expect(r[0]).toMatchObject({ id: 'a', titulo: 'Hello', idioma_mostrado: 'en', sin_traduccion: false });
    expect(r[1]).toMatchObject({ id: 'b', titulo: 'Adios', idioma_mostrado: 'es', sin_traduccion: true });
  });

  test('una pieza escrita en ingles se muestra tal cual en ingles y busca traduccion al espanol', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const r = await aplicarTraducciones('contenido', [
      { id: 'x', titulo: 'Original EN', idioma_original: 'en' },
      { id: 'y', titulo: 'Original ES', idioma_original: 'es' },
    ], 'en');
    expect(pool.query.mock.calls[0][1]).toEqual(['contenido', 'en', ['y']]);
    expect(r[0]).toMatchObject({ idioma_mostrado: 'en', sin_traduccion: false });
    expect(r[1]).toMatchObject({ idioma_mostrado: 'es', sin_traduccion: true });
  });

  test('si la consulta falla (migracion sin aplicar) degrada al original sin romper', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    pool.query.mockRejectedValueOnce(new Error('relation "traducciones" does not exist'));
    const r = await aplicarTraducciones('noticia', filas, 'en');
    expect(r.every((f) => f.sin_traduccion === true && f.idioma_mostrado === 'es')).toBe(true);
    spy.mockRestore();
  });

  test('lista vacia no consulta', async () => {
    expect(await aplicarTraducciones('noticia', [], 'en')).toEqual([]);
    expect(pool.query).not.toHaveBeenCalled();
  });
});
