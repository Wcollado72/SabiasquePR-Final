# -*- coding: utf-8 -*-
"""
Genera docs/entrega/Guia-para-la-profesora.pdf: una pagina que dice como evaluar el proyecto sin leer todo
(enlaces, como probarlo en 5 minutos, donde esta cada punto de la rubrica y como correr las pruebas).
Las cifras salen de docs/entrega/evidencia-pruebas.json.
Uso (desde la raiz del repo): python docs/generate_guia_profesora.py
"""
import json
import os

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

AQUI = os.path.dirname(os.path.abspath(__file__))
ENTREGA = os.path.join(AQUI, 'entrega')
OUT = os.path.join(ENTREGA, 'Guia-para-la-profesora.pdf')
DATOS = os.path.join(AQUI, 'privado', 'datos-estudiante.json')

INK = colors.HexColor('#16202B')
SOFT = colors.HexColor('#51606E')
LINE = colors.HexColor('#C9D1D9')
HEAD = colors.HexColor('#123762')
SOFTBG = colors.HexColor('#E4ECF5')
VIDEO_URL = 'Se agrega aquí al publicar el video'

base = ParagraphStyle('base', fontName='Helvetica', fontSize=8.8, leading=11.6, textColor=INK)
small = ParagraphStyle('small', parent=base, fontSize=8, leading=10.2)
h1 = ParagraphStyle('h1', parent=base, fontName='Helvetica-Bold', fontSize=16, leading=19, textColor=HEAD)
h2 = ParagraphStyle('h2', parent=base, fontName='Helvetica-Bold', fontSize=10.2, leading=13, textColor=HEAD, spaceBefore=7, spaceAfter=3)
cab = ParagraphStyle('cab', parent=base, fontName='Helvetica-Bold', fontSize=8, textColor=colors.white)


def nombre_estudiante():
    try:
        with open(DATOS, encoding='utf-8') as f:
            return json.load(f).get('nombre') or 'William R. Collado'
    except OSError:
        return 'William R. Collado'


def tabla(filas, anchos):
    data = [[Paragraph(c, cab) for c in filas[0]]] + [[Paragraph(c, small) for c in f] for f in filas[1:]]
    t = Table(data, colWidths=anchos, hAlign='LEFT', repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HEAD), ('GRID', (0, 0), (-1, -1), 0.5, LINE), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F4F7FA')]),
        ('TOPPADDING', (0, 0), (-1, -1), 2.6), ('BOTTOMPADDING', (0, 0), (-1, -1), 2.6), ('LEFTPADDING', (0, 0), (-1, -1), 5), ('RIGHTPADDING', (0, 0), (-1, -1), 5)]))
    return t


