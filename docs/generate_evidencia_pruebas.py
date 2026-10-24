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
# Motor de Safari (WebKit): backend/scripts/probar-webkit.js (se corre aparte; Playwright no es dependencia del proyecto)
JSON_WEBKIT = os.path.join(ENTREGA_DIR, 'evidencia-webkit.json')
JSON_WEBKIT_ANTES = os.path.join(ENTREGA_DIR, 'evidencia-webkit-antes.json')
JSON_WEBKIT_SIN_ALM = os.path.join(ENTREGA_DIR, 'evidencia-webkit-sin-almacenamiento.json')
JSON_WEBKIT_ANTES_SIN_ALM = os.path.join(ENTREGA_DIR, 'evidencia-webkit-antes-sin-almacenamiento.json')

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
        ['Repositorio', 'github.com/Wcollado72/SabiasquePR-Final'],
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
        'src/routes/newsletter.', 'src/clasificacion.test', 'src/regiones.test', 'src/util/autorVisible.test',
        'src/routes/fuentes.']),
    ('Validadores de datos y utilidades', ['src/validators/', 'src/util/deteccionRiesgo', 'src/util/slugify']),
    ('Pagos Stripe y webhook', ['src/routes/stripe']),
    ('Seguridad y cabeceras', ['src/app.']),
    ('Panel de administración, agentes de IA y traducciones', [
        'src/routes/admin.', 'src/services/', 'src/util/traducciones.test', 'src/ia-herramientas.test',
        'src/validators/iaHerramientas', 'src/routes/brigada.', 'src/routes/contenidoIa.', 'src/routes/correccion.',
        'src/routes/semillas.', 'src/correccion.test', 'src/taller.test', 'src/util/semillaAContenido', 'src/util/usoIa']),
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
     'Corregido junto con la clasificación de contenidos; el commit solo reporta pruebas en verde (694 en ese momento; la cifra actual está en la sección 1).'),
    ('a72918f', 'Educación: el banner de reglas del foro mostraba la etiqueta de edad «12+», que una política sin etiqueta de edad (COPPA) evita porque puede leerse como «dirigido a menores».',
     'Las reglas del foro pasan a ser para todo público, sin etiqueta de edad (se quitó el badge «12+» de las páginas), con prueba nueva en frontend-filtros.test.js.'),
    ('ddcd338', 'Privacidad: las publicaciones y comentarios del debate devolvían y mostraban el correo del autor (autor_email).',
     'La API devuelve autor_nombre (nombre del perfil o un alias genérico «Participante-xxxx» derivado del id, util/autorVisible.js); pruebas de que la API pública no selecciona el correo.'),
    ('1de54a9', 'Panel de administración y debate: la selección de texto no era visible en los campos oscuros del panel, no había aviso del campo obligatorio que faltaba y la tecla Enter enviaba el formulario; en el debate no existía el botón Editar.',
     'Selección de texto visible, aviso con apertura del panel del primer campo obligatorio que falta, Enter ya no envía, botón Editar (PATCH) en el debate (además, cuadro propio para Reportar); el commit reporta 713 pruebas en verde en ese momento.'),
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
    wk = cargar(JSON_WEBKIT)
    wk_antes = cargar(JSON_WEBKIT_ANTES)
    wk_sin = cargar(JSON_WEBKIT_SIN_ALM)
    wk_antes_sin = cargar(JSON_WEBKIT_ANTES_SIN_ALM)

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

    # ── 3. QUE DEMUESTRAN ───────────────────────────────────
    h1(story, 2, 'Qué demuestran las pruebas respecto a la rúbrica')
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
    h1(story, 3, 'Verificación en producción desde fuera')
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
    story.append(Paragraph('3.1 Lecturas públicas y rutas protegidas', ParagraphStyle('H2nk', parent=styles['H2'], keepWithNext=0)))
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

    # ── 5. NAVEGADORES ──────────────────────────────────────
    h1(story, 4, 'Pruebas en navegadores y dispositivos')
    body(story,
         f"<b>Qué se probó automáticamente.</b> Se cargaron en <b>{esc(nav['base'].replace('https://', ''))}</b> las siete páginas principales "
         '(inicio, noticias, Revolución Humana, educación, tienda, apoyo/premium y contacto) con cada navegador instalado en esta computadora, '
         'sin pantalla, controlado por el protocolo DevTools, en tres tamaños de pantalla: escritorio (1280×800), tableta (768×1024) y móvil '
         '(390×844, con emulación táctil). Por cada combinación se verificó: (1) que el documento responde 2xx, dispara «load» y muestra contenido; '
         '(2) que <b>no hay desbordamiento horizontal</b> (<font face="Courier">scrollWidth ≤ innerWidth</font>); y (3) que no hay errores en la consola.')
    versiones = ', '.join(f"{esc(n['navegador'])} {esc(n['version'].split('/')[-1])}" for n in nav['navegadores'])
    caja(story, 'Qué cubre y qué no cubre esta prueba',
         'Chrome y Edge (motor Chromium) y el motor de Safari (WebKit) se probaron de forma automática en Windows, con tamaños de escritorio, '
         'tableta y móvil emulados. Resultado: cargan las 7 páginas en los 3 tamaños, sin desbordamiento horizontal y sin errores de JavaScript '
         '(los avisos de seguridad que trae el distintivo «Powered by Netlify» no son del código del proyecto). '
         '<b>No sustituye</b> probar en dispositivos reales: el estudiante probó el sitio en un <b>iPhone 14 (Safari)</b>, lo que destapó dos fallos '
         '(la página se arrastraba de lado y el botón de menú quedaba cortado) que se corrigieron; Firefox, Android y Samsung Internet no se probaron.',
         fondo=RISK_SOFT, borde=RISK, color_titulo=RISK)

    # ── 5.4 MOTOR DE SAFARI (WebKit) ───────────────────────────
    story.append(Paragraph('4.1 Motor de Safari (WebKit) en iPhone, iPad y Mac', styles['H2']))
    def resumen_wk(d):
        r = d['resultados']
        return {
            'total': len(r),
            'http': sum(1 for x in r if x['estadoHttp'] == 200),
            'js': sum(1 for x in r if not any(e.startswith('pageerror') or e.startswith('console') or e.startswith('navegacion') for e in x['errores'])),
            'desborde': sum(1 for x in r if not x.get('desborde')),
            'campos': sum(1 for x in r if not x.get('camposConLetraMenorDe16px')),
            'red': sum(1 for x in r if not x['red']),
            'pageerror': sum(1 for x in r if any(e.startswith('pageerror') for e in x['errores'])),
            'con_campos_chicos': sum(1 for x in r if x.get('camposConLetraMenorDe16px')),
        }
    a, d_, a_s, d_s = resumen_wk(wk_antes), resumen_wk(wk), resumen_wk(wk_antes_sin), resumen_wk(wk_sin)
    fecha_wk = wk['generado'][:10]
    body(story,
         f"<b>Qué se probó.</b> Con <b>{esc(wk['motor'])}</b> (el motor de Safari) se cargaron en <b>{esc(wk['base'].replace('https://', ''))}</b> las mismas siete páginas "
         'en tres tamaños con el agente de usuario de Safari: <b>iPhone</b> (390×844, táctil), <b>iPad</b> (820×1180, táctil) y <b>Mac</b> (1440×900). '
         'Por cada combinación se midió: que responda 200, que no haya errores de JavaScript, que no haya desbordamiento horizontal, que ningún campo de '
         'formulario tenga letra menor de 16 px (con menos, Safari de iPhone hace zoom solo al tocar el campo) y que no haya respuestas de red con código 400 o mayor. '
         'Además se repitió con el <b>almacenamiento bloqueado</b>, como Safari con «Bloquear todas las cookies» (tocar <font face="Courier">localStorage</font> '
         'lanza <font face="Courier">SecurityError</font>).')
    filas = [['Medición (21 combinaciones: 3 dispositivos × 7 páginas)', f'Antes de los ajustes<br/>({wk_antes["generado"][:10]})', f'Después de los ajustes<br/>({fecha_wk})']]
    filas += [
        ['Responden 200', f"{a['http']} de {a['total']}", f"{d_['http']} de {d_['total']}"],
        ['Sin errores de JavaScript', f"{a['js']} de {a['total']}", f"{d_['js']} de {d_['total']}"],
        ['Sin desbordamiento horizontal', f"{a['desborde']} de {a['total']}", f"{d_['desborde']} de {d_['total']}"],
        ['Campos de formulario de 16 px o más (sin zoom en iPhone)', f"{a['campos']} de {a['total']}", f"{d_['campos']} de {d_['total']}"],
        ['Sin respuestas de red con código 400 o mayor', f"{a['red']} de {a['total']}", f"{d_['red']} de {d_['total']}"],
        ['Con el almacenamiento bloqueado: sin errores de JavaScript', f"{a_s['total'] - a_s['pageerror']} de {a_s['total']}", f"{d_s['total'] - d_s['pageerror']} de {d_s['total']}"],
    ]
    story.append(tabla(filas, [250, (CONTENT_W - 250) / 2, (CONTENT_W - 250) / 2]))
    story.append(Spacer(1, 6))
    caja(story, 'Hallazgos de esta prueba y cómo se corrigieron',
         f"<b>1. Zoom al tocar un campo (iPhone).</b> Los campos de texto medían 15,2 px; en {a['con_campos_chicos']} de {a['total']} combinaciones "
         'había campos por debajo de 16 px (inicio, educación y contacto). Se subió la regla base a 1rem (16 px). '
         f"<b>2. Carrito.</b> El cajón del carrito usaba <font face=\"Courier\">100vh</font>, que en iPhone incluye la barra de Safari y puede tapar el botón de pagar; "
         'se agregó <font face="Courier">100dvh</font> con <font face="Courier">100vh</font> de respaldo. '
         f"<b>3. Almacenamiento bloqueado.</b> Con «Bloquear todas las cookies», {a_s['pageerror']} de {a_s['total']} combinaciones lanzaban un error de JavaScript sin atrapar "
         '(el tema claro/oscuro y la confirmación de edad de las secciones 18+ leían <font face="Courier">localStorage</font>/<font face="Courier">sessionStorage</font> sin protección); '
         f"ahora {d_s['pageerror']}. Las tres correcciones se publicaron y la medición «después» se hizo contra producción. "
         'Los avisos de CSP del distintivo «Powered by Netlify» (un iframe ajeno al código del proyecto) se separan, igual que en Chrome y Edge.')
    caja(story, 'Límite de esta prueba',
         'Es el <b>motor</b> de Safari ejecutándose en una computadora con Windows, controlado de forma automática. No es un iPhone, un iPad ni un Mac reales: '
         'no cubre el teclado en pantalla, los gestos, la barra de Safari que sube y baja, ni las diferencias propias de cada versión de iOS o macOS. '
         'Por eso se hizo además la prueba manual en un iPhone 14 real.',
         fondo=RISK_SOFT, borde=RISK, color_titulo=RISK)

    body(story,
         f"<b>Conclusión.</b> {pr['pruebas_pasadas']} de {pr['pruebas_total']} pruebas automáticas pasan ({pr['cobertura_global']['lineas']} % de líneas cubiertas) y "
         f"{n_ok} de {len(prod['resultados'])} comprobaciones en producción dieron el resultado esperado. Eso respalda el CRUD, las rutas protegidas, "
         'la validación de datos y la publicación en línea. Para repetirlo: <font face="Courier">cd backend; npm test</font> (pruebas), '
         '<font face="Courier">node scripts/verificar-produccion.js</font> (producción) y '
         '<font face="Courier">node scripts/probar-navegadores.js</font> (navegadores).')

    doc.build(story, onFirstPage=draw_footer, onLaterPages=draw_footer)


if __name__ == '__main__':
    if '--recoger' in sys.argv:
        recoger()
    build()
    print('OK ->', OUT_PATH)
