# -*- coding: utf-8 -*-
"""
Genera docs/planificacion-y-diseno-bd.pdf para Sabias Que PR:
Fase 1 (Planificacion y Diseno) + Fase 2 (Diseno de la Base de Datos)
de la rubrica del curso Full-Stack.
"""
import math
import os
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    HRFlowable, ListFlowable, ListItem, Preformatted
)
from reportlab.graphics.shapes import Drawing, Rect, String, Line, Polygon
from reportlab.pdfgen import canvas as pdfcanvas

# ── PALETA ──────────────────────────────────────────────────
INK = colors.HexColor('#16202B')
INK_SOFT = colors.HexColor('#51606E')
ACCENT = colors.HexColor('#1D4E89')
ACCENT_DARK = colors.HexColor('#123762')
ACCENT_SOFT = colors.HexColor('#E4ECF5')
LINE = colors.HexColor('#C7D2DB')
DONE = colors.HexColor('#2E7D5B')
DONE_SOFT = colors.HexColor('#E1F0E8')
RISK = colors.HexColor('#B5432E')
PAPER_RULED = colors.HexColor('#F4F7FA')
WHITE = colors.white

PAGE_W, PAGE_H = letter
MARGIN = 54
CONTENT_W = PAGE_W - 2 * MARGIN

DOCS_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(DOCS_DIR)
OUT_PATH = os.path.join(DOCS_DIR, 'planificacion-y-diseno-bd.pdf')
SCHEMA_SQL_PATH = os.path.join(REPO_ROOT, 'backend', 'sql', 'schema.sql')

# ── ESTILOS ─────────────────────────────────────────────────
styles = getSampleStyleSheet()

styles.add(ParagraphStyle(
    name='Eyebrow', fontName='Helvetica-Bold', fontSize=9, leading=11,
    textColor=ACCENT, spaceAfter=4, tracking=0.6,
))
styles.add(ParagraphStyle(
    name='DocTitle', fontName='Helvetica-Bold', fontSize=22, leading=27,
    textColor=INK, spaceAfter=6,
))
styles.add(ParagraphStyle(
    name='DocSub', fontName='Helvetica', fontSize=11.5, leading=16,
    textColor=INK_SOFT, spaceAfter=0,
))
styles.add(ParagraphStyle(
    name='H1', fontName='Helvetica-Bold', fontSize=15, leading=19,
    textColor=INK, spaceBefore=22, spaceAfter=10,
))
styles.add(ParagraphStyle(
    name='H2', fontName='Helvetica-Bold', fontSize=11.5, leading=15,
    textColor=ACCENT_DARK, spaceBefore=14, spaceAfter=6,
))
styles.add(ParagraphStyle(
    name='Body', fontName='Helvetica', fontSize=10, leading=15,
    textColor=INK, spaceAfter=8, alignment=TA_JUSTIFY,
))
styles.add(ParagraphStyle(
    name='BodySmall', fontName='Helvetica', fontSize=8.7, leading=12.5,
    textColor=INK_SOFT, spaceAfter=6,
))
styles.add(ParagraphStyle(
    name='Caption', fontName='Helvetica-Oblique', fontSize=8.5, leading=11,
    textColor=INK_SOFT, spaceBefore=4, spaceAfter=14, alignment=TA_CENTER,
))
styles.add(ParagraphStyle(
    name='BulletText', fontName='Helvetica', fontSize=10, leading=14.5,
    textColor=INK, spaceAfter=3,
))
styles.add(ParagraphStyle(
    name='Mono', fontName='Courier', fontSize=7.6, leading=10.2,
    textColor=INK,
))
styles.add(ParagraphStyle(
    name='TableCell', fontName='Helvetica', fontSize=8.3, leading=11,
    textColor=INK,
))
styles.add(ParagraphStyle(
    name='TableCellSoft', fontName='Helvetica', fontSize=8.3, leading=11,
    textColor=INK_SOFT,
))
styles.add(ParagraphStyle(
    name='TableHead', fontName='Helvetica-Bold', fontSize=8.3, leading=11,
    textColor=WHITE,
))
styles.add(ParagraphStyle(
    name='FooterText', fontName='Helvetica', fontSize=7.5, leading=9,
    textColor=INK_SOFT,
))

# ── DIBUJO: helpers de diagrama ─────────────────────────────

def box(d, x, y, w, h, title, subtitle=None, fill=ACCENT_SOFT, stroke=ACCENT,
        title_size=8.6, title_color=ACCENT_DARK, dashed=False, lines=None):
    kwargs = dict(fillColor=fill, strokeColor=stroke, strokeWidth=1)
    if dashed:
        kwargs['strokeDashArray'] = [3, 2]
    d.add(Rect(x, y, w, h, rx=5, ry=5, **kwargs))
    ty = y + h / 2
    if subtitle or lines:
        ty = y + h - 14
    d.add(String(x + w / 2, ty, title, fontName='Helvetica-Bold', fontSize=title_size,
                 fillColor=title_color, textAnchor='middle'))
    if subtitle:
        d.add(String(x + w / 2, y + h / 2 - 9, subtitle, fontName='Helvetica', fontSize=6.8,
                     fillColor=INK_SOFT, textAnchor='middle'))
    if lines:
        yy = ty - 13
        for ln in lines:
            d.add(String(x + 8, yy, ln, fontName='Courier', fontSize=6.4, fillColor=INK_SOFT))
            yy -= 8.6


