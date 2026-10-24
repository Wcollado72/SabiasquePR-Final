jest.mock('../middleware/auth', () => require('../test-utils/authMock'));
jest.mock('../db', () => ({ pool: { query: jest.fn(), connect: jest.fn() } }));

// Taller E4: «otras fuentes» (columna `fuentes`) de las noticias y de los contenidos.
const request = require('supertest');
const { buildApp } = require('../app');
const { pool } = require('../db');

const app = buildApp();
const ADMIN = JSON.stringify({ id: 'admin-1', rol: 'admin' });

const CONTENIDO = {
  seccion: 'educacion', tipoFormato: 'lectura_corta', categoria: 'leyes-educativas', titulo: 'Un titulo cualquiera',
  subtituloResumen: 'Un resumen de al menos diez caracteres.', urlPortada: 'images/educacion.webp', portadaAlt: 'Descripcion', fechaPublicacion: '2026-01-15',
};
const NOTICIA = {
  titulo: 'Un titulo cualquiera', fecha: '2026-01-15', categoria: 'salud', imagen: 'images/foto.webp', imagenAlt: 'Descripcion',
  fuenteUrl: 'https://ejemplo.com', fuenteTexto: 'Ejemplo News', parrafos: ['Primer parrafo.'],
};
const FUENTES = [
  { nombre: '  Diario Uno ', url: ' https://uno.com/nota ' },
  { nombre: 'Diario Dos', url: 'https://uno.com/nota' }, // el mismo enlace: no se repite
  { nombre: 'Libro sin enlace' },
];

beforeEach(() => {
  pool.query.mockReset();
  pool.connect.mockReset();
});

describe.each([
  ['contenidos', '/api/contenidos', CONTENIDO, 'contenido', 31],
  ['noticias', '/api/noticias', NOTICIA, 'noticia', 18],
])('otras fuentes en %s', (nombre, ruta, valido, clave, posicion) => {
  const ultimo = (llamada) => pool.query.mock.calls[llamada][1][posicion - 1];

  test('al crear, se guardan limpias (sin espacios ni enlaces repetidos) como JSON en el último parámetro', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id: 'x' }] });
    const res = await request(app).post(ruta).set('x-test-user', ADMIN).send({ ...valido, fuentes: FUENTES });
    expect(res.status).toBe(201);
    expect(JSON.parse(ultimo(1))).toEqual([{ nombre: 'Diario Uno', url: 'https://uno.com/nota' }, { nombre: 'Libro sin enlace', url: '' }]);
    expect(pool.query.mock.calls[1][0]).toContain(`$${posicion}::jsonb`);
  });

  test('sin «fuentes» al crear se guarda una lista vacía', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id: 'x' }] });
    expect((await request(app).post(ruta).set('x-test-user', ADMIN).send(valido)).status).toBe(201);
    expect(ultimo(1)).toBe('[]');
  });

  test.each([
    ['más de 4 fuentes', Array.from({ length: 5 }, (_, i) => ({ nombre: `F${i}` }))],
    ['una fuente sin nombre', [{ url: 'https://x.com' }]],
    ['un enlace que no es http(s)', [{ nombre: 'Mala', url: 'javascript:alert(1)' }]],
    ['algo que no es una lista', 'https://x.com'],
  ])('400 con %s, sin tocar la base', async (_, fuentes) => {
    const res = await request(app).post(ruta).set('x-test-user', ADMIN).send({ ...valido, fuentes });
    expect(res.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('al editar sin «fuentes» se conservan las que ya tenía, y con «fuentes» se reemplazan', async () => {
    const existente = { id: 'a', ...(nombre === 'contenidos' ? { seccion: 'educacion', tipo_formato: 'lectura_corta', categoria: 'leyes-educativas', titulo: 'T', subtitulo_resumen: 'Resumen largo.', url_portada: 'i', portada_alt: 'a', fecha_publicacion: '2026-01-01' } : { titulo: 'T', fecha: '2026-01-01', categoria: 'salud', imagen: 'i', imagen_alt: 'a', fuente_url: 'https://e.com', fuente_texto: 'E', parrafos: ['p'] }), fuentes: [{ nombre: 'Vieja', url: '' }] };
    pool.query.mockResolvedValueOnce({ rows: [existente] }).mockResolvedValueOnce({ rows: [{ id: 'a' }] });
    expect((await request(app).put(`${ruta}/a`).set('x-test-user', ADMIN).send({ titulo: 'Nuevo titulo' })).status).toBe(200);
    expect(JSON.parse(ultimo(1))).toEqual([{ nombre: 'Vieja', url: '' }]);

    pool.query.mockReset();
    pool.query.mockResolvedValueOnce({ rows: [existente] }).mockResolvedValueOnce({ rows: [{ id: 'a' }] });
    const res = await request(app).put(`${ruta}/a`).set('x-test-user', ADMIN).send({ fuentes: [{ nombre: 'Nueva', url: 'https://n.com' }] });
    expect(res.status).toBe(200);
    expect(JSON.parse(ultimo(1))).toEqual([{ nombre: 'Nueva', url: 'https://n.com' }]);
    expect(res.body[clave]).toBeDefined();

    pool.query.mockReset();
    pool.query.mockResolvedValueOnce({ rows: [existente] }).mockResolvedValueOnce({ rows: [{ id: 'a' }] });
    expect((await request(app).put(`${ruta}/a`).set('x-test-user', ADMIN).send({ fuentes: [] })).status).toBe(200);
    expect(ultimo(1)).toBe('[]'); // se pueden quitar todas
  });
});
