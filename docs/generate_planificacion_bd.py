# -*- coding: utf-8 -*-
"""
Genera docs/entrega/planificacion-y-diseno-bd.pdf para Sabias Que PR:
Fase 1 (Planificacion y Diseno) + Fase 2 (Diseno de la Base de Datos)
de la rubrica del curso Full-Stack.
"""
import datetime
import json
import math
import os
import re
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    HRFlowable, ListFlowable, ListItem, Preformatted, CondPageBreak
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
OUT_PATH = os.path.join(DOCS_DIR, 'entrega', 'planificacion-y-diseno-bd.pdf')
SCHEMA_SQL_PATH = os.path.join(REPO_ROOT, 'backend', 'sql', 'schema.sql')
ESTRUCTURA_PATH = os.path.join(DOCS_DIR, 'entrega', 'estructura-bd.json')
DATOS_ESTUDIANTE_PATH = os.path.join(DOCS_DIR, 'privado', 'datos-estudiante.json')
sys.path.insert(0, DOCS_DIR)
from descripciones_bd import DESC, PROPOSITO

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
    textColor=INK, spaceBefore=22, spaceAfter=10, keepWithNext=1,
))
styles.add(ParagraphStyle(
    name='H2', fontName='Helvetica-Bold', fontSize=11.5, leading=15,
    textColor=ACCENT_DARK, spaceBefore=14, spaceAfter=6, keepWithNext=1,
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

AMBAR = colors.HexColor('#B8791A')
AMBAR_TXT = colors.HexColor('#8A5A10')
VERDE_SOFT = colors.HexColor('#EAF3EF')
AMBAR_SOFT = colors.HexColor('#F5ECE1')


def diagrama_arquitectura():
    W, H = CONTENT_W, 330
    d = Drawing(W, H)
    d.hAlign = 'CENTER'
    bw = 170
    xl, xr = 12, W - 12 - bw

    box(d, W/2 - 90, H - 40, 180, 32, 'Navegador del usuario', 'cliente HTTP')

    box(d, xl, H - 130, bw, 46, 'Frontend estático', 'HTML5 + CSS3 + JavaScript · Netlify', fill=VERDE_SOFT, stroke=DONE, title_color=DONE)
    box(d, xr, H - 130, bw, 46, 'Supabase Auth', 'login, registro, Google, 2FA, JWKS', fill=AMBAR_SOFT, stroke=AMBAR, title_color=AMBAR_TXT)
    box(d, xl, H - 220, bw, 46, 'Backend API propio', 'Node.js + Express · Render')
    box(d, xr, H - 220, bw, 46, 'Base de datos', 'PostgreSQL (Supabase) · 14 tablas', fill=VERDE_SOFT, stroke=DONE, title_color=DONE)

    d.add(String(W/2, 92, 'Servicios de terceros', fontName='Helvetica-Oblique', fontSize=7.5,
                 fillColor=INK_SOFT, textAnchor='middle'))
    serv = [('Stripe', 'pagos y apoyo'), ('Claude API', 'agentes de IA'), ('Beehiiv', 'boletín'),
            ('Formspree', 'contacto'), ('Turnstile', 'anti-robots'), ('Resend', 'correos de Auth')]
    sw, gap = 74, 12
    x0 = (W - (len(serv) * sw + (len(serv) - 1) * gap)) / 2
    for i, (t, st) in enumerate(serv):
        box(d, x0 + i * (sw + gap), 46, sw, 36, t, st, title_size=7.6, fill=WHITE, stroke=LINE, title_color=INK_SOFT)
    box(d, W/2 - 150, 4, 300, 30, 'Respaldo diario cifrado · CI (GitHub Actions)', 'pruebas, lint y auditoría en cada cambio',
        fill=WHITE, stroke=LINE, title_color=INK_SOFT, dashed=True, title_size=7.4)

    arrow(d, W/2 - 30, H - 40, xl + bw/2 + 20, H - 84, 'HTML/CSS/JS')
    arrow(d, W/2 + 30, H - 40, xr + bw/2 - 20, H - 84, 'sesión / login')
    arrow(d, xl + bw/2, H - 130, xl + bw/2, H - 174, 'fetch + Bearer JWT')
    arrow(d, xl + bw, H - 107, xr, H - 107, 'signInWithPassword / OAuth', dashed=True)
    arrow(d, xl + bw, H - 197, xr, H - 197, 'pool.query (pg)')
    arrow(d, xl + bw, H - 178, xr + 40, H - 130, 'verifica JWT (JWKS, ES256)', dashed=True)
    return d


# ── DIAGRAMA 2: NAVEGACION ──────────────────────────────────

def diagrama_navegacion():
    W, H = CONTENT_W, 360
    d = Drawing(W, H)
    d.hAlign = 'CENTER'

    icx = W / 2
    box(d, icx - 70, 322, 140, 28, 'Inicio', 'index.html', fill=ACCENT_SOFT, stroke=ACCENT)

    menu = [
        ('Noticias', 'noticias.html'), ('Revolución', 'Humana'), ('Educación', 'educacion.html'),
        ('Tienda', 'tienda.html'), ('Quiénes', 'somos'), ('Apoya', 'el canal'),
    ]
    n = len(menu)
    bw, gap = 64, 10
    total = n * bw + (n - 1) * gap
    x0 = (W - total) / 2
    row_y, row_h, spine_y = 250, 36, 298
    arrow(d, icx, 322, icx, spine_y + 2)
    d.add(Line(x0 + bw/2, spine_y, x0 + total - bw/2, spine_y, strokeColor=INK_SOFT, strokeWidth=1))
    centros = []
    for i, (t1, t2) in enumerate(menu):
        x = x0 + i * (bw + gap)
        cx = x + bw / 2
        centros.append(cx)
        premium = (i == 5)
        fill, stroke, tc = (AMBAR_SOFT, AMBAR, AMBAR_TXT) if premium else (ACCENT_SOFT, ACCENT, ACCENT_DARK)
        box(d, x, row_y, bw, row_h, t1, t2, title_size=7, fill=fill, stroke=stroke, title_color=tc)
        d.add(Line(cx, spine_y, cx, row_y + row_h, strokeColor=INK_SOFT, strokeWidth=1))

    # Revolución Humana → sub-secciones con debate
    sub_y = 168
    box(d, 8, sub_y, 168, 54, 'Sub-secciones (cada una con debate)',
        lines=['Nuevos Humanos · Lógica Humana', 'Corrupción Humana (18+)', 'Ilógica Humana (18+)'],
        fill=VERDE_SOFT, stroke=DONE, title_color=DONE, title_size=6.6)
    arrow(d, centros[1], row_y, 92, sub_y + 54, None, dashed=True)

    # Educación / Noticias → artículo
    box(d, 190, sub_y, 128, 54, 'Artículo / recurso', lines=['articulo.html', 'recurso.html'],
        fill=WHITE, stroke=LINE, title_color=INK_SOFT, dashed=True, title_size=7)
    arrow(d, centros[0], row_y, 230, sub_y + 54, None, dashed=True)
    arrow(d, centros[2], row_y, 280, sub_y + 54, None, dashed=True)

    # Tienda / apoyo → Stripe
    box(d, 332, sub_y, 164, 54, 'Pago en Stripe (modo prueba)', 'compra o apoyo voluntario',
        fill=AMBAR_SOFT, stroke=AMBAR, title_color=AMBAR_TXT, title_size=7)
    arrow(d, centros[3], row_y, 380, sub_y + 54, 'checkout', dashed=True)
    arrow(d, centros[5], row_y, 450, sub_y + 54, 'apoyo', dashed=True)

    # Control de sesión
    box(d, 8, 84, 168, 44, 'Iniciar sesión (en toda página)', 'registro, Google, recuperar contraseña',
        fill=ACCENT_SOFT, stroke=ACCENT, title_size=7)
    box(d, 190, 84, 128, 44, 'Mi cuenta', 'mi-cuenta.html · requiere sesión',
        fill=WHITE, stroke=LINE, dashed=True, title_color=INK_SOFT, title_size=7.4)
    box(d, 332, 84, 164, 44, 'Panel de administración', 'admin.html · rol admin + 2FA',
        fill=AMBAR_SOFT, stroke=AMBAR, title_color=AMBAR_TXT, title_size=7.4)
    arrow(d, 176, 106, 190, 106, None)
    arrow(d, 318, 106, 332, 106, None, dashed=True)

    box(d, 8, 14, 488, 40, 'Páginas de apoyo', lines=['Privacidad · Términos · Restablecer contraseña · 404 · selector de idioma ES/EN'],
        fill=PAPER_RULED, stroke=LINE, dashed=True, title_color=INK_SOFT, title_size=7.4)
    return d


# ── DIAGRAMA 3: MODELO ENTIDAD-RELACION (14 tablas) ─────────

def diagrama_mer():
    W, H = CONTENT_W, 650
    d = Drawing(W, H)
    d.hAlign = 'CENTER'

    def ent(x, y, w, h, name, cols, ext=False):
        box(d, x, y, w, h, name, lines=cols, dashed=ext,
            fill=WHITE if not ext else PAPER_RULED, stroke=ACCENT if not ext else LINE,
            title_color=ACCENT_DARK if not ext else INK_SOFT)

    lw, bh = 134, 70
    px, py, pw, ph = 177, 508, 150, 70
    pcx = px + pw / 2

    ent(pcx - 70, 606, 140, 36, 'auth.users (Supabase)', ['id uuid PK'], ext=True)
    ent(px, py, pw, ph, 'perfiles', ['id uuid PK, FK', 'email, rol, nombre', 'stripe_customer_id'])
    pk_fk_line(d, pcx, 606, pcx, py + ph, '1:1')

    # Columna izquierda
    izq = [
        (520, 'ordenes', ['id uuid PK', 'usuario_id FK', 'items jsonb, total'], 58),
        (414, 'comentarios', ['id uuid PK', 'autor_id FK', 'tipo, item_id (lógico)'], 42),
        (308, 'reportes', ['id uuid PK', 'reportado_por FK', 'tipo, item_id (lógico)'], 26),
        (202, 'traducciones', ['PK (tipo,item_id,idioma)', 'actualizado_por FK', 'campos jsonb'], 10),
    ]
    for y, name, cols, off in izq:
        ent(0, y, lw, bh, name, cols)
        pk_fk_line(d, px, py + off, lw, y + bh / 2, '1:N')

    # Columna derecha
    rx = W - lw
    ent(rx, 560, lw, bh, 'contenidos', ['id text PK', 'seccion, categoria', 'titulo, es_premium'])
    ent(rx, 454, lw, bh, 'foro_posts', ['id uuid PK', 'autor_id FK', 'tema_contenido_id FK'])
    ent(rx, 348, lw, bh, 'foro_comentarios', ['id uuid PK', 'post_id FK', 'autor_id FK'])
    ent(rx, 242, lw, bh, 'ia_generaciones', ['id uuid PK', 'creado_por FK', 'agente, costo_usd'])
    pk_fk_line(d, rx + lw/2, 560, rx + lw/2, 454 + bh, 'N:1 (opcional)')
    pk_fk_line(d, rx + lw/2, 454, rx + lw/2, 348 + bh, '1:N (post)')
    pk_fk_line(d, px + pw, py + 58, rx, 454 + bh / 2, '1:N')
    pk_fk_line(d, px + pw, py + 34, rx, 348 + bh / 2, '1:N (autor)')
    pk_fk_line(d, px + pw, py + 10, rx, 242 + bh / 2, '1:N')

    # Independientes
    d.add(String(W/2, 172, 'Entidades independientes (sin llaves foráneas)',
                 fontName='Helvetica-Oblique', fontSize=7.5, fillColor=INK_SOFT, textAnchor='middle'))
    ind = [
        ('noticias', ['id text PK', 'titulo, fecha', 'parrafos jsonb']),
        ('productos', ['id text PK', 'nombre, precio', 'stripe_price_id']),
        ('mensajes_contacto', ['id uuid PK', 'nombre, email', 'mensaje']),
        ('suscriptores', ['id uuid PK', 'email UNIQUE']),
        ('gastos_servicios', ['id text PK', 'nombre, estado', 'costo_mensual_usd']),
    ]
    bw, gap = 92, 11
    x0 = (W - (5 * bw + 4 * gap)) / 2
    for i, (name, cols) in enumerate(ind):
        ent(x0 + i * (bw + gap), 88, bw, 70, name, cols)
    # Escalado para que el diagrama completo quepa en una página junto a su texto.
    k = 0.76
    d.scale(k, k)
    d.width, d.height = W * k, H * k
    return d


# ── DICCIONARIO DESDE LA ESTRUCTURA REAL ────────────────────

def cargar_estructura():
    with open(ESTRUCTURA_PATH, encoding='utf-8') as f:
        return json.load(f)


def lista_check(definicion):
    """'CHECK ((x = ANY (ARRAY['a'::text, ...])))' -> ['a', ...]; otros CHECK -> None."""
    valores = re.findall(r"'([^']*)'::text", definicion)
    return valores or None


def restricciones_de(estructura, tabla, columna, fila):
    out = []
    pk = [r for r in estructura['restricciones'] if r['t'] == tabla and r['tipo'] == 'p']
    if pk and re.search(r'\b' + columna + r'\b', pk[0]['def']):
        out.append('PK')
    for r in estructura['restricciones']:
        if r['t'] != tabla:
            continue
        if r['tipo'] == 'f':
            m = re.match(r'FOREIGN KEY \((\w+)\) REFERENCES ([\w.]+)\((\w+)\)(?: ON DELETE ([A-Z ]+))?', r['def'])
            if m and m.group(1) == columna:
                accion = f' ON DELETE {m.group(4)}' if m.group(4) else ''
                out.append(f'FK → {m.group(2)}({m.group(3)}){accion}')
        elif r['tipo'] == 'u' and re.search(r'\(' + columna + r'\)$', r['def']):
            out.append('UNIQUE')
        elif r['tipo'] == 'c' and re.search(r'\b' + columna + r'\b', r['def'][:60]):
            vals = lista_check(r['def'])
            if vals and len(vals) <= 5:
                out.append('CHECK IN (' + ', '.join(vals) + ')')
            elif vals:
                out.append(f'CHECK IN ({len(vals)} valores)')
            else:
                out.append('CHECK ' + re.sub(r'[()]', '', r['def'][len('CHECK '):])[:24])
    if fila['nulo'] == 'NO' and 'PK' not in out:
        out.append('NOT NULL')
    if fila['def']:
        d = fila['def'].replace('::text', '').replace('::jsonb', '')
        out.append('DEFAULT ' + d)
    return ', '.join(out)


def tablas_del_diccionario(estructura):
    por_tabla = {}
    for c in estructura['columnas']:
        por_tabla.setdefault(c['t'], []).append(c)
    faltan = [f'{t}.{c["col"]}' for t, cols in por_tabla.items() for c in cols if c['col'] not in DESC.get(t, {})]
    if faltan:
        raise SystemExit('Faltan descripciones en docs/descripciones_bd.py para: ' + ', '.join(faltan))
    sin_tabla = [t for t in por_tabla if t not in PROPOSITO]
    if sin_tabla:
        raise SystemExit('Falta el propósito de las tablas: ' + ', '.join(sin_tabla))
    return por_tabla


def tabla_diccionario(estructura, tabla, columnas):
    header = [Paragraph(h, styles['TableHead']) for h in ('Campo', 'Tipo', 'Restricciones', 'Descripción')]
    data = [header]
    for c in columnas:
        data.append([
            Paragraph(f'<font face="Courier-Bold">{c["col"]}</font>', styles['TableCell']),
            Paragraph(f'<font face="Courier">{c["tipo"]}</font>', styles['TableCellSoft']),
            Paragraph(restricciones_de(estructura, tabla, c['col'], c).replace('<', '&lt;'), styles['TableCellSoft']),
            Paragraph(DESC[tabla][c['col']], styles['TableCell']),
        ])
    t = Table(data, colWidths=[88, 62, 170, CONTENT_W - 88 - 62 - 170], hAlign='LEFT', repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), ACCENT_DARK),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, PAPER_RULED]),
        ('GRID', (0, 0), (-1, -1), 0.5, LINE),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 3.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
    ]))
    return t