def arrow(d, x1, y1, x2, y2, label=None, dashed=False, color=INK_SOFT, label_bg=True, curve=None):
    dash = [3, 2] if dashed else None
    d.add(Line(x1, y1, x2, y2, strokeColor=color, strokeWidth=1, strokeDashArray=dash))
    ang = math.atan2(y2 - y1, x2 - x1)
    size = 5.5
    p1 = (x2, y2)
    p2 = (x2 - size * math.cos(ang - math.pi / 7), y2 - size * math.sin(ang - math.pi / 7))
    p3 = (x2 - size * math.cos(ang + math.pi / 7), y2 - size * math.sin(ang + math.pi / 7))
    d.add(Polygon([p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]], fillColor=color, strokeColor=color))
    if label:
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        if label_bg:
            wpx = len(label) * 3.7 + 6
            d.add(Rect(mx - wpx / 2, my - 5, wpx, 10, fillColor=WHITE, strokeColor=None))
        d.add(String(mx, my - 2.7, label, fontName='Helvetica', fontSize=6.6,
                     fillColor=INK_SOFT, textAnchor='middle'))


def pk_fk_line(d, x1, y1, x2, y2, label):
    d.add(Line(x1, y1, x2, y2, strokeColor=ACCENT, strokeWidth=1))
    for (px, py) in [(x1, y1), (x2, y2)]:
        d.add(Rect(px - 2, py - 2, 4, 4, fillColor=ACCENT, strokeColor=None))
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    wpx = len(label) * 3.6 + 6
    d.add(Rect(mx - wpx / 2, my - 5, wpx, 10, fillColor=WHITE, strokeColor=None))
    d.add(String(mx, my - 2.6, label, fontName='Helvetica-Oblique', fontSize=6.4,
                 fillColor=ACCENT_DARK, textAnchor='middle'))


def pk_fk_path(d, points, label):
    """Conector ortogonal (varios segmentos) para relaciones que deben
    rodear otras entidades en vez de cruzarlas."""
    for i in range(len(points) - 1):
        x1, y1 = points[i]
        x2, y2 = points[i + 1]
        d.add(Line(x1, y1, x2, y2, strokeColor=ACCENT, strokeWidth=1))
    for (px, py) in [points[0], points[-1]]:
        d.add(Rect(px - 2, py - 2, 4, 4, fillColor=ACCENT, strokeColor=None))
    mx, my = points[0][0], (points[0][1] + points[1][1]) / 2
    wpx = len(label) * 3.6 + 6
    d.add(Rect(mx - wpx / 2 - 4, my - 5, wpx, 10, fillColor=WHITE, strokeColor=None))
    d.add(String(mx - 4, my - 2.6, label, fontName='Helvetica-Oblique', fontSize=6.4,
                 fillColor=ACCENT_DARK, textAnchor='middle'))


# ── DIAGRAMA 1: ARQUITECTURA ────────────────────────────────

def diagrama_arquitectura():
    W, H = CONTENT_W, 300
    d = Drawing(W, H)
    d.hAlign = 'CENTER'

    # Navegador
    box(d, W/2 - 90, H - 40, 180, 32, 'Navegador del usuario', 'cliente HTTP')

    # Frontend
    box(d, 20, H - 130, 200, 46, 'Frontend estatico', 'HTML5 + CSS3 + JavaScript', fill=colors.HexColor('#EAF3EF'), stroke=DONE, title_color=DONE)
    # Supabase Auth
    box(d, W - 220, H - 130, 200, 46, 'Supabase Auth', 'login, registro, Google OAuth, JWKS', fill=colors.HexColor('#F5ECE1'), stroke=colors.HexColor('#B8791A'), title_color=colors.HexColor('#8A5A10'))

    # Backend
    box(d, 20, H - 220, 200, 46, 'Backend API propio', 'Node.js + Express (backend/src)')
    # Postgres
    box(d, W - 220, H - 220, 200, 46, 'Base de datos', 'PostgreSQL (proyecto Supabase)', fill=colors.HexColor('#EAF3EF'), stroke=DONE, title_color=DONE)

    # Despliegue (planeado)
    box(d, W/2 - 150, 8, 300, 34, 'Despliegue academico (Fase 6)', 'Netlify/Vercel + Render/Railway + Supabase',
        fill=WHITE, stroke=LINE, title_color=INK_SOFT, dashed=True)

    cx_nav = W/2
    cx_front, cx_auth = 20 + 100, W - 220 + 100
    cx_back, cx_db = 20 + 100, W - 220 + 100

    arrow(d, cx_nav - 30, H - 40, cx_front + 15, H - 84, 'HTML/CSS/JS')
    arrow(d, cx_nav + 30, H - 40, cx_auth - 15, H - 84, 'sesion / login')

    arrow(d, cx_front, H - 130, cx_back, H - 174, 'fetch API REST + Bearer JWT')
    arrow(d, cx_front + 60, H - 107, cx_auth - 60, H - 107, 'signInWithPassword / OAuth', dashed=True)

    arrow(d, cx_back, H - 220, cx_db, H - 220, 'pool.query (pg)')
    arrow(d, cx_back + 60, H - 197, cx_auth - 60, H - 197, 'verifica JWT (JWKS, ES256)', dashed=True)

    return d


# ── DIAGRAMA 2: NAVEGACION ──────────────────────────────────

