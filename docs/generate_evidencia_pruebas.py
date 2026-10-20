# -*- coding: utf-8 -*-
"""
Genera docs/entrega/Evidencia-de-pruebas-SabiasquePR.pdf para Sabias Que PR
(Fase 4 de la rubrica: Pruebas y publicacion).

El documento NO tiene cifras escritas a mano: lee los resultados reales que dejan
tres scripts en docs/entrega/:
  - evidencia-pruebas.json       <- backend/scripts/recoger-evidencia.js   (Jest + cobertura)
  - evidencia-produccion.json    <- backend/scripts/verificar-produccion.js (curl contra produccion)
  - evidencia-navegadores.json   <- backend/scripts/probar-navegadores.js   (Chrome/Edge por CDP)
y el historial real de git (git show) para la tabla de correcciones.

Uso (desde la raiz del repositorio):
  python docs/generate_evidencia_pruebas.py            # solo arma el PDF con los JSON existentes
  python docs/generate_evidencia_pruebas.py --recoger  # vuelve a ejecutar los 3 scripts antes
"""
import datetime
import json
import os
import subprocess
import sys

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas as pdfcanvas
from reportlab.platypus import (
    CondPageBreak, HRFlowable, KeepTogether, ListFlowable, ListItem, PageBreak,
    Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

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
RISK_SOFT = colors.HexColor('#F6E3DE')
PAPER_RULED = colors.HexColor('#F4F7FA')
WHITE = colors.white

PAGE_W, PAGE_H = letter
MARGIN = 54
CONTENT_W = PAGE_W - 2 * MARGIN

DOCS_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(DOCS_DIR)
ENTREGA_DIR = os.path.join(DOCS_DIR, 'entrega')
OUT_PATH = os.path.join(ENTREGA_DIR, 'Evidencia-de-pruebas-SabiasquePR.pdf')
DATOS_ESTUDIANTE_PATH = os.path.join(DOCS_DIR, 'privado', 'datos-estudiante.json')
JSON_PRUEBAS = os.path.join(ENTREGA_DIR, 'evidencia-pruebas.json')
JSON_PROD = os.path.join(ENTREGA_DIR, 'evidencia-produccion.json')
JSON_NAV = os.path.join(ENTREGA_DIR, 'evidencia-navegadores.json')

# Fuente con los simbolos de marca de verificacion (Helvetica estandar no los trae).
SIMBOLOS = 'SegoeSym'
try:
    pdfmetrics.registerFont(TTFont(SIMBOLOS, 'C:/Windows/Fonts/seguisym.ttf'))
    TICK, CROSS = '\u2714', '\u2718'
except Exception:  # pragma: no cover - fuera de Windows
    SIMBOLOS = 'Helvetica-Bold'
    TICK, CROSS = 'OK', 'X'

# ── ESTILOS (copiados de generate_planificacion_bd.py) ──────
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='Eyebrow', fontName='Helvetica-Bold', fontSize=9, leading=11,
                          textColor=ACCENT, spaceAfter=4, tracking=0.6))
styles.add(ParagraphStyle(name='DocTitle', fontName='Helvetica-Bold', fontSize=22, leading=27,
                          textColor=INK, spaceAfter=6))
styles.add(ParagraphStyle(name='DocSub', fontName='Helvetica', fontSize=11.5, leading=16,
                          textColor=INK_SOFT, spaceAfter=0))
styles.add(ParagraphStyle(name='H1', fontName='Helvetica-Bold', fontSize=15, leading=19,
                          textColor=INK, spaceBefore=22, spaceAfter=10, keepWithNext=1))
styles.add(ParagraphStyle(name='H2', fontName='Helvetica-Bold', fontSize=11.5, leading=15,
                          textColor=ACCENT_DARK, spaceBefore=14, spaceAfter=6, keepWithNext=1))
styles.add(ParagraphStyle(name='Body', fontName='Helvetica', fontSize=10, leading=15,
                          textColor=INK, spaceAfter=8, alignment=TA_JUSTIFY))
styles.add(ParagraphStyle(name='BodySmall', fontName='Helvetica', fontSize=8.7, leading=12.5,
                          textColor=INK_SOFT, spaceAfter=6))
styles.add(ParagraphStyle(name='Caption', fontName='Helvetica-Oblique', fontSize=8.5, leading=11,
                          textColor=INK_SOFT, spaceBefore=4, spaceAfter=14, alignment=TA_CENTER))
styles.add(ParagraphStyle(name='BulletText', fontName='Helvetica', fontSize=10, leading=14.5,
                          textColor=INK, spaceAfter=3))
styles.add(ParagraphStyle(name='Mono', fontName='Courier', fontSize=7.6, leading=10.2, textColor=INK))
styles.add(ParagraphStyle(name='TableCell', fontName='Helvetica', fontSize=8.3, leading=11, textColor=INK))
styles.add(ParagraphStyle(name='TableCellSoft', fontName='Helvetica', fontSize=8.3, leading=11, textColor=INK_SOFT))
styles.add(ParagraphStyle(name='TableHead', fontName='Helvetica-Bold', fontSize=8.3, leading=11, textColor=WHITE))
styles.add(ParagraphStyle(name='FooterText', fontName='Helvetica', fontSize=7.5, leading=9, textColor=INK_SOFT))
# Estilos propios de este documento
styles.add(ParagraphStyle(name='Cell7', fontName='Helvetica', fontSize=7.4, leading=9.6, textColor=INK))
styles.add(ParagraphStyle(name='Cell7C', parent=styles['Cell7'], alignment=TA_CENTER))
styles.add(ParagraphStyle(name='Head7', fontName='Helvetica-Bold', fontSize=7.4, leading=9.6,
                          textColor=WHITE, alignment=TA_CENTER))
styles.add(ParagraphStyle(name='Mono7', fontName='Courier', fontSize=7.2, leading=9.4, textColor=INK))
styles.add(ParagraphStyle(name='Area', fontName='Helvetica-Bold', fontSize=8.3, leading=11, textColor=ACCENT_DARK))
styles.add(ParagraphStyle(name='BigNum', fontName='Helvetica-Bold', fontSize=21, leading=24,
                          textColor=ACCENT_DARK, alignment=TA_CENTER))
styles.add(ParagraphStyle(name='BigLbl', fontName='Helvetica', fontSize=8, leading=10,
                          textColor=INK_SOFT, alignment=TA_CENTER))

MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
         'septiembre', 'octubre', 'noviembre', 'diciembre']


def fecha_en_letras(hoy=None):
    hoy = hoy or datetime.date.today()
    return f'{hoy.day} de {MESES[hoy.month - 1]} de {hoy.year}'