def main():
    ev = json.load(open(os.path.join(ENTREGA, 'evidencia-pruebas.json'), encoding='utf-8'))
    pruebas = ev['pruebas_total']
    cobertura = str(ev['cobertura_global']['lineas']).replace('.', ',')
    s = []
    s.append(Paragraph('Guía para la profesora', h1))
    s.append(Paragraph(f'<b>Sabías que PR</b> · COMP2053 Desarrollo Web Full-Stack · {nombre_estudiante()} · Universidad Interamericana de Puerto Rico, Recinto de Fajardo', small))
    s.append(Spacer(1, 6))

    s.append(tabla([
        ['Qué', 'Dónde'],
        ['Aplicación en línea', '<font face="Courier">https://sabiasquepr.com</font> (la primera carga puede tardar hasta 50 s: servidor gratuito que se «duerme»)'],
        ['Código (público)', '<font face="Courier">https://github.com/Wcollado72/SabiasquePR-Final</font> · carpetas <font face="Courier">/frontend</font>, <font face="Courier">/backend</font> y README.md. Es una copia limpia del repositorio de trabajo, desde el cual Netlify y Render despliegan el sitio.'],
        ['Video demostrativo (5–10 min)', VIDEO_URL],
        ['Cuenta de evaluación', 'Rol <i>usuario</i>. El estudiante entrega el correo y la contraseña por separado; se desactiva después de la calificación.'],
    ], [110, 400]))

    s.append(Paragraph('Cómo probarlo en 5 minutos', h2))
    pasos = [
        'Abre <font face="Courier">sabiasquepr.com</font>, toca <b>Iniciar sesión</b> y entra con la cuenta de evaluación (el servidor valida un JWT de Supabase Auth).',
        'En <b>Revolución Humana</b> o <b>Educación</b>, abre el <b>Debate</b>: <b>crea</b> una publicación, <b>léela</b>, <b>edítala</b> y <b>bórrala</b> (CRUD completo con la API propia).',
        'Prueba una ruta protegida sin sesión: abre <font face="Courier">https://sabiasquepr-backend-uufz.onrender.com/api/me</font> en una ventana de incógnito: responde <b>401</b> (sin sesión no hay acceso).',
        'El <b>panel de administración</b> (CRUD de noticias, contenidos y productos) exige verificación en dos pasos: se muestra en el video y en el Manual de usuario (sección 3.6).',
        'Cambia el tamaño de la ventana o abre el sitio en un celular: el diseño es responsivo y funciona en Chrome, Edge y Safari.',
    ]
    for i, t in enumerate(pasos, 1):
        s.append(Paragraph(f'<b>{i}.</b> {t}', ParagraphStyle('p', parent=base, leftIndent=14, firstLineIndent=-14, spaceAfter=2)))

    s.append(Paragraph('Dónde está cada punto de la rúbrica', h2))
    s.append(tabla([
        ['Criterio (peso)', 'Dónde verlo'],
        ['Planificación y diseño (10 %)', '<i>Planificación y diseño de la base de datos</i>, secciones 1–7: descripción, objetivo, justificación, alcance, tecnologías, arquitectura y navegación'],
        ['Base de datos (20 %)', '<i>Planificación y diseño de la base de datos</i>, secciones 8–12 (MER, esquema relacional, diccionario, script) y <font face="Courier">backend/sql/schema.sql</font>: 15 tablas con llaves primarias y foráneas'],
        ['Funcionalidad y CRUD (30 %)', 'Pasos 2–4 de arriba; endpoints en la <i>Documentación técnica</i>; CRUD de administrador en el video y en el manual'],
        ['Tecnologías Full-Stack (10 %)', '<i>Documento final</i>, sección 4: HTML5/CSS3/JS, Node.js + Express, PostgreSQL, Netlify, Render'],
        ['Calidad del código (10 %)', f'<font face="Courier">/backend/src</font> organizado por rutas, validadores y middleware; {pruebas} pruebas automáticas ({cobertura} % de líneas); CI en GitHub Actions'],
        ['UX/UI (10 %)', 'El sitio en línea; capturas en el manual; pruebas en Chrome, Edge, Safari (motor WebKit) y un iPhone 14 en la <i>Evidencia de pruebas</i>'],
        ['Documentación y presentación (5 %)', 'Carpeta <font face="Courier">docs/entrega</font>: documento final, manual de usuario, documentación técnica, evidencia de pruebas y video'],
        ['Despliegue (5 %)', '<font face="Courier">sabiasquepr.com</font> (Netlify) + API (Render) + base de datos (Supabase); verificación desde fuera en la <i>Evidencia de pruebas</i>'],
    ], [140, 370]))

    s.append(Paragraph('Los documentos mencionados están en la carpeta <font face="Courier">docs/entrega</font>; los nombres de archivo no llevan tildes ni eñes a propósito, para que funcionen igual en cualquier sistema.', small))
    s.append(Paragraph('Correr las pruebas (opcional)', h2))
    s.append(Paragraph('<font face="Courier">git clone https://github.com/Wcollado72/SabiasquePR-Final.git &amp;&amp; cd SabiasquePR-Final/backend &amp;&amp; npm install &amp;&amp; npm test</font> '
                       f'y deben pasar las {pruebas} pruebas (no necesitan base de datos ni llaves). Instrucciones completas en el README.', small))

    doc = SimpleDocTemplate(OUT, pagesize=letter, leftMargin=46, rightMargin=46, topMargin=40, bottomMargin=36,
                            title='Guía para la profesora — Sabías que PR', author=nombre_estudiante())
    doc.build(s)
    print('OK ->', OUT)


if __name__ == '__main__':
    main()
