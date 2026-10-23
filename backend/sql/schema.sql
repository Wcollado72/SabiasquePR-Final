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

-- Rol moderador: puede revisar/actuar sobre reportes y borrar contenido
-- reportado del debate (foro_posts/foro_comentarios), pero NO tiene acceso
-- a la gestion de contenido editorial (CRUD de noticias/contenidos/
-- productos) ni al autocompletar con IA -- eso sigue siendo admin-only.
ALTER TABLE perfiles DROP CONSTRAINT IF EXISTS perfiles_rol_check;
ALTER TABLE perfiles ADD CONSTRAINT perfiles_rol_check
  CHECK (rol IN ('usuario', 'admin', 'premium', 'moderador'));

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
    'tecnologia', 'descubrimientos', 'politica', 'clima', 'cultura', 'ciencia',
    -- Especificas de Educacion (seccion='educacion') -- no se agregan al
    -- filtro de Noticias, solo quedan disponibles como valor/etiqueta.
    'leyes-educativas', 'estudiantes-sobresalientes', 'sistemas-mundiales', 'programas-educativos'
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

-- ============================================================
-- Checkout unificado de Tienda: los Payment Links estaticos por
-- producto no permiten combinar varios productos distintos en un solo
-- pago, y ningun webhook los procesaba (ninguna compra quedaba
-- registrada). Se agrega el Price ID real de Stripe por producto para
-- que el backend arme una sesion de checkout con multiples line_items,
-- igual que ya se hace con la suscripcion premium.
-- ============================================================
ALTER TABLE productos ADD COLUMN IF NOT EXISTS stripe_price_id text;

-- Evita registrar el mismo pedido dos veces si Stripe reintenta la
-- entrega del webhook (comportamiento normal y esperado de Stripe).
CREATE UNIQUE INDEX IF NOT EXISTS idx_ordenes_stripe_session_id
  ON ordenes(stripe_session_id) WHERE stripe_session_id IS NOT NULL;

-- ============================================================
-- Direccion de envio/facturacion por pedido: los productos de Tienda
-- son fisicos y el checkout no pedia ninguna direccion -- no habia
-- forma de saber a donde enviar lo que se compraba.
-- ============================================================
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS envio_nombre text;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS envio_direccion jsonb;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS facturacion_direccion jsonb;

-- ============================================================
-- Sub-secciones de Revolución Humana. La definicion final del CHECK vive
-- mas abajo, junto al eje `enfoque` -- esta ALTER solo agrega la columna
-- (idempotente, no valida nada por si sola).
-- ============================================================
ALTER TABLE contenidos ADD COLUMN IF NOT EXISTS subseccion text NULL;

-- Contenido premium por pieza individual (no por seccion completa).
ALTER TABLE contenidos ADD COLUMN IF NOT EXISTS es_premium boolean NOT NULL DEFAULT false;

