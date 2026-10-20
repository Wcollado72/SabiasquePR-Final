# -*- coding: utf-8 -*-
"""
Genera docs/entrega/Manual-de-usuario-SabiasquePR.pdf para Sabías que PR.

Parte 3 del PDF de la rúbrica (COMP2053): descripción del sistema, requisitos,
guía de uso y capturas de pantalla ilustrativas. Los pasos se redactaron
leyendo el código real del sitio (frontend/build.js, *.js y backend/src/routes).

Las capturas salen de docs/entrega/capturas/ (tomadas de producción). Si en esa
carpeta hay archivos admin-*.png se incluyen solos, en orden alfabético, en la
sección del panel de administración.
"""
import datetime
import glob
import io
import json
import os

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfgen import canvas as pdfcanvas
from reportlab.platypus import (
    CondPageBreak, Image, KeepTogether, ListFlowable, ListItem, PageBreak,
    Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)
from reportlab.platypus.tableofcontents import TableOfContents

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
AMBAR = colors.HexColor('#B8791A')
AMBAR_SOFT = colors.HexColor('#F5ECE1')

PAGE_W, PAGE_H = letter
MARGIN = 54
CONTENT_W = PAGE_W - 2 * MARGIN

DOCS_DIR = os.path.dirname(os.path.abspath(__file__))
ENTREGA_DIR = os.path.join(DOCS_DIR, 'entrega')
CAPTURAS_DIR = os.path.join(ENTREGA_DIR, 'capturas')
OUT_PATH = os.path.join(ENTREGA_DIR, 'Manual-de-usuario-SabiasquePR.pdf')
DATOS_ESTUDIANTE_PATH = os.path.join(DOCS_DIR, 'privado', 'datos-estudiante.json')

SITIO = 'https://sabiasquepr.com'
CORREO = 'sabiasquepr@yahoo.com'

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
    textColor=ACCENT_DARK, spaceBefore=14, spaceAfter=6,
))
styles.add(ParagraphStyle(
    name='H3', fontName='Helvetica-Bold', fontSize=10, leading=13.5,
    textColor=ACCENT_DARK, spaceBefore=10, spaceAfter=4,
))
styles.add(ParagraphStyle(
    name='H3T', fontName='Helvetica-Bold', fontSize=10, leading=13.5,
    textColor=ACCENT_DARK, spaceBefore=10, spaceAfter=4,
))
styles.add(ParagraphStyle(
    name='BodyL', fontName='Helvetica', fontSize=10, leading=15,
    textColor=INK, spaceAfter=8,
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
    name='StepText', fontName='Helvetica', fontSize=10, leading=14.5,
    textColor=INK, spaceAfter=0,
))
styles.add(ParagraphStyle(
    name='StepNum', fontName='Helvetica-Bold', fontSize=10, leading=14.5,
    textColor=ACCENT,
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
    name='Callout', fontName='Helvetica', fontSize=9.4, leading=13.5,
    textColor=INK, spaceAfter=0,
))
styles.add(ParagraphStyle(
    name='TOCTitle', fontName='Helvetica-Bold', fontSize=15, leading=19,
    textColor=INK, spaceAfter=10,
))
TOC_L0 = ParagraphStyle('TOC0', fontName='Helvetica-Bold', fontSize=10, leading=14,
                        textColor=INK, spaceBefore=5)
TOC_L1 = ParagraphStyle('TOC1', fontName='Helvetica', fontSize=9.3, leading=12.5,
                        textColor=INK_SOFT, leftIndent=16)


# ── UTILIDADES DE FECHA Y ESTUDIANTE ────────────────────────
MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
         'septiembre', 'octubre', 'noviembre', 'diciembre']


def fecha_en_letras(hoy=None):
    hoy = hoy or datetime.date.today()
    return f'{hoy.day} de {MESES[hoy.month - 1]} de {hoy.year}'


def datos_estudiante():
    """Nombre y número de estudiante: de docs/privado/datos-estudiante.json (no se sube al repositorio).
    Si el archivo no existe se usa el nombre ya usado en entregas anteriores y no se muestra número."""
    datos = {'nombre': 'William Collado', 'numero': None}
    try:
        with open(DATOS_ESTUDIANTE_PATH, encoding='utf-8') as f:
            datos.update(json.load(f))
    except FileNotFoundError:
        pass
    return datos


# ── PIE DE PÁGINA ───────────────────────────────────────────
def draw_footer(c: pdfcanvas.Canvas, doc):
    if doc.page == 1:
        return
    c.saveState()
    c.setStrokeColor(LINE)
    c.setLineWidth(0.5)
    c.line(MARGIN, 44, PAGE_W - MARGIN, 44)
    c.setFont('Helvetica', 7.5)
    c.setFillColor(INK_SOFT)
    c.drawString(MARGIN, 32, 'Sabías que PR — Manual de usuario')
    c.drawRightString(PAGE_W - MARGIN, 32, f'Página {doc.page}')
    c.restoreState()


class ManualDoc(SimpleDocTemplate):
    """Documento con tabla de contenido y marcadores (H1 y H2 alimentan ambos)."""
    def afterFlowable(self, flowable):
        if not isinstance(flowable, Paragraph):
            return
        nivel = {'H1': 0, 'H2': 1}.get(flowable.style.name)
        if nivel is None:
            return
        texto = flowable.getPlainText()
        clave = f'sec{self.seq.nextf("sec")}'
        self.canv.bookmarkPage(clave)
        self.canv.addOutlineEntry(texto, clave, nivel, 0)
        self.notify('TOCEntry', (nivel, texto, self.page))


# ── BLOQUES DE CONTENIDO ────────────────────────────────────
def h1(story, num, titulo):
    story.append(Paragraph(f'{num}. {titulo}', styles['H1']))


def h2(story, num, titulo):
    story.append(CondPageBreak(150))
    story.append(Paragraph(f'{num} {titulo}', styles['H2']))


def h3(story, titulo):
    story.append(CondPageBreak(100))
    story.append(Paragraph(titulo, styles['H3']))


def h3t(story, titulo):
    """Subtítulo que precede a una tabla: la tabla puede partirse entre páginas sin dejar huecos grandes."""
    story.append(CondPageBreak(110))
    story.append(Paragraph(titulo, styles['H3T']))


def p(story, texto):
    story.append(Paragraph(texto, styles['Body']))


def pl(story, texto):
    story.append(Paragraph(texto, styles['BodyL']))


def bullets(story, items):
    story.append(ListFlowable(
        [ListItem(Paragraph(it, styles['BulletText']), leftIndent=6) for it in items],
        bulletType='bullet', start='•', leftIndent=14, bulletFontSize=8,
    ))
    story.append(Spacer(1, 6))


def tabla(filas, anchos, cabecera=True):
    datos = []
    for i, row in enumerate(filas):
        estilo = styles['TableHead'] if (cabecera and i == 0) else styles['TableCell']
        datos.append([Paragraph(str(c), estilo) for c in row])
    t = Table(datos, colWidths=anchos, hAlign='LEFT', repeatRows=1 if cabecera else 0)
    est = [
        ('GRID', (0, 0), (-1, -1), 0.5, LINE),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 3.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]
    if cabecera:
        est += [('BACKGROUND', (0, 0), (-1, 0), ACCENT_DARK),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, PAPER_RULED])]
    else:
        est += [('ROWBACKGROUNDS', (0, 0), (-1, -1), [WHITE, PAPER_RULED])]
    t.setStyle(TableStyle(est))
    return t


def agregar_tabla(story, filas, anchos, cabecera=True):
    story.append(tabla(filas, anchos, cabecera))
    story.append(Spacer(1, 10))


