-- Costos por agente (2026-10-25): la bitacora ia_generaciones solo distinguia tres oficios (investigador, redactor,
-- traductor), asi que el gasto de Dona Fichas, Dona Breve, Dona Tilde, La Guardiana y La Pintora se sumaba al de
-- «redactor». Se agregan sus nombres a la lista permitida. Cambio ADITIVO: las filas existentes siguen valiendo y el
-- backend anterior sigue funcionando (solo escribe los tres nombres de antes).
-- Idempotente: se puede correr mas de una vez. Aplicar en Supabase ANTES de publicar el backend que escribe los nombres nuevos.
ALTER TABLE ia_generaciones DROP CONSTRAINT IF EXISTS ia_generaciones_agente_check;
ALTER TABLE ia_generaciones ADD CONSTRAINT ia_generaciones_agente_check
  CHECK (agente IN ('investigador', 'redactor', 'traductor', 'clasificadora', 'resumidora', 'correctora', 'guardiana', 'pintora'));
