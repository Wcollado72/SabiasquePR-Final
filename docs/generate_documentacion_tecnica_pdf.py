# -*- coding: utf-8 -*-
"""
Convierte docs/entrega/documentacion-tecnica.md (generado desde el codigo con
backend/scripts/generar-doc-tecnica.js) en docs/entrega/Documentacion-Tecnica-SabiasquePR.pdf con el mismo
estilo que los demas documentos de la entrega. Soporta lo que usa ese archivo: titulos, parrafos con
`codigo`, **negrita**, *cursiva*, tablas, listas y bloques de codigo.
Uso (desde la raiz del repo): python docs/generate_documentacion_tecnica_pdf.py
"""
import os
import re
import sys

DOCS_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, DOCS_DIR)
import generate_planificacion_bd as P  # noqa: E402
from reportlab.lib.pagesizes import letter  # noqa: E402
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, Preformatted, ListFlowable, ListItem  # noqa: E402
from reportlab.lib.styles import ParagraphStyle  # noqa: E402
from reportlab.lib.enums import TA_LEFT  # noqa: E402

MD = os.path.join(DOCS_DIR, 'entrega', 'documentacion-tecnica.md')
OUT = os.path.join(DOCS_DIR, 'entrega', 'Documentacion-Tecnica-SabiasquePR.pdf')
styles, CW = P.styles, P.CONTENT_W
BODY_L = ParagraphStyle('BodyL', parent=P.styles['Body'], alignment=TA_LEFT)
CERCA = '`' * 3  # marca de bloque de codigo en Markdown


def inline(texto):
    texto = texto.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    texto = re.sub(r'`([^`]+)`', r'<font face="Courier">\1</font>', texto)
    texto = re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', texto)
    texto = re.sub(r'(?<!\*)\*([^*]+)\*(?!\*)', r'<i>\1</i>', texto)
    return texto


def tabla(filas):
    cab, cuerpo = filas[0], filas[1:]
    n = len(cab)
    if n == 4:
        anchos = [52, 190, 130, CW - 52 - 190 - 130]
    else:
        anchos = [CW * 0.38, CW * 0.62] if n == 2 else [CW / n] * n
    data = [[Paragraph(inline(c), styles['TableHead']) for c in cab]]
    data += [[Paragraph(inline(c), styles['TableCell']) for c in fila] for fila in cuerpo]
    t = Table(data, colWidths=anchos, hAlign='LEFT', repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), P.ACCENT_DARK), ('ROWBACKGROUNDS', (0, 1), (-1, -1), [P.WHITE, P.PAPER_RULED]),
        ('GRID', (0, 0), (-1, -1), 0.5, P.LINE), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 3), ('BOTTOMPADDING', (0, 0), (-1, -1), 3), ('LEFTPADDING', (0, 0), (-1, -1), 5),
    ]))
    return t


def footer(c, doc):
    if doc.page == 1:
        return
    c.saveState()
    c.setStrokeColor(P.LINE)
    c.line(P.MARGIN, 44, P.PAGE_W - P.MARGIN, 44)
    c.setFont('Helvetica', 7.5)
    c.setFillColor(P.INK_SOFT)
    c.drawString(P.MARGIN, 32, 'Sabías que PR — Documentación técnica')
    c.drawRightString(P.PAGE_W - P.MARGIN, 32, f'Página {doc.page}')
    c.restoreState()


def portada(story):
    est = P.datos_estudiante()
    story.append(Spacer(1, 90))
    story.append(Paragraph('UNIVERSIDAD INTERAMERICANA DE PUERTO RICO · RECINTO DE FAJARDO', styles['Eyebrow']))
    story.append(Spacer(1, 40))
    story.append(Paragraph('PROYECTO FINAL · DESARROLLO WEB FULL-STACK', styles['Eyebrow']))
    story.append(Paragraph('Sabías que PR', ParagraphStyle('CT', parent=styles['DocTitle'], fontSize=32, leading=36)))
    story.append(Paragraph('Documentación técnica', ParagraphStyle('CS', parent=styles['DocSub'], fontSize=14, leading=19, textColor=P.ACCENT_DARK)))
    story.append(Spacer(1, 10))
    story.append(Paragraph('Estructura del proyecto · rutas API y endpoints · configuración del entorno · autenticación · dependencias', styles['DocSub']))
    story.append(Spacer(1, 150))
    meta = [['Estudiante', est['nombre']]]
    if est.get('numero'):
        meta.append(['Número de estudiante', est['numero']])
    meta += [['Curso', 'COMP2053 — Desarrollo Web Full-Stack'], ['Profesora', 'Milagros Donato Cintrón'],
             ['Institución', 'Universidad Interamericana de Puerto Rico, Recinto de Fajardo'], ['Fecha', P.fecha_en_letras()]]
    t = Table([[Paragraph(f'<font color="#51606E">{k}</font>', styles['Body']), Paragraph(v, styles['Body'])] for k, v in meta],
              colWidths=[130, CW - 130], hAlign='LEFT')
    t.setStyle(TableStyle([('TOPPADDING', (0, 0), (-1, -1), 3), ('BOTTOMPADDING', (0, 0), (-1, -1), 3), ('LEFTPADDING', (0, 0), (-1, -1), 0)]))
    story.append(t)
    story.append(PageBreak())


def build():
    with open(MD, encoding='utf-8') as f:
        lineas = f.read().split('\n')
    est = P.datos_estudiante()
    doc = SimpleDocTemplate(OUT, pagesize=letter, leftMargin=P.MARGIN, rightMargin=P.MARGIN, topMargin=64, bottomMargin=58,
                            title='Sabías que PR — Documentación técnica', author=est['nombre'])
    story = []
    portada(story)
    mono = ParagraphStyle('MonoBlk', fontName='Courier', fontSize=7.4, leading=9.8, textColor=P.INK, backColor=P.PAPER_RULED,
                          borderPadding=6, leftIndent=4)
    i = 0
    while i < len(lineas):
        ln = lineas[i]
        if ln.startswith('# '):
            i += 1
            continue  # el titulo va en la portada
        if ln.startswith('## '):
            story.append(Paragraph(inline(ln[3:]), styles['H1']))
        elif ln.startswith('### '):
            story.append(Paragraph(inline(ln[4:]), styles['H2']))
        elif ln.startswith(CERCA):
            bloque = []
            i += 1
            while i < len(lineas) and not lineas[i].startswith(CERCA):
                bloque.append(lineas[i])
                i += 1
            story.append(Preformatted('\n'.join(bloque), mono))
            story.append(Spacer(1, 8))
        elif ln.startswith('|'):
            filas = []
            while i < len(lineas) and lineas[i].startswith('|'):
                celdas = [c.strip() for c in lineas[i].strip().strip('|').split('|')]
                if not all(re.fullmatch(r'-+', c) for c in celdas):
                    filas.append(celdas)
                i += 1
            story.append(tabla(filas))
            story.append(Spacer(1, 6))
            continue
        elif ln.startswith('- '):
            items = []
            while i < len(lineas) and lineas[i].startswith('- '):
                items.append(ListItem(Paragraph(inline(lineas[i][2:]), styles['BulletText']), leftIndent=6))
                i += 1
            story.append(ListFlowable(items, bulletType='bullet', start='•', leftIndent=14, bulletFontSize=8))
            story.append(Spacer(1, 6))
            continue
        elif ln.strip():
            story.append(Paragraph(inline(ln), BODY_L))
        i += 1
    doc.build(story, onFirstPage=footer, onLaterPages=footer)


if __name__ == '__main__':
    build()
    print('OK ->', OUT)
