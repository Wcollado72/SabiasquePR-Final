-- Quita la categoria "General" (decision del usuario 2026-10-03: todas las piezas llevan una categoria
-- descriptiva). Idempotente: se puede correr mas de una vez.
-- 1) Reclasifica lo que hoy es "general" (al 2026-10-03: solo el contenido "Primer Video", camaras 360 de
--    Puerto Rico) a "cultura". Si aparece otro contenido, revisar antes de correr.
-- 2) Reemplaza las restricciones CHECK de noticias y contenidos sin 'general'.
-- Aplicar en el proyecto de Supabase que use el sitio (SQL Editor o backend/scripts/apply-schema.js).
BEGIN;

UPDATE noticias   SET categoria = 'cultura' WHERE categoria = 'general';
UPDATE contenidos SET categoria = 'cultura' WHERE categoria = 'general';

ALTER TABLE noticias DROP CONSTRAINT IF EXISTS noticias_categoria_check;
ALTER TABLE noticias ADD CONSTRAINT noticias_categoria_check
  CHECK (categoria IN (
    'internacionales', 'crimen', 'salud', 'deportes', 'finanzas',
    'tecnologia', 'descubrimientos', 'politica', 'clima', 'cultura', 'ciencia'
  ));

ALTER TABLE contenidos DROP CONSTRAINT IF EXISTS contenidos_categoria_check;
ALTER TABLE contenidos ADD CONSTRAINT contenidos_categoria_check
  CHECK (categoria IN (
    'internacionales', 'crimen', 'salud', 'deportes', 'finanzas',
    'tecnologia', 'descubrimientos', 'politica', 'clima', 'cultura', 'ciencia',
    'leyes-educativas', 'estudiantes-sobresalientes', 'sistemas-mundiales', 'programas-educativos'
  ));

COMMIT;
