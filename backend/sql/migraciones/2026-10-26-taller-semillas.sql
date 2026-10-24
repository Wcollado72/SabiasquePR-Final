-- Taller de Aliado Imperfekto (2026-10-26): cuaderno de «semillas» (ideas propias del autor) que los agentes del Taller
-- analizan y desarrollan. Cambio ADITIVO: una tabla nueva y mas nombres permitidos en la bitacora de uso de IA; no toca
-- ningun dato ni tabla existente, y el backend anterior sigue funcionando.
--  * semillas.analisis: ultimo resultado de cada agente, por nombre (grieta, cazadora, contrapunto), con el hash del texto analizado.
--  * semillas.desarrollos: borradores que La Farolera escribio a partir de la semilla.
--  * semillas.contenido_id: la pieza de Contenidos que se creo a partir de esta semilla (sin llave foranea: es un slug de texto).
-- Idempotente: se puede correr mas de una vez. Aplicar en Supabase ANTES de publicar el backend que usa la tabla.
CREATE TABLE IF NOT EXISTS semillas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  autor_id        uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  titulo          text NOT NULL DEFAULT '',
  texto           text NOT NULL,
  etiquetas       text[] NOT NULL DEFAULT '{}',
  estado          text NOT NULL DEFAULT 'semilla' CHECK (estado IN ('semilla', 'explorada', 'en_desarrollo', 'lista', 'pasada')),
  analisis        jsonb NOT NULL DEFAULT '{}',
  desarrollos     jsonb NOT NULL DEFAULT '[]',
  contenido_id    text,
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_en  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_semillas_autor ON semillas (autor_id, actualizado_en DESC);
ALTER TABLE semillas ENABLE ROW LEVEL SECURITY;

ALTER TABLE ia_generaciones DROP CONSTRAINT IF EXISTS ia_generaciones_agente_check;
ALTER TABLE ia_generaciones ADD CONSTRAINT ia_generaciones_agente_check
  CHECK (agente IN ('investigador', 'redactor', 'traductor', 'clasificadora', 'resumidora', 'correctora', 'guardiana', 'pintora', 'grieta', 'cazadora', 'contrapunto', 'farolera'));
