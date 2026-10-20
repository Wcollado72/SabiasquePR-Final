# -*- coding: utf-8 -*-
"""
Genera docs/entrega/Documento-Final-SabiasquePR.pdf: el documento PDF de la entrega final de COMP2053.
Secciones que exige la rubrica oficial: portada, introduccion, objetivos, justificacion, tecnologias,
arquitectura, diseno de la base de datos, capturas, evidencias de pruebas, conclusiones y referencias.
Reusa estilos y diagramas de generate_planificacion_bd.py. Las cifras salen de archivos reales:
docs/entrega/estructura-bd.json (base de datos), docs/entrega/documentacion-tecnica.md (endpoints) y
docs/entrega/evidencia-pruebas.json (pruebas y cobertura).
Uso (desde la raiz del repo): python docs/generate_documento_final.py
"""
import json
import os
import re
import sys

DOCS_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, DOCS_DIR)
import generate_planificacion_bd as P  # noqa: E402
from reportlab.lib.pagesizes import letter  # noqa: E402
from reportlab.lib.styles import ParagraphStyle  # noqa: E402
from reportlab.lib.enums import TA_LEFT  # noqa: E402
from reportlab.platypus import (  # noqa: E402
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, Image, KeepTogether, CondPageBreak,
)

ENTREGA = os.path.join(DOCS_DIR, 'entrega')
OUT_PATH = os.path.join(ENTREGA, 'Documento-Final-SabiasquePR.pdf')
CAPTURAS = os.path.join(ENTREGA, 'capturas')
EVIDENCIA_JSON = os.path.join(ENTREGA, 'evidencia-pruebas.json')
DOC_TECNICA = os.path.join(ENTREGA, 'documentacion-tecnica.md')

styles, CONTENT_W, MARGIN = P.styles, P.CONTENT_W, P.MARGIN
Ref = ParagraphStyle('Ref', parent=styles['Body'], leftIndent=28, firstLineIndent=-28, alignment=TA_LEFT, spaceAfter=7)

_fig = {'n': 0}


def figura(story, archivo, pie, ancho=430, alto_max=330):
    """Inserta una captura de docs/entrega/capturas con su pie numerado, sin deformarla."""
    ruta = os.path.join(CAPTURAS, archivo)
    if not os.path.exists(ruta):
        raise SystemExit(f'Falta la captura {ruta}')
    from PIL import Image as PILImage
    w, h = PILImage.open(ruta).size
    escala = min(ancho / w, alto_max / h)
    _fig['n'] += 1
    story.append(KeepTogether([
        Image(ruta, width=w * escala, height=h * escala, hAlign='CENTER'),
        Paragraph(f'Figura {_fig["n"]}. {pie}', styles['Caption']),
    ]))


def cargar_endpoints():
    filas = []
    with open(DOC_TECNICA, encoding='utf-8') as f:
        for linea in f:
            m = re.match(r'\| (GET|POST|PUT|PATCH|DELETE) \| `([^`]+)` \| ([^|]+) \| (\w+)\.js \|', linea)
            if m:
                filas.append((m.group(1), m.group(2), m.group(3).strip(), m.group(4)))
    return filas


def matriz_crud(endpoints):
    modulos = {}
    for metodo, ruta, acceso, modulo in endpoints:
        modulos.setdefault(modulo, {'m': set(), 'a': set()})
        modulos[modulo]['m'].add(metodo)
        modulos[modulo]['a'].add(acceso)
    filas = [['Recurso (módulo)', 'Crear', 'Consultar', 'Modificar', 'Eliminar', 'Acceso']]
    for mod, d in sorted(modulos.items()):
        m = d['m']
        filas.append([mod, 'POST' if 'POST' in m else '—', 'GET' if 'GET' in m else '—',
                      '/'.join(x for x in ('PUT', 'PATCH') if x in m) or '—',
                      'DELETE' if 'DELETE' in m else '—', ', '.join(sorted(d['a']))])
    return filas