def diagrama_navegacion():
    W, H = CONTENT_W, 400
    d = Drawing(W, H)
    d.hAlign = 'CENTER'

    # Inicio
    icx = W / 2
    box(d, icx - 70, 360, 140, 28, 'Inicio', 'index.html', fill=ACCENT_SOFT, stroke=ACCENT)

    # Fila unica con las secciones del menu principal (orden real del nav)
    publicas = [
        ('Noticias', None), ('Revolucion', 'Humana'), ('Educacion', None),
        ('Foro', None), ('Tienda', None), ('Contacto', None), ('Premium', None),
    ]
    n = len(publicas)
    bw, gap = 50, 6
    total = n * bw + (n - 1) * gap
    x0 = (W - total) / 2
    row_y, row_h = 290, 32
    spine_y = 330

    arrow(d, icx, 360, icx, spine_y + 2)
    d.add(Line(x0 + bw/2, spine_y, x0 + total - bw/2, spine_y, strokeColor=INK_SOFT, strokeWidth=1))

    centers = []
    foro_center = None
    for i, (t1, t2) in enumerate(publicas):
        x = x0 + i * (bw + gap)
        cx = x + bw / 2
        centers.append(cx)
        is_foro = (t1 == 'Foro')
        is_premium = (t1 == 'Premium')
        if is_foro:
            fill, stroke, tcolor = DONE_SOFT, DONE, DONE
        elif is_premium:
            fill, stroke, tcolor = colors.HexColor('#F5ECE1'), colors.HexColor('#B8791A'), colors.HexColor('#8A5A10')
        else:
            fill, stroke, tcolor = ACCENT_SOFT, ACCENT, ACCENT_DARK
        box(d, x, row_y, bw, row_h, t1, t2, title_size=6.3, fill=fill, stroke=stroke, title_color=tcolor)
        d.add(Line(cx, spine_y, cx, row_y + row_h, strokeColor=INK_SOFT, strokeWidth=1))
        if is_foro:
            foro_center = cx

    # Rama del foro: requiere sesion para publicar/comentar.
    # Se ancla a la derecha de la columna "Iniciar sesion / Panel admin"
    # (que ocupa x 40-210) en vez de centrarse bajo Foro, para no
    # superponerse con esa columna a este ancho de diagrama.
    np_x, np_w, np_y, np_h = 220, 160, 220, 36
    box(d, np_x, np_y, np_w, np_h, 'Nueva publicacion / comentar', 'requiere sesion',
        fill=WHITE, stroke=LINE, dashed=True, title_color=INK_SOFT, title_size=7.2)
    arrow(d, foro_center, row_y, np_x + np_w/2, np_y + np_h, 'sesion activa', dashed=True)

    # Iniciar sesion -> Panel de administracion (control disponible en toda pagina)
    login_x, login_w, login_y, login_h = 40, 170, 220, 36
    box(d, login_x, login_y, login_w, login_h, 'Iniciar sesion', 'disponible en toda pagina (header)',
        fill=ACCENT_SOFT, stroke=ACCENT)
    admin_x, admin_y, admin_w, admin_h = 40, 150, 170, 42
    box(d, admin_x, admin_y, admin_w, admin_h, 'Panel de administracion', 'admin.html - solo rol admin',
        fill=colors.HexColor('#F5ECE1'), stroke=colors.HexColor('#B8791A'), title_color=colors.HexColor('#8A5A10'))
    arrow(d, login_x + login_w/2, login_y, admin_x + admin_w/2, admin_y + admin_h, 'rol = admin', dashed=True)

    # Paginas secundarias (fuera del menu principal) -- mas abajo que la
    # rama del foro para no montarse encima (el foro ya no es el 7mo de 9
    # items sino el 4to de 7, y su rama quedo mas a la izquierda)
    sec_x, sec_y, sec_w, sec_h = W - 210, 130, 170, 46
    box(d, sec_x, sec_y, sec_w, sec_h, 'Paginas secundarias',
        lines=['Servicios, Privacidad,', 'Terminos, 404'],
        fill=PAPER_RULED, stroke=LINE, dashed=True, title_color=INK_SOFT, title_size=7.4)

    return d


# ── DIAGRAMA 3: MODELO ENTIDAD-RELACION ─────────────────────