def esquema_relacional(estructura, por_tabla):
    """Notación textual: tabla(PK subrayada*, atributos…) con las llaves foráneas debajo."""
    filas = []
    for tabla, cols in por_tabla.items():
        pk = next((r for r in estructura['restricciones'] if r['t'] == tabla and r['tipo'] == 'p'), None)
        pks = re.findall(r'\w+', pk['def'].replace('PRIMARY KEY', '')) if pk else []
        attrs = ', '.join(f'<u>{c["col"]}</u>' if c['col'] in pks else c['col'] for c in cols)
        fks = []
        for r in estructura['restricciones']:
            if r['t'] == tabla and r['tipo'] == 'f':
                m = re.match(r'FOREIGN KEY \((\w+)\) REFERENCES ([\w.]+)\((\w+)\)', r['def'])
                fks.append(f'{m.group(1)} → {m.group(2)}.{m.group(3)}')
        texto = f'<b>{tabla}</b>({attrs})'
        if fks:
            texto += '<br/><font color="#51606E">FK: ' + '; '.join(fks) + '</font>'
        filas.append(Paragraph(texto, styles['TableCell']))
    return filas


# ── PAGINA / PIE DE PAGINA ──────────────────────────────────

def draw_footer(c: pdfcanvas.Canvas, doc):
    if doc.page == 1:
        return
    c.saveState()
    c.setStrokeColor(LINE)
    c.setLineWidth(0.5)
    c.line(MARGIN, 44, PAGE_W - MARGIN, 44)
    c.setFont('Helvetica', 7.5)
    c.setFillColor(INK_SOFT)
    c.drawString(MARGIN, 32, 'Sabías que PR — Planificación y Diseño de Base de Datos')
    c.drawRightString(PAGE_W - MARGIN, 32, f'Página {doc.page}')
    c.restoreState()


MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
         'septiembre', 'octubre', 'noviembre', 'diciembre']


def fecha_en_letras(hoy=None):
    hoy = hoy or datetime.date.today()
    return f'{hoy.day} de {MESES[hoy.month - 1]} de {hoy.year}'


def datos_estudiante():
    """Nombre y número de estudiante: de docs/privado/datos-estudiante.json (no se sube al repositorio).
    Si el archivo no existe se usa el nombre ya usado en entregas anteriores y no se inventa el número."""
    datos = {'nombre': 'William Collado', 'numero': None}
    try:
        with open(DATOS_ESTUDIANTE_PATH, encoding='utf-8') as f:
            datos.update(json.load(f))
    except FileNotFoundError:
        pass
    return datos


# ── PORTADA ──────────────────────────────────────────────────

def build_portada(story):
    est = datos_estudiante()
    story.append(Spacer(1, 90))
    story.append(Paragraph('UNIVERSIDAD INTERAMERICANA DE PUERTO RICO · RECINTO DE FAJARDO', styles['Eyebrow']))
    story.append(Spacer(1, 40))
    story.append(Paragraph('PROYECTO FINAL · DESARROLLO WEB FULL-STACK', styles['Eyebrow']))
    story.append(Paragraph('Sabías que PR', ParagraphStyle('CoverTitle', parent=styles['DocTitle'], fontSize=32, leading=36)))
    story.append(Paragraph('Planificación y Diseño de la Base de Datos', ParagraphStyle('CoverSub', parent=styles['DocSub'], fontSize=14, leading=19, textColor=ACCENT_DARK)))
    story.append(Spacer(1, 10))
    story.append(Paragraph('Fase 1: Planificación y Diseño &nbsp;·&nbsp; Fase 2: Diseño de la Base de Datos', styles['DocSub']))
    story.append(Spacer(1, 150))

    meta = [['Estudiante', est['nombre']]]
    if est.get('numero'):
        meta.append(['Número de estudiante', est['numero']])
    meta += [
        ['Curso', 'COMP2053 — Desarrollo Web Full-Stack'],
        ['Profesora', 'Milagros Donato Cintrón'],
        ['Institución', 'Universidad Interamericana de Puerto Rico, Recinto de Fajardo'],
        ['Repositorio', 'github.com/Wcollado72/SabiasquePR'],
        ['Sitio en línea', 'sabiasquepr.com'],
        ['Fecha', fecha_en_letras()],
    ]
    data = [[Paragraph(f'<font color="#51606E">{k}</font>', styles['Body']), Paragraph(v, styles['Body'])] for k, v in meta]
    t = Table(data, colWidths=[130, CONTENT_W - 130], hAlign='LEFT')
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


