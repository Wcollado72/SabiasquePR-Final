// ============================================================
// editorial.js — Sabías que PR · Utilidades compartidas de noticias
// ============================================================
// Lo usan home.js, noticias.js y articulo.js: etiquetas de categoría,
// escape de HTML, resumen (dek), tiempo de lectura y tarjetas.
// ============================================================

(function () {
  const CATEGORIAS = {
    general: 'General',
    internacionales: 'Internacionales',
    crimenes: 'Crímenes',
    salud: 'Salud',
    deportes: 'Deportes',
    finanzas: 'Finanzas',
    tecnologia: 'Tecnología',
    descubrimientos: 'Descubrimientos',
    politica: 'Política',
    clima: 'Clima y Medio Ambiente',
    cultura: 'Cultura',
  };

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str == null ? '' : String(str);
    return d.innerHTML;
  }

  // Texto plano de un párrafo que puede traer HTML (<strong>, <a>...)
  function stripHtml(html) {
    const d = document.createElement('div');
    d.innerHTML = html || '';
    return (d.textContent || '').replace(/\s+/g, ' ').trim();
  }

  // Solo se permite http(s) y mailto en enlaces
  function safeUrl(url) {
    return /^(https?:\/\/|mailto:)/i.test(url || '') ? url : '';
  }

  // Limpia el HTML de un párrafo: deja solo formato básico y enlaces seguros
  const ALLOWED_TAGS = ['STRONG', 'B', 'EM', 'I', 'U', 'A', 'BR', 'SUP', 'SUB', 'CODE'];
  const DROP_TAGS = ['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'NOSCRIPT'];
  function sanitizeHtml(html) {
    const tpl = document.createElement('template');
    tpl.innerHTML = html || '';
    (function clean(node) {
      Array.from(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) return;           // texto
        if (child.nodeType !== 1) { child.remove(); return; } // comentarios, etc.
        if (DROP_TAGS.indexOf(child.tagName) !== -1) { child.remove(); return; } // sin su contenido
        clean(child);
        if (ALLOWED_TAGS.indexOf(child.tagName) === -1) {
          child.replaceWith.apply(child, Array.from(child.childNodes)); // conserva el texto
          return;
        }
        Array.from(child.attributes).forEach(function (attr) {
          if (child.tagName === 'A' && attr.name === 'href' && safeUrl(attr.value)) return;
          child.removeAttribute(attr.name);
        });
        if (child.tagName === 'A') {
          child.setAttribute('target', '_blank');
          child.setAttribute('rel', 'noopener noreferrer');
        }
      });
    })(tpl.content);
    return tpl.innerHTML;
  }

  // Resumen: el primer párrafo, recortado sin partir palabras
  function dek(art, max) {
    const limit = max || 190;
    const text = stripHtml((art.parrafos || [])[0]);
    if (text.length <= limit) return text;
    return text.slice(0, limit).replace(/\s+\S*$/, '') + '…';
  }

  // ~200 palabras por minuto
  function readingMinutes(art) {
    const words = (art.parrafos || []).map(stripHtml).join(' ').split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
  }

  function categoriaLabel(art) {
    return CATEGORIAS[art.categoria] || art.categoria || '';
  }

  function articleUrl(art) {
    return 'articulo.html?id=' + encodeURIComponent(art.id);
  }

  function metaLine(art) {
    const parts = [];
    if (art.fecha_display) parts.push(escapeHtml(art.fecha_display));
    parts.push(readingMinutes(art) + ' min de lectura');
    return parts.join(' · ');
  }

  function mediaHtml(art, opts) {
    const o = opts || {};
    if (!art.imagen) return '<figure class="card-media" aria-hidden="true"></figure>';
    return '<figure class="card-media"><img src="' + escapeHtml(art.imagen) + '" alt="' + escapeHtml(art.imagen_alt || '') + '"'
      + ' width="' + (o.w || 600) + '" height="' + (o.h || 400) + '"'
      + (o.eager ? ' fetchpriority="high"' : ' loading="lazy"') + '></figure>';
  }

  // Tarjeta estándar (rejilla). `opts.featured` = versión grande para portada.
  function cardHtml(art, opts) {
    const o = opts || {};
    const tag = o.featured ? 'h2' : 'h3';
    const inner = mediaHtml(art, o.featured ? { w: 960, h: 540, eager: true } : {})
      + '<div class="card-body">'
      + '<span class="eyebrow">' + escapeHtml(categoriaLabel(art)) + '</span>'
      + '<' + tag + ' class="card-title">' + escapeHtml(art.titulo) + '</' + tag + '>'
      + '<p class="card-dek">' + escapeHtml(dek(art, o.featured ? 260 : 170)) + '</p>'
      + '<p class="card-meta">' + metaLine(art) + '</p>'
      + '</div>';
    return '<article class="card"><a class="card-link" href="' + articleUrl(art) + '">' + inner + '</a></article>';
  }

  function skeletonCard() {
    return '<div class="card skeleton-card" aria-hidden="true">'
      + '<div class="card-media skeleton"></div>'
      + '<div class="skeleton skeleton-line short"></div>'
      + '<div class="skeleton skeleton-line"></div>'
      + '<div class="skeleton skeleton-line"></div></div>';
  }

  window.SQPR = {
    CATEGORIAS: CATEGORIAS,
    escapeHtml: escapeHtml,
    stripHtml: stripHtml,
    safeUrl: safeUrl,
    sanitizeHtml: sanitizeHtml,
    dek: dek,
    readingMinutes: readingMinutes,
    categoriaLabel: categoriaLabel,
    articleUrl: articleUrl,
    metaLine: metaLine,
    cardHtml: cardHtml,
    skeletonCard: skeletonCard,
  };
})();
