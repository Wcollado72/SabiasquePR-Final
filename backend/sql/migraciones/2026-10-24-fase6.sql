-- Fase 6 (2026-10-24), tres cambios ADITIVOS que el backend anterior tolera:
--  1. contenidos.publicado: borrador / AL AIRE, igual que noticias. Las piezas existentes quedan publicadas (DEFAULT true).
--  2. reportes.tipo admite 'articulo_comentario' (comentarios de noticias y contenidos, ademas de los del debate).
--  3. Indices unicos parciales: una persona no puede tener dos reportes PENDIENTES del mismo elemento, y un
--     elemento no acumula reportes automaticos pendientes repetidos.
-- Idempotente: se puede correr mas de una vez. Aplicar en Supabase ANTES de publicar el backend que los usa.
ALTER TABLE contenidos ADD COLUMN IF NOT EXISTS publicado boolean NOT NULL DEFAULT true;

ALTER TABLE reportes DROP CONSTRAINT IF EXISTS reportes_tipo_check;
ALTER TABLE reportes ADD CONSTRAINT reportes_tipo_check
  CHECK (tipo IN ('debate_post', 'debate_comentario', 'articulo_comentario'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_reportes_pendiente_por_persona
  ON reportes (tipo, item_id, reportado_por)
  WHERE estado = 'pendiente' AND reportado_por IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_reportes_automatico_pendiente
  ON reportes (tipo, item_id)
  WHERE estado = 'pendiente' AND automatico;