def footer(c, doc):
    if doc.page == 1:
        return
    c.saveState()
    c.setStrokeColor(P.LINE)
    c.setLineWidth(0.5)
    c.line(MARGIN, 44, P.PAGE_W - MARGIN, 44)
    c.setFont('Helvetica', 7.5)
    c.setFillColor(P.INK_SOFT)
    c.drawString(MARGIN, 32, 'Sabías que PR — Documento final del proyecto')
    c.drawRightString(P.PAGE_W - MARGIN, 32, f'Página {doc.page}')
    c.restoreState()


def portada(story):
    est = P.datos_estudiante()
    story.append(Spacer(1, 90))
    story.append(Paragraph('UNIVERSIDAD INTERAMERICANA DE PUERTO RICO · RECINTO DE FAJARDO', styles['Eyebrow']))
    story.append(Spacer(1, 40))
    story.append(Paragraph('PROYECTO FINAL · DESARROLLO WEB FULL-STACK', styles['Eyebrow']))
    story.append(Paragraph('Sabías que PR', ParagraphStyle('CT', parent=styles['DocTitle'], fontSize=32, leading=36)))
    story.append(Paragraph('Documento final del proyecto', ParagraphStyle('CS', parent=styles['DocSub'], fontSize=14, leading=19, textColor=P.ACCENT_DARK)))
    story.append(Spacer(1, 10))
    story.append(Paragraph('Aplicación web full-stack de noticias, educación y debate comunitario', styles['DocSub']))
    story.append(Spacer(1, 140))
    meta = [['Estudiante', est['nombre']]]
    if est.get('numero'):
        meta.append(['Número de estudiante', est['numero']])
    meta += [['Curso', 'COMP2053 — Desarrollo Web Full-Stack'], ['Profesora', 'Milagros Donato Cintrón'],
             ['Institución', 'Universidad Interamericana de Puerto Rico, Recinto de Fajardo'],
             ['Sitio en línea', 'https://sabiasquepr.com'], ['Repositorio', 'github.com/Wcollado72/SabiasquePR'],
             ['Fecha', P.fecha_en_letras()]]
    data = [[Paragraph(f'<font color="#51606E">{k}</font>', styles['Body']), Paragraph(v, styles['Body'])] for k, v in meta]
    t = Table(data, colWidths=[130, CONTENT_W - 130], hAlign='LEFT')
    t.setStyle(TableStyle([('TOPPADDING', (0, 0), (-1, -1), 3), ('BOTTOMPADDING', (0, 0), (-1, -1), 3), ('LEFTPADDING', (0, 0), (-1, -1), 0)]))
    story.append(t)
    story.append(PageBreak())


def cargar_evidencia():
    if not os.path.exists(EVIDENCIA_JSON):
        raise SystemExit('Falta docs/entrega/evidencia-pruebas.json: genere primero la evidencia de pruebas '
                         '(python docs/generate_evidencia_pruebas.py).')
    with open(EVIDENCIA_JSON, encoding='utf-8') as f:
        return json.load(f)


