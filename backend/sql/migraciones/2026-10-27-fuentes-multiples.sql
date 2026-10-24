-- Varias fuentes por pieza (2026-10-27, Taller E4): ademas de la fuente principal (fuente_url + fuente_texto, que siguen
-- igual), una noticia o un contenido puede guardar OTRAS fuentes: una lista de { nombre, url } (hasta 4). Cambio ADITIVO:
-- una columna nueva con valor por defecto en cada tabla; no toca ningun dato y el backend anterior sigue funcionando.
-- Plan de vuelta atras: ALTER TABLE ... DROP COLUMN fuentes (no hay nada mas que dependa de ella).
-- Idempotente: se puede correr mas de una vez. Aplicar en Supabase ANTES de publicar el backend que usa la columna.
ALTER TABLE contenidos ADD COLUMN IF NOT EXISTS fuentes jsonb NOT NULL DEFAULT '[]';
ALTER TABLE noticias   ADD COLUMN IF NOT EXISTS fuentes jsonb NOT NULL DEFAULT '[]';