def pasos(story, lista):
    """Lista numerada. Cada elemento: texto o (texto, 'lo que debes ver')."""
    filas = []
    for i, item in enumerate(lista, 1):
        texto, ver = (item, None) if isinstance(item, str) else item
        contenido = [Paragraph(texto, styles['StepText'])]
        if ver:
            contenido.append(Paragraph(
                f'<font color="#2E7D5B"><b>Verás:</b> {ver}</font>',
                ParagraphStyle('StepSee', parent=styles['StepText'], fontSize=9.2, leading=13, spaceBefore=2)))
        filas.append([Paragraph(f'{i}.', styles['StepNum']), contenido])
    t = Table(filas, colWidths=[22, CONTENT_W - 22], hAlign='LEFT')
    t.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('LINEBELOW', (0, 0), (-1, -2), 0.25, LINE),
    ]))
    story.append(t)
    story.append(Spacer(1, 8))


def nota(story, titulo, texto, tipo='tip'):
    fondo, barra = {'tip': (ACCENT_SOFT, ACCENT), 'aviso': (AMBAR_SOFT, AMBAR), 'ok': (DONE_SOFT, DONE)}[tipo]
    t = Table([[Paragraph(f'<b>{titulo}</b> {texto}', styles['Callout'])]], colWidths=[CONTENT_W], hAlign='LEFT')
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), fondo),
        ('LINEBEFORE', (0, 0), (0, -1), 3, barra),
        ('TOPPADDING', (0, 0), (-1, -1), 7),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ]))
    story.append(t)
    story.append(Spacer(1, 10))


# ── CAPTURAS ────────────────────────────────────────────────
_fig = {'n': 0}


def _imagen(nombre, recorte, ancho):
    """Abre la captura, la recorta (x0, y0, x1, y1) sin deformar y la devuelve como Image
    con el ancho pedido (en puntos) y el alto proporcional. Se guarda como JPEG para no
    inflar el PDF."""
    ruta = os.path.join(CAPTURAS_DIR, nombre)
    im = PILImage.open(ruta).convert('RGB')
    if recorte:
        im = im.crop(recorte)
    buf = io.BytesIO()
    im.save(buf, 'JPEG', quality=88, optimize=True)
    buf.seek(0)
    alto = ancho * im.height / im.width
    if alto > 560:  # capturas muy altas (p. ej. del panel): se reducen sin deformar para que quepan en la página
        ancho, alto = ancho * 560 / alto, 560
    return Image(buf, width=ancho, height=alto), alto


def _marco(contenido_celdas, anchos, separacion=0):
    t = Table([contenido_celdas], colWidths=anchos, hAlign='CENTER')
    t.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), separacion),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    return t


def _con_borde(img, ancho, alto):
    t = Table([[img]], colWidths=[ancho], rowHeights=[alto], hAlign='CENTER')
    t.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.6, LINE),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    return t


def figura(story, nombre, pie, recorte=None, ancho=CONTENT_W):
    """Una captura con su pie 'Figura N. …'."""
    _fig['n'] += 1
    img, alto = _imagen(nombre, recorte, ancho)
    ancho = img.drawWidth
    story.append(KeepTogether([
        _con_borde(img, ancho, alto),
        Paragraph(f'Figura {_fig["n"]}. {pie}', styles['Caption']),
    ]))


def figura_fila(story, items, pie, separacion=12):
    """Varias capturas lado a lado (items: lista de (archivo, recorte, ancho)) con un solo pie."""
    _fig['n'] += 1
    celdas, anchos = [], []
    for nombre, recorte, ancho in items:
        img, alto = _imagen(nombre, recorte, ancho)
        celdas.append(_con_borde(img, ancho, alto))
        anchos.append(ancho + separacion)
    anchos[-1] -= separacion
    story.append(KeepTogether([
        _marco(celdas, anchos, separacion),
        Paragraph(f'Figura {_fig["n"]}. {pie}', styles['Caption']),
    ]))
    # el último elemento no necesita separación a la derecha
    return


# ── PORTADA ─────────────────────────────────────────────────
def build_portada(story):
    est = datos_estudiante()
    story.append(Spacer(1, 90))
    story.append(Paragraph('UNIVERSIDAD INTERAMERICANA DE PUERTO RICO · RECINTO DE FAJARDO', styles['Eyebrow']))
    story.append(Spacer(1, 40))
    story.append(Paragraph('PROYECTO FINAL · DESARROLLO WEB FULL-STACK', styles['Eyebrow']))
    story.append(Paragraph('Sabías que PR', ParagraphStyle('CoverTitle', parent=styles['DocTitle'], fontSize=32, leading=36)))
    story.append(Paragraph('Manual de usuario', ParagraphStyle('CoverSub', parent=styles['DocSub'], fontSize=14, leading=19, textColor=ACCENT_DARK)))
    story.append(Spacer(1, 10))
    story.append(Paragraph('Descripción del sistema &nbsp;·&nbsp; Requisitos &nbsp;·&nbsp; Guía de uso &nbsp;·&nbsp; Capturas ilustrativas', styles['DocSub']))
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


# ── CONTENIDO ───────────────────────────────────────────────
def seccion_indice(story):
    story.append(Paragraph('Contenido', styles['TOCTitle']))
    toc = TableOfContents()
    toc.levelStyles = [TOC_L0, TOC_L1]
    toc.dotsMinLevel = 0
    story.append(toc)
    story.append(Spacer(1, 6))


def seccion_descripcion(story):
    h1(story, 1, 'Descripción del sistema')
    p(story,
      '<b>Sabías que PR</b> es un sitio web informativo y comunitario creado en Puerto Rico. Su propósito es '
      'ayudar a cualquier persona a entender, cuestionar y mejorar la sociedad en la que vive. Reúne noticias con '
      'contexto, contenido educativo, ensayos, videos y audios, un espacio de debate moderado, una tienda y un '
      'apoyo voluntario al proyecto. <b>Todo el contenido se puede leer gratis</b>, con cuenta o sin ella.')
    pl(story,
      f'El sitio está publicado en <font face="Courier">{SITIO.replace("https://", "")}</font> y funciona en '
      'computadora, tableta y celular. Se puede ver en español o en inglés y en modo claro u oscuro. Todavía está en '
      'fase <b>BETA</b> (así lo indica la etiqueta junto al nombre en el encabezado): se sigue ampliando el contenido.')

    h3t(story, 'Secciones del sitio')
    agregar_tabla(story, [
        ['Sección', 'Qué encuentras'],
        ['Inicio', 'Una pieza destacada, "Lo más reciente", accesos a las secciones, el boletín y el manifiesto del proyecto.'],
        ['Noticias', 'Un collage con piezas de todas las secciones (noticias, videos, ensayos, audios) que se puede filtrar por categoría y por región.'],
        ['Revolución Humana', 'Cuatro sub-secciones: <b>Nuevos Humanos</b> (lo mejor de la humanidad), <b>Lógica Humana</b> (ideas del autor Aliado Imperfekto), <b>Corrupción Humana</b> y <b>Ilógica Humana</b> (lo que le falla; estas dos son para mayores de 18 años). Cada una tiene su cuadrícula de contenido y, salvo Lógica Humana, su debate.'],
        ['Educación', 'Piezas sobre leyes educativas, estudiantes sobresalientes, programas educativos y sistemas educativos del mundo; tablas con rankings educativos y el foro de la sección.'],
        ['Tienda', 'Productos del proyecto con carrito de compras y pago con Stripe.'],
        ['Apoya el canal', 'Apoyo voluntario mensual o único, y el muro de agradecimiento para quienes apoyan cada mes.'],
        ['Quiénes somos', 'Visión y datos del proyecto, y un formulario para escribirle al equipo.'],
        ['Mi cuenta', 'Perfil, muro de agradecimiento y pedidos de la persona que inició sesión.'],
        ['Panel de administración', 'Herramientas para publicar y moderar. Solo para el rol administrador o moderador (sección 3.10).'],
    ], [105, CONTENT_W - 105])

    h3t(story, 'Qué se puede hacer según el tipo de visita')
    agregar_tabla(story, [
        ['Tipo de visita', 'Puede'],
        ['Sin cuenta', 'Leer todo el contenido y los debates; ver videos y escuchar audios; filtrar por categoría y región; cambiar idioma y modo claro/oscuro; suscribirse al boletín; enviar un mensaje desde "Quiénes somos". Las secciones 18+ piden confirmar la edad con una casilla.'],
        ['Con cuenta gratuita', 'Todo lo anterior, más: publicar y comentar en los debates (hasta 200 palabras por publicación), comentar en noticias y piezas, reportar contenido, comprar en la tienda, activar el apoyo mensual, editar su nombre y ver sus pedidos.'],
        ['Con apoyo mensual (Colaborador)', 'Todo lo de la cuenta gratuita, más: insignia "Colaborador", publicaciones de hasta 1000 palabras, enlace multimedia (imagen, audio o video) en sus publicaciones, acceso completo a las piezas marcadas como premium y la opción de aparecer en el muro de agradecimiento.'],
        ['Administrador o moderador', 'El administrador gestiona noticias, contenidos, productos, reportes, agentes de IA y gastos. El moderador solo atiende reportes y ve el estado de las defensas.'],
    ], [125, CONTENT_W - 125])
    nota(story, 'Pagos en modo de prueba.',
         'El apoyo voluntario y la tienda funcionan con Stripe en <b>modo de prueba</b>: se puede recorrer todo el '
         'proceso de pago con una tarjeta de prueba y <b>no se cobra dinero real</b> (ver sección 3.7).', 'aviso')


