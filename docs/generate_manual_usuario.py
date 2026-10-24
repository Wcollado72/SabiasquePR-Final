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
    story.append(Paragraph('Descripción · Requisitos · Guía de uso · Capturas', styles['DocSub']))
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


# ── CONTENIDO (versión compacta para la entrega: solo lo que pide la rúbrica) ──────────────────
def buscar_captura(base):
    """Devuelve el nombre del archivo de captura (png, jpg o jpeg) o None si todavía no existe."""
    for ext in ('.png', '.jpg', '.jpeg', '.webp'):
        if os.path.exists(os.path.join(CAPTURAS_DIR, base + ext)):
            return base + ext
    return None


def figura_si(story, base, pie, ancho=CONTENT_W, recorte=None):
    arch = buscar_captura(base)
    if arch:
        figura(story, arch, pie, recorte=recorte, ancho=ancho)
        return True
    return False


def fila_si(story, bases_pies, pie, ancho=236):
    """Dos capturas lado a lado con un solo pie; si falta alguna, se omite la fila."""
    items = []
    for base in bases_pies:
        arch = buscar_captura(base)
        if not arch:
            return False
        items.append((arch, None, ancho))
    figura_fila(story, items, pie)
    return True


def seccion_descripcion(story):
    h1(story, 1, 'Descripción del sistema')
    p(story,
      '<b>Sabías que PR</b> es un sitio web informativo y comunitario creado en Puerto Rico: reúne noticias con contexto, '
      'contenido educativo, un espacio de debate moderado, una tienda y un apoyo voluntario. '
      f'Está publicado en <font face="Courier">{SITIO.replace("https://", "")}</font> y funciona en computadora, tableta y celular, '
      'en español o inglés y en modo claro u oscuro. <b>Todo el contenido se puede leer gratis</b>, con cuenta o sin ella.')
    agregar_tabla(story, [
        ['Tipo de visita', 'Qué puede hacer'],
        ['Sin cuenta', 'Leer todo, filtrar por categoría y región, cambiar idioma y modo, suscribirse al boletín y escribir por el formulario de contacto.'],
        ['Con cuenta gratuita', 'Lo anterior, más publicar y comentar en los debates (<b>crear, ver, editar y borrar sus propias publicaciones</b>) y reportar contenido.'],
        ['Administrador', 'Gestiona noticias, contenidos, productos y reportes desde el panel de administración (CRUD completo). Exige verificación en dos pasos.'],
    ], [105, CONTENT_W - 105])


def seccion_requisitos(story):
    h1(story, 2, 'Requisitos')
    agregar_tabla(story, [
        ['Requisito', 'Detalle'],
        ['Dispositivo y navegador', 'Computadora, tableta o celular con una versión reciente de Chrome, Edge, Firefox o Safari. JavaScript activado (lo está por defecto).'],
        ['Dirección', f'<font face="Courier">{SITIO}</font>. No hay que instalar nada.'],
        ['Cuenta de evaluación', 'Una cuenta de usuario para probar el inicio de sesión y el CRUD del debate. El estudiante entrega el correo y la contraseña por separado.'],
        ['Panel de administración', 'Se muestra en el video y en las capturas de la sección 3.6: exige una app de autenticación en el celular.'],
    ], [135, CONTENT_W - 135])
    nota(story, 'La primera visita puede tardar.',
         'El servidor usa un plan gratuito que se «duerme» si nadie lo usa: la primera carga de noticias, debate o tienda puede '
         'tardar <b>hasta unos 50 segundos</b>. Es normal; espera y no recargues varias veces.', 'aviso')