def build():
    estructura = P.cargar_estructura()
    por_tabla = P.tablas_del_diccionario(estructura)
    n_tablas = len(por_tabla)
    n_pk = sum(1 for r in estructura['restricciones'] if r['tipo'] == 'p')
    n_fk = sum(1 for r in estructura['restricciones'] if r['tipo'] == 'f')
    n_check = sum(1 for r in estructura['restricciones'] if r['tipo'] == 'c')
    endpoints = cargar_endpoints()
    ev = cargar_evidencia()
    est = P.datos_estudiante()
    h1, bullets = P.h1, P.bullets

    doc = SimpleDocTemplate(OUT_PATH, pagesize=letter, leftMargin=MARGIN, rightMargin=MARGIN,
                            topMargin=64, bottomMargin=58, title='Sabías que PR — Documento final del proyecto',
                            author=est['nombre'])
    story = []
    portada(story)

    # 1. Introducción
    h1(story, 1, 'Introducción')
    story.append(Paragraph(
        '<b>Sabías que PR</b> es una plataforma web nacida en Puerto Rico que reúne noticias con contexto, '
        'contenido educativo y espacios de debate comunitario, con una misión sin fronteras: ayudar a cualquier '
        'persona a entender su entorno. Es, al mismo tiempo, un producto real en construcción —que se lanzará '
        'públicamente cuando tenga suficiente contenido— y el proyecto final del curso '
        '<b>COMP2053 Desarrollo Web Full-Stack</b>.', styles['Body']))
    story.append(Paragraph(
        'Este documento presenta el proyecto de principio a fin: los objetivos y la justificación, las '
        'tecnologías elegidas, la arquitectura, el diseño de la base de datos, capturas del sistema '
        'funcionando en línea, la evidencia de pruebas y las conclusiones. Acompañan a este documento el '
        'repositorio con las carpetas <font face="Courier">/frontend</font> y <font face="Courier">/backend</font>, el '
        'manual de usuario, la documentación técnica, el video demostrativo y la aplicación desplegada '
        'en <font face="Courier">sabiasquepr.com</font>.', styles['Body']))

    # 2. Objetivos
    h1(story, 2, 'Objetivos')
    story.append(Paragraph('Objetivo general', styles['H2']))
    story.append(Paragraph(
        'Diseñar, desarrollar, probar y desplegar una aplicación web full-stack funcional que integre un '
        'frontend responsivo, una API REST propia con operaciones CRUD completas, una base de datos relacional '
        'persistente y un sistema de autenticación con JWT verificado en el servidor.', styles['Body']))
    story.append(Paragraph('Objetivos específicos', styles['H2']))
    bullets(story, [
        'Construir una API REST organizada por rutas, con validación centralizada de datos, manejo de errores y rutas protegidas por rol.',
        f'Diseñar una base de datos PostgreSQL normalizada de {n_tablas} tablas, con llaves primarias y foráneas, restricciones y seguridad por fila.',
        'Implementar registro, inicio de sesión y verificación en dos pasos, validando cada JWT en el servidor.',
        'Desarrollar un frontend responsivo, accesible y bilingüe que consuma la API y ofrezca una buena experiencia de usuario.',
        'Verificar el sistema con pruebas automáticas, integración continua y pruebas en distintos navegadores y dispositivos, y publicarlo en línea.',
    ])

    # 3. Justificación
    h1(story, 3, 'Justificación')
    story.append(Paragraph(
        'Un proyecto final full-stack evalúa que se construyan y se controlen las tres capas de una aplicación '
        'real: un backend propio, una base de datos con esquema propio y un frontend que consuma esa API, no solo '
        'enlaces a servicios externos. El sitio responde además a una necesidad concreta: un espacio en español, '
        'desde Puerto Rico, donde las noticias vienen con contexto y la comunidad puede debatir con respeto y '
        'moderación.', styles['Body']))
    story.append(Paragraph(
        'El debate, la gestión de contenidos y la tienda sirven de eje del CRUD, el criterio de mayor peso de la '
        'rúbrica (30 %). Las decisiones de diseño —todo el contenido es gratis, el apoyo es voluntario, las '
        'secciones para adultos tienen verificación de edad y la protección de menores es prioridad— reflejan '
        'que el proyecto está pensado para operar como un servicio real y no solo para aprobar un curso.', styles['Body']))

    # 4. Tecnologías
    h1(story, 4, 'Tecnologías utilizadas')
    story.append(P.tabla_simple([
        ['Capa', 'Tecnología', 'Uso en el proyecto'],
        ['Frontend', 'HTML5, CSS3, JavaScript (sin framework)', 'Sitio responsivo generado por un script de plantillas (build.js), PWA con service worker, modo claro/oscuro, bilingüe ES/EN'],
        ['Backend', 'Node.js 22 + Express 5', f'API REST propia con {len(endpoints)} endpoints, validadores, middleware de autenticación y errores centralizados'],
        ['Base de datos', 'PostgreSQL (Supabase)', f'{n_tablas} tablas relacionales con Row Level Security activo'],
        ['Autenticación', 'Supabase Auth + jose (JWKS, ES256)', 'Registro, inicio de sesión, Google y 2FA; el servidor verifica cada JWT'],
        ['Pagos', 'Stripe', 'Tienda y apoyo voluntario con webhook firmado (modo de prueba)'],
        ['Servicios', 'Resend, Cloudflare Turnstile, Beehiiv, Formspree, API de Claude', 'Correos de autenticación, anti-robots, boletín, contacto y agentes de IA del panel'],
        ['Calidad', 'Jest + Supertest, ESLint', f'{ev["pruebas"]["total"]} pruebas automáticas y revisión de estilo en cada cambio'],
        ['Control de versiones y CI', 'Git, GitHub, GitHub Actions', 'Ramas y pull requests; flujos de pruebas, auditoría de dependencias y secretos, respaldo diario cifrado'],
        ['Despliegue', 'Netlify + Render + Supabase', 'Frontend estático con dominio propio, API y base de datos en servicios gestionados'],
    ], [88, 150, CONTENT_W - 88 - 150]))

    # 5. Arquitectura
    story.append(CondPageBreak(430))
    h1(story, 5, 'Arquitectura del sistema')
    story.append(Paragraph(
        'El sistema sigue una arquitectura de tres capas. El navegador carga el frontend estático y se '
        'autentica directamente con Supabase Auth, que le entrega un JWT firmado. El frontend consume la API '
        'REST propia enviando ese JWT en el encabezado <font face="Courier">Authorization: Bearer</font>; el '
        'backend lo valida contra las llaves públicas del proyecto (JWKS) y solo entonces consulta PostgreSQL con '
        'una conexión directa. La API de datos de Supabase permanece cerrada.', styles['Body']))
    story.append(P.diagrama_arquitectura())
    _fig['n'] += 1
    story.append(Paragraph(f'Figura {_fig["n"]}. Arquitectura de tres capas con Supabase Auth como servicio de identidad compartido.', styles['Caption']))
    story.append(CondPageBreak(420))
    story.append(Paragraph('Navegación del sitio', styles['H2']))
    story.append(P.diagrama_navegacion())
    _fig['n'] += 1
    story.append(Paragraph(f'Figura {_fig["n"]}. Mapa de navegación: páginas públicas, área con sesión y área restringida por rol.', styles['Caption']))

    story.append(Paragraph('Funcionalidad CRUD y rutas protegidas', styles['H2']))
    story.append(Paragraph(
        f'La API expone <b>{len(endpoints)} endpoints</b>. Cada recurso implementa las operaciones que le '
        'corresponden: noticias, contenidos, productos y publicaciones del debate tienen CRUD completo. Las '
        'rutas de escritura exigen un JWT válido (401 si falta o es inválido) y el rol necesario (403 si no lo '
        'tiene). La siguiente matriz se genera a partir del código de las rutas.', styles['Body']))
    filas = matriz_crud(endpoints)
    story.append(P.tabla_simple(filas, [110, 52, 62, 66, 56, CONTENT_W - 110 - 52 - 62 - 66 - 56]))
    story.append(Paragraph(
        '<i>Acceso:</i> Público = sin sesión; Opcional = con o sin sesión; Sesión = JWT válido; '
        'Moderador/Admin y Admin = además exigen ese rol.', styles['BodySmall']))

    # 6. Diseño de la base de datos
    story.append(PageBreak())
    h1(story, 6, 'Diseño de la base de datos')
    story.append(Paragraph(
        f'La base de datos tiene <b>{n_tablas} tablas</b>, {n_pk} llaves primarias, <b>{n_fk} llaves foráneas</b> y '
        f'{n_check} restricciones CHECK, normalizadas a Tercera Forma Normal, con Row Level Security activo. '
        '<font face="Courier">perfiles</font> extiende la identidad de Supabase Auth y es el origen de las '
        'relaciones de autoría. El diccionario de datos completo, el esquema relacional y el script de creación '
        'están en el documento de Planificación y Diseño de la Base de Datos que acompaña la entrega.', styles['Body']))
    d = P.diagrama_mer()
    story.append(d)
    _fig['n'] += 1
    story.append(Paragraph(f'Figura {_fig["n"]}. Modelo Entidad-Relación de las {n_tablas} tablas propias.', styles['Caption']))
    story.append(P.tabla_simple(
        [['Tabla', 'Propósito']] + [[t, P.PROPOSITO[t]] for t in por_tabla],
        [100, CONTENT_W - 100]))

    # 7. Capturas
    story.append(PageBreak())
    h1(story, 7, 'Capturas del sistema en funcionamiento')
    story.append(Paragraph(
        'Capturas tomadas en la aplicación desplegada (<font face="Courier">https://sabiasquepr.com</font>). '
        'Cada una muestra una pantalla real servida desde producción.', styles['Body']))
    figura(story, 'inicio-escritorio.png', 'Página de inicio.')
    figura(story, 'noticias-escritorio.png', 'Noticias, con filtros por categoría y por región.')
    figura(story, 'revolucion-humana-escritorio.png', 'Revolución Humana y sus sub-secciones.', alto_max=300)
    figura(story, 'educacion-escritorio.png', 'Educación, con filtros de tema y de región.')
    figura(story, 'pieza-detalle-escritorio.png', 'Detalle de una pieza (video).', alto_max=300)
    figura(story, 'tienda-escritorio.png', 'Tienda.', alto_max=300)
    figura(story, 'apoyo-escritorio.png', 'Apoya el canal (apoyo voluntario).', alto_max=300)
    figura(story, 'quienes-somos-escritorio.png', 'Quiénes somos y contacto.', alto_max=300)
    figura(story, 'inicio-sesion-modal.png', 'Inicio de sesión con verificación anti-robots.', alto_max=300)
    figura(story, 'registro-modal.png', 'Creación de cuenta.', alto_max=300)
    story.append(Paragraph('Vistas en teléfono móvil (diseño responsivo)', styles['H2']))
    movil = [('inicio-movil.png', 'Inicio'), ('noticias-movil.png', 'Noticias'), ('tienda-movil.png', 'Tienda'), ('educacion-movil.png', 'Educación')]
    from PIL import Image as PILImage
    celdas = []
    for arch, _ in movil:
        ruta = os.path.join(CAPTURAS, arch)
        w, h = PILImage.open(ruta).size
        k = 112 / w
        celdas.append(Image(ruta, width=112, height=h * k))
    t = Table([celdas, [Paragraph(n, styles['Caption']) for _, n in movil]], colWidths=[CONTENT_W / 4] * 4)
    t.setStyle(TableStyle([('ALIGN', (0, 0), (-1, -1), 'CENTER'), ('VALIGN', (0, 0), (-1, 0), 'TOP')]))
    story.append(t)
    _fig['n'] += 1
    story.append(Paragraph(f'Figura {_fig["n"]}. El mismo sitio en una pantalla de 390 px de ancho.', styles['Caption']))

    # 8. Evidencias de pruebas
    story.append(PageBreak())
    h1(story, 8, 'Evidencias de pruebas')
    c = ev['cobertura']
    p = ev['pruebas']
    story.append(Paragraph(
        f'Las pruebas automáticas (Jest y Supertest) suman <b>{p["total"]} pruebas en {p["suites"]} archivos</b>; '
        f'<b>{p["pasadas"]} pasan y {p["falladas"]} fallan</b>. La cobertura global es de '
        f'<b>{c["sentencias"]} % de las sentencias</b> ({c["ramas"]} % de las ramas, {c["funciones"]} % de las funciones y '
        f'{c["lineas"]} % de las líneas). Se ejecutan en cada cambio mediante GitHub Actions junto con ESLint, '
        'la auditoría de dependencias y el análisis de secretos.', styles['Body']))
    story.append(Paragraph(
        'Cubren la autenticación (JWT inválido o ausente → 401; rol insuficiente → 403), el CRUD de cada '
        'recurso, la validación de datos, el webhook de Stripe con firma, las cabeceras de seguridad, la '
        'configuración de despliegue y el esquema de la base de datos. El detalle por archivo, la verificación '
        'contra producción y las pruebas por navegador y dispositivo están en el documento '
        '<i>Evidencia de pruebas</i> que acompaña la entrega.', styles['Body']))
    story.append(Paragraph(
        'Durante el proyecto se corrigieron errores reales encontrados al probar (por ejemplo, una '
        'diferencia entre las variables de entorno de producción y las de pruebas, un bloqueo de '
        'construcción en Netlify y textos sin traducir); cada uno quedó registrado en el historial de '
        'Git y, cuando aplicaba, cubierto con una prueba nueva para que no vuelva a ocurrir.', styles['Body']))

    # 9. Conclusiones
    h1(story, 9, 'Conclusiones')
    story.append(Paragraph(
        'El proyecto cumple los requisitos técnicos de la rúbrica: un frontend responsivo que consume una API REST '
        f'propia de {len(endpoints)} endpoints, una base de datos relacional de {n_tablas} tablas, autenticación con JWT '
        'verificado en el servidor, rutas protegidas, CRUD completo y una aplicación desplegada y accesible en '
        'línea. Además de lo exigido, incorpora verificación en dos pasos, moderación del debate, pagos de '
        'prueba con Stripe, bilingüismo, integración continua y respaldos cifrados.', styles['Body']))
    story.append(Paragraph('Aprendizajes', styles['H2']))
    bullets(story, [
        'Separar responsabilidades en tres capas permite probar cada una por separado y cambiar un servicio sin reescribir el resto.',
        'La seguridad no puede quedarse en el navegador: validar el JWT en el servidor y cerrar la API de datos fue una decisión central.',
        'Los servicios gratuitos tienen límites (pausa por inactividad, arranque lento): fue necesario documentarlos, automatizar un chequeo diario y practicar una migración completa a un proyecto nuevo de Supabase con plan de vuelta atrás.',
        'Las pruebas automáticas y la integración continua evitaron que los cambios rompieran lo que ya funcionaba, incluida la reestructuración final del repositorio en /frontend y /backend.',
    ])
    story.append(Paragraph('Trabajo futuro', styles['H2']))
    bullets(story, [
        'Activar Stripe en modo real y completar la entidad legal que respalda el proyecto antes del lanzamiento público.',
        'Unificar las dos tablas de noticias en un solo modelo de contenido.',
        'Debates en vivo tipo chat y más zonas de debate; que los agentes de IA pregunten idioma, formato y tono antes de investigar.',
        'Lanzamiento público cuando cada sección tenga suficiente contenido.',
    ])

    # 10. Referencias
    h1(story, 10, 'Referencias')
    refs = [
        'Anthropic. (s. f.). <i>Claude API documentation</i>. https://docs.anthropic.com/',
        'Cloudflare. (s. f.). <i>Turnstile documentation</i>. https://developers.cloudflare.com/turnstile/',
        'Codd, E. F. (1970). A relational model of data for large shared data banks. <i>Communications of the ACM, 13</i>(6), 377–387. https://doi.org/10.1145/362384.362685',
        'Express. (s. f.). <i>Express: Fast, unopinionated, minimalist web framework for Node.js</i>. https://expressjs.com/',
        'Federal Trade Commission. (s. f.). <i>Children’s Online Privacy Protection Rule (COPPA)</i>. https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa',
        'Fielding, R. T. (2000). <i>Architectural styles and the design of network-based software architectures</i> [Tesis doctoral, University of California, Irvine]. https://ics.uci.edu/~fielding/pubs/dissertation/top.htm',
        'Jest. (s. f.). <i>Jest documentation</i>. https://jestjs.io/docs/getting-started',
        'Jones, M., Bradley, J., y Sakimura, N. (2015). <i>JSON Web Token (JWT)</i> (RFC 7519). Internet Engineering Task Force. https://www.rfc-editor.org/rfc/rfc7519',
        'Mozilla. (s. f.). <i>MDN Web Docs</i>. https://developer.mozilla.org/',
        'Netlify. (s. f.). <i>Netlify documentation</i>. https://docs.netlify.com/',
        'Node.js. (s. f.). <i>Node.js documentation</i>. https://nodejs.org/docs/latest/api/',
        'OWASP Foundation. (2021). <i>OWASP Top 10:2021</i>. https://owasp.org/Top10/',
        'PostgreSQL Global Development Group. (s. f.). <i>PostgreSQL documentation</i>. https://www.postgresql.org/docs/',
        'Render. (s. f.). <i>Render documentation</i>. https://render.com/docs',
        'Stripe. (s. f.). <i>Stripe documentation</i>. https://docs.stripe.com/',
        'Supabase. (s. f.). <i>Supabase documentation</i>. https://supabase.com/docs',
        'World Wide Web Consortium. (2023). <i>Web Content Accessibility Guidelines (WCAG) 2.2</i>. https://www.w3.org/TR/WCAG22/',
    ]
    for r in refs:
        story.append(Paragraph(r, Ref))

    doc.build(story, onFirstPage=footer, onLaterPages=footer)


if __name__ == '__main__':
    build()
    print('OK ->', OUT_PATH)