def diagrama_mer():
    W, H = CONTENT_W, 520
    d = Drawing(W, H)
    d.hAlign = 'CENTER'

    def ent(x, y, w, h, name, cols, ext=False):
        box(d, x, y, w, h, name, lines=cols, dashed=ext,
            fill=WHITE if not ext else PAPER_RULED, stroke=ACCENT if not ext else LINE,
            title_color=ACCENT_DARK if not ext else INK_SOFT)

    # auth.users (externo, gestionado por Supabase) -> perfiles (1:1)
    ux, uy, uw, uh = 182, 480, 140, 30
    ent(ux, uy, uw, uh, 'auth.users (Supabase)', ['id uuid PK'], ext=True)

    px, py, pw, ph = 167, 370, 170, 74
    ent(px, py, pw, ph, 'perfiles', ['id uuid PK, FK', 'email text', 'rol text'])
    pk_fk_line(d, ux + uw/2, uy, px + pw/2, py + ph, '1:1')

    # perfiles -> ordenes, perfiles -> foro_posts (1:N cada una)
    ox, oy, ow, oh = 70, 264, 170, 70
    ent(ox, oy, ow, oh, 'ordenes', ['id uuid PK', 'usuario_id FK', 'items jsonb, total'])
    pk_fk_line(d, px + pw*0.25, py, ox + ow/2, oy + oh, '1:N')

    fx, fy, fw, fh = 270, 264, 170, 70
    ent(fx, fy, fw, fh, 'foro_posts', ['id uuid PK', 'autor_id FK', 'titulo, categoria'])
    pk_fk_line(d, px + pw*0.75, py, fx + fw/2, fy + fh, '1:N')

    # foro_posts -> foro_comentarios (1:N)
    cx, cy, cw, ch = 280, 158, 190, 70
    ent(cx, cy, cw, ch, 'foro_comentarios', ['id uuid PK', 'post_id FK', 'autor_id FK'])
    pk_fk_line(d, fx + fw/2, fy, cx + cw/2, cy + ch, '1:N')

    # perfiles -> foro_comentarios (autor_id, 1:N) -- ruteado por el margen
    # derecho para no cruzar por encima de foro_posts.
    lane_x = 498
    pk_fk_path(d, [
        (px + pw, py + ph * 0.35),
        (lane_x, py + ph * 0.35),
        (lane_x, cy + ch * 0.5),
        (cx + cw, cy + ch * 0.5),
    ], '1:N (autor_id)')

    # Entidades independientes (sin llaves foraneas)
    label_y = 142
    d.add(String(W/2, label_y, 'Entidades independientes (sin relaciones foraneas)',
                 fontName='Helvetica-Oblique', fontSize=7.5, fillColor=INK_SOFT, textAnchor='middle'))
    row_e_y = 58
    ind = [
        ('noticias', ['id text PK', 'titulo, fecha', 'parrafos jsonb']),
        ('productos', ['id text PK', 'nombre, precio', 'disponible bool']),
        ('mensajes_contacto', ['id uuid PK', 'nombre, email', 'mensaje']),
        ('suscriptores', ['id uuid PK', 'email UNIQUE']),
    ]
    bw, gap = 110, 14
    total = 4 * bw + 3 * gap
    x0 = (W - total) / 2
    for i, (name, cols) in enumerate(ind):
        ent(x0 + i * (bw + gap), row_e_y, bw, 70, name, cols)

    return d


# ── TABLAS: esquema relacional y diccionario de datos ───────