def seccion_requisitos(story):
    h1(story, 2, 'Requisitos')
    p(story, 'No hay que instalar nada. Para usar el sitio solo se necesita lo siguiente:')
    agregar_tabla(story, [
        ['Requisito', 'Detalle'],
        ['Dispositivo', 'Computadora, tableta o celular.'],
        ['Navegador', 'Una versión reciente de Chrome, Edge, Firefox o Safari.'],
        ['Conexión', 'Acceso a internet. Todo el contenido se carga desde el servidor del sitio.'],
        ['JavaScript', f'Debe estar activado (lo está por defecto). Noticias, filtros, tienda, cuenta y debate se cargan con JavaScript; sin él, el sitio muestra un aviso como "Activa JavaScript para ver las noticias".'],
        ['Dirección', f'<font face="Courier">{SITIO}</font>'],
        ['Correo electrónico', 'Solo para crear una cuenta (se envía un enlace de confirmación) y para recuperar la contraseña.'],
        ['Para probar un pago', 'No hace falta una tarjeta real: se usa la tarjeta de prueba de Stripe (sección 3.7).'],
        ['Para probar el panel de administración', 'La cuenta de evaluación se entrega por separado. Requiere una app de autenticación en el celular (Google Authenticator, Microsoft Authenticator, Authy o similar).'],
    ], [135, CONTENT_W - 135])
    nota(story, 'La primera visita puede tardar.',
         'El servidor del sitio usa un plan gratuito que se "duerme" cuando nadie lo usa. Si es la primera visita en un '
         'rato, las noticias, el debate o la tienda pueden tardar <b>hasta unos 50 segundos</b> en aparecer. '
         'Mientras tanto verás un aviso como "Cargando… el servidor puede tardar unos segundos en despertar". '
         'Es normal: espera y no recargues varias veces seguidas.', 'aviso')