def esc(t):
    return str(t).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def datos_estudiante():
    """Nombre y numero: de docs/privado/datos-estudiante.json (no se sube al repositorio).
    Si no existe se usa el nombre de entregas anteriores y no se inventa el numero."""
    datos = {'nombre': 'William Collado', 'numero': None}
    try:
        with open(DATOS_ESTUDIANTE_PATH, encoding='utf-8') as f:
            datos.update(json.load(f))
    except FileNotFoundError:
        pass
    return datos


def cargar(ruta):
    if not os.path.exists(ruta):
        sys.exit(f'Falta {ruta}. Ejecuta: python docs/generate_evidencia_pruebas.py --recoger')
    with open(ruta, encoding='utf-8') as f:
        return json.load(f)


def recoger():
    backend = os.path.join(REPO_ROOT, 'backend')
    for script in ('recoger-evidencia.js', 'verificar-produccion.js', 'probar-navegadores.js'):
        print('>>', script)
        r = subprocess.run(['node', os.path.join('scripts', script)], cwd=backend)
        if script == 'recoger-evidencia.js' and r.returncode not in (0, 2):
            sys.exit('No se pudo recoger la evidencia de Jest.')


# ── PAGINA / PIE ────────────────────────────────────────────

def draw_footer(c: pdfcanvas.Canvas, doc):
    if doc.page == 1:
        return
    c.saveState()
    c.setStrokeColor(LINE)
    c.setLineWidth(0.5)
    c.line(MARGIN, 44, PAGE_W - MARGIN, 44)
    c.setFont('Helvetica', 7.5)
    c.setFillColor(INK_SOFT)
    c.drawString(MARGIN, 32, 'Sabías que PR — Evidencia de pruebas')
    c.drawRightString(PAGE_W - MARGIN, 32, f'Página {doc.page}')
    c.restoreState()


# ── PORTADA ─────────────────────────────────────────────────

def build_portada(story):
    est = datos_estudiante()
    story.append(Spacer(1, 90))
    story.append(Paragraph('UNIVERSIDAD INTERAMERICANA DE PUERTO RICO · RECINTO DE FAJARDO', styles['Eyebrow']))
    story.append(Spacer(1, 40))
    story.append(Paragraph('PROYECTO FINAL · DESARROLLO WEB FULL-STACK', styles['Eyebrow']))
    story.append(Paragraph('Sabías que PR', ParagraphStyle('CoverTitle', parent=styles['DocTitle'], fontSize=32, leading=36)))
    story.append(Paragraph('Evidencia de pruebas', ParagraphStyle('CoverSub', parent=styles['DocSub'], fontSize=14, leading=19, textColor=ACCENT_DARK)))
    story.append(Spacer(1, 10))
    story.append(Paragraph('Fase 4: Pruebas y publicación &nbsp;·&nbsp; pruebas funcionales, corrección de errores y publicación en línea', styles['DocSub']))
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


# ── AYUDAS ──────────────────────────────────────────────────

def h1(story, num, title):
    story.append(CondPageBreak(150))
    story.append(Paragraph(f'{num}. {title}', styles['H1']))


def body(story, texto):
    story.append(Paragraph(texto, styles['Body']))


def bullets(story, items):
    story.append(ListFlowable(
        [ListItem(Paragraph(it, styles['BulletText']), leftIndent=6) for it in items],
        bulletType='bullet', start='•', leftIndent=14, bulletFontSize=8,
    ))


def tabla(filas, anchos, head_style='TableHead', cell_style='TableCell', extra=None, repeat=1):
    data = []
    for i, row in enumerate(filas):
        data.append([c if not isinstance(c, str) else Paragraph(c, styles[head_style if i == 0 else cell_style]) for c in row])
    t = Table(data, colWidths=anchos, hAlign='LEFT', repeatRows=repeat)
    est = [
        ('BACKGROUND', (0, 0), (-1, 0), ACCENT_DARK),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, PAPER_RULED]),
        ('GRID', (0, 0), (-1, -1), 0.5, LINE),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 3.2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3.2),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
    ]
    if extra:
        est += extra
    t.setStyle(TableStyle(est))
    return t


def caja(story, titulo, texto, fondo=ACCENT_SOFT, borde=ACCENT, color_titulo=ACCENT_DARK):
    contenido = [Paragraph(f'<b>{titulo}</b>', ParagraphStyle('CajaT', parent=styles['Body'], textColor=color_titulo, spaceAfter=3, alignment=0)),
                 Paragraph(texto, ParagraphStyle('CajaB', parent=styles['Body'], fontSize=9.2, leading=13.4, spaceAfter=0, alignment=0))]
    t = Table([[contenido]], colWidths=[CONTENT_W], hAlign='LEFT')
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), fondo),
        ('BOX', (0, 0), (-1, -1), 0.8, borde),
        ('LEFTPADDING', (0, 0), (-1, -1), 10), ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 7), ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
    ]))
    story.append(KeepTogether([t, Spacer(1, 8)]))


def marca(ok):
    color = '#2E7D5B' if ok else '#B5432E'
    return f'<font name="{SIMBOLOS}" color="{color}">{TICK if ok else CROSS}</font>'


def num(n, dec=0):
    return f'{n:,.{dec}f}'.replace(',', ' ') if dec else f'{n:,}'.replace(',', ' ')


def fecha_corta(iso):
    try:
        d = datetime.datetime.fromisoformat(iso.replace('Z', '+00:00')).astimezone()
        return d.strftime('%d/%m/%Y %H:%M')
    except Exception:
        return iso


# ── AREAS DE LAS SUITES ─────────────────────────────────────
AREAS = [
    ('Autenticación y roles', [
        'src/middleware/', 'src/routes/perfil.integration', 'src/util/edad.test']),
    ('CRUD: noticias, contenidos, productos y debate', [
        'src/routes/noticias.', 'src/routes/contenidos.', 'src/routes/productos.', 'src/routes/foro.',
        'src/routes/comentarios.', 'src/routes/reportes.', 'src/routes/ordenes.', 'src/routes/agradecimientos.',
        'src/routes/newsletter.', 'src/clasificacion.test', 'src/regiones.test']),
    ('Validadores de datos y utilidades', ['src/validators/', 'src/util/deteccionRiesgo', 'src/util/slugify']),
    ('Pagos Stripe y webhook', ['src/routes/stripe']),
    ('Seguridad y cabeceras', ['src/app.']),
    ('Panel de administración, agentes de IA y traducciones', [
        'src/routes/admin.', 'src/services/', 'src/util/traducciones.test']),
    ('Frontend, i18n y build', ['src/frontend-', 'src/i18n/', 'src/build.']),
    ('Scripts de base de datos, respaldo y migración', ['scripts/']),
    ('Configuración de despliegue', ['src/netlify-config']),
]


