-- Esquema inicial de Sabias que PR
-- Fase 1: solo estructura. Los endpoints CRUD se conectan en la Fase 2.

CREATE TABLE IF NOT EXISTS noticias (
  id              text PRIMARY KEY,
  titulo          text NOT NULL,
  fecha           date NOT NULL,
  fecha_display   text NOT NULL,
  imagen          text NOT NULL,
  imagen_alt      text NOT NULL,
  imagen_caption  text NOT NULL,
  clase           text NOT NULL,
  fuente_url      text NOT NULL,
  fuente_texto    text NOT NULL,
  parrafos        jsonb NOT NULL DEFAULT '[]',
  creado_en       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS productos (
  id              text PRIMARY KEY,
  nombre          text NOT NULL,
  descripcion     text NOT NULL,
  precio          numeric(10,2) NOT NULL,
  imagen          text NOT NULL,
  imagen_alt      text NOT NULL,
  stripe_link     text,
  disponible      boolean NOT NULL DEFAULT true,
  creado_en       timestamptz NOT NULL DEFAULT now()
);

-- Perfil extendido de cada usuario de Supabase Auth (auth.users)
CREATE TABLE IF NOT EXISTS perfiles (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           text NOT NULL,
  rol             text NOT NULL DEFAULT 'usuario' CHECK (rol IN ('usuario', 'admin')),
  creado_en       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mensajes_contacto (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          text NOT NULL,
  email           text NOT NULL,
  motivo          text NOT NULL,
  mensaje         text NOT NULL,
  creado_en       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS suscriptores (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text NOT NULL UNIQUE,
  creado_en       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ordenes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id          uuid REFERENCES perfiles(id) ON DELETE SET NULL,
  items               jsonb NOT NULL,
  total               numeric(10,2) NOT NULL,
  stripe_session_id   text,
  estado              text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagada', 'cancelada')),
  creado_en           timestamptz NOT NULL DEFAULT now()
);

-- Publicaciones del foro comunitario
CREATE TABLE IF NOT EXISTS foro_posts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  autor_id        uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  titulo          text NOT NULL,
  cuerpo          text NOT NULL,
  categoria       text NOT NULL DEFAULT 'general'
                    CHECK (categoria IN ('general','tecnologia','internacionales','nuevos-humanos','educacion')),
  creado_en       timestamptz NOT NULL DEFAULT now(),
  editado_en      timestamptz
);

-- Comentarios de cada publicacion
CREATE TABLE IF NOT EXISTS foro_comentarios (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id         uuid NOT NULL REFERENCES foro_posts(id) ON DELETE CASCADE,
  autor_id        uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  cuerpo          text NOT NULL,
  creado_en       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_foro_posts_categoria      ON foro_posts(categoria, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_foro_comentarios_post_id  ON foro_comentarios(post_id, creado_en ASC);

-- Suscripciones premium (Stripe). Se agregan via ALTER porque
-- CREATE TABLE IF NOT EXISTS no modifica una tabla ya existente.
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS stripe_customer_id     text;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

-- Ampliar el rol permitido para incluir 'premium'.
ALTER TABLE perfiles DROP CONSTRAINT IF EXISTS perfiles_rol_check;
ALTER TABLE perfiles ADD CONSTRAINT perfiles_rol_check
  CHECK (rol IN ('usuario', 'admin', 'premium'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_perfiles_stripe_customer_id
  ON perfiles(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- Categoria de cada noticia (separada de 'clase', que es solo para
-- estilos CSS). Permite filtrar el feed de Noticias por tema.
ALTER TABLE noticias ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'general';

-- (El CHECK de esta columna se define mas abajo, junto al rename
-- 'crimenes' -> 'crimen': definirlo tambien aqui con la lista vieja
-- rompia cada re-corrida del script en cuanto existia una fila con el
-- valor nuevo.)

CREATE INDEX IF NOT EXISTS idx_noticias_categoria ON noticias(categoria, fecha DESC);

-- Noticia destacada de la portada. Solo puede haber una a la vez: el indice
-- unico parcial lo garantiza a nivel de base de datos (el backend limpia la
-- anterior dentro de la misma transaccion antes de marcar la nueva).
ALTER TABLE noticias ADD COLUMN IF NOT EXISTS destacado boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_noticias_un_destacado
  ON noticias (destacado) WHERE destacado;

-- La pagina "Critica Internacional" se retiro; sus temas se fusionaron
-- en la categoria "internacionales". Reasignar publicaciones existentes
-- antes de endurecer el CHECK (el CREATE TABLE de arriba no modifica una
-- tabla ya existente).
UPDATE foro_posts SET categoria = 'internacionales' WHERE categoria = 'critica-internacional';

ALTER TABLE foro_posts DROP CONSTRAINT IF EXISTS foro_posts_categoria_check;
ALTER TABLE foro_posts ADD CONSTRAINT foro_posts_categoria_check
  CHECK (categoria IN ('general', 'tecnologia', 'internacionales', 'nuevos-humanos', 'educacion'));

-- Contenido multi-formato (video/ensayo/noticia/lectura_corta) para las
-- secciones "Revolución Humana" y "Educación", que antes eran cajas de
-- texto estáticas. Tabla separada de `noticias`: esta última se mantiene
-- 100% periodística (RSS, tono de noticia), mientras que `contenidos`
-- alimenta secciones editoriales de formato mixto.
CREATE TABLE IF NOT EXISTS contenidos (
  id                text PRIMARY KEY,                    -- slug
  seccion           text NOT NULL
                      CHECK (seccion IN ('revolucion-humana', 'educacion')),
  tipo_formato      text NOT NULL
                      CHECK (tipo_formato IN ('video', 'ensayo', 'noticia', 'lectura_corta')),
  categoria         text NOT NULL DEFAULT 'general'
                      CHECK (categoria IN (
                        'general', 'internacionales', 'crimenes', 'salud', 'deportes',
                        'finanzas', 'tecnologia', 'descubrimientos', 'politica', 'clima', 'cultura'
                      )),
  titulo            text NOT NULL,
  subtitulo_resumen text NOT NULL,                       -- dek: 2-3 oraciones, redacción propia
  cuerpo            text,                                -- opcional: texto largo propio (ensayo/lectura_corta)
  autor             text,
  url_media         text,                                -- video embebible (NULL si no aplica)
  fuente_url        text,                                -- enlace a la fuente/medio original
  fuente_texto      text,                                -- nombre visible de esa fuente
  duracion_min      integer NOT NULL DEFAULT 1 CHECK (duracion_min > 0),
  url_portada       text NOT NULL,
  portada_alt       text NOT NULL,
  fecha_publicacion date NOT NULL,
  destacado         boolean NOT NULL DEFAULT false,
  creado_en         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contenidos_seccion
  ON contenidos(seccion, categoria, fecha_publicacion DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_contenidos_un_destacado
  ON contenidos (seccion, destacado) WHERE destacado;

-- RLS activo por defecto en todas las tablas (sin policies = sin acceso
-- publico via la Data API de Supabase; el backend usa la conexion directa
-- de Postgres y no pasa por RLS).
ALTER TABLE noticias           ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensajes_contacto  ENABLE ROW LEVEL SECURITY;
ALTER TABLE suscriptores       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordenes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE foro_posts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE foro_comentarios   ENABLE ROW LEVEL SECURITY;
ALTER TABLE contenidos         ENABLE ROW LEVEL SECURITY;

-- Noticias combina dos fuentes: articulos propios de `noticias` y
-- video/ensayo/lectura_corta curados en `contenidos` (seccion='noticias').
-- Esto permite que un video (que `noticias` no soporta) aparezca en la
-- pagina de Noticias con su reproduccion en linea intacta.
ALTER TABLE contenidos DROP CONSTRAINT IF EXISTS contenidos_seccion_check;
ALTER TABLE contenidos ADD CONSTRAINT contenidos_seccion_check
  CHECK (seccion IN ('revolucion-humana', 'educacion', 'noticias'));

-- Categoria: "crimenes" (plural, lista cerrada de delitos) se renombra a
-- "crimen" (dominio editorial, igual que "salud"/"politica"/"cultura"), y se
-- agrega "ciencia" para noticias y contenidos de ciencia en general (no solo
-- espacio). Reasignar filas existentes antes de endurecer el CHECK.
UPDATE noticias   SET categoria = 'crimen' WHERE categoria = 'crimenes';
UPDATE contenidos SET categoria = 'crimen' WHERE categoria = 'crimenes';

ALTER TABLE noticias DROP CONSTRAINT IF EXISTS noticias_categoria_check;
ALTER TABLE noticias ADD CONSTRAINT noticias_categoria_check
  CHECK (categoria IN (
    'general', 'internacionales', 'crimen', 'salud', 'deportes', 'finanzas',
    'tecnologia', 'descubrimientos', 'politica', 'clima', 'cultura', 'ciencia'
  ));

ALTER TABLE contenidos DROP CONSTRAINT IF EXISTS contenidos_categoria_check;
ALTER TABLE contenidos ADD CONSTRAINT contenidos_categoria_check
  CHECK (categoria IN (
    'general', 'internacionales', 'crimen', 'salud', 'deportes', 'finanzas',
    'tecnologia', 'descubrimientos', 'politica', 'clima', 'cultura', 'ciencia'
  ));

-- ============================================================
-- Expansión de `contenidos`: subformato libre, divulgación de uso
-- de IA (política editorial, no requisito legal), citación
-- académica (APA y otros) y nuevos tipo_formato ('audio','foto').
-- ============================================================

-- Subformato: etiqueta secundaria opcional que NO cambia el
-- comportamiento de renderizado de la tarjeta (eso lo sigue
-- controlando tipo_formato). Lista curada, ampliable con un ALTER.
ALTER TABLE contenidos ADD COLUMN IF NOT EXISTS subformato text NULL;

ALTER TABLE contenidos DROP CONSTRAINT IF EXISTS contenidos_subformato_check;
ALTER TABLE contenidos ADD CONSTRAINT contenidos_subformato_check
  CHECK (subformato IS NULL OR subformato IN (
    'podcast', 'entrevista', 'galeria', 'opinion', 'reportaje',
    'cronica', 'guia', 'infografia', 'tutorial', 'documental', 'columna'
  ));

-- Divulgación de uso de IA: política editorial voluntaria (no hay
-- ley en PR/EE.UU. que la exija para contenido editorial general a
-- 2026-09-23). Debe mostrarse públicamente en tarjeta y artículo.
ALTER TABLE contenidos ADD COLUMN IF NOT EXISTS divulgacion_ia text NOT NULL DEFAULT 'no';

ALTER TABLE contenidos DROP CONSTRAINT IF EXISTS contenidos_divulgacion_ia_check;
ALTER TABLE contenidos ADD CONSTRAINT contenidos_divulgacion_ia_check
  CHECK (divulgacion_ia IN ('no', 'parcial', 'generado'));

-- Citación automática (APA/MLA/Chicago/Turabian/AMA/Vancouver/ABNT/
-- ICONTEC/IEEE/Bluebook). Reutiliza fuente_url/fuente_texto ya
-- existentes como URL y nombre de publicación — no se duplican.
ALTER TABLE contenidos ADD COLUMN IF NOT EXISTS cita_estilo text NULL;
ALTER TABLE contenidos ADD COLUMN IF NOT EXISTS cita_autor text NULL;
ALTER TABLE contenidos ADD COLUMN IF NOT EXISTS cita_anio text NULL;
ALTER TABLE contenidos ADD COLUMN IF NOT EXISTS cita_titulo_original text NULL;
ALTER TABLE contenidos ADD COLUMN IF NOT EXISTS cita_fecha_acceso date NULL;
ALTER TABLE contenidos ADD COLUMN IF NOT EXISTS cita_sin_fuente_externa boolean NOT NULL DEFAULT false;

ALTER TABLE contenidos DROP CONSTRAINT IF EXISTS contenidos_cita_estilo_check;
ALTER TABLE contenidos ADD CONSTRAINT contenidos_cita_estilo_check
  CHECK (cita_estilo IS NULL OR cita_estilo IN (
    'apa', 'mla', 'chicago', 'turabian', 'ama', 'vancouver', 'abnt', 'icontec', 'ieee', 'bluebook'
  ));

-- tipo_formato: se agregan 'audio' (reproducción en línea vía
-- <audio>, igual que video) y 'foto' (navega a recurso.html, mismo
-- comportamiento que ensayo/noticia/lectura_corta por ahora).
-- Nombre de constraint confirmado contra la base real (pg_constraint)
-- antes de aplicar esta migración: contenidos_tipo_formato_check.
ALTER TABLE contenidos DROP CONSTRAINT IF EXISTS contenidos_tipo_formato_check;
ALTER TABLE contenidos ADD CONSTRAINT contenidos_tipo_formato_check
  CHECK (tipo_formato IN ('video', 'ensayo', 'noticia', 'lectura_corta', 'audio', 'foto'));

-- ============================================================
-- Divulgación de uso de IA también en `noticias` (hasta ahora solo
-- existía en `contenidos`) — necesaria para el botón "Autocompletar
-- con IA": sin este campo no habría forma de indicar públicamente
-- que una noticia se redactó con asistencia de IA.
-- ============================================================
ALTER TABLE noticias ADD COLUMN IF NOT EXISTS divulgacion_ia text NOT NULL DEFAULT 'no';
ALTER TABLE noticias DROP CONSTRAINT IF EXISTS noticias_divulgacion_ia_check;
ALTER TABLE noticias ADD CONSTRAINT noticias_divulgacion_ia_check
  CHECK (divulgacion_ia IN ('no', 'parcial', 'generado'));

-- ============================================================
-- Borradores en `noticias`: hasta ahora todo lo que existía en la
-- tabla era publico de inmediato via GET /api/noticias, sin forma de
-- guardar algo "sin publicar" para revisar despues. DEFAULT true para
-- que las filas ya existentes (todas publicadas hoy) no cambien de
-- comportamiento con esta migracion.
-- ============================================================
ALTER TABLE noticias ADD COLUMN IF NOT EXISTS publicado boolean NOT NULL DEFAULT true;

-- ============================================================
-- Nombre visible en `perfiles` (pagina "Mi cuenta"). Opcional: hasta
-- ahora el perfil solo tenia email/rol, sin nada editable por el
-- propio usuario.
-- ============================================================
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS nombre text;