def seccion_guia(story, capturas_admin):
    story.append(CondPageBreak(220))
    h1(story, 3, 'Guía de uso')
    p(story,
      'Cada paso dice qué hacer y, en verde, <font color="#2E7D5B"><b>qué debes ver</b></font> al terminarlo. '
      'Las capturas son del sitio publicado en sabiasquepr.com. Si algo no coincide, consulta la sección 4.')

    # 3.1 ────────────────────────────────────────────────────
    h2(story, '3.1', 'Navegar el sitio')
    pasos(story, [
        (f'Abre <font face="Courier">{SITIO}</font> en tu navegador.',
         'la página de inicio con una pieza destacada grande y, debajo, "Lo más reciente" (Figura 1).'),
        ('Usa el menú del encabezado: <b>Noticias</b>, <b>Revolución Humana</b>, <b>Educación</b>, <b>Tienda</b>, '
         '<b>Quiénes somos</b> y <b>Apoya el canal</b>. En el celular, el menú se abre con el botón de tres rayitas.',
         'la página cambia y la opción donde estás queda resaltada. Pulsa el nombre del sitio, a la izquierda, para volver al inicio.'),
        ('Cambia el idioma con el botón <b>ES / EN</b> del encabezado.',
         'la página se recarga y los textos aparecen en inglés (o de vuelta en español). El sitio recuerda tu elección en este navegador.'),
        ('Cambia entre modo claro y oscuro con el botón de la luna (en modo oscuro muestra un sol).',
         'los colores del sitio cambian al instante y se recuerdan en este navegador.'),
        ('Revisa el pie de página: allí están los enlaces a las secciones, al Manifiesto, a Servicios, a "Apoya el canal", '
         'al RSS, el correo de contacto y los enlaces a Privacidad y Términos.', None),
        ('<i>Opcional.</i> Si tu navegador lo ofrece (por ejemplo, el icono de instalar en la barra de direcciones de Chrome o Edge, '
         'o "Agregar a pantalla de inicio" en el celular), puedes instalar el sitio como una aplicación. No es necesario para usarlo.', None),
    ])
    nota(story, 'Idioma.',
         'Si una pieza todavía no está traducida, en inglés se muestra en español con la etiqueta "Solo en español". '
         'Los Términos y la Política de Privacidad llevan un aviso: la versión en español es la que prevalece. '
         'El panel de administración siempre se muestra en español.')
    figura(story, 'inicio-escritorio.png',
           'Página de inicio en computadora: menú, botones de idioma, modo oscuro, carrito e inicio de sesión.',
           recorte=(0, 0, 1280, 700))
    figura_fila(story, [
        ('inicio-movil.png', (0, 0, 390, 640), 150),
        ('noticias-movil.png', (0, 0, 390, 640), 150),
        ('tienda-movil.png', (0, 0, 390, 640), 150),
    ], 'Vista en celular: inicio, noticias y tienda.', separacion=18)

    # 3.2 ────────────────────────────────────────────────────
    h2(story, '3.2', 'Noticias')
    pasos(story, [
        ('Entra a <b>Noticias</b> desde el menú.',
         'una fila de botones de categoría (Ciencia, Clima y Medio Ambiente, Crimen, Cultura, Deportes, Descubrimientos, '
         'Finanzas, Internacionales, Política, Salud y Tecnología) y, debajo, los de región: Puerto Rico, Estados Unidos, '
         'Hispanoamérica e Internacionales (Figura 3).'),
        ('Para <b>filtrar por categoría</b>, pulsa un botón de categoría. Funciona como un interruptor: al pulsarlo se activa; '
         'si lo pulsas otra vez, se desactiva y vuelves a ver todas.',
         'el botón se oscurece y la cuadrícula se actualiza con las piezas de esa categoría.'),
        ('Para <b>filtrar por región</b>, pulsa Puerto Rico, Estados Unidos, Hispanoamérica o Internacionales. '
         'Al entrar, Puerto Rico viene activa.',
         'solo las piezas de esa región. Las piezas que no tienen región asignada se muestran en todas.'),
        ('Para <b>abrir una pieza</b>, pulsa su título o su imagen.',
         'la página de lectura: sección, formato y categoría, título, fecha, tiempo de lectura o duración, el texto y, al final, '
         'la fuente con su enlace. Algunas piezas llevan etiquetas como "Original", "Asistencia parcial de IA" o "Generado con IA" '
         '(la divulgación del uso de inteligencia artificial) (Figura 4).'),
        ('Para <b>reproducir un video o un audio</b>, pulsa el botón de reproducir sobre la imagen de la tarjeta.',
         'el video se reproduce dentro de la misma tarjeta; en un audio aparece una barra de reproducción. '
         'También puedes abrir la pieza y reproducirlo allí.'),
        ('Al final de cada pieza está la sección <b>Comentarios</b>. Sin cuenta verás "Inicia sesión para comentar". '
         'Con cuenta, escribe tu comentario (mínimo 2 caracteres) y pulsa <b>Comentar</b>.',
         'tu comentario aparece en la lista con tu correo y la fecha, y un botón <b>Eliminar</b> para quitarlo.'),
    ])
    nota(story, 'Qué muestra el collage.',
         'La página Noticias mezcla piezas de todas las secciones, de la más reciente a la más antigua, y procura mostrar '
         'al menos una de cada sección. Las piezas de Corrupción Humana e Ilógica Humana (18+) solo aparecen si ya '
         'confirmaste que eres mayor de 18 años (sección 3.3). Algunas piezas llevan la insignia "Premium": '
         'sin apoyo mensual verás un adelanto y el aviso "Este contenido es para quienes apoyan el canal".')
    figura(story, 'noticias-escritorio.png',
           'Noticias: filtros de categoría (arriba), filtros de región (debajo) y el collage de piezas.',
           recorte=(0, 0, 1280, 740))
    figura(story, 'pieza-detalle-escritorio.png',
           'Una pieza abierta: clasificación, título, fecha, reproductor de video y texto.',
           recorte=(0, 0, 1280, 700))

    # 3.3 ────────────────────────────────────────────────────
    h2(story, '3.3', 'Revolución Humana')
    pasos(story, [
        ('Entra a <b>Revolución Humana</b>.',
         'el título, cuatro botones de sub-sección (Corrupción Humana, Ilógica Humana, Lógica Humana y Nuevos Humanos, que viene '
         'activa), los botones de región y la presentación del autor, Aliado Imperfekto (Figura 5).'),
        ('Pulsa una sub-sección para cambiar de tema.',
         'la cuadrícula muestra las piezas de esa sub-sección. En Nuevos Humanos, Corrupción Humana e Ilógica Humana, '
         'debajo aparece el debate (sección 3.6). En Lógica Humana aparece el cuadro "Herramientas para pensar en voz alta", '
         'cuyo botón <b>Lógica</b> abre un ensayo del autor.'),
        ('<b>Corrupción Humana</b> e <b>Ilógica Humana</b> son solo para mayores de 18 años. Al elegirlas verás un aviso. '
         'Marca la casilla <i>"Confirmo que soy mayor de 18 años y acepto los términos de esta sección"</i> y pulsa <b>Entrar</b>.',
         'el botón Entrar se habilita al marcar la casilla y, al pulsarlo, aparece el debate de la sección.'),
        ('Para filtrar por <b>región</b>, pulsa Puerto Rico, Estados Unidos, Hispanoamérica o Internacionales.',
         'la cuadrícula se actualiza con las piezas de esa región.'),
    ])
    nota(story, 'Sobre la confirmación de edad.',
         'La confirmación se pide una sola vez y sirve para las dos secciones 18+. Sin cuenta se recuerda mientras '
         'dure la sesión del navegador; con cuenta queda guardada en tu perfil. Es una declaración tuya: '
         'el sitio no verifica tu identidad.')
    figura(story, 'revolucion-humana-escritorio.png',
           'Revolución Humana: sub-secciones, región y presentación del autor.',
           recorte=(0, 0, 1280, 720))

    # 3.4 ────────────────────────────────────────────────────
    h2(story, '3.4', 'Educación')
    pasos(story, [
        ('Entra a <b>Educación</b>.',
         'cuatro botones de tema: Estudiantes sobresalientes (activo), Leyes educativas, Programas educativos destacados y '
         'Sistemas educativos mundiales. Debajo, los botones de región con "Todas" activo (Figura 6).'),
        ('Pulsa un tema para ver sus piezas. La región que elegiste se mantiene al cambiar de tema.',
         'la cuadrícula se actualiza. Si todavía no hay piezas en esa selección verás el mensaje '
         '"Aún no hay contenido en esta selección en esta sección": es normal.'),
        ('Para ver piezas de un lugar específico, pulsa Puerto Rico, Estados Unidos, Hispanoamérica o Internacionales. '
         'Pulsa <b>Todas</b> para quitar el filtro de región.',
         'las piezas de esa región y las que no tienen región asignada.'),
        ('Baja hasta <b>Educación en el mundo</b>.',
         'dos tablas con datos y fuentes enlazadas: el top 10 mundial de PISA 2022 y el top 10 de estados de EE. UU., '
         'cada una con un recuadro sobre la posición de Puerto Rico.'),
        ('Al final de la página están el foro de la sección (sección 3.6), el formulario del boletín (sección 3.8) y un correo para ideas y sugerencias.', None),
    ])
    figura(story, 'educacion-escritorio.png',
           'Educación: temas, región y, más abajo, la sección "Educación en el mundo".',
           recorte=(0, 0, 1280, 640))

    # 3.5 ────────────────────────────────────────────────────
    h2(story, '3.5', 'Crear cuenta, iniciar sesión y recuperar la contraseña')
    h3(story, 'Crear una cuenta')
    pasos(story, [
        ('Pulsa <b>Iniciar sesión</b>, en la esquina superior derecha de cualquier página.',
         'un cuadro con los campos "Usuario o correo" y "Contraseña", una verificación de Cloudflare, el botón <b>Entrar</b>, '
         'un botón con una G (Google) y los enlaces "Registrar" y "¿Olvidaste tu contraseña?" (Figura 7, izquierda).'),
        ('Pulsa <b>Registrar</b>.',
         'el botón Entrar cambia a <b>Crear cuenta</b> y aparece el campo <b>Fecha de nacimiento</b> (Figura 7, derecha).'),
        ('Escribe tu correo, una contraseña de al menos 8 caracteres (mejor con mayúsculas, minúsculas, números y símbolos) '
         'y tu fecha de nacimiento.', None),
        ('Espera a que la verificación de Cloudflare Turnstile termine (pasa de "Verifying…" a una marca de verificado). '
         'Es un control automático que evita registros hechos por robots; normalmente no hay que hacer nada.', None),
        ('Pulsa <b>Crear cuenta</b>.',
         'el mensaje "Revisa tu correo para confirmar tu cuenta."'),
        ('Abre el correo que te llegó y pulsa el enlace de confirmación (si no lo ves, revisa la carpeta de spam). '
         'Después vuelve al sitio e inicia sesión.', 'tu cuenta lista para usarse.'),
    ])
    nota(story, 'Sobre la fecha de nacimiento.',
         'Se pide una sola vez, no se muestra a nadie y no se puede cambiar después. Sirve para aplicar las reglas de edad '
         '(algunas secciones son solo para mayores de 18). No se rechaza a nadie por su edad. Si la contraseña que '
         'escribes aparece en filtraciones de datos conocidas, el sitio te pide elegir otra.')
    figura_fila(story, [
        ('inicio-sesion-modal.png', (452, 180, 828, 620), 232),
        ('registro-modal.png', (452, 180, 828, 620), 232),
    ], 'Cuadro de inicio de sesión (izquierda) y el mismo cuadro en modo de registro, con la fecha de nacimiento (derecha).', separacion=16)

    h3(story, 'Iniciar sesión')
    pasos(story, [
        ('Pulsa <b>Iniciar sesión</b>, escribe tu correo y tu contraseña y pulsa <b>Entrar</b> (o la tecla Enter).',
         '"¡Bienvenido!" y el cuadro se cierra. El botón del encabezado ahora muestra tu correo.'),
        ('Pulsa el botón con tu correo para abrir el menú de tu cuenta.',
         '"Bienvenido/a", tu correo, tu estado (Cuenta gratuita, Colaborador o Administrador) y los enlaces '
         '<b>Mi cuenta</b>, <b>Cambiar contraseña</b> y <b>Cerrar sesión</b>.'),
        ('<b>Entrar con Google:</b> pulsa el botón <b>G</b>, elige tu cuenta de Google y regresarás al sitio con la sesión iniciada. '
         'Si es tu primera vez, aparece el cuadro "Completa tu perfil" para escribir tu fecha de nacimiento y pulsar <b>Guardar</b>.', None),
    ])
    p(story, 'Por seguridad, la sesión se cierra sola después de 30 minutos sin actividad.')

    h3(story, 'Recuperar la contraseña')
    pasos(story, [
        ('Pulsa <b>Iniciar sesión</b> y escribe tu correo en el primer campo. Si lo dejas vacío, el sitio avisa "Escribe tu correo primero."', None),
        ('Pulsa <b>¿Olvidaste tu contraseña?</b>',
         '"Revisa tu correo para restablecer la contraseña."'),
        ('Abre el correo y pulsa el enlace.',
         'la página "Restablecer contraseña" con los campos "Nueva contraseña" y "Confirma la contraseña". '
         'Si tu cuenta tiene verificación en dos pasos, antes te pedirá el código de 6 dígitos de tu app.'),
        ('Escribe la nueva contraseña dos veces (mínimo 8 caracteres) y pulsa <b>Guardar nueva contraseña</b>.',
         '"¡Listo! Tu contraseña se actualizó. Ya puedes iniciar sesión."'),
    ])

    # 3.6 ────────────────────────────────────────────────────
    h2(story, '3.6', 'Debate')
    p(story,
      'El debate está en <b>Nuevos Humanos</b>, <b>Corrupción Humana</b> e <b>Ilógica Humana</b> (dentro de Revolución Humana) '
      'y en <b>Educación</b>. Cualquiera puede leerlo; para escribir hace falta una cuenta.')
    pasos(story, [
        ('<b>Leer sin cuenta.</b> Baja hasta la lista de publicaciones y pulsa el título de una.',
         'la publicación se despliega con su texto y los comentarios. Pulsa el título otra vez para cerrarla. '
         'Cada publicación muestra el autor, la fecha y cuántos comentarios tiene; la "Tema oficial de la semana" lleva una etiqueta.'),
        ('<b>Escribir una publicación.</b> Inicia sesión y, en el formulario "Nueva publicación", escribe el <b>Título</b> '
         '(de 3 a 140 caracteres) y <b>Tu opinión</b> (mínimo 10 caracteres). Espera la verificación de Cloudflare y pulsa <b>Publicar</b>.',
         'un contador de palabras bajo el texto (por ejemplo, "35/200 palabras"). Al publicar aparece "¡Publicado!" '
         'y tu publicación entra a la lista. Sin sesión, en lugar del formulario verás "Inicia sesión para participar en el debate".'),
        ('<b>Comentar.</b> Abre una publicación, escribe en el campo "Comentar..." y pulsa <b>Comentar</b>.',
         'tu comentario al final de la lista de comentarios.'),
        ('<b>Reportar.</b> Pulsa <b>Reportar</b> en una publicación o comentario. Escribe el motivo (mínimo 5 caracteres) en la ventana que aparece.',
         '"Gracias, tu reporte fue enviado para revisión."'),
        ('<b>Eliminar lo tuyo.</b> En tus propias publicaciones y comentarios aparece el botón <b>Eliminar</b>; confirma en la ventana.',
         'la publicación o el comentario desaparece de la lista.'),
    ])
    h3t(story, 'Reglas del debate')
    agregar_tabla(story, [
        ['Regla', 'Cómo funciona'],
        ['Límite de palabras', 'Cuenta gratuita: <b>200 palabras</b> por publicación. Quien apoya cada mes (Colaborador): <b>1000 palabras</b>. '
                              'Si te pasas, el contador se pone en rojo y el sitio rechaza la publicación con un aviso.'],
        ['Cuenta nueva', 'Para publicar o comentar, la cuenta debe tener al menos 1 hora de creada.'],
        ['Secciones 18+', 'Corrupción Humana e Ilógica Humana exigen haber confirmado que eres mayor de 18 años.'],
        ['Contra robots', 'Verificación de Cloudflare, un campo oculto que solo los robots llenan y un máximo de 20 envíos '
                          'cada 15 minutos.'],
        ['Quien apoya cada mes', 'Puede añadir a su publicación un enlace de imagen, audio o video (campo "Enlace multimedia").'],
    ], [115, CONTENT_W - 115])
    h3(story, 'Cómo funciona la moderación')
    bullets(story, [
        'Cualquier persona con sesión puede <b>reportar</b> una publicación o un comentario.',
        'Además, el sistema revisa cada publicación y comentario nuevo y, si detecta señales de riesgo, crea por su cuenta un '
        'reporte marcado como "detección automática". Esto <b>no bloquea ni borra</b> nada: solo avisa a quien modera.',
        'El equipo (administrador o moderador) revisa la cola de reportes y puede <b>marcarlos como revisados</b>, '
        '<b>descartarlos</b> o <b>eliminar el contenido</b> reportado.',
        'La base de las secciones 18+ es la libertad de expresión: no se censura una opinión por ser incómoda, pero los '
        'casos extremos, como amenazas de daño o contenido ilegal, se revisan y se eliminan. La Educación admite todo '
        'lo que sea respetuoso: no se toleran el lenguaje ofensivo, el contenido sexual ni los ataques personales.',
    ])
    nota(story, 'Tu publicación es pública.',
         'Todo lo que escribes en un debate o en un comentario lo puede leer cualquier visitante y se muestra junto al '
         'correo de tu cuenta como autor. Escribe pensando en eso.', 'aviso')

    # 3.7 ────────────────────────────────────────────────────
    h2(story, '3.7', 'Tienda y apoyo voluntario')
    nota(story, 'Modo de prueba.',
         'Stripe está en modo de prueba: <b>nada se cobra de verdad</b>. Usa siempre la tarjeta de prueba '
         '<font face="Courier"><b>4242 4242 4242 4242</b></font>, <b>cualquier fecha de vencimiento futura</b> '
         '(por ejemplo, 12/34) y <b>cualquier código CVC</b> de 3 dígitos (por ejemplo, 123). Para el código postal y los '
         'demás datos puedes escribir valores de ejemplo. Una tarjeta real no será aceptada.', 'aviso')
    h3(story, 'Comprar en la tienda')
    pasos(story, [
        ('Entra a <b>Tienda</b>.',
         'los productos disponibles, cada uno con su foto, descripción, precio y el botón <b>Añadir al carrito</b> (Figura 8).'),
        ('Pulsa <b>Añadir al carrito</b> en un producto.',
         'un aviso con el nombre del producto y, a la derecha, el panel <b>Tu carrito</b> con el producto, su cantidad, '
         'el precio, el <b>Total</b> y el botón <b>Ir al pago</b>. El número sobre el icono de la bolsa sube.'),
        ('En el panel, usa los botones <b>-</b> y <b>+</b> para cambiar la cantidad y la <b>x</b> para quitar un producto.',
         'el total se actualiza al momento.'),
        ('Pulsa <b>Ir al pago</b>. Si no has iniciado sesión, el sitio avisa "Inicia sesión para completar tu compra." y abre el cuadro '
         'de inicio de sesión; inicia sesión y vuelve a pulsar <b>Ir al pago</b>.',
         'el botón cambia a "Procesando..." y se abre la página de pago de Stripe.'),
        ('En Stripe escribe tu correo, la dirección de envío y de facturación (el envío es solo a Estados Unidos, lo que incluye a '
         'Puerto Rico) y los datos de la tarjeta de prueba. Pulsa el botón de pagar.',
         'regresas a la tienda cuando el pago se completa.'),
        ('Abre el menú de tu cuenta, entra a <b>Mi cuenta</b> y baja a <b>Mis pedidos</b>.',
         'tu pedido con el total, el estado (Pendiente o Pagada), la fecha, los productos y la dirección de envío.'),
    ])
    nota(story, 'Consejo.',
         'El carrito no se guarda si recargas la página o cambias a otra: añade los productos y paga sin salir de la '
         'misma página. Si cierras el panel de Stripe sin pagar, no se hace ningún cargo.')
    figura(story, 'tienda-escritorio.png',
           'Tienda: cada producto muestra foto, descripción, precio y el botón "Añadir al carrito".',
           recorte=(0, 0, 1280, 720))

    h3(story, 'Apoyar el canal')
    pasos(story, [
        ('Entra a <b>Apoya el canal</b>.',
         'por qué existe el apoyo, las formas de apoyar (mensual, único y la tienda), el muro de agradecimiento y "Lo que debes saber" (Figura 9).'),
        ('<b>Apoyo mensual:</b> inicia sesión y pulsa <b>Apoyar cada mes</b> (el botón solo aparece con la sesión iniciada; '
         'sin sesión verás "Inicia sesión para activar el apoyo mensual y recibir tu insignia").',
         '"Redirigiendo a Stripe..." y la página de pago. Completa el pago con la tarjeta de prueba.'),
        ('Al volver al sitio:',
         '"¡Gracias por apoyar a Sabías que PR!" (o, si cancelaste, "Cancelaste el proceso. No se hizo ningún cargo."). '
         'Tu estado cambia a <b>Colaborador</b>, lo que puede tardar unos instantes en reflejarse; recarga la página si hace falta.'),
        ('<b>Apoyo único:</b> si el botón <b>Apoyar una vez</b> está disponible, abre un enlace de pago de Stripe donde tú decides la cantidad, sin necesidad de cuenta. '
         'No da insignia ni cambia tu cuenta.', None),
    ])
    pl(story,
      'El apoyo es voluntario, para mayores de 18 años y no abre ni cierra contenido. No es una donación deducible de impuestos. '
      'El apoyo mensual se puede cancelar en cualquier momento escribiendo a '
      f'<font face="Courier">{CORREO}</font> o desde el enlace del recibo. El resto de las condiciones está en la propia página "Apoya el canal".')
    figura(story, 'apoyo-escritorio.png',
           'Apoya el canal: formas de apoyar y muro de agradecimiento.',
           recorte=(0, 0, 1280, 960), ancho=360)

    # 3.8 ────────────────────────────────────────────────────
    h2(story, '3.8', 'Quiénes somos, contacto y boletín')
    pasos(story, [
        ('Entra a <b>Quiénes somos</b>.',
         'la visión del proyecto, los datos del proyecto y el recuadro "Cómo comunicarte" con el correo, el teléfono y la ubicación (Figura 10).'),
        ('Baja hasta "Envíanos un mensaje". Escribe tu <b>Nombre</b> (mínimo 2 letras), tu <b>Correo</b>, elige el <b>Motivo</b> '
         '(Consulta general, Propuesta de colaboración, Reportar un error, Sugerencia de contenido u Otro) y escribe el <b>Mensaje</b> (mínimo 10 caracteres). '
         'Si ya iniciaste sesión, el correo y el nombre vienen escritos; puedes cambiarlos.', None),
        ('Pulsa <b>Enviar mensaje</b>.',
         '"¡Mensaje enviado! Te responderemos pronto." Si falta algún dato, el sitio te dice cuál corregir.'),
        ('<b>Boletín.</b> En la página de inicio, en Educación y en Servicios hay un cuadro para recibir nuevo contenido. '
         'Escribe tu correo y pulsa <b>Suscribirme</b>.',
         '"¡Suscripción exitosa! Revisa tu correo para confirmar." Para darte de baja usa el enlace que viene en cada correo del boletín.'),
    ])
    figura(story, 'quienes-somos-escritorio.png',
           'Quiénes somos: visión y datos del proyecto; más abajo, el formulario de contacto.',
           recorte=(0, 0, 1280, 720))

    # 3.9 ────────────────────────────────────────────────────
    h2(story, '3.9', 'Mi cuenta')
    pasos(story, [
        ('Inicia sesión, pulsa el botón con tu correo y elige <b>Mi cuenta</b>.',
         'tu correo, tu estado (Cuenta gratuita, Colaborador o Administrador) y el campo <b>Nombre</b>. '
         'Si no has iniciado sesión, el sitio muestra "Inicia sesión para ver tu cuenta".'),
        ('Para cambiar tu nombre, escríbelo y pulsa <b>Guardar cambios</b>.', '"Guardado."'),
        ('Para cambiar la contraseña, usa el enlace "Restablécela aquí", que lleva a la página de restablecer contraseña (sección 3.5).', None),
        ('<b>Muro de agradecimiento</b> (solo aparece si apoyas cada mes). Escribe el nombre o alias que quieras mostrar, marca la casilla de autorización y pulsa <b>Guardar</b>. '
         'Para quitarlo, pulsa <b>Retirar mi nombre</b>.',
         '"Listo: tu nombre aparecerá en la página Apoya el canal." o "Tu nombre se retiró del muro."'),
        ('<b>Mis pedidos:</b> lista tus compras de la tienda.',
         'el total, el estado, la fecha, los productos y la dirección de envío; o "Todavía no tienes pedidos."'),
    ])
    p(story, 'Las cuentas de administración también ven en esta página un enlace al panel de administración.')

    # 3.10 ───────────────────────────────────────────────────
    story.append(CondPageBreak(180))
    h2(story, '3.10', 'Panel de administración')
    pl(story,
      'El panel es solo para cuentas con rol <b>administrador</b> o <b>moderador</b>. Cualquier otra cuenta que entre a '
      '<font face="Courier">/admin.html</font> verá el aviso "Tu cuenta no tiene permisos de administrador ni de moderador". '
      'El administrador puede usar todas las pestañas; el moderador solo ve <b>Reportes</b> y <b>Agentes</b>.')
    h3(story, 'Cómo entrar')
    pasos(story, [
        ('Inicia sesión con la cuenta de administración. Al iniciar sesión, el sitio te lleva solo al panel.', None),
        ('<b>Verificación en dos pasos.</b> La primera vez, el panel muestra un código QR: escanéalo con tu app de autenticación y escribe el código de 6 dígitos que te muestra. '
         'Las veces siguientes basta con escribir el código de 6 dígitos y pulsar <b>Verificar</b>.',
         '"Verificado. Abriendo el panel..." y luego el panel con sus pestañas.'),
    ])
    h3t(story, 'Pestañas del panel')
    agregar_tabla(story, [
        ['Pestaña', 'Para qué sirve'],
        ['Noticias rápidas', 'Crear, buscar, editar y eliminar noticias. El formulario tiene cinco niveles: <b>Clasificación</b> (idioma en que se escribió y categoría), '
                             '<b>Contenido</b> (título, párrafos —uno por línea— y divulgación de IA), <b>Multimedia</b> (imagen, texto alternativo y pie), '
                             '<b>Asistente IA</b> (autocompleta un borrador a partir de la URL del artículo original, que queda sin publicar) y <b>Fuente</b> (URL y nombre). '
                             'Abajo van la fecha, "Publicado" (desmarcado = borrador visible solo en el panel), "Destacada" y el botón <b>AL AIRE</b> para guardar.'],
        ['Contenidos', 'Crear, buscar, editar y eliminar piezas multi-formato (video, audio, foto, ensayo, noticia, lectura corta) para Noticias, Revolución Humana y Educación. '
                       'La lista se agrupa por sub-sección. Ver el ejemplo paso a paso más abajo.'],
        ['Productos', 'Crear, buscar, editar y eliminar los productos de la tienda: nombre, descripción, precio en USD, imagen y texto alternativo, el Price ID de Stripe para el carrito, '
                      'un enlace de pago opcional y la casilla "Disponible en la tienda" (si se desmarca, el producto queda oculto).'],
        ['Reportes', 'La cola de moderación del debate. Cada reporte indica quién lo hizo (o "detección automática"), el motivo y su estado. '
                     'Acciones: <b>Marcar revisado</b>, <b>Descartar</b> y <b>Eliminar contenido</b> (borra la publicación o el comentario reportado).'],
        ['Agentes', 'Estado real de las defensas del sitio (Turnstile, campo oculto, límite de uso, espera de cuentas nuevas y confirmaciones de edad), '
                    'el uso y el costo de los agentes de IA <b>Investigador</b> y <b>Redactor</b> en el mes, y accesos directos a Contenidos y a Reportes.'],
        ['Gastos (solo administrador)', 'Control de los servicios y suscripciones del proyecto (nombre, estado gratis / gratis por ahora / por uso, costo mensual, renovación, enlace y notas) '
                                        'con el total mensual estimado y el gasto automático de los agentes de IA. También se puede crear, editar y eliminar cada servicio.'],
    ], [105, CONTENT_W - 105])
    p(story,
      'Debajo de los formularios de noticias, contenidos y productos hay un recuadro <b>Traducción</b> para guardar la versión en el otro idioma '
      '(manualmente o con un borrador de IA que se revisa antes de guardar). El botón <b>?</b> abre un manual de ayuda dentro del panel.')

    h3t(story, 'Las cuatro operaciones (crear, consultar, modificar y eliminar)')
    agregar_tabla(story, [
        ['Operación', 'Cómo se hace en el panel', 'Qué debes ver'],
        ['Crear', 'Botón <b>+ Nueva noticia</b>, <b>+ Nuevo contenido</b> o <b>+ Nuevo producto</b>; llenar el formulario y guardar.',
                  'El formulario se cierra y el elemento nuevo aparece en la lista.'],
        ['Consultar', 'Las listas se cargan al abrir cada pestaña; el buscador de arriba filtra por título o nombre.',
                      'Cada elemento con sus etiquetas (Borrador, Destacado, Premium, Oculto) y botones Editar y Eliminar.'],
        ['Modificar', 'Botón <b>Editar</b> en la fila; cambiar lo necesario y guardar.',
                      'El formulario se abre con los datos actuales y, al guardar, la lista refleja el cambio.'],
        ['Eliminar', 'Botón <b>Eliminar</b> en la fila; confirmar en la ventana ("Esta acción no se puede deshacer").',
                     'El elemento desaparece de la lista.'],
    ], [62, 235, CONTENT_W - 62 - 235])

    h3(story, 'Ejemplo: crear un contenido nuevo')
    p(story, 'Supongamos que quieres publicar un ensayo en la sub-sección Nuevos Humanos de Revolución Humana.')
    pasos(story, [
        ('Abre la pestaña <b>Contenidos</b> y pulsa <b>+ Nuevo contenido</b>.',
         'el formulario "Nuevo contenido" con cinco tarjetas de niveles: Clasificación, Contenido, Multimedia, Investigador + Redactor y Citación.'),
        ('<b>Nivel 1, Clasificación.</b> Deja el idioma en Español. En <b>Sección</b> elige <i>Revolución Humana</i>. '
         'En la lista siguiente, que cambia según la sección, elige <i>Nuevos Humanos</i>. '
         'En <b>Región</b> elige, por ejemplo, <i>Puerto Rico</i> (o "Ninguna" para que se vea en todas las regiones). En <b>Tipo de formato</b> elige <i>Ensayo</i>.',
         'la lista de sub-sección con el nombre "Sub-sección de Revolución Humana (opcional)". Si eliges Noticias, la lista pasa a ser las categorías de noticias '
         '(Sub-sección de Noticias); si eliges Educación, los cuatro temas de Educación, y en esos dos casos es obligatoria.'),
        ('<b>Nivel 2, Contenido.</b> Escribe el <b>Título</b> (3 a 160 caracteres), el <b>Resumen</b> (2 o 3 oraciones, mínimo 10 caracteres), '
         'el <b>Cuerpo del texto</b> (opcional) y, si quieres, el autor. El botón <b>Revisar texto</b> sugiere correcciones de ortografía. '
         'En <b>Divulgación de uso de IA</b> indica si se usó inteligencia artificial.', None),
        ('<b>Nivel 3, Multimedia.</b> Escribe la ruta o URL de la <b>Imagen de portada</b> (obligatoria) y su texto alternativo, o usa "Elegir imagen de la galería" '
         'o "Usar imagen de la categoría seleccionada". Si el tipo es Video o Audio, pega también el enlace del video o audio.',
         'una vista previa de la imagen.'),
        ('<i>Opcional.</i> <b>Nivel 4, Investigador + Redactor.</b> Pega la URL de una fuente (o un texto) y pulsa <b>Investigar</b>; luego <b>Redactar con IA</b>. '
         'El resultado rellena Título, Resumen y Cuerpo para que lo revises antes de guardar; nunca se publica solo. Cada uso tiene un costo pequeño que se registra en la pestaña Gastos.', None),
        ('<b>Nivel 5, Citación.</b> Escribe el nombre y la URL de la fuente y elige el estilo de citación (APA, MLA, etc.), '
         'o marca "Sin fuente externa / contenido 100% original".',
         'una vista previa de la cita.'),
        ('En la barra inferior escribe la <b>Fecha</b> y la <b>Duración</b> en minutos. Marca <b>Destacado</b> (reemplaza al destacado anterior de esa sección) o '
         '<b>Premium</b> (los visitantes sin apoyo mensual ven solo un adelanto) si corresponde. Pulsa <b>GUARDAR</b>.',
         'el formulario se cierra y la pieza aparece en la lista, dentro del grupo "Nuevos Humanos". Si falta un campo obligatorio, el navegador lo señala.'),
        ('Comprueba el resultado: en el sitio público abre <b>Revolución Humana</b>, Nuevos Humanos, con la región elegida.',
         'la tarjeta de la nueva pieza. Para quitarla, vuelve al panel y usa <b>Eliminar</b>.'),
    ])
    for ruta in capturas_admin:
        figura(story, os.path.basename(ruta), 'Panel de administración', recorte=None)