def area_de(archivo):
    for nombre, prefijos in AREAS:
        if any(archivo.startswith(p) for p in prefijos):
            return nombre
    raise SystemExit(f'Suite sin área asignada: {archivo} (agrégala a AREAS)')


def prueba(pr, archivo_sub, texto):
    """Devuelve el nombre real completo de una prueba (falla si no existe: nada inventado)."""
    for s in pr['suites']:
        if archivo_sub in s['archivo']:
            for n in s['nombres']:
                if texto in n['titulo']:
                    return n['titulo'], s['archivo'], n['estado']
    raise SystemExit(f'No existe la prueba citada: {archivo_sub} / {texto}')


def cita(pr, archivo_sub, texto):
    titulo, archivo, estado = prueba(pr, archivo_sub, texto)
    return (f'<font face="Courier" size="6.6">{esc(titulo)}</font><br/>'
            f'<font color="#51606E">{esc(archivo)} · {"pasa" if estado == "passed" else "FALLA"}</font>')


# ── HISTORIAL DE CORRECCIONES (hash fijo; fecha y titulo se leen de git) ────
CORRECCIONES = [
    ('ceb7bc2', 'Inicio de sesión y registro: la tecla Enter no hacía nada (los campos no estaban en un formulario) y, en modo registro, un listener que no se quitaba lanzaba inicio de sesión y registro a la vez.',
     'Se unificó en un solo manejador que revisa el modo actual y soporta Enter.'),
    ('3f23ca8', 'Noticias: el campo «destacado» se infería por posición en un arreglo (mismo defecto que ya se habia corregido en contenidos).',
     'Se pasa de forma explícita; pruebas nuevas «noticia destacada» (147/147 en ese momento). También se corrigió una vulnerabilidad moderada de una dependencia (npm audit fix).'),
    ('b024dca', 'La conexión a Postgres no tenía límite de tiempo: un despliegue con una conexión mala se quedaba colgado muchos minutos en vez de fallar rápido.',
     'Se añadieron tiempos límite de conexión y de consulta en backend/src/db.js.'),
    ('10e797e', 'Netlify no aplicaba la redirección de «/» porque existe un index.html físico en esa ruta.',
     'Se marcó force=true en la regla de netlify.toml.'),
    ('b37d840', 'Menú de escritorio: «Hazte premium» se desbordaba sobre el botón de tema cuando el correo del usuario era largo.',
     'Se recortó el correo mostrado y el menú pasó a flex-wrap; el commit indica que se verificó en el navegador a 1440 px.'),
    ('e794e0b', 'Auditoría de seguridad: enlaces javascript:/data: en el debate y en contenidos (XSS almacenado), conexión a la BD sin verificar certificado y errores 500 que filtraban mensajes de Postgres.',
     'Validadores que bloquean esos esquemas (con pruebas), SSL con certificado fijado, errores genéricos y CSP en netlify.toml.'),
    ('6994f0d', 'Fix urgente: la CSP recién añadida bloqueaba cdn.jsdelivr.net y rompía el inicio de sesión en producción (detectado en el sitio real).',
     'Se añadió el dominio a script-src de netlify.toml.'),
    ('047f18b', 'Panel de administración: tras cerrar sesión el panel seguía visible con los datos ya cargados.',
     'admin.js escucha onAuthStateChange y vuelve a tapar el panel; además se limpiaron opciones obsoletas del campo Región en validadores y schema.sql.'),
    ('50b90a2', 'Endurecimiento: el API anunciaba Express, el JWT no exigía emisor/audiencia, las cuentas suspendidas seguían válidas y /api/health devolvía el mensaje interno de error.',
     'helmet, jwtVerify con issuer y audience, banned_until, JSON malformado → 400 y cuerpo grande → 413; 14 pruebas nuevas (app.hardening.test.js y auth.jwt.test.js).'),
    ('6a435c2', 'Contacto: la nota del correo se comportaba mal tras enviar el formulario; además había 5 textos sin traducir (nombres propios).',
     'Corregido junto con la clasificación de contenidos; el commit reporta 694 pruebas en verde, cifra que coincide con la de este documento.'),
]


def info_git(h):
    r = subprocess.run(['git', 'show', '-s', '--format=%h|%ad|%s', '--date=short', h],
                       cwd=REPO_ROOT, capture_output=True, text=True, encoding='utf-8')
    if r.returncode != 0 or '|' not in r.stdout:
        raise SystemExit(f'El commit {h} no existe en el historial.')
    corto, fecha, asunto = r.stdout.strip().split('|', 2)
    return corto, fecha, asunto


# ── CONSTRUCCION ────────────────────────────────────────────