def seccion_guia(story, capturas_admin):
    story.append(CondPageBreak(220))
    h1(story, 3, 'Guía de uso')

    h2(story, '3.1', 'Navegar el sitio')
    p(story, 'La cabecera tiene el logo, el selector <b>ES / EN</b>, el modo claro/oscuro, el carrito y el botón de sesión; en pantallas '
             'pequeñas el menú (tres líneas) abre la lista de secciones: Noticias, Revolución Humana, Educación, Tienda, Apoya el canal y Quiénes somos.')
    items = [('inicio-escritorio.png', None, 300), ('inicio-movil.png', None, 118)]
    figura_fila(story, items, 'Inicio en computadora (izquierda) y en celular (derecha).')
    if not fila_si(story, ['C1-iphone-inicio', 'C2-iphone-menu'], 'Inicio y menú abierto en un iPhone.', ancho=140):
        pass

    h2(story, '3.2', 'Noticias, Revolución Humana y Educación')
    p(story, 'Cada sección muestra piezas (noticias, videos, ensayos, audios) que se filtran por categoría y por región. Al tocar una pieza se abre '
             'su página, con la fuente, la divulgación del uso de IA y los comentarios.')
    figura(story, 'noticias-escritorio.png', 'Noticias, con filtros por categoría y región.', ancho=330)

    h2(story, '3.3', 'Crear una cuenta e iniciar sesión')
    pasos(story, [
        ('Toca <b>Iniciar sesión</b> en la cabecera y elige <b>Crear cuenta</b>.', 'Una ventana con correo, contraseña y fecha de nacimiento.'),
        ('Completa los datos, marca la casilla anti-robots y pulsa el botón.', 'Un aviso de que se envió un enlace de confirmación a tu correo.'),
        ('Abre el enlace del correo y vuelve a iniciar sesión.', 'Tu correo aparece en el botón de la cabecera.'),
    ])
    figura_fila(story, [('inicio-sesion-modal.png', None, 236), ('registro-modal.png', None, 236)], 'Inicio de sesión (izquierda) y creación de cuenta (derecha).')
    figura_si(story, 'A1-registro-ok', 'Sesión iniciada: el correo aparece en la cabecera.', ancho=330)

    h2(story, '3.4', 'Debate: crear, editar y borrar publicaciones (CRUD de usuario)')
    p(story, 'Con la sesión iniciada, en el debate de Revolución Humana o Educación puedes hacer las cuatro operaciones sobre tus publicaciones '
             'y comentar en las de otras personas (máximo 200 palabras; el apoyo mensual sube el límite a 1000).')
    pasos(story, [
        ('<b>Crear:</b> escribe título y texto y pulsa <b>Publicar</b>.', 'Tu publicación aparece al inicio de la lista.'),
        ('<b>Leer:</b> abre la publicación y sus comentarios.', 'El texto completo y la lista de comentarios.'),
        ('<b>Editar:</b> en tu publicación pulsa <b>Editar</b>, cambia el texto y guarda.', 'El texto actualizado, marcado como editado.'),
        ('<b>Borrar:</b> pulsa <b>Eliminar</b> y confirma.', 'La publicación desaparece de la lista.'),
    ])
    a = fila_si(story, ['A2-foro-crear', 'A3-foro-publicada'], 'Crear una publicación (izquierda) y verla publicada (derecha).')
    b = fila_si(story, ['A4-foro-editar', 'A5-foro-borrada'], 'Editarla (izquierda) y borrarla (derecha).')

    h2(story, '3.5', 'Tienda, apoyo voluntario y Mi cuenta')
    p(story, 'La <b>Tienda</b> tiene carrito y pago con Stripe; <b>Apoya el canal</b> permite un apoyo voluntario mensual o único. Ambos funcionan en '
             '<b>modo de prueba</b> (tarjeta <font face="Courier">4242 4242 4242 4242</font>, cualquier fecha futura y cualquier CVC): no se cobra dinero real. '
             '<b>Mi cuenta</b> muestra tu perfil y tus pedidos.')
    figura_fila(story, [('tienda-escritorio.png', None, 236), ('apoyo-escritorio.png', None, 236)], 'Tienda (izquierda) y Apoya el canal (derecha).')

    h2(story, '3.6', 'Panel de administración (CRUD completo)')
    p(story, 'Solo el rol <b>administrador</b> ve el panel. Al entrar pide un código de 6 dígitos de la app de autenticación (verificación en dos pasos); '
             'sin él, la API responde 403. Cada pestaña (Noticias rápidas, Contenidos, Productos, Reportes) tiene su lista y su formulario.')
    pasos(story, [
        ('<b>Crear:</b> en <b>Noticias rápidas</b> pulsa <b>+ Nueva noticia</b>, llena el formulario y guarda. Si dejas campos obligatorios vacíos, el formulario muestra el error.', 'La noticia aparece en la lista y en la página pública.'),
        ('<b>Editar:</b> pulsa <b>Editar</b> en la lista, cambia el título y guarda.', 'El título nuevo en la lista y en la página pública.'),
        ('<b>Borrar:</b> pulsa <b>Eliminar</b> y confirma.', 'La noticia desaparece de las dos.'),
    ])
    figura_si(story, 'B1-panel-2fa', 'Verificación en dos pasos al entrar al panel.', ancho=300)
    fila_si(story, ['B2-noticias-lista', 'B3-noticia-validacion'], 'Lista de noticias (izquierda) y validación del formulario (derecha).')
    fila_si(story, ['B4-noticia-creada', 'B5-noticia-publica'], 'Noticia creada (izquierda) y la misma noticia en la página pública (derecha).')
    fila_si(story, ['B6-noticia-editada', 'B7-noticia-borrar'], 'Noticia editada (izquierda) y confirmación de borrado (derecha).')
    fila_si(story, ['B8-contenidos', 'B9-productos'], 'Las pestañas Contenidos (izquierda) y Productos (derecha) tienen el mismo CRUD.')