-- Comentarios generalizados: aplican tanto a `noticias` como a `contenidos`
-- (ambas tablas usan slug de texto como PK, por eso `item_id` es texto sin
-- FK real -- no se puede tener una FK a dos tablas distintas). Se valida en
-- el backend que el item exista antes de insertar. Mismo patron que
-- foro_comentarios: sin edicion, solo crear/borrar.
CREATE TABLE IF NOT EXISTS comentarios (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo        text NOT NULL CHECK (tipo IN ('noticia', 'contenido')),
  item_id     text NOT NULL,
  autor_id    uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  cuerpo      text NOT NULL,
  creado_en   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comentarios_item ON comentarios(tipo, item_id, creado_en ASC);
ALTER TABLE comentarios ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Corrupcion Humana: 5ta sub-seccion de Revolucion Humana. Reemplaza a
-- la sub-seccion reservada 'humanos-inhumanos' (nunca activada) -- ese
-- concepto pasa a ser el eje `enfoque` (institucional vs individual)
-- dentro de Corrupcion Humana, no una sub-seccion propia.
-- ============================================================
ALTER TABLE contenidos DROP CONSTRAINT IF EXISTS contenidos_subseccion_check;
ALTER TABLE contenidos ADD CONSTRAINT contenidos_subseccion_check
  CHECK (subseccion IS NULL OR subseccion IN (
    'nuevos-humanos', 'revolucion-mundial', 'logica-humana', 'corrupcion-humana', 'ilogica-humana'
  ));

-- `enfoque` es la region dentro de cualquier sub-seccion de Revolucion
-- Humana. El eje "institucional/individual" (pensado solo para Corrupcion
-- Humana) se elimino 2026-09-27 -- las 4 sub-secciones usan el mismo modelo
-- de 2 niveles, Seccion -> Region (confirmado sin filas existentes con esos
-- valores antes de quitarlos del CHECK).
ALTER TABLE contenidos ADD COLUMN IF NOT EXISTS enfoque text NULL;
ALTER TABLE contenidos DROP CONSTRAINT IF EXISTS contenidos_enfoque_check;
ALTER TABLE contenidos ADD CONSTRAINT contenidos_enfoque_check
  CHECK (enfoque IS NULL OR enfoque IN (
    'puerto-rico', 'estados-unidos', 'hispanoamerica', 'internacionales'
  ));

-- foro_posts/foro_comentarios se reutilizan como motor del debate semanal
-- por sub-seccion (el Foro general se retira como pagina propia -- su
-- CRUD+JWT sigue existiendo, solo cambia de proposito).
ALTER TABLE foro_posts ADD COLUMN IF NOT EXISTS subseccion text NULL;
ALTER TABLE foro_posts DROP CONSTRAINT IF EXISTS foro_posts_subseccion_check;
ALTER TABLE foro_posts ADD CONSTRAINT foro_posts_subseccion_check
  CHECK (subseccion IS NULL OR subseccion IN ('corrupcion-humana', 'ilogica-humana', 'nuevos-humanos', 'educacion'));

ALTER TABLE foro_posts ADD COLUMN IF NOT EXISTS enfoque text NULL;
ALTER TABLE foro_posts DROP CONSTRAINT IF EXISTS foro_posts_enfoque_check;
ALTER TABLE foro_posts ADD CONSTRAINT foro_posts_enfoque_check
  CHECK (enfoque IS NULL OR enfoque IN (
    'puerto-rico', 'estados-unidos', 'hispanoamerica', 'internacionales'
  ));

ALTER TABLE foro_posts ADD COLUMN IF NOT EXISTS tema_contenido_id text NULL
  REFERENCES contenidos(id) ON DELETE SET NULL;
ALTER TABLE foro_posts ADD COLUMN IF NOT EXISTS destacado boolean NOT NULL DEFAULT false;
ALTER TABLE foro_posts ADD COLUMN IF NOT EXISTS enlace_media text NULL;
ALTER TABLE foro_posts ADD COLUMN IF NOT EXISTS enlace_media_tipo text NULL;
ALTER TABLE foro_posts DROP CONSTRAINT IF EXISTS foro_posts_enlace_media_tipo_check;
ALTER TABLE foro_posts ADD CONSTRAINT foro_posts_enlace_media_tipo_check
  CHECK (enlace_media_tipo IS NULL OR enlace_media_tipo IN ('imagen', 'audio', 'video'));

-- Autoafirmacion de edad (checkbox del usuario, no verificacion real con
-- ID) para secciones 18+. Politica de edad por seccion fijada 2026-09-27:
-- solo Corrupcion Humana e Ilogica Humana son 18+ (Nuevos Humanos y Logica
-- Humana son 12+, sin este gate). Compartida entre las dos 18+ -- es un
-- hecho sobre la persona, no sobre el contenido.
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS edad_confirmada boolean NOT NULL DEFAULT false;

-- Fecha de nacimiento real, capturada en el registro (2026-09-27, ver
-- docs/interno/AUDITORIA-LEGAL-MENORES.md). NULL para cuentas creadas antes de este campo
-- -- esas siguen dependiendo de la autoafirmacion edad_confirmada. Cuando SI
-- se conoce, el backend calcula la edad real y la usa para bloquear acceso a
-- secciones 18+ sin depender solo del honor del checkbox -- un dato conocido
-- nunca se puede "mentir" por encima via el checkbox.
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS fecha_nacimiento date NULL;

-- Logica Humana (area personal de Aliado Imperfekto, solo premium) pide
-- ademas su propio disclaimer, separado del de edad -- se recuerda aparte
-- porque el usuario quiere que cada paso del gate se confirme una sola vez
-- y no se repita en sesiones futuras.
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS logica_humana_terminos_ok boolean NOT NULL DEFAULT false;

-- Reportes: generico (tipo + item_id), mismo patron que `comentarios`.
CREATE TABLE IF NOT EXISTS reportes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo          text NOT NULL CHECK (tipo IN ('debate_post', 'debate_comentario')),
  item_id       uuid NOT NULL,
  reportado_por uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  motivo        text NOT NULL,
  estado        text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'revisado', 'descartado')),
  creado_en     timestamptz NOT NULL DEFAULT now()
);

-- Deteccion automatica de lenguaje de riesgo (2026-09-27, ver
-- docs/interno/AUDITORIA-LEGAL-MENORES.md): un post/comentario que coincide con un patron
-- de riesgo (solicitar contacto fuera de la plataforma, lenguaje de
-- grooming, etc.) genera un reporte automatico para revision prioritaria de
-- un moderador -- nunca borra ni bloquea el contenido por si solo, un humano
-- decide. `reportado_por` se vuelve NULL-able solo para este caso (un
-- reporte automatico no tiene un usuario reportando); `automatico` distingue
-- ambos tipos en el panel de admin.
ALTER TABLE reportes ALTER COLUMN reportado_por DROP NOT NULL;
ALTER TABLE reportes ADD COLUMN IF NOT EXISTS automatico boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_reportes_estado ON reportes(estado, creado_en DESC);
ALTER TABLE reportes ENABLE ROW LEVEL SECURITY;