DICCIONARIO = [
    ('noticias', [
        ('id', 'text', 'PK', 'Slug unico generado del titulo'),
        ('titulo', 'text', 'NOT NULL', 'Titular de la noticia'),
        ('fecha', 'date', 'NOT NULL', 'Fecha editorial de la noticia'),
        ('fecha_display', 'text', 'NOT NULL', 'Fecha en formato legible (es-PR)'),
        ('imagen', 'text', 'NOT NULL', 'Ruta o URL de la imagen principal'),
        ('imagen_alt', 'text', 'NOT NULL', 'Texto alternativo (accesibilidad)'),
        ('imagen_caption', 'text', 'NOT NULL', 'Pie de foto / credito'),
        ('clase', 'text', 'NOT NULL', 'Clase CSS para estilos particulares'),
        ('fuente_url', 'text', 'NOT NULL', 'URL de la fuente original'),
        ('fuente_texto', 'text', 'NOT NULL', 'Nombre visible de la fuente'),
        ('parrafos', 'jsonb', "NOT NULL, DEFAULT '[]'", 'Arreglo de parrafos del cuerpo'),
        ('categoria', 'text', "NOT NULL, DEFAULT 'general', CHECK IN (11 valores)", 'Categoria tematica (filtrable desde el frontend)'),
        ('creado_en', 'timestamptz', "NOT NULL, DEFAULT now()", 'Fecha de creacion del registro'),
    ]),
    ('productos', [
        ('id', 'text', 'PK', 'Slug unico generado del nombre'),
        ('nombre', 'text', 'NOT NULL', 'Nombre del producto'),
        ('descripcion', 'text', 'NOT NULL', 'Descripcion corta'),
        ('precio', 'numeric(10,2)', 'NOT NULL', 'Precio en USD'),
        ('imagen', 'text', 'NOT NULL', 'Ruta o URL de la imagen'),
        ('imagen_alt', 'text', 'NOT NULL', 'Texto alternativo'),
        ('stripe_link', 'text', 'NULL', 'Enlace de pago de Stripe (Fase 5 del roadmap de producto)'),
        ('disponible', 'boolean', 'NOT NULL, DEFAULT true', 'Visible en la tienda'),
        ('creado_en', 'timestamptz', "NOT NULL, DEFAULT now()", 'Fecha de creacion del registro'),
    ]),
    ('perfiles', [
        ('id', 'uuid', 'PK, FK -> auth.users(id) ON DELETE CASCADE', 'Mismo id que el usuario de Supabase Auth'),
        ('email', 'text', 'NOT NULL', 'Correo del usuario'),
        ('rol', 'text', "NOT NULL, DEFAULT 'usuario', CHECK IN ('usuario','admin','premium')", 'Rol de autorizacion (premium ampliado por Stripe)'),
        ('stripe_customer_id', 'text', 'NULL, UNIQUE (parcial)', 'Id del cliente en Stripe, una vez se suscribe'),
        ('stripe_subscription_id', 'text', 'NULL', 'Id de la suscripcion activa en Stripe'),
        ('creado_en', 'timestamptz', "NOT NULL, DEFAULT now()", 'Fecha de creacion del perfil'),
    ]),
    ('mensajes_contacto', [
        ('id', 'uuid', 'PK, DEFAULT gen_random_uuid()', 'Identificador del mensaje'),
        ('nombre', 'text', 'NOT NULL', 'Nombre de quien escribe'),
        ('email', 'text', 'NOT NULL', 'Correo de contacto'),
        ('motivo', 'text', 'NOT NULL', 'Motivo del mensaje'),
        ('mensaje', 'text', 'NOT NULL', 'Contenido del mensaje'),
        ('creado_en', 'timestamptz', "NOT NULL, DEFAULT now()", 'Fecha de envio'),
    ]),
    ('suscriptores', [
        ('id', 'uuid', 'PK, DEFAULT gen_random_uuid()', 'Identificador del suscriptor'),
        ('email', 'text', 'NOT NULL, UNIQUE', 'Correo suscrito al boletin'),
        ('creado_en', 'timestamptz', "NOT NULL, DEFAULT now()", 'Fecha de suscripcion'),
    ]),
    ('ordenes', [
        ('id', 'uuid', 'PK, DEFAULT gen_random_uuid()', 'Identificador de la orden'),
        ('usuario_id', 'uuid', 'FK -> perfiles(id) ON DELETE SET NULL', 'Comprador (si inicio sesion)'),
        ('items', 'jsonb', 'NOT NULL', 'Lista de productos y cantidades'),
        ('total', 'numeric(10,2)', 'NOT NULL', 'Total cobrado'),
        ('stripe_session_id', 'text', 'NULL', 'Referencia de la sesion de pago'),
        ('estado', 'text', "NOT NULL, DEFAULT 'pendiente', CHECK IN ('pendiente','pagada','cancelada')", 'Estado del pago'),
        ('creado_en', 'timestamptz', "NOT NULL, DEFAULT now()", 'Fecha de la orden'),
    ]),
    ('foro_posts', [
        ('id', 'uuid', 'PK, DEFAULT gen_random_uuid()', 'Identificador de la publicacion'),
        ('autor_id', 'uuid', 'NOT NULL, FK -> perfiles(id) ON DELETE CASCADE', 'Autor de la publicacion'),
        ('titulo', 'text', 'NOT NULL', 'Titulo de la publicacion'),
        ('cuerpo', 'text', 'NOT NULL', 'Contenido de la publicacion'),
        ('categoria', 'text', "NOT NULL, DEFAULT 'general', CHECK IN (5 valores)", 'Categoria tematica'),
        ('creado_en', 'timestamptz', "NOT NULL, DEFAULT now()", 'Fecha de publicacion'),
        ('editado_en', 'timestamptz', 'NULL', 'Fecha de la ultima edicion'),
    ]),
    ('foro_comentarios', [
        ('id', 'uuid', 'PK, DEFAULT gen_random_uuid()', 'Identificador del comentario'),
        ('post_id', 'uuid', 'NOT NULL, FK -> foro_posts(id) ON DELETE CASCADE', 'Publicacion comentada'),
        ('autor_id', 'uuid', 'NOT NULL, FK -> perfiles(id) ON DELETE CASCADE', 'Autor del comentario'),
        ('cuerpo', 'text', 'NOT NULL', 'Contenido del comentario'),
        ('creado_en', 'timestamptz', "NOT NULL, DEFAULT now()", 'Fecha del comentario'),
    ]),
]


def tabla_diccionario(tabla, campos):
    header = [Paragraph('Campo', styles['TableHead']), Paragraph('Tipo', styles['TableHead']),
              Paragraph('Restricciones', styles['TableHead']), Paragraph('Descripcion', styles['TableHead'])]
    data = [header]
    for campo, tipo, restr, desc in campos:
        data.append([
            Paragraph(f'<font face="Courier-Bold">{campo}</font>', styles['TableCell']),
            Paragraph(f'<font face="Courier">{tipo}</font>', styles['TableCellSoft']),
            Paragraph(restr, styles['TableCellSoft']),
            Paragraph(desc, styles['TableCell']),
        ])
    t = Table(data, colWidths=[80, 70, 165, CONTENT_W - 80 - 70 - 165], hAlign='LEFT')
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), ACCENT_DARK),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, PAPER_RULED]),
        ('GRID', (0, 0), (-1, -1), 0.5, LINE),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    return t


# ── PAGINA / PIE DE PAGINA ──────────────────────────────────

def draw_footer(c: pdfcanvas.Canvas, doc):
    c.saveState()
    c.setStrokeColor(LINE)
    c.setLineWidth(0.5)
    c.line(MARGIN, 44, PAGE_W - MARGIN, 44)
    c.setFont('Helvetica', 7.5)
    c.setFillColor(INK_SOFT)
    c.drawString(MARGIN, 32, 'Sabias Que PR — Planificacion y Diseno de Base de Datos')
    c.drawRightString(PAGE_W - MARGIN, 32, f'Pagina {doc.page}')
    c.restoreState()


# ── PORTADA ──────────────────────────────────────────────────