def seccion_faq(story):
    story.append(CondPageBreak(120))
    h1(story, 4, 'Preguntas frecuentes y solución de problemas')

    h3(story, 'La página tarda mucho en cargar o dice "Cargando…"')
    pl(story,
      'El servidor gratuito se duerme cuando pasa un rato sin visitas y puede tardar hasta unos 50 segundos en despertar la primera vez. '
      'Espera un momento y no recargues varias veces seguidas. Si después de un par de minutos sigue igual, revisa tu conexión a internet '
      f'o escríbenos a <font face="Courier">{CORREO}</font>.')

    h3(story, 'No me llega el correo de confirmación')
    bullets(story, [
        'Espera unos minutos y revisa la carpeta de <b>spam</b> o de promociones.',
        'Confirma que escribiste bien el correo al registrarte.',
        'Si el sitio dice "Pediste demasiados correos seguidos", espera unos minutos antes de pedir otro.',
        'Si dice "Ya existe una cuenta con ese correo", ya te registraste: inicia sesión o usa "¿Olvidaste tu contraseña?".',
        'Si al iniciar sesión dice "Todavía no confirmas tu correo", abre el correo de confirmación y pulsa su enlace.',
    ])

    h3(story, 'Olvidé mi contraseña')
    pl(story,
      'Sigue los pasos de "Recuperar la contraseña" en la sección 3.5. Si al abrir el enlace ves "Este enlace no es válido o ya expiró", '
      'pide uno nuevo desde "¿Olvidaste tu contraseña?". Si el sitio dice que la contraseña "aparece en filtraciones de datos conocidas", '
      'elige una distinta: debe tener al menos 8 caracteres.')

    h3t(story, 'No puedo escribir en el debate')
    agregar_tabla(story, [
        ['Lo que ves', 'Qué significa y qué hacer'],
        ['"Inicia sesión para participar en el debate"', 'Para escribir hace falta una cuenta: inicia sesión o crea una.'],
        ['"Tu cuenta debe tener al menos 1 hora de creada…"', 'Es una protección contra robots: espera una hora desde que creaste la cuenta.'],
        ['"Debes confirmar que eres mayor de 18 años…"', 'Estás en Corrupción Humana o Ilógica Humana: marca la casilla de confirmación de edad.'],
        ['"El mensaje no puede superar 200 palabras"', 'Acorta el texto. Quien apoya cada mes puede escribir hasta 1000 palabras.'],
        ['"Completa la verificación antes de publicar"', 'Espera a que termine la verificación de Cloudflare (pasa a marca de verificado) y vuelve a pulsar Publicar.'],
        ['"Demasiadas publicaciones en poco tiempo"', 'Hay un máximo de 20 envíos cada 15 minutos: espera unos minutos.'],
    ], [190, CONTENT_W - 190])

    h3(story, 'No puedo pagar o el pago de prueba no funciona')
    bullets(story, [
        'Para comprar en la tienda y para el apoyo mensual hay que <b>iniciar sesión</b>. Sin sesión, el carrito avisa "Inicia sesión para completar tu compra".',
        'Usa solo la tarjeta de prueba <font face="Courier">4242 4242 4242 4242</font>, cualquier fecha futura y cualquier CVC de 3 dígitos. '
        'Como Stripe está en modo de prueba, una tarjeta real no se acepta y no se cobra nada.',
        'El carrito se vacía si recargas o cambias de página: vuelve a añadir los productos y paga sin salir de la misma página.',
        'Tus compras aparecen en <b>Mi cuenta</b>, sección <b>Mis pedidos</b>. Si acabas de pagar, el estado puede pasar de "Pendiente" a "Pagada" '
        'después de unos instantes: recarga la página.',
        'Si algo falla de forma repetida, escríbenos con el motivo "Reportar un error" desde Quiénes somos.',
    ])

    h3(story, 'Otras dudas')
    bullets(story, [
        '<b>Mi sesión se cerró sola.</b> Por seguridad, se cierra tras 30 minutos sin actividad. Vuelve a iniciar sesión.',
        '<b>Veo el sitio en inglés (o en español) y quiero cambiarlo.</b> Usa el botón ES / EN del encabezado.',
        '<b>No veo Corrupción Humana ni Ilógica Humana en Noticias.</b> Son secciones 18+: aparecen en el collage cuando confirmas la edad (sección 3.3).',
        '<b>Una pieza muestra solo un adelanto.</b> Es contenido marcado como premium: se ve completo con el apoyo mensual.',
        '<b>Una pieza dice "Solo en español".</b> Todavía no tiene versión en inglés; se muestra en español.',
    ])