def tabla_simple(filas, anchos):
    t = Table([[Paragraph(str(c), styles['TableHead'] if i == 0 else styles['TableCell']) for c in row] for i, row in enumerate(filas)],
              colWidths=anchos, hAlign='LEFT', repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), ACCENT_DARK),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, PAPER_RULED]),
        ('GRID', (0, 0), (-1, -1), 0.5, LINE),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 3.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ]))
    return t


def build():
    estructura = cargar_estructura()
    por_tabla = tablas_del_diccionario(estructura)
    n_tablas = len(por_tabla)
    n_pk = sum(1 for r in estructura['restricciones'] if r['tipo'] == 'p')
    n_fk = sum(1 for r in estructura['restricciones'] if r['tipo'] == 'f')
    n_check = sum(1 for r in estructura['restricciones'] if r['tipo'] == 'c')
    n_idx = sum(1 for i in estructura['indices'] if not i['nombre'].endswith('_pkey'))
    n_rls = sum(1 for r in estructura['rls'] if r['rls'])

    est = datos_estudiante()
    doc = SimpleDocTemplate(OUT_PATH, pagesize=letter,
                             leftMargin=MARGIN, rightMargin=MARGIN,
                             topMargin=64, bottomMargin=58,
                             title='Sabías que PR — Planificación y Diseño de Base de Datos',
                             author=est['nombre'])
    story = []
    build_portada(story)

    # ── FASE 1 ──────────────────────────────────────────────
    story.append(Paragraph('FASE 1 · PLANIFICACIÓN Y DISEÑO', styles['Eyebrow']))

    h1(story, 1, 'Descripción del proyecto')
    story.append(Paragraph(
        '<b>Sabías que PR</b> es una plataforma web informativa y comunitaria nacida en Puerto Rico con una '
        'misión sin fronteras: ayudar a cualquier persona a entender su entorno. Reúne noticias con contexto, '
        'contenido educativo, la sección <b>Revolución Humana</b> (ensayos, videos y audios con sus propios '
        'espacios de debate), una tienda, y un <b>apoyo voluntario</b> al proyecto. Todo el contenido es gratis; '
        'quien apoya recibe reconocimiento y puede escribir textos más largos en el debate.', styles['Body']))
    story.append(Paragraph(
        'El sitio es una aplicación <b>full-stack</b>: un frontend en HTML5, CSS3 y JavaScript que consume una '
        '<b>API REST propia</b> (Node.js y Express), con persistencia en <b>PostgreSQL</b> (Supabase), '
        'autenticación con <b>JSON Web Tokens verificados en el servidor</b> y pagos con <b>Stripe</b> '
        '(modo de prueba). Está <b>desplegada y accesible públicamente</b> en '
        '<font face="Courier">sabiasquepr.com</font> (Netlify + Render + Supabase).', styles['Body']))

    h1(story, 2, 'Objetivo general')
    story.append(Paragraph(
        'Diseñar, desarrollar, probar y desplegar una aplicación web full-stack funcional que integre un '
        'frontend responsivo, una API REST propia con operaciones CRUD completas, una base de datos '
        'relacional persistente y un sistema de autenticación con JWT verificado en el servidor, aplicando '
        'de manera integrada las tecnologías estudiadas en el curso de Desarrollo Web Full-Stack.', styles['Body']))
    story.append(Paragraph('Objetivos específicos', styles['H2']))
    bullets(story, [
        'Construir una API REST con rutas organizadas, validación de datos, manejo centralizado de errores y rutas protegidas por rol.',
        f'Diseñar una base de datos relacional de {n_tablas} tablas con llaves primarias y foráneas, restricciones y seguridad por fila.',
        'Implementar registro, inicio de sesión y verificación en dos pasos para el panel de administración.',
        'Publicar la aplicación en línea con pruebas automáticas y un flujo de integración continua.',
    ])

    h1(story, 3, 'Justificación')
    story.append(Paragraph(
        'Un proyecto final de desarrollo full-stack evalúa que se construyan y controlen las tres capas de '
        'una aplicación real: un backend propio, una base de datos con esquema propio y un frontend que '
        'consuma esa API, no solo enlaces a servicios externos. El sitio responde además a una necesidad real: '
        'un espacio en español, desde Puerto Rico, donde las noticias vienen con contexto y la comunidad '
        'puede debatir con respeto y moderación.', styles['Body']))
    story.append(Paragraph(
        'El debate comunitario, la gestión de contenidos y la tienda sirven de eje del CRUD, el criterio de '
        'mayor peso de la rúbrica (30 %), y a la vez avanzan la visión del producto: que la comunidad no '
        'solo lea, sino que participe.', styles['Body']))

    h1(story, 4, 'Alcance del sistema')
    story.append(Paragraph('<b>Funcionalidades incluidas en esta entrega:</b>', styles['H2']))
    bullets(story, [
        '<b>CRUD vía API REST</b> sobre noticias, contenidos multi-formato, productos y publicaciones del debate; comentarios, reportes de moderación y órdenes con las operaciones que aplican.',
        '<b>Autenticación completa:</b> registro, inicio de sesión, recuperación de contraseña y Google (Supabase Auth); JWT verificado en el servidor; roles usuario, apoyo (premium), moderador y administrador; verificación en dos pasos (TOTP) para el panel de administración.',
        '<b>Debate comunitario</b> en cada sub-sección, con moderación, reportes y filtro automático; límite de palabras según el rol (200 para cuentas gratuitas y 1000 para quienes apoyan).',
        '<b>Panel de administración</b> protegido: formularios CRUD de noticias y contenidos, productos, moderación, métricas de uso de IA y control de gastos de servicios.',
        '<b>Agentes de IA</b> (Investigador, Redactor y Traductor, sobre la API de Claude) para preparar contenido, con registro de costo por uso.',
        '<b>Tienda y apoyo voluntario</b> con Stripe (checkout y webhook firmado) en modo de prueba.',
        '<b>Sitio bilingüe</b> (español e inglés), diseño responsivo, accesible y con modo claro y oscuro.',
        f'<b>Calidad:</b> 694 pruebas automáticas (Jest y Supertest), ESLint, auditoría de dependencias y de secretos en cada cambio (GitHub Actions) y respaldo diario cifrado de la base de datos.',
    ])
    story.append(Paragraph('<b>Fuera de alcance de esta entrega</b> (roadmap de producto, no criterio de evaluación):', styles['H2']))
    bullets(story, [
        'Activar Stripe en modo real (llaves de producción): el flujo está construido y probado con llaves de prueba.',
        'Lanzamiento público y promoción: se hará cuando haya suficiente contenido en cada sección.',
        'Debates en vivo tipo chat y nuevas zonas de debate.',
    ])

    h1(story, 5, 'Tecnologías seleccionadas')
    story.append(tabla_simple([
        ['Capa', 'Tecnología', 'Uso en el proyecto'],
        ['Frontend', 'HTML5, CSS3, JavaScript (sin framework)', 'Sitio responsivo generado por un script de plantillas (build.js), PWA con service worker, modo claro/oscuro, bilingüe'],
        ['Backend', 'Node.js 22 + Express 5', 'API REST propia (54 endpoints) con validadores, middleware de autenticación y manejo de errores centralizado'],
        ['Base de datos', 'PostgreSQL (Supabase)', f'{n_tablas} tablas relacionales con Row Level Security activo'],
        ['Autenticación', 'Supabase Auth + jose (JWKS, ES256)', 'Registro, inicio de sesión, Google y 2FA en el cliente; verificación del JWT en cada ruta protegida del servidor'],
        ['Pagos', 'Stripe', 'Checkout de tienda y apoyo voluntario, con webhook firmado (modo de prueba)'],
        ['Servicios', 'Resend, Cloudflare Turnstile, Beehiiv, Formspree, API de Claude', 'Correos de autenticación, anti-robots, boletín, formulario de contacto y agentes de IA'],
        ['Calidad', 'Jest + Supertest, ESLint', '694 pruebas automáticas y revisión de estilo en cada cambio'],
        ['Control de versiones', 'Git + GitHub + GitHub Actions', 'Historial de commits, ramas y pull requests; flujos de pruebas, auditoría, respaldo y mantenimiento'],
        ['Despliegue', 'Netlify + Render + Supabase', 'Frontend estático (Netlify, dominio propio), API (Render) y base de datos (Supabase)'],
    ], [88, 150, CONTENT_W - 88 - 150]))
    story.append(Spacer(1, 4))

    story.append(CondPageBreak(420))
    h1(story, 6, 'Diagrama de arquitectura')
    story.append(Paragraph(
        'El navegador carga el frontend estático y, por separado, se comunica con Supabase Auth para '
        'autenticarse y obtener un JWT firmado. El frontend consulta el backend propio mediante '
        '<font face="Courier">fetch</font> enviando ese JWT en el encabezado '
        '<font face="Courier">Authorization: Bearer</font>. El backend valida el JWT contra las llaves públicas '
        'de Supabase (JWKS) —sin compartir ningún secreto— y solo entonces consulta PostgreSQL.', styles['Body']))
    story.append(diagrama_arquitectura())
    story.append(Paragraph('Figura 1. Arquitectura de tres capas con Supabase Auth como servicio de identidad compartido y los servicios de terceros que usa cada capa.', styles['Caption']))
    story.append(Paragraph(
        'Cuando alguien apoya el proyecto o compra en la tienda, el backend crea una sesión de checkout de '
        'Stripe; al completarse el pago, Stripe llama al webhook propio '
        '(<font face="Courier">POST /api/stripe/webhook</font>), verificado con la firma de Stripe, que '
        'actualiza la orden y el rol del usuario en PostgreSQL sin intervención del frontend.', styles['Body']))

    story.append(CondPageBreak(420))
    h1(story, 7, 'Diagrama general de navegación')
    story.append(Paragraph(
        'Todas las páginas comparten la barra de navegación y el acceso a iniciar sesión. Cada sub-sección de '
        'Revolución Humana y Educación tiene su propio debate: se lee sin cuenta y se escribe con sesión. '
        'El panel de administración exige el rol de administrador y verificación en dos pasos.', styles['Body']))
    story.append(diagrama_navegacion())
    story.append(Paragraph('Figura 2. Mapa de navegación: páginas públicas, área con sesión y área restringida por rol.', styles['Caption']))

    # ── FASE 2 ──────────────────────────────────────────────
    story.append(PageBreak())
    story.append(Paragraph('FASE 2 · DISEÑO DE LA BASE DE DATOS', styles['Eyebrow']))

    h1(story, 8, 'Modelo Entidad-Relación (MER)')
    story.append(Paragraph(
        'La base de datos vive en un proyecto de Supabase (PostgreSQL administrado). '
        '<font face="Courier">auth.users</font> es la tabla de identidad que gestiona Supabase Auth; '
        '<font face="Courier">perfiles</font> la extiende con el rol y los datos de la cuenta, y es el origen '
        f'de las relaciones de autoría. El modelo tiene <b>{n_tablas} tablas propias</b>, {n_pk} llaves primarias, '
        f'<b>{n_fk} llaves foráneas</b> y Row Level Security activo en {n_rls} de {n_tablas}.', styles['Body']))
    story.append(diagrama_mer())
    story.append(Paragraph(
        'Figura 3. Modelo Entidad-Relación. Las líneas son llaves foráneas; en comentarios, reportes y '
        'traducciones la pieza referida se identifica por (tipo, item_id), una relación lógica sin llave foránea '
        'porque apunta a tablas distintas según el tipo.', styles['Caption']))

    story.append(PageBreak())
    h1(story, 9, 'Esquema relacional')
    story.append(Paragraph(
        'Notación relacional del modelo: cada tabla con sus atributos, la llave primaria <u>subrayada</u> y '
        'las llaves foráneas debajo.', styles['Body']))
    filas = esquema_relacional(estructura, por_tabla)
    t = Table([[f] for f in filas], colWidths=[CONTENT_W], hAlign='LEFT')
    t.setStyle(TableStyle([
        ('ROWBACKGROUNDS', (0, 0), (-1, -1), [WHITE, PAPER_RULED]),
        ('GRID', (0, 0), (-1, -1), 0.5, LINE),
        ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(t)

    story.append(PageBreak())
    h1(story, 10, 'Diccionario de datos')
    story.append(Paragraph(
        'Cada tabla con sus columnas, tipo de dato, restricciones (llaves, valores por defecto y '
        'validaciones) y una descripción. Se genera a partir de la estructura real de la base de datos, por '
        'lo que coincide exactamente con el script <font face="Courier">backend/sql/schema.sql</font>.', styles['Body']))
    orden = ['perfiles', 'noticias', 'contenidos', 'productos', 'ordenes', 'foro_posts', 'foro_comentarios',
             'comentarios', 'reportes', 'traducciones', 'ia_generaciones', 'gastos_servicios',
             'mensajes_contacto', 'suscriptores']
    assert sorted(orden) == sorted(por_tabla), 'La lista de orden no coincide con las tablas de la base'
    for i, tabla in enumerate(orden):
        story.append(Spacer(1, 10 if i else 4))
        bloque = [Paragraph(tabla, styles['H2']), Paragraph(PROPOSITO[tabla], styles['BodySmall'])]
        story.extend(bloque)
        story.append(tabla_diccionario(estructura, tabla, por_tabla[tabla]))

    story.append(Spacer(1, 14))
    h1(story, 11, 'Normalización, índices y seguridad')
    story.append(Paragraph(
        'El esquema está normalizado a Tercera Forma Normal (3FN): cada tabla describe una sola entidad, sin '
        'grupos repetitivos ni dependencias transitivas. Las excepciones son deliberadas: listas ordenadas que '
        'no se consultan por separado se guardan como <font face="Courier">jsonb</font> '
        '(<font face="Courier">noticias.parrafos</font>, <font face="Courier">ordenes.items</font>, las '
        'direcciones de envío y los campos de <font face="Courier">traducciones</font>).', styles['Body']))
    story.append(Paragraph(
        f'Hay <b>{n_check} restricciones CHECK</b> que sustituyen tablas de catálogo (roles, categorías, estados) '
        f'por ser listas cortas y fijas, y <b>{n_idx} índices</b> adicionales a las llaves primarias, entre ellos:', styles['Body']))
    bullets(story, [
        '<font face="Courier">idx_contenidos_seccion</font> — filtra y ordena el contenido por sección, categoría y fecha.',
        '<font face="Courier">idx_foro_posts_categoria</font> y <font face="Courier">idx_foro_comentarios_post_id</font> — cargan el debate por categoría y los comentarios de cada publicación.',
        '<font face="Courier">idx_noticias_un_destacado</font> e <font face="Courier">idx_contenidos_un_destacado</font> — índices únicos parciales: solo puede haber una pieza destacada.',
        '<font face="Courier">idx_ordenes_stripe_session_id</font> y <font face="Courier">idx_perfiles_stripe_customer_id</font> — búsquedas rápidas desde el webhook de Stripe.',
    ])
    story.append(Paragraph(
        f'Las {n_rls} tablas tienen <b>Row Level Security</b> activo sin políticas públicas: la API de datos de '
        'Supabase queda cerrada a propósito y solo el backend propio, con conexión directa y verificación '
        'previa del JWT, accede a los datos.', styles['Body']))

    h1(story, 12, 'Script de creación de la base de datos')
    story.append(Paragraph(
        'El script completo de creación vive en <font face="Courier">backend/sql/schema.sql</font> y se aplica con '
        '<font face="Courier">npm run db:schema</font>. Un script de comprobación '
        '(<font face="Courier">npm run db:probar-schema</font>) lo ejecuta en un esquema temporal y compara '
        'columnas, restricciones, índices y RLS con la base real y coinciden todos. Se incluye '
        'a continuación tal como está en el repositorio.', styles['Body']))
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
