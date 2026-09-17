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

ALTER TABLE noticias DROP CONSTRAINT IF EXISTS noticias_categoria_check;
ALTER TABLE noticias ADD CONSTRAINT noticias_categoria_check
  CHECK (categoria IN (
    'general', 'internacionales', 'crimenes', 'salud', 'deportes',
    'finanzas', 'tecnologia', 'descubrimientos', 'politica', 'clima', 'cultura'
  ));

CREATE INDEX IF NOT EXISTS idx_noticias_categoria ON noticias(categoria, fecha DESC);

-- La pagina "Critica Internacional" se retiro; sus temas se fusionaron
-- en la categoria "internacionales". Reasignar publicaciones existentes
-- antes de endurecer el CHECK (el CREATE TABLE de arriba no modifica una
-- tabla ya existente).
UPDATE foro_posts SET categoria = 'internacionales' WHERE categoria = 'critica-internacional';

ALTER TABLE foro_posts DROP CONSTRAINT IF EXISTS foro_posts_categoria_check;
ALTER TABLE foro_posts ADD CONSTRAINT foro_posts_categoria_check
  CHECK (categoria IN ('general', 'tecnologia', 'internacionales', 'nuevos-humanos', 'educacion'));

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
