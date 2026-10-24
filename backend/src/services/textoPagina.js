// Texto visible de una pagina web (sin scripts, estilos, menus ni etiquetas). Lo comparten la Clasificadora, que lee el
// inicio de la fuente, y la Guardiana, que compara el texto completo con la pieza.
function textoVisible(html, max) {
  return String(html)
    .replace(/<(script|style|noscript|svg|nav|footer|header|form)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

module.exports = { textoVisible };
