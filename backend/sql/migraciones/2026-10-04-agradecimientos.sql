-- Muro de agradecimiento (2026-10-04): quienes apoyan cada mes pueden AUTORIZAR que su nombre aparezca en la
-- pagina "Apoya el canal". Es opt-in: nadie aparece sin haberlo pedido.
--   agradecimiento_nombre          nombre/alias que se muestra (NULL = no autorizo / lo retiro)
--   agradecimiento_autorizado_en   cuando dio su autorizacion (constancia del consentimiento)
-- Idempotente: se puede correr mas de una vez. Aplicar en el proyecto de Supabase que use el sitio, ANTES de
-- publicar el backend que usa estas columnas.
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS agradecimiento_nombre text NULL;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS agradecimiento_autorizado_en timestamptz NULL;
ALTER TABLE perfiles DROP CONSTRAINT IF EXISTS perfiles_agradecimiento_nombre_check;
ALTER TABLE perfiles ADD CONSTRAINT perfiles_agradecimiento_nombre_check
  CHECK (agradecimiento_nombre IS NULL OR char_length(agradecimiento_nombre) BETWEEN 2 AND 40);