-- Bitacora de uso/costo real de los agentes de IA de contenido (Investigador
-- y Redactor). El costo se calcula SIEMPRE a partir del `usage` real que
-- devuelve la API de Claude en cada llamada, nunca estimado de antemano --
-- este es el dato que alimenta el dashboard de Agentes con gasto real.
CREATE TABLE IF NOT EXISTS ia_generaciones (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agente                text NOT NULL CHECK (agente IN ('investigador', 'redactor')),
  fuente_tipo           text NOT NULL CHECK (fuente_tipo IN ('url', 'texto', 'notas')),
  uso_busqueda_web      boolean NOT NULL DEFAULT false,
  busquedas_realizadas  int NOT NULL DEFAULT 0,
  tokens_entrada        int NOT NULL DEFAULT 0,
  tokens_salida         int NOT NULL DEFAULT 0,
  costo_estimado_usd    numeric(10,4) NOT NULL DEFAULT 0,
  creado_por            uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  creado_en             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ia_generaciones_creado_en ON ia_generaciones(creado_en DESC);

-- ============================================================
-- Fase C2 (2026-09-28): sitio bilingue espanol/ingles.
-- `idioma_original` dice en que idioma se escribio la pieza; la otra
-- version vive en `traducciones` (una fila por pieza+idioma), asi que hay
-- UN solo hilo de comentarios, UN solo destacado y el mismo producto de
-- Stripe. Productos siempre se consideran escritos en espanol.
-- ============================================================
ALTER TABLE noticias ADD COLUMN IF NOT EXISTS idioma_original text NOT NULL DEFAULT 'es';
ALTER TABLE noticias DROP CONSTRAINT IF EXISTS noticias_idioma_original_check;
ALTER TABLE noticias ADD CONSTRAINT noticias_idioma_original_check CHECK (idioma_original IN ('es', 'en'));

ALTER TABLE contenidos ADD COLUMN IF NOT EXISTS idioma_original text NOT NULL DEFAULT 'es';
ALTER TABLE contenidos DROP CONSTRAINT IF EXISTS contenidos_idioma_original_check;
ALTER TABLE contenidos ADD CONSTRAINT contenidos_idioma_original_check CHECK (idioma_original IN ('es', 'en'));

CREATE TABLE IF NOT EXISTS traducciones (
  tipo           text NOT NULL CHECK (tipo IN ('noticia', 'contenido', 'producto')),
  item_id        text NOT NULL,
  idioma         text NOT NULL CHECK (idioma IN ('es', 'en')),
  campos         jsonb NOT NULL,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_por uuid NULL REFERENCES perfiles(id) ON DELETE SET NULL,
  PRIMARY KEY (tipo, item_id, idioma)
);
ALTER TABLE traducciones ENABLE ROW LEVEL SECURITY;

-- El agente Traductor tambien se registra en la bitacora de costo real.
ALTER TABLE ia_generaciones DROP CONSTRAINT IF EXISTS ia_generaciones_agente_check;
ALTER TABLE ia_generaciones ADD CONSTRAINT ia_generaciones_agente_check
  CHECK (agente IN ('investigador', 'redactor', 'traductor'));

-- ============================================================
-- Fase "Gastos" del admin (2026-09-28): servicios/suscripciones fijas del
-- proyecto (Claude Pro, Netlify, Supabase, etc.), separado del gasto
-- automatico de ia_generaciones (Investigador/Redactor/Traductor).
-- ============================================================
CREATE TABLE IF NOT EXISTS gastos_servicios (
  id                  text PRIMARY KEY,
  nombre              text NOT NULL,
  estado              text NOT NULL CHECK (estado IN ('gratis', 'gratis_por_ahora', 'por_uso')),
  costo_mensual_usd   numeric(10,2) NULL,
  fecha_renovacion    date NULL,
  enlace_facturacion  text NULL,
  notas               text NULL,
  creado_en           timestamptz NOT NULL DEFAULT now(),
  actualizado_en      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE gastos_servicios ENABLE ROW LEVEL SECURITY;
-- ia_generaciones ya tenia RLS activo en la base viva (2026-10); el script no lo activaba: ahora si, para que una instalacion nueva quede igual.
ALTER TABLE ia_generaciones ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Muro de agradecimiento (2026-10-04): opt-in de quienes apoyan cada mes para
-- aparecer en "Apoya el canal". Mismo SQL que backend/sql/migraciones/2026-10-04-agradecimientos.sql.
-- ============================================================
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS agradecimiento_nombre text NULL;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS agradecimiento_autorizado_en timestamptz NULL;
ALTER TABLE perfiles DROP CONSTRAINT IF EXISTS perfiles_agradecimiento_nombre_check;
ALTER TABLE perfiles ADD CONSTRAINT perfiles_agradecimiento_nombre_check
  CHECK (agradecimiento_nombre IS NULL OR char_length(agradecimiento_nombre) BETWEEN 2 AND 40);

-- ============================================================
-- Categoria "general" eliminada (2026-10-03, aplicado al proyecto nuevo el 2026-10-15): todas las piezas llevan una
-- categoria descriptiva. Mismo SQL que backend/sql/migraciones/2026-10-03-quitar-categoria-general.sql.
-- ============================================================
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