def seccion_privacidad(story):
    story.append(CondPageBreak(120))
    h1(story, 5, 'Privacidad y seguridad')
    pl(story,
      'Resumen en lenguaje simple. El detalle completo está en la '
      f'<b>Política de Privacidad</b> (<font face="Courier">{SITIO}/privacidad.html</font>) y en los '
      f'<b>Términos de uso</b> (<font face="Courier">{SITIO}/terminos.html</font>), enlazados en el pie de cada página.')
    h3t(story, 'Qué datos se piden y quién los maneja')
    agregar_tabla(story, [
        ['Cuándo', 'Qué se pide', 'Quién lo maneja'],
        ['Crear una cuenta', 'Correo, contraseña (se guarda cifrada) y fecha de nacimiento', 'Supabase'],
        ['Escribir desde "Quiénes somos"', 'Nombre, correo y mensaje', 'Formspree'],
        ['Suscribirte al boletín', 'Correo', 'beehiiv'],
        ['Pagar en la tienda o apoyar', 'Datos de tarjeta, dirección y correo', 'Stripe (el sitio no los ve ni los guarda)'],
        ['Visitar el sitio', 'Páginas visitadas, dispositivo y ubicación aproximada (estadísticas agregadas)', 'Google Analytics 4'],
    ], [135, CONTENT_W - 135 - 125, 125])
    bullets(story, [
        '<b>Los pagos no pasan por el sitio.</b> Nunca se te piden datos de tu tarjeta en sabiasquepr.com: los escribes en la página de Stripe, '
        'y el sitio solo guarda tu correo, el identificador de cliente de Stripe y si tu apoyo mensual está activo o cancelado.',
        '<b>No se venden tus datos.</b> Solo se comparten con los servicios de la tabla, para lo que cada uno hace.',
        '<b>Protecciones.</b> Verificación de Cloudflare Turnstile en el inicio de sesión y el debate, límites de uso contra abusos, '
        'cierre de sesión tras 30 minutos de inactividad, rechazo de contraseñas que han aparecido en filtraciones y verificación en dos pasos '
        'obligatoria para el panel de administración.',
        '<b>Lo que escribes en un debate o comentario es público</b> y se muestra con el correo de tu cuenta.',
        '<b>Tus derechos.</b> Puedes pedir acceso, corrección o eliminación de tus datos, y darte de baja del boletín en cualquier momento. '
        f'Escribe a <font face="Courier">{CORREO}</font>.',
        '<b>Recomendación.</b> No compartas tu contraseña ni el código de tu app de autenticación con nadie.',
    ])
    figura(story, 'privacidad-escritorio.png',
           'Política de Privacidad del sitio (privacidad.html): qué datos se recopilan, para qué se usan y cuáles son tus derechos.',
           recorte=(0, 0, 1280, 700), ancho=400)
    p(story, f'<font color="#51606E">Este manual describe la versión del sitio publicada en {SITIO.replace("https://", "")} '
             f'al {fecha_en_letras()}.</font>')


# ── ENSAMBLAJE ──────────────────────────────────────────────
def build():
    est = datos_estudiante()
    capturas_admin = sorted(glob.glob(os.path.join(CAPTURAS_DIR, 'admin-*.png')))

    doc = ManualDoc(OUT_PATH, pagesize=letter,
                    leftMargin=MARGIN, rightMargin=MARGIN, topMargin=64, bottomMargin=58,
                    title='Sabías que PR — Manual de usuario', author=est['nombre'],
                    subject='COMP2053 — Desarrollo Web Full-Stack, UIPR Recinto de Fajardo')
    story = []
    build_portada(story)
    seccion_indice(story)
    seccion_descripcion(story)
    seccion_requisitos(story)
    seccion_guia(story, capturas_admin)
    seccion_faq(story)
    seccion_privacidad(story)
    doc.multiBuild(story, onFirstPage=draw_footer, onLaterPages=draw_footer)
    print(f'PDF generado: {OUT_PATH}  ({_fig["n"]} figuras, {len(capturas_admin)} capturas de admin)')


if __name__ == '__main__':
    build()