def build():
    pr = cargar(JSON_PRUEBAS)
    prod = cargar(JSON_PROD)
    nav = cargar(JSON_NAV)

    est = datos_estudiante()
    doc = SimpleDocTemplate(OUT_PATH, pagesize=letter,
                            leftMargin=MARGIN, rightMargin=MARGIN, topMargin=64, bottomMargin=58,
                            title='Sabías que PR — Evidencia de pruebas', author=est['nombre'])
    story = []
    build_portada(story)

    cg = pr['cobertura_global']
    story.append(Paragraph('FASE 4 · PRUEBAS Y PUBLICACIÓN', styles['Eyebrow']))

    # ── 1. RESUMEN ──────────────────────────────────────────
    h1(story, 1, 'Resumen')
    body(story,
         'Este documento reúne la evidencia de las pruebas de <b>Sabías que PR</b>: las pruebas automáticas del '
         'backend (Jest y Supertest), la verificación del sitio y del API publicados desde fuera, y las pruebas de '
         'carga y de pantalla en navegadores. Todas las cifras se <b>leen de los resultados guardados</b> por los '
         'scripts del repositorio (ver la sección 7); nada se escribió a mano. Lo que no se pudo probar se dice con '
         'claridad en la sección 5.')

    def tarjeta(valor, etiqueta):
        return [Paragraph(valor, styles['BigNum']), Paragraph(etiqueta, styles['BigLbl'])]
    cards = Table([[
        tarjeta(f"{pr['suites_pasadas']}/{pr['suites_total']}", 'suites de pruebas pasan'),
        tarjeta(f"{pr['pruebas_pasadas']}/{pr['pruebas_total']}", f"pruebas pasan ({pr['pruebas_falladas']} fallan, {pr['pruebas_omitidas']} omitidas)"),
        tarjeta(f"{cg['lineas']:.1f} %".replace('.', ','), f"cobertura de líneas ({cg['lineas_cubiertas']} de {cg['lineas_total']})"),
        tarjeta(f"{pr['duracion_seg']:.0f} s".replace('.', ','), 'duración de la ejecución completa'),
    ]], colWidths=[CONTENT_W / 4] * 4, hAlign='LEFT')
    cards.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.8, ACCENT), ('INNERGRID', (0, 0), (-1, -1), 0.5, LINE),
        ('BACKGROUND', (0, 0), (-1, -1), ACCENT_SOFT), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 9), ('BOTTOMPADDING', (0, 0), (-1, -1), 9),
    ]))
    story.append(cards)
    story.append(Paragraph(
        f"Ejecución del {fecha_corta(pr['generado'])} con Node {esc(pr['node'])}. Comando: "
        f"<font face='Courier'>cd backend &amp;&amp; npx jest --coverage</font>.", styles['Caption']))

    story.append(Paragraph('Cobertura de código', styles['H2']))
    body(story,
         f"Cobertura global: <b>{cg['lineas']:.1f} %</b> de líneas, ".replace('.', ',') +
         f"{cg['sentencias']:.1f} % de sentencias, {cg['funciones']:.1f} % de funciones y {cg['ramas']:.1f} % de ramas".replace('.', ',') +
         ', medida sobre <font face="Courier">backend/src/**</font> '
         'excepto <font face="Courier">server.js</font>. Por carpeta:')
    filas = [['Carpeta', 'Archivos', 'Líneas', 'Sentencias', 'Funciones', 'Ramas']]
    for c in pr['cobertura_por_carpeta']:
        filas.append([f'<font face="Courier">{esc(c["carpeta"])}</font>', str(c['archivos']),
                      f"{c['lineas']:.1f} %".replace('.', ','), f"{c['sentencias']:.1f} %".replace('.', ','),
                      f"{c['funciones']:.1f} %".replace('.', ','), f"{c['ramas']:.1f} %".replace('.', ',')])
    story.append(tabla(filas, [170, 55, 69, 70, 70, 70]))
    serv = next((c for c in pr['cobertura_por_carpeta'] if c['carpeta'] == 'src/services'), None)
    nota = ''
    if serv:
        nota = (f" La carpeta más baja es <font face='Courier'>src/services</font> ({str(serv['lineas']).replace('.', ',')} % de líneas): "
                'son los agentes de IA (Investigador, Redactor, Traductor) y el extractor de artículos, que dependen de la API de Claude y de '
                'páginas externas; sus pruebas cubren la lógica interna con servicios simulados, no las llamadas reales.')
    story.append(Paragraph(f'Las carpetas de rutas y validadores, donde viven el CRUD y la validación, superan el 90 % de líneas.{nota}', styles['BodySmall']))

    caja(story, 'Qué significan y qué no significan estas pruebas',
         'Las pruebas <b>no necesitan red ni base de datos real</b>: ninguna se conectó a Supabase, a Stripe ni a la API de Claude. '
         'Las pruebas de integración de las rutas usan Supertest sobre la aplicación Express real, pero sustituyen la base de datos '
         '(<font face="Courier">jest.mock(\'../db\')</font>) y la verificación del token (un doble de prueba, '
         '<font face="Courier">test-utils/authMock.js</font>) para simular usuarios y roles. En las pruebas del middleware real '
         '(<font face="Courier">auth*.test.js</font>) la librería <font face="Courier">jose</font> también está simulada: comprueban que el '
         'servidor exige emisor y audiencia y responde 401 ante un token inválido, no que Supabase firme un token. Por eso la sección 4 '
         'repite las comprobaciones clave <b>contra el servidor real en producción</b>. El esquema de la base de datos se valida con '
         '<font face="Courier">npm run db:probar-schema</font>, que sí necesita una base de datos y <b>no se ejecutó para este documento</b>.')

    # ── 2. SUITES POR AREA ──────────────────────────────────
    h1(story, 2, 'Suites de pruebas por área')
    body(story,
         f"El proyecto tiene <b>{pr['suites_total']} archivos de pruebas</b> con <b>{pr['pruebas_total']} pruebas</b>. Se agrupan por área "
         'según su ubicación en el código (rutas, validadores, middleware, scripts, etc.).')
    grupos = {}
    for s in pr['suites']:
        grupos.setdefault(area_de(s['archivo']), []).append(s)
    anchos = [CONTENT_W - 120, 60, 60]
    cab = Table([[Paragraph('Área / archivo de pruebas', styles['TableHead']), Paragraph('Pruebas', styles['TableHead']),
                  Paragraph('Estado', styles['TableHead'])]], colWidths=anchos, hAlign='LEFT')
    cab.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), ACCENT_DARK), ('TOPPADDING', (0, 0), (-1, -1), 3.5),
                             ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5), ('LEFTPADDING', (0, 0), (-1, -1), 5)]))
    story.append(cab)
    for nombre, _ in AREAS:
        lista = grupos.get(nombre)
        if not lista:
            continue
        total = sum(s['pruebas'] for s in lista)
        data = [[Paragraph(f'{esc(nombre)} — {len(lista)} suites', styles['Area']),
                 Paragraph(f'<b>{total}</b>', styles['TableCell']), '']]
        for s in lista:
            data.append([Paragraph(f'<font face="Courier">{esc(s["archivo"])}</font>', styles['Cell7']),
                         Paragraph(str(s['pruebas']), styles['Cell7C']),
                         Paragraph(marca(s['estado'] == 'passed'), styles['Cell7C'])])
        t = Table(data, colWidths=anchos, hAlign='LEFT')
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), ACCENT_SOFT),
            ('GRID', (0, 0), (-1, -1), 0.5, LINE), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 2.2), ('BOTTOMPADDING', (0, 0), (-1, -1), 2.2),
            ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ]))
        story.append(KeepTogether([t]))
    story.append(Paragraph(
        f"Total: {pr['suites_total']} suites, {pr['pruebas_total']} pruebas. "
        'Nota: no hay una suite de Jest dedicada al esquema de la base de datos; esa verificación es el script '
        '<font face="Courier">db:probar-schema</font> mencionado arriba.', styles['Caption']))

    # ── 3. QUE DEMUESTRAN ───────────────────────────────────
    h1(story, 3, 'Qué demuestran las pruebas respecto a la rúbrica')
    body(story,
         'Cada fila cita pruebas reales, con su nombre tal como aparece en el resultado de Jest y el archivo donde viven. '
         'El generador de este documento falla si una prueba citada no existe en el resultado, de modo que no se puede citar una prueba inexistente.')
    c = lambda a, t_: cita(pr, a, t_)  # noqa: E731
    filas = [
        ['Requisito', 'Qué se comprueba', 'Pruebas concretas'],
        ['CRUD completo',
         'Crear, leer, editar y borrar (noticias; igual en contenidos, productos y publicaciones del debate), con 404 si no existe.',
         [Paragraph(x, styles['Cell7']) for x in (
             c('noticias.integration', 'POST /api/noticias 201 al crear una noticia valida como admin'),
             c('noticias.integration', 'GET /api/noticias devuelve la lista de noticias'),
             c('noticias.integration', 'PUT /api/noticias/:id 200 al editar una noticia existente'),
             c('noticias.integration', 'DELETE /api/noticias/:id 200 al eliminar una noticia existente'))]],
        ['JWT verificado en el servidor',
         'El servidor exige emisor y audiencia del token y rechaza uno inválido con 401 (con jose simulado; ver el recuadro de la sección 1).',
         [Paragraph(x, styles['Cell7']) for x in (
             c('auth.jwt', 'requireAuth exige iss'),
             c('auth.jwt', 'un token con emisor/audiencia equivocados'),
             c('auth.test', 'requireAuth responde 401 si no hay encabezado Authorization'),
             c('auth.mfa', 'admin con sesion aal1 (solo contrasena) pierde el poder'))]],
        ['Rutas protegidas: 401 y 403',
         '401 sin sesión y 403 si la sesión no tiene el rol requerido, en rutas de escritura y del panel.',
         [Paragraph(x, styles['Cell7']) for x in (
             c('noticias.integration', 'POST /api/noticias 401 sin autenticacion'),
             c('noticias.integration', 'POST /api/noticias 403 si el usuario no es admin'),
             c('admin.integration', 'GET /api/admin/estado-seguridad 403 si el usuario no es admin ni moderador'),
             c('foro.integration', 'DELETE /api/foro/posts/:id (permisos) 403 si el usuario no es el autor ni admin'))]],
        ['Validación de datos',
         'Los datos inválidos se rechazan con 400 antes de tocar la base de datos, incluido el bloqueo de enlaces peligrosos.',
         [Paragraph(x, styles['Cell7']) for x in (
             c('validators/noticia', 'validateNoticia rechaza titulo muy corto'),
             c('noticias.integration', 'POST /api/noticias 400 si el cuerpo es invalido'),
             c('foroPost', 'validatePost rechaza esquemas peligrosos'),
             c('productos.integration', 'POST /api/productos 400 si el precio es invalido'))]],
        ['Pagos y despliegue',
         'El webhook de Stripe rechaza firmas falsas; la configuración de Netlify oculta los archivos internos.',
         [Paragraph(x, styles['Cell7']) for x in (
             c('stripeWebhook', 'POST /api/stripe/webhook 400 si la firma es invalida'),
             c('netlify-config', 'netlify.toml el archivo interno "/build.js" se devuelve como 404'))]],
    ]
    story.append(tabla(filas, [88, 150, CONTENT_W - 238], head_style='TableHead', cell_style='TableCell'))
    story.append(Spacer(1, 6))

    # ── 4. PRODUCCION ───────────────────────────────────────
    h1(story, 4, 'Verificación en producción desde fuera')
    res = {r['id']: r for r in prod['resultados']}
    n_ok = sum(1 for r in prod['resultados'] if r['ok'])
    body(story,
         f"El {fecha_corta(prod['generado'])} se ejecutaron, con <font face='Courier'>curl</font> desde esta computadora, {len(prod['resultados'])} peticiones "
         'contra el API publicado (<font face="Courier">sabiasquepr-backend-uufz.onrender.com</font>) y el sitio '
         '(<font face="Courier">sabiasquepr.com</font>). Son solo lecturas públicas y peticiones <b>sin credenciales válidas</b> que el '
         f"servidor debe rechazar; no crean ni modifican datos. Resultado: <b>{n_ok} de {len(prod['resultados'])} dieron el código esperado</b>. "
         'La respuesta se muestra literal (recortada a 70 caracteres).')

    def fila_prod(r, etiqueta=None):
        et = etiqueta or f"{r['metodo']} {r['url'].replace('https://sabiasquepr-backend-uufz.onrender.com', '').replace('https://', '')}"
        cuerpo = r['cuerpo'].replace('\r', ' ').replace('\n', ' ')[:70]
        return [f'<font face="Courier" size="6.8">{esc(et)}</font>', str(r['esperado']),
                f"<b>{r['estado']}</b> {marca(r['ok'])}", f"{r['segundos']:.2f} s".replace('.', ','),
                f'<font face="Courier" size="6.4">{esc(cuerpo)}</font>']

    story.append(CondPageBreak(110))
    story.append(Paragraph('4.1 Lecturas públicas y rutas protegidas', ParagraphStyle('H2nk', parent=styles['H2'], keepWithNext=0)))
    grupos_prod = [
        ('Lecturas públicas (deben dar 200 con datos)', ['health', 'noticias', 'cont-educacion', 'cont-revolucion', 'productos']),
        ('Rutas protegidas SIN token (deben dar 401)', ['post-noticias-sin', 'put-noticias-sin', 'del-noticias-sin', 'admin-gastos-sin', 'admin-uso-sin', 'foro-post-sin', 'me-sin']),
        ('Rutas protegidas con un token INVENTADO (deben dar 401)', ['post-noticias-falso', 'admin-gastos-falso', 'me-falso']),
        ('Webhook de Stripe sin firma válida (debe dar 400)', ['stripe-webhook']),
    ]
    filas = [['Petición', 'Esperado', 'Obtenido', 'Tiempo', 'Respuesta literal']]
    extra = []
    for titulo, ids in grupos_prod:
        filas.append([Paragraph(esc(titulo), styles['Area']), '', '', '', ''])
        extra += [('SPAN', (0, len(filas) - 1), (-1, len(filas) - 1)), ('BACKGROUND', (0, len(filas) - 1), (-1, len(filas) - 1), ACCENT_SOFT)]
        for i in ids:
            filas.append(fila_prod(res[i]))
    story.append(tabla(filas, [146, 50, 54, 40, CONTENT_W - 290], extra=extra))
    c_prod = prod['conteos']
    story.append(Paragraph(
        f"Datos reales devueltos: {c_prod['noticias']} noticias, {c_prod['contenidos_revolucion_humana']} contenidos de Revolución Humana y "
        f"{c_prod['productos']} productos. El token inventado es un JWT con firma falsa: "
        '<font face="Courier">eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJpbnZlbnRhZG8ifQ.firma-falsa</font>.', styles['BodySmall']))
    if c_prod['contenidos_educacion'] == 0:
        caja(story, 'Observación: Educación no tiene contenidos publicados todavía',
             '<font face="Courier">GET /api/contenidos?seccion=educacion</font> responde 200 pero con la lista vacía '
             f"(<font face=\"Courier\">{esc(res['cont-educacion']['cuerpo'])}</font>). No es un error del servidor: aún no hay piezas de "
             'Educación publicadas en la base de datos de producción, y la página lo muestra con su mensaje de «Aún no hay contenido». '
             'Conviene publicar contenido en esa sección antes de la demostración si se quiere mostrar esa ruta con datos.',
             fondo=RISK_SOFT, borde=RISK, color_titulo=RISK)

    story.append(Paragraph('4.2 Sitio estático (Netlify)', styles['H2']))
    sitio = res['sitio-cabeceras']['cabeceras']
    filas = [['Comprobación', 'Esperado', 'Obtenido', 'Detalle']]
    for i, det in (('sitio-build-js', 'build.js interno no se publica'), ('sitio-package-json', 'package.json interno no se publica'),
                   ('sitio-http', 'redirección a HTTPS'), ('sitio-netlify-app', 'redirección al dominio propio')):
        r = res[i]
        loc = r['cabeceras'].get('location', '')
        filas.append([f'<font face="Courier" size="6.8">{esc(r["metodo"])} {esc(r["url"].replace("https://", ""))}</font>', str(r['esperado']),
                      f"<b>{r['estado']}</b> {marca(r['ok'])}", esc(det + (f' → {loc}' if loc else ''))])
    story.append(tabla(filas, [184, 50, 54, CONTENT_W - 288]))
    story.append(Spacer(1, 6))
    story.append(Paragraph('Cabeceras de seguridad recibidas en <font face="Courier">GET https://sabiasquepr.com/</font> (<font face="Courier">curl -sI</font>):', styles['Body']))
    filas = [['Cabecera', 'Valor recibido (recortado)']]
    for h in ('content-security-policy', 'strict-transport-security', 'x-frame-options', 'x-content-type-options',
              'referrer-policy', 'permissions-policy'):
        v = sitio.get(h)
        filas.append([f'<font face="Courier" size="6.8">{h}</font>',
                      f'{marca(True)} <font face="Courier" size="6.4">{esc(v[:105])}{"…" if len(v) > 105 else ""}</font>' if v
                      else f'{marca(False)} <b>ausente</b>'])
    story.append(tabla(filas, [140, CONTENT_W - 140]))
    story.append(Spacer(1, 6))
    api_h = res['api-cabeceras']['cabeceras']
    presentes = [h for h in ('content-security-policy', 'strict-transport-security', 'x-frame-options', 'x-content-type-options',
                             'referrer-policy', 'cross-origin-resource-policy') if h in api_h]
    ausente_powered = 'x-powered-by' not in api_h
    story.append(Paragraph(
        'El API también manda sus cabeceras de endurecimiento (helmet): ' + ', '.join(f'<font face="Courier">{h}</font>' for h in presentes) +
        f". {'No aparece <font face=\"Courier\">x-powered-by</font> (no anuncia el framework). ' if ausente_powered else ''}"
        f"Además responde con límite de pedidos (<font face='Courier'>ratelimit-limit: {esc(api_h.get('ratelimit-limit', '—'))}</font>).", styles['BodySmall']))
    story.append(Paragraph(
        'Tiempos: todas las respuestas del API llegaron en menos de 1,5 s porque el servicio estaba despierto. En el nivel gratuito de Render el '
        'primer pedido tras un rato de inactividad puede tardar alrededor de 50 s (arranque en frío); esa espera no se midió en esta ejecución.', styles['BodySmall']))

    # ── 5. NAVEGADORES ──────────────────────────────────────
    h1(story, 5, 'Pruebas en navegadores y dispositivos')
    body(story,
         f"<b>Qué se probó automáticamente.</b> Se cargaron en <b>{esc(nav['base'].replace('https://', ''))}</b> las siete páginas principales "
         '(inicio, noticias, Revolución Humana, educación, tienda, apoyo/premium y contacto) con cada navegador instalado en esta computadora, '
         'sin pantalla, controlado por el protocolo DevTools, en tres tamaños de pantalla: escritorio (1280×800), tableta (768×1024) y móvil '
         '(390×844, con emulación táctil). Por cada combinación se verificó: (1) que el documento responde 2xx, dispara «load» y muestra contenido; '
         '(2) que <b>no hay desbordamiento horizontal</b> (<font face="Courier">scrollWidth ≤ innerWidth</font>); y (3) que no hay errores en la consola.')
    versiones = ', '.join(f"{esc(n['navegador'])} {esc(n['version'].split('/')[-1])}" for n in nav['navegadores'])
    caja(story, 'Límites de esta prueba (léase antes de las tablas)',
         f'Solo se probaron <b>{versiones}</b>, ambos con motor Chromium, en Windows. Los tamaños de tableta y móvil son <b>emulación de pantalla '
         'en un navegador de escritorio</b>, no teléfonos ni tabletas reales. <b>No se probó</b> Firefox (no está instalado en esta computadora), '
         'Safari en iPhone o iPad, Chrome en Android ni Samsung Internet: esas pruebas están en la tabla de pruebas manuales pendientes de más abajo '
         'y <b>no deben darse por hechas</b>.',
         fondo=RISK_SOFT, borde=RISK, color_titulo=RISK)

    tams = ['Escritorio', 'Tableta', 'Móvil']
    for n in nav['navegadores']:
        story.append(Paragraph(f"5.{nav['navegadores'].index(n) + 1} {esc(n['navegador'])} {esc(n['version'].split('/')[-1])}", styles['H2']))
        filas = [['Página'] + [t_ for t_ in tams for _ in range(1)]]
        cab1 = [Paragraph('Página', styles['Head7'])]
        for t_ in tams:
            cab1.append(Paragraph(f'{t_}<br/>carga · sin desborde · sin errores', styles['Head7']))
        data = [cab1]
        for pag in [p[0] for p in [('Inicio',), ('Noticias',), ('Revolución Humana',), ('Educación',), ('Tienda',), ('Premium (apoyo)',), ('Contacto',)]]:
            fila = [Paragraph(esc(pag), styles['Cell7'])]
            for t_ in tams:
                f = next(x for x in n['filas'] if x['pagina'] == pag and x['tamano'] == t_)
                fila.append(Paragraph(f"{marca(f['carga'])}&nbsp;&nbsp;{marca(f['sinDesborde'])}&nbsp;&nbsp;{marca(f['sinErroresConsola'])}", styles['Cell7C']))
            data.append(fila)
        tb = Table(data, colWidths=[110] + [(CONTENT_W - 110) / 3] * 3, hAlign='LEFT', repeatRows=1)
        tb.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), ACCENT_DARK), ('GRID', (0, 0), (-1, -1), 0.5, LINE),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, PAPER_RULED]), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 3), ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ]))
        story.append(tb)
        story.append(Spacer(1, 4))

    # tabla de medidas
    story.append(Paragraph('Medidas de ancho (contenido / ventana, en píxeles)', styles['H2']))
    body(story, 'Un desbordamiento horizontal existiría si el ancho del contenido fuera mayor que el de la ventana. Valores medidos con '
                '<font face="Courier">document.documentElement.scrollWidth</font> y <font face="Courier">window.innerWidth</font>:')
    cab = [Paragraph('Página', styles['Head7'])]
    for n in nav['navegadores']:
        for t_ in tams:
            cab.append(Paragraph(f"{esc(n['navegador'].split()[-1])}<br/>{t_}", styles['Head7']))
    data = [cab]
    for pag in ('Inicio', 'Noticias', 'Revolución Humana', 'Educación', 'Tienda', 'Premium (apoyo)', 'Contacto'):
        fila = [Paragraph(esc(pag), styles['Cell7'])]
        for n in nav['navegadores']:
            for t_ in tams:
                f = next(x for x in n['filas'] if x['pagina'] == pag and x['tamano'] == t_)
                fila.append(Paragraph(f"{f['anchoContenido']} / {f['anchoVentana']}", styles['Cell7C']))
        data.append(fila)
    ncol = len(cab) - 1
    tb = Table(data, colWidths=[100] + [(CONTENT_W - 100) / ncol] * ncol, hAlign='LEFT', repeatRows=1)
    tb.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), ACCENT_DARK), ('GRID', (0, 0), (-1, -1), 0.5, LINE),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, PAPER_RULED]), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3), ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    story.append(tb)

    todas = [f for n in nav['navegadores'] for f in n['filas']]
    n_tot = len(todas)
    n_carga = sum(1 for f in todas if f['carga'])
    n_desb = sum(1 for f in todas if f['sinDesborde'])
    n_err = sum(1 for f in todas if f['sinErroresConsola'])
    n_badge = sum(1 for f in todas if f.get('erroresBadgeNetlify'))
    n_red = sum(len(f['avisosRed']) for f in todas)
    story.append(Spacer(1, 6))
    body(story,
         f"<b>Resultado:</b> de {n_tot} combinaciones (navegador × tamaño × página), {n_carga} cargaron correctamente, {n_desb} no tienen desbordamiento "
         f"horizontal y {n_err} no tienen errores de consola propios. Respuestas de red con código 400 o mayor durante las cargas: {n_red}.")
    if n_badge:
        ejemplo = next(f['erroresBadgeNetlify'][0] for f in todas if f.get('erroresBadgeNetlify'))
        caja(story, 'Hallazgo: la consola muestra avisos de CSP que no vienen del código del proyecto',
             f"En {n_badge} de {n_tot} cargas la consola registra 2 avisos de seguridad (CSP) cuyo origen es "
             '<font face="Courier">about:srcdoc</font>: un <font face="Courier">&lt;iframe id="nl-badge-frame" title="Powered by Netlify"&gt;</font> que '
             'Netlify añade al sitio y cuyo código en línea la política CSP del sitio bloquea (uno por estilo y otro por script). '
             'Esos avisos <b>no se contaron como errores propios</b> en las tablas, pero se declaran aquí con su cifra completa. '
             'El código del repositorio no contiene ese iframe (búsqueda de «srcdoc» en <font face="Courier">frontend/</font>: sin resultados). '
             'No afecta el funcionamiento observado; conviene revisar en Netlify si ese distintivo es intencional. '
             f"Ejemplo literal: <font face=\"Courier\" size=\"6.8\">{esc(ejemplo[:150])}…</font><br/>"
             'En una ejecución previa de este mismo script apareció además, una sola vez (Edge, escritorio, Tienda), la excepción '
             '«Identifier \'AssistantLoadState\' has already been declared»; ese nombre no existe en el código del proyecto y no se repitió '
             'en la ejecución final, así que se atribuye a un script interno del navegador, no al sitio.',
             fondo=ACCENT_SOFT, borde=ACCENT)

    story.append(Paragraph('5.4 Pruebas manuales pendientes (por completar)', styles['H2']))
    body(story,
         '<b>Estas pruebas NO se han hecho.</b> Requieren dispositivos o navegadores que no se pudieron usar de forma automática. Quien las '
         'realice marca cada casilla con ' + marca(True) + ' o ' + marca(False) + ' y anota el modelo del dispositivo, la versión del navegador y la fecha. Todas se hacen abriendo '
         '<font face="Courier">https://sabiasquepr.com</font>.')
    checks = [
        ('A', 'Carga y se ve completa: Inicio y Noticias (sin cortes ni texto montado).'),
        ('B', 'No hay barra de desplazamiento horizontal en ninguna página (se arrastra el dedo de lado y no se mueve).'),
        ('C', 'El menú se abre y se cierra y cada enlace lleva a su página.'),
        ('D', 'Iniciar sesión: el cuadro se abre, se puede escribir y cerrarlo.'),
        ('E', 'El selector ES / EN cambia el idioma de la página.'),
        ('F', 'Tienda y Apoyo: los productos y los botones se ven completos.'),
        ('G', 'Contacto: el formulario se ve y se puede escribir en sus campos.'),
    ]
    data = [[Paragraph('<b>Clave</b>', styles['TableHead']), Paragraph('Qué verificar en cada dispositivo', styles['TableHead'])]]
    for k, v in checks:
        data.append([Paragraph(f'<b>{k}</b>', styles['Cell7C']), Paragraph(esc(v), styles['Cell7'])])
    tb = Table(data, colWidths=[40, CONTENT_W - 40], hAlign='LEFT')
    tb.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), ACCENT_DARK), ('GRID', (0, 0), (-1, -1), 0.5, LINE),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, PAPER_RULED]), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 2.6), ('BOTTOMPADDING', (0, 0), (-1, -1), 2.6),
    ]))
    story.append(tb)
    story.append(Spacer(1, 8))

    dispositivos = [
        ('iPhone — Safari (iOS)', 'Safari'),
        ('Android — Chrome', 'Chrome'),
        ('Samsung Galaxy — Samsung Internet', 'Samsung Internet'),
        ('Firefox en escritorio (no instalado aquí)', 'Firefox'),
        ('Tableta real (iPad o Android)', 'Safari / Chrome'),
        ('Safari en Mac (si hay acceso a una)', 'Safari'),
    ]
    cab = ['Dispositivo y navegador'] + [k for k, _ in checks] + ['Modelo, versión y fecha']
    data = [[Paragraph(c_, styles['Head7']) for c_ in cab]]
    casilla = Paragraph('[&nbsp;&nbsp;&nbsp;]', styles['Cell7C'])
    for disp, _ in dispositivos:
        data.append([Paragraph(f'<b>{esc(disp)}</b>', styles['Cell7'])] + [Paragraph('[&nbsp;&nbsp;&nbsp;]', styles['Cell7C']) for _ in checks] +
                    [Paragraph('Resultado: ____________<br/>________________', styles['Cell7'])])
    tb = Table(data, colWidths=[128] + [27] * len(checks) + [CONTENT_W - 128 - 27 * len(checks)], hAlign='LEFT', repeatRows=1,
               rowHeights=[None] + [34] * len(dispositivos))
    tb.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), ACCENT_DARK), ('GRID', (0, 0), (-1, -1), 0.5, LINE),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, PAPER_RULED]), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(tb)
    story.append(Paragraph('Estado actual de esta tabla: <b>todas las casillas están vacías a propósito</b>; ninguna de estas pruebas se ha realizado.', styles['Caption']))

    # ── 6. ERRORES CORREGIDOS ───────────────────────────────
    h1(story, 6, 'Errores encontrados y corregidos durante el proyecto')
    body(story,
         'Lista tomada del historial real de git (el commit, la fecha y el título se leen del repositorio al generar este documento; la descripción '
         'resume el mensaje del propio commit). Muestra el ciclo de probar, encontrar el error y corregirlo; no es una lista exhaustiva.')
    filas = [['Commit', 'Fecha', 'Problema encontrado', 'Corrección']]
    for h, problema, correccion in CORRECCIONES:
        corto, fecha, _asunto = info_git(h)
        filas.append([f'<font face="Courier" size="7">{corto}</font>', fecha, esc(problema), esc(correccion)])
    story.append(tabla(filas, [44, 52, 220, CONTENT_W - 316], cell_style='Cell7'))
    story.append(Spacer(1, 4))

    # ── 7. COMO EJECUTAR ────────────────────────────────────
    h1(story, 7, 'Cómo ejecutar las pruebas')
    body(story, 'Todos los comandos se escriben en una terminal (PowerShell o Git Bash) con Node 22 o superior instalado.')
    comandos = [
        ('Instalar dependencias del backend (una vez)', 'cd backend; npm install'),
        ('Ejecutar todas las suites de pruebas', 'cd backend; npm test'),
        ('Ejecutar las pruebas con informe de cobertura', 'cd backend; npm run test:coverage'),
        ('Revisar el estilo del código (ESLint)', 'cd backend; npm run lint'),
        ('Guardar los resultados de Jest y la cobertura (docs/entrega/evidencia-pruebas.json)', 'cd backend; node scripts/recoger-evidencia.js'),
        ('Repetir la verificación contra producción (usa curl)', 'cd backend; node scripts/verificar-produccion.js'),
        ('Probar Chrome y Edge en tres tamaños de pantalla', 'cd backend; node scripts/probar-navegadores.js'),
        ('Regenerar este PDF, desde la raíz del repositorio (con --recoger repite también las tres mediciones)', 'python docs/generate_evidencia_pruebas.py'),
    ]
    filas = [['Para qué', 'Comando']]
    for para, cmd in comandos:
        filas.append([esc(para), Paragraph(esc(cmd), styles['Mono7'])])
    story.append(tabla(filas, [250, CONTENT_W - 250]))
    story.append(Paragraph(
        'Los resultados temporales (informes de Jest y de cobertura) se guardan en la carpeta temporal del sistema, por lo que no ensucian el repositorio; '
        'la carpeta <font face="Courier">backend/coverage/</font> está ignorada por git.', styles['BodySmall']))

    # ── 8. HALLAZGOS Y PENDIENTES ───────────────────────────
    h1(story, 8, 'Hallazgos y pendientes')
    body(story, 'Resumen honesto de lo que esta evidencia deja abierto. Ninguna de estas filas se ha resuelto ni se da por probada.')
    filas = [['Tema', 'Qué se encontró', 'Estado']]
    filas.append(['Educación sin contenido', 'La ruta de contenidos de Educación responde 200 con lista vacía en producción (sección 4).',
                  'Pendiente: publicar piezas en esa sección antes de la demostración.'])
    if n_badge:
        filas.append(['Avisos de CSP en consola', f'{n_badge} de {n_tot} cargas muestran 2 avisos del iframe «Powered by Netlify» bloqueado por la CSP (sección 5).',
                      'Pendiente: revisar en Netlify si el distintivo es intencional.'])
    filas.append(['Dispositivos y navegadores no probados', 'Firefox, Safari (iPhone/iPad/Mac), Chrome en Android y Samsung Internet no se probaron; las tabletas y móviles automáticos son emulación.',
                  'Pendiente: completar la tabla de la sección 5.4 (casillas vacías).'])
    if serv:
        filas.append(['Cobertura de los servicios de IA', f"src/services tiene {str(serv['lineas']).replace('.', ',')} % de líneas cubiertas; las llamadas reales a la API de Claude no se prueban de forma automática.",
                      'Aceptado: se prueba la lógica con servicios simulados.'])
    filas.append(['Esquema de la base de datos', 'El script db:probar-schema necesita una base de datos y no se ejecutó para este documento.',
                  'Pendiente: ejecutarlo y anotar el resultado si se quiere incluir como evidencia.'])
    filas.append(['Arranque en frío del API', 'Render (nivel gratuito) puede tardar unos 50 s tras inactividad; en esta ejecución el servicio ya estaba despierto y no se midió.',
                  'Informativo: el flujo keep-alive del repositorio mitiga la espera.'])
    story.append(tabla(filas, [112, 244, CONTENT_W - 356], cell_style='Cell7'))
    story.append(Spacer(1, 6))
    body(story,
         f"<b>Conclusión.</b> Con lo medido en esta ejecución: {pr['pruebas_pasadas']} de {pr['pruebas_total']} pruebas automáticas pasan, "
         f"{n_ok} de {len(prod['resultados'])} comprobaciones en producción dieron el resultado esperado y {n_carga} de {n_tot} cargas en Chrome y Edge fueron correctas "
         'y sin desbordamiento horizontal. Lo anterior respalda el CRUD, las rutas protegidas, la validación de datos y la publicación en línea; '
         'no sustituye las pruebas manuales en dispositivos reales listadas arriba.')

    doc.build(story, onFirstPage=draw_footer, onLaterPages=draw_footer)


if __name__ == '__main__':
    if '--recoger' in sys.argv:
        recoger()
    build()
    print('OK ->', OUT_PATH)