def build_portada(story):
    story.append(Spacer(1, 130))
    story.append(Paragraph('PROYECTO FINAL · DESARROLLO WEB FULL-STACK', styles['Eyebrow']))
    story.append(Paragraph('Sabías Que PR', ParagraphStyle('CoverTitle', parent=styles['DocTitle'], fontSize=32, leading=36)))
    story.append(Paragraph('Planificación y Diseño de la Base de Datos', ParagraphStyle('CoverSub', parent=styles['DocSub'], fontSize=14, leading=19, textColor=ACCENT_DARK)))
    story.append(Spacer(1, 10))
    story.append(Paragraph('Fase 1: Planificación y Diseño &nbsp;·&nbsp; Fase 2: Diseño de la Base de Datos', styles['DocSub']))
    story.append(Spacer(1, 200))

    meta = [
        ['Estudiante', 'William Collado'],
        ['Curso', 'COMP2053 — Desarrollo Web Full-Stack'],
        ['Institución', 'Universidad Interamericana de Puerto Rico, Recinto de Fajardo'],
        ['Repositorio', 'github.com/Wcollado72/SabiasquePR'],
        ['Sitio en vivo', 'fabulous-tartufo-fcb839.netlify.app'],
        ['Fecha', '17 de septiembre de 2026 (actualizado)'],
    ]
    data = [[Paragraph(f'<font color="#51606E">{k}</font>', styles['Body']), Paragraph(v, styles['Body'])] for k, v in meta]
    t = Table(data, colWidths=[110, CONTENT_W - 110], hAlign='LEFT')
    t.setStyle(TableStyle([
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(t)
    story.append(PageBreak())


def h1(story, num, title):
    story.append(Paragraph(f'{num}. {title}', styles['H1']))


def bullets(story, items):
    story.append(ListFlowable(
        [ListItem(Paragraph(it, styles['BulletText']), leftIndent=6) for it in items],
        bulletType='bullet', start='•', leftIndent=14, bulletFontSize=8,
    ))


def build():
    doc = SimpleDocTemplate(OUT_PATH, pagesize=letter,
                             leftMargin=MARGIN, rightMargin=MARGIN,
                             topMargin=64, bottomMargin=58,
                             title='Sabías Que PR — Planificación y Diseño de Base de Datos',
                             author='William Collado')
    story = []
    build_portada(story)

    # ── FASE 1 ──────────────────────────────────────────────
    story.append(Paragraph('FASE 1 · PLANIFICACIÓN Y DISEÑO', styles['Eyebrow']))

    h1(story, 1, 'Descripción del proyecto')
    story.append(Paragraph(
        '<b>Sabías Que PR</b> es una plataforma web informativa y comunitaria, nacida en Puerto Rico con una '
        'misión sin fronteras: cualquier persona, en cualquier país, que quiera entender su entorno y ser '
        'agente de cambio. Combina noticias categorizadas con contexto histórico y análisis crítico, contenido '
        'educativo organizado por rutas de aprendizaje, una tienda de artículos que apoya el sostenimiento '
        'del proyecto, y un foro comunitario donde los usuarios registrados publican y comentan — con un '
        'modelo de suscripción premium que amplía lo que pueden publicar.', styles['Body']))
    story.append(Paragraph(
        'El sitio nació como una aplicación estática (13 páginas HTML generadas por un script de plantillas '
        'propio) y, como proyecto final del curso, evolucionó hacia una aplicación <b>full-stack</b> real: un '
        'frontend en HTML5/CSS3/JavaScript que consume una <b>API REST propia</b> construida en Node.js y '
        'Express, con persistencia en una base de datos <b>PostgreSQL</b> (alojada en Supabase), '
        'autenticación de usuarios mediante <b>JSON Web Tokens verificados en el servidor</b> — no solo '
        'en el navegador — y suscripciones recurrentes procesadas por <b>Stripe</b>. La aplicación ya está '
        '<b>desplegada y accesible públicamente</b> (Netlify + Render), no solo en un entorno local.', styles['Body']))

    h1(story, 2, 'Objetivo general')
    story.append(Paragraph(
        'Diseñar, desarrollar, probar y desplegar una aplicación web full-stack funcional para el proyecto '
        '<b>Sabías Que PR</b>, que integre un frontend responsivo, una API REST propia con operaciones CRUD '
        'completas, una base de datos relacional persistente y un sistema de autenticación con JWT verificado '
        'en el servidor, aplicando de manera integrada las tecnologías y metodologías estudiadas durante el '
        'curso de Desarrollo Web Full-Stack.', styles['Body']))

    h1(story, 3, 'Justificación')
    story.append(Paragraph(
        'Antes de este proyecto, todo lo "dinámico" del sitio dependía de que el navegador llamara '
        'directamente a servicios de terceros sin configurar (Formspree, Supabase, Mailchimp, Stripe), y el '
        'contenido se editaba a mano en archivos JSON. Un proyecto final de desarrollo full-stack evalúa que '
        'el equipo construya y controle las tres capas de una aplicación real: un backend/API propio, una '
        'base de datos con esquema propio, y un frontend que consuma esa API — no solo enlaces a widgets '
        'externos.', styles['Body']))
    story.append(Paragraph(
        'Construir un <b>foro comunitario real</b> como eje del CRUD, junto con la gestión de noticias y '
        'productos vía API, resuelve ambos objetivos a la vez: cumple el criterio de mayor peso de la '
        'rúbrica del curso (30%, funcionalidad y CRUD completo) y avanza la visión original del proyecto de '
        'convertirse en un espacio donde la comunidad no solo lee, sino que participa.', styles['Body']))

    h1(story, 4, 'Alcance del sistema')
    story.append(Paragraph('<b>Incluido en esta entrega:</b>', styles['H2']))
    bullets(story, [
        'Foro comunitario con CRUD completo (publicaciones y comentarios), filtrable por categoría, con límite de palabras según el rol del usuario (100 para usuarios regulares, 500 para premium), autenticación JWT verificada en el servidor y permisos de dueño/administrador.',
        'CRUD vía API REST propia para noticias (filtrables por 11 categorías) y productos (antes generados estáticamente por un script de plantillas).',
        'Autenticación completa de extremo a extremo: registro, inicio de sesión, recuperación de contraseña e inicio de sesión con Google (Supabase Auth), verificada también del lado del servidor, con acceso disponible desde una ventana de inicio de sesión en todas las páginas.',
        'Suscripciones premium recurrentes vía Stripe (checkout + webhook que sincroniza el rol del usuario automáticamente) — construidas y funcionando en modo de prueba (sandbox), sin cobrar dinero real todavía.',
        'Panel de administración protegido por rol, con formularios CRUD sobre noticias (incluyendo categoría) y productos.',
        'Suite de pruebas automatizadas (94 pruebas, unitarias e integración) sobre la API.',
        'Despliegue público real de la aplicación (frontend en Netlify, backend en Render) en una URL accesible para evaluación, con un flujo automatizado (GitHub Actions) que mantiene la base de datos activa.',
    ])
    story.append(Paragraph('<b>Fuera de alcance para esta entrega académica</b> (parte del roadmap de producto, no del criterio de evaluación):', styles['H2']))
    bullets(story, [
        'Activar Stripe en modo real (llaves de producción) — las suscripciones premium están construidas y probadas, pero solo con llaves de prueba.',
        'Checkout de carrito multi-producto para la tienda (hoy usa enlaces de pago individuales de Stripe por producto).',
        'Sistema de newsletter propio para reemplazar Mailchimp.',
        'Conexión al dominio de producción real (sabiasquepr.com) — deliberadamente pospuesta hasta tener más contenido publicado; el despliegue académico usa la URL de Netlify/Render, que ya es pública y funcional.',
        'Catalogador de noticias asistido por IA, sección de videos y soporte multi-idioma — roadmap de producto a futuro.',
    ])

    h1(story, 5, 'Tecnologías seleccionadas')
    tech_data = [
        [Paragraph('<b>Capa</b>', styles['TableCell']), Paragraph('<b>Tecnología</b>', styles['TableCell']), Paragraph('<b>Uso en el proyecto</b>', styles['TableCell'])],
        ['Frontend', 'HTML5, CSS3, JavaScript (ES modules)', 'Sitio responsive, modo oscuro con persistencia, PWA (manifest + service worker)'],
        ['Backend', 'Node.js + Express', 'API REST propia (backend/src) con middleware de validación y manejo de errores centralizado'],
        ['Base de datos', 'PostgreSQL (Supabase)', 'Esquema relacional propio con Row Level Security activo'],
        ['Autenticación', 'Supabase Auth + jose (JWKS, ES256)', 'Login/registro/OAuth en el cliente; verificación de JWT en cada ruta protegida del servidor'],
        ['Pagos', 'Stripe (suscripciones)', 'Checkout de suscripción premium + webhook que actualiza el rol del usuario automáticamente (modo prueba)'],
        ['Pruebas', 'Jest + Supertest', '94 pruebas unitarias de validadores/middleware y de integración de la API'],
        ['Control de versiones', 'Git + GitHub', 'Historial de commits por fase (github.com/Wcollado72/SabiasquePR)'],
        ['Despliegue', 'Netlify + Render', 'Frontend estático (Netlify) y backend Express (Render) — ya desplegados y accesibles públicamente'],
        ['Automatización', 'GitHub Actions', 'Ping periódico a la API (cada 3 días) para evitar que Supabase pause la base de datos por inactividad'],
    ]
    t = Table([[Paragraph(str(c), styles['TableCell']) if not isinstance(c, Paragraph) else c for c in row] for row in tech_data],
               colWidths=[85, 165, CONTENT_W - 85 - 165], hAlign='LEFT')
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), ACCENT_DARK),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, PAPER_RULED]),
        ('GRID', (0, 0), (-1, -1), 0.5, LINE),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(t)
    story.append(Spacer(1, 4))

    story.append(PageBreak())
    h1(story, 6, 'Diagrama de arquitectura')
    story.append(Paragraph(
        'El navegador carga el frontend estático y, por separado, se comunica directamente con Supabase Auth '
        'para autenticarse (obteniendo un JWT firmado). El frontend consulta el backend propio mediante fetch, '
        'enviando ese JWT en el encabezado <font face="Courier">Authorization: Bearer</font>. El backend valida '
        'el JWT contra el JWKS público de Supabase (sin necesidad de compartir ningún secreto) y solo entonces '
        'consulta PostgreSQL.', styles['Body']))
    story.append(diagrama_arquitectura())
    story.append(Paragraph('Figura 1. Arquitectura de tres capas: frontend, API propia y base de datos, con Supabase Auth como servicio de identidad compartido.', styles['Caption']))
    story.append(Paragraph(
        'Un cuarto integrante, no mostrado en el diagrama por espacio, es <b>Stripe</b>: cuando un usuario se '
        'suscribe a premium desde <font face="Courier">premium.html</font>, el backend crea una sesión de '
        'checkout de Stripe; al completarse el pago, Stripe llama a un <i>webhook</i> propio '
        '(<font face="Courier">POST /api/stripe/webhook</font>), verificado con la firma de Stripe, que '
        'actualiza directamente el rol del usuario en PostgreSQL — sin que el frontend tenga que hacer nada '
        'adicional.', styles['Body']))

    h1(story, 7, 'Diagrama general de navegación')
    story.append(Paragraph(
        'Todas las páginas públicas comparten la barra de navegación superior y un botón de inicio de sesión '
        'en el encabezado (ventana emergente, disponible en toda página). El foro permite lectura pública '
        'y restringe la escritura (publicar, comentar) a usuarios con sesión activa; el panel de administración '
        'está completamente restringido al rol <font face="Courier">admin</font>; la página Premium inicia el '
        'checkout de Stripe para quien quiera suscribirse. Las páginas "Sobre el proyecto", "Crítica '
        'Internacional" y "Tecnología" se retiraron: la primera se fusionó dentro de Inicio, y los temas de '
        'las otras dos se absorbieron en las categorías del feed de Noticias.', styles['Body']))
    story.append(diagrama_navegacion())
    story.append(Paragraph('Figura 2. Mapa de navegación del sitio: páginas públicas, área que requiere sesión (foro) y área restringida por rol (panel de administración).', styles['Caption']))

    # ── FASE 2 ──────────────────────────────────────────────
    story.append(PageBreak())
    story.append(Paragraph('FASE 2 · DISEÑO DE LA BASE DE DATOS', styles['Eyebrow']))

    h1(story, 8, 'Modelo Entidad-Relación (MER)')
    story.append(Paragraph(
        'La base de datos vive en el proyecto de Supabase (PostgreSQL administrado). '
        '<font face="Courier">auth.users</font> es la tabla gestionada por Supabase Auth; '
        '<font face="Courier">perfiles</font> extiende esa identidad con el rol de autorización '
        '(<font face="Courier">usuario</font> / <font face="Courier">admin</font>) y es el punto de origen de '
        'todas las relaciones de autoría del sistema. Todas las tablas tienen <b>Row Level Security</b> activo.', styles['Body']))
    story.append(diagrama_mer())
    story.append(Paragraph('Figura 3. Modelo Entidad-Relación: 8 tablas propias más la tabla de identidad de Supabase Auth (externa, gestionada por la plataforma).', styles['Caption']))

    story.append(PageBreak())
    h1(story, 9, 'Esquema relacional y diccionario de datos')
    story.append(Paragraph(
        'A continuación, el diccionario de datos completo: cada tabla, sus columnas, tipo de dato, '
        'restricciones (llaves primarias/foráneas, valores por defecto, validaciones) y una descripción '
        'de su propósito. Corresponde exactamente al script <font face="Courier">backend/sql/schema.sql</font> '
        'del repositorio.', styles['Body']))
    for i, (tabla, campos) in enumerate(DICCIONARIO):
        story.append(Spacer(1, 10 if i else 4))
        story.append(Paragraph(tabla, styles['H2']))
        story.append(tabla_diccionario(tabla, campos))

    story.append(Spacer(1, 14))
    h1(story, 10, 'Normalización e índices')
    story.append(Paragraph(
        'El esquema está normalizado a Tercera Forma Normal (3FN): cada tabla describe una sola entidad, sin '
        'grupos repetitivos ni dependencias transitivas. La única excepción deliberada es '
        '<font face="Courier">noticias.parrafos</font> y <font face="Courier">ordenes.items</font>, almacenados '
        'como <font face="Courier">jsonb</font> por tratarse de listas ordenadas sin necesidad de consultarse '
        'individualmente por fuera de su registro padre.', styles['Body']))
    bullets(story, [
        '<font face="Courier">idx_foro_posts_categoria</font> — acelera el filtrado del foro por categoría, ordenado por fecha.',
        '<font face="Courier">idx_foro_comentarios_post_id</font> — acelera la carga de comentarios de una publicación.',
        'Restricciones <font face="Courier">CHECK</font> en <font face="Courier">perfiles.rol</font>, <font face="Courier">foro_posts.categoria</font> y <font face="Courier">ordenes.estado</font> sustituyen tablas de catálogo separadas, dado el número reducido y fijo de valores válidos.',
    ])

    h1(story, 11, 'Script de creación de la base de datos')
    story.append(Paragraph(
        'El script completo de creación (DDL) vive en el repositorio en '
        '<font face="Courier">backend/sql/schema.sql</font> y se aplica con '
        '<font face="Courier">npm run db:schema</font> (backend/scripts/apply-schema.js). Fue verificado '
        'aplicándolo contra el proyecto real de Supabase durante la Fase 1 del desarrollo. Se incluye a '
        'continuación tal como está en el repositorio.', styles['Body']))
    story.append(Spacer(1, 6))
    with open(SCHEMA_SQL_PATH, 'r', encoding='utf-8') as f:
        sql_text = f.read()
    pre_style = ParagraphStyle('SqlPre', fontName='Courier', fontSize=7.4, leading=9.6, textColor=INK)
    story.append(HRFlowable(width=CONTENT_W, thickness=0.5, color=LINE, spaceAfter=8))
    story.append(Preformatted(sql_text, pre_style))

    doc.build(story, onFirstPage=draw_footer, onLaterPages=draw_footer)


if __name__ == '__main__':
    build()
    print('OK ->', OUT_PATH)
