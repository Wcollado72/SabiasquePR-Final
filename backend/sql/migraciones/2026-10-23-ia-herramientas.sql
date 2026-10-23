-- Herramientas de IA usadas (2026-10-23): el admin marca QUE IA se uso en cada noticia/contenido (ademas de la
-- divulgacion no/parcial/generado). Cada elemento es una clave conocida en minuscula (claude, gemini, perplexity,
-- chatgpt, copilot) o un nombre libre de 1 a 40 caracteres; maximo 8 por pieza (lo valida la API y este CHECK).
-- Cambio ADITIVO: el backend anterior sigue funcionando con la columna presente (el DEFAULT cubre sus INSERT).
-- Idempotente: se puede correr mas de una vez. Aplicar en Supabase ANTES de publicar el backend que usa la columna.
ALTER TABLE noticias ADD COLUMN IF NOT EXISTS ia_herramientas text[] NOT NULL DEFAULT '{}';
ALTER TABLE noticias DROP CONSTRAINT IF EXISTS noticias_ia_herramientas_max;
ALTER TABLE noticias ADD CONSTRAINT noticias_ia_herramientas_max CHECK (cardinality(ia_herramientas) <= 8);

ALTER TABLE contenidos ADD COLUMN IF NOT EXISTS ia_herramientas text[] NOT NULL DEFAULT '{}';
ALTER TABLE contenidos DROP CONSTRAINT IF EXISTS contenidos_ia_herramientas_max;
ALTER TABLE contenidos ADD CONSTRAINT contenidos_ia_herramientas_max CHECK (cardinality(ia_herramientas) <= 8);