def seccion_faq(story):
    story.append(CondPageBreak(120))
    h1(story, 4, 'Problemas frecuentes y privacidad')
    agregar_tabla(story, [
        ['Problema', 'Qué hacer'],
        ['La página tarda mucho en cargar la primera vez', 'Espera hasta 50 segundos: el servidor gratuito se está despertando.'],
        ['No llega el correo de confirmación', 'Revisa la carpeta de spam y espera unos minutos; si no llega, intenta crear la cuenta de nuevo.'],
        ['Olvidé mi contraseña', 'En el inicio de sesión elige <b>¿Olvidaste tu contraseña?</b> y sigue el enlace que llega al correo.'],
        ['Pide un código de 6 dígitos', 'Es la verificación en dos pasos del panel de administración; el código sale de la app de autenticación.'],
        ['Algo no se ve bien en mi teléfono', f'Actualiza el navegador y escribe a <font face="Courier">{CORREO}</font> con el modelo del teléfono.'],
    ], [160, CONTENT_W - 160])
    p(story, '<b>Privacidad y seguridad.</b> Las contraseñas las gestiona el servicio de autenticación (nunca se guardan en el sitio); la API valida el '
             'token de sesión en cada ruta protegida y las secciones para adultos piden confirmar la edad. No se guardan datos de tarjeta: los pagos '
             'los procesa Stripe. Más detalle en las páginas de Privacidad y Términos del sitio.')


def seccion_privacidad(story):
    return


def build():
    est = datos_estudiante()
    capturas_admin = sorted(glob.glob(os.path.join(CAPTURAS_DIR, 'admin-*.png')))

    doc = ManualDoc(OUT_PATH, pagesize=letter,
                    leftMargin=MARGIN, rightMargin=MARGIN, topMargin=64, bottomMargin=58,
                    title='Sabías que PR — Manual de usuario', author=est['nombre'],
                    subject='COMP2053 — Desarrollo Web Full-Stack, UIPR Recinto de Fajardo')
    story = []
    build_portada(story)
    seccion_descripcion(story)
    seccion_requisitos(story)
    seccion_guia(story, capturas_admin)
    seccion_faq(story)
    doc.multiBuild(story, onFirstPage=draw_footer, onLaterPages=draw_footer)
    print(f'PDF generado: {OUT_PATH}  ({_fig["n"]} figuras, {len(capturas_admin)} capturas de admin)')


if __name__ == '__main__':
    build()
