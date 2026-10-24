// ============================================================
// editorial.js — Sabías que PR · Utilidades compartidas de noticias
// ============================================================
// Lo usan home.js, noticias.js y articulo.js: etiquetas de categoría,
// escape de HTML, resumen (dek), tiempo de lectura y tarjetas.
// ============================================================

(function () {
  const CATEGORIAS = {
    // 'General' ya no se ofrece al crear contenido (2026-10-03); la etiqueta queda solo para mostrar
    // piezas antiguas hasta que se reclasifiquen (migracion backend/sql/migraciones).
    general: 'General',
    internacionales: 'Internacionales',
    crimen: 'Crimen',
    salud: 'Salud',
    deportes: 'Deportes',
    finanzas: 'Finanzas',
    tecnologia: 'Tecnología',
    descubrimientos: 'Descubrimientos',
    politica: 'Política',
    clima: 'Clima y Medio Ambiente',
    cultura: 'Cultura',
    ciencia: 'Ciencia',
    'leyes-educativas': 'Leyes educativas',
    'estudiantes-sobresalientes': 'Estudiantes sobresalientes',
    'sistemas-mundiales': 'Sistemas educativos mundiales',
    'programas-educativos': 'Programas educativos destacados',
  };

  // Ilustración genérica por categoría (fondo/portada de respaldo cuando una
  // noticia o contenido no trae foto propia). Usar SQPR.CATEGORIA_IMAGEN[categoria].
  const CATEGORIA_IMAGEN = {
    general: { src: 'images/categoria-general.webp', alt: 'Ilustración de un árbol del conocimiento con libros y bombillas, símbolo de la categoría General' },
    internacionales: { src: 'images/categoria-internacionales.webp', alt: 'Ilustración de un globo terráqueo con rutas trazadas hacia Puerto Rico, símbolo de la categoría Internacionales' },
    crimen: { src: 'images/categoria-crimenes.webp', alt: 'Ilustración de una lupa sobre una huella dactilar y un expediente, símbolo de la categoría Crimen' },
    salud: { src: 'images/categoria-salud.webp', alt: 'Ilustración de un estetoscopio formando un corazón con una línea de pulso, símbolo de la categoría Salud' },
    deportes: { src: 'images/categoria-deportes.webp', alt: 'Ilustración de balones y guantes de boxeo bajo las luces de un estadio, símbolo de la categoría Deportes' },
    finanzas: { src: 'images/categoria-finanzas.webp', alt: 'Ilustración de columnas de monedas crecientes con una flecha ascendente, símbolo de la categoría Finanzas' },
    tecnologia: { src: 'images/categoria-tecnologia.webp', alt: 'Ilustración de un microchip con circuitos en forma de red neuronal, símbolo de la categoría Tecnología' },
    descubrimientos: { src: 'images/categoria-descubrimientos.webp', alt: 'Ilustración de un telescopio observando un cometa en el cielo estrellado, símbolo de la categoría Descubrimientos' },
    ciencia: { src: 'images/categoria-ciencia.webp', alt: 'Ilustración de un microscopio, un átomo y una hebra de ADN, símbolo de la categoría Ciencia' },
    politica: { src: 'images/categoria-politica.webp', alt: 'Ilustración de una balanza frente al Capitolio, símbolo de la categoría Política' },
    clima: { src: 'images/categoria-clima.webp', alt: 'Ilustración de un huracán girando sobre el mapa de Puerto Rico y el Caribe, símbolo de la categoría Clima y Medio Ambiente' },
    cultura: { src: 'images/categoria-cultura.webp', alt: 'Ilustración de un vejigante, un cuatro y una pandereta, símbolo de la categoría Cultura' },
  };

  // Agrega ?lang=en a una URL de la API cuando el visitante eligio ingles
  // (window.SQPR_LANG, de i18n.js) -- en español no hace falta el parametro,
  // el backend ya devuelve el idioma original. Ver Fase C3.
  function withLang(url) {
    if (window.SQPR_LANG !== 'en') return url;
    return url + (url.includes('?') ? '&' : '?') + 'lang=en';
  }

  // Pastilla "Solo en español" para tarjetas -- el texto es la clave del
  // diccionario de i18n.js, se traduce solo si hiciera falta (no debería,
  // ya que solo aparece cuando se pidio ingles y no hay traduccion).
  function badgeIdioma(item) {
    return item && item.sin_traduccion
      ? '<span class="badge-idioma">Solo en español</span>'
      : '';
  }

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

  // ── Tarjeta multi-formato (video/ensayo/noticia/lectura_corta) ─────
  // La usan noticias.js (Noticias combina noticias + contenidos) y
  // contenidos.js (Revolución Humana / Educación). Consumo dual: el botón
  // "reproducir" cambia la imagen por un <iframe> sin navegar; el título sí
  // navega. En video, el área de medios queda FUERA del <a> para no anidar
  // <button> dentro de <a> (inválido en HTML) — ver styles.css, .card-media.
  const FORMATO_LABEL = {
    video: 'Video',
    audio: 'Audio',
    foto: 'Foto',
    ensayo: 'Ensayo',
    noticia: 'Noticia',
    lectura_corta: 'Lectura corta',
  };
  // Formatos con reproducción en línea (el botón no navega, solo video/audio
  // traen la imagen fuera del <a> — ver comentario arriba de .card-media en styles.css).
  const REPRODUCIBLES = { video: 'Reproducir video', audio: 'Reproducir audio' };
  const SUBFORMATO_LABEL = {
    podcast: 'Podcast', entrevista: 'Entrevista', galeria: 'Galería', opinion: 'Opinión',
    reportaje: 'Reportaje', cronica: 'Crónica', guia: 'Guía', infografia: 'Infografía',
    tutorial: 'Tutorial', documental: 'Documental', columna: 'Columna',
  };
  // Divulgación de IA: política editorial, no requisito legal (ver
  // reference_deploy_setup / project_contenidos_multiformato). "no" queda
  // implícito (sin insignia) para no saturar cada tarjeta con una etiqueta
  // negativa en cada post.
  const DIVULGACION_IA_LABEL = { parcial: 'Asistencia parcial de IA', generado: 'Generado con IA' };
  const DIVULGACION_IA_CLASS = { parcial: 'badge-ia-parcial', generado: 'badge-ia-generado' };
  // Divulgacion de uso de IA: la etiqueta (parcial / generado) y los iconos de las herramientas usadas.
  function iaBadgesHtml(item) {
    const etiqueta = item.divulgacion_ia && DIVULGACION_IA_LABEL[item.divulgacion_ia];
    const insignia = etiqueta
      ? '<span class="badge-ia ' + DIVULGACION_IA_CLASS[item.divulgacion_ia] + '">' + escapeHtml(etiqueta) + '</span>'
      : '';
    const herramientas = window.sqprIa ? window.sqprIa.insigniasHtml(item.ia_herramientas) : '';
    return insignia + herramientas;
  }
  const PLAY_ICON = '<span class="card-play-icon" aria-hidden="true">'
    + '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>';

  function contenidoHref(item) {
    return (item._hrefBase || 'recurso.html') + '?id=' + encodeURIComponent(item.id);
  }

  function contenidoMetaLine(item) {
    const parts = [];
    if (item.fecha_publicacion) parts.push(escapeHtml(String(item.fecha_publicacion).slice(0, 10)));
    const unidad = item.tipo_formato === 'video' ? ' min de video' : item.tipo_formato === 'audio' ? ' min de audio' : ' min de lectura';
    parts.push((item.duracion_min || 1) + unidad);
    return parts.join(' · ');
  }

  function contenidoCardHtml(item) {
    const formatoLabel = FORMATO_LABEL[item.tipo_formato] || item.tipo_formato;
    const subformatoLabel = item.subformato && SUBFORMATO_LABEL[item.subformato];
    const formatoTexto = subformatoLabel ? formatoLabel + ' · ' + subformatoLabel : formatoLabel;
    const catLabel = CATEGORIAS[item.categoria] || item.categoria;
    const img = '<img src="' + escapeHtml(item.url_portada) + '" alt="' + escapeHtml(item.portada_alt || '') + '" width="600" height="400" loading="lazy">';
    // Categoria + formato combinados en una sola linea de texto, entre la
    // imagen y el titulo (no encima de la imagen -- se probo como pastilla
    // superpuesta y en imagenes con su propio diseño/texto tapaba parte de
    // la portada, sobre todo al hacer zoom en hover).
    const badge = '<span class="card-format">' + escapeHtml(catLabel) + ' · ' + escapeHtml(formatoTexto) + '</span>';
    const iaBadge = iaBadgesHtml(item);
    const premiumBadge = item.es_premium
      ? '<span class="badge-premium">🔒 Premium</span>'
      : '';
    // "Original": contenido propio, sin fuente externa (campo cita_sin_fuente_externa del admin).
    const originalBadge = item.cita_sin_fuente_externa
      ? '<span class="badge-original">Original</span>'
      : '';

    const body = '<div class="card-body">'
      + badge
      + '<h3 class="card-title">' + escapeHtml(item.titulo) + '</h3>'
      + '<p class="card-dek">' + escapeHtml(item.subtitulo_resumen) + '</p>'
      + '<p class="card-meta">' + contenidoMetaLine(item) + '</p>'
      + iaBadge
      + originalBadge
      + premiumBadge
      + badgeIdioma(item)
      + '</div>';

    const reproducirLabel = REPRODUCIBLES[item.tipo_formato];
    if (reproducirLabel && item.url_media) {
      return '<article class="card">'
        + '<div class="card-media">' + img
        + '<button type="button" class="card-play" data-url="' + escapeHtml(item.url_media) + '" data-formato="' + escapeHtml(item.tipo_formato) + '" aria-label="' + reproducirLabel + ': ' + escapeHtml(item.titulo) + '">' + PLAY_ICON + '</button>'
        + '</div>'
        + '<a class="card-title-link" href="' + contenidoHref(item) + '">' + body + '</a>'
        + '</article>';
    }

    return '<article class="card">'
      + '<a class="card-link" href="' + contenidoHref(item) + '">'
      + '<div class="card-media">' + img + '</div>'
      + body
      + '</a></article>';
  }

  // Delegación de eventos: reproduce video/audio dentro de la tarjeta sin
  // navegar. El video reemplaza toda el área de medios por un <iframe>; el
  // audio deja la portada visible y agrega una barra de reproductor al pie
  // (un <audio> ahí adentro, sin imagen, se vería como un hueco vacío).
  function bindCardPlayDelegation(container) {
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('.card-play');
      if (!btn) return;
      e.preventDefault();
      const media = btn.closest('.card-media');
      const url = btn.dataset.url;
      if (!media || !url) return;
      if (btn.dataset.formato === 'audio') {
        btn.remove();
        const bar = document.createElement('div');
        bar.className = 'card-audio-inline';
        bar.innerHTML = '<audio controls autoplay src="' + escapeHtml(url) + '"></audio>';
        media.appendChild(bar);
        return;
      }
      media.innerHTML = '<iframe class="card-media-frame" src="' + escapeHtml(url) + '?autoplay=1"'
        + ' title="Reproductor de video" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe>';
    });
  }

  // Convierte una fila de la tabla `noticias` a la misma forma que `contenidos`,
  // para poder mostrarlas juntas con contenidoCardHtml() en la página Noticias.
  function noticiaComoContenido(row) {
    return {
      id: row.id,
      tipo_formato: 'noticia',
      seccion: 'noticias',
      categoria: row.categoria,
      titulo: row.titulo,
      subtitulo_resumen: dek(row, 170),
      url_portada: row.imagen,
      portada_alt: row.imagen_alt,
      fecha_publicacion: row.fecha,
      duracion_min: readingMinutes(row),
      url_media: null,
      _hrefBase: 'articulo.html',
      sin_traduccion: row.sin_traduccion,
      divulgacion_ia: row.divulgacion_ia,
      ia_herramientas: row.ia_herramientas,
    };
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
  // `noticias` (la tabla, distinta de `contenidos`) es siempre formato
  // "Noticia" -- mismo formato combinado categoria+formato que
  // contenidoCardHtml, entre la imagen y el titulo, para verse consistente
  // en toda la página principal y "Lo más reciente".
  function cardHtml(art, opts) {
    const o = opts || {};
    const tag = o.featured ? 'h2' : 'h3';
    const inner = mediaHtml(art, o.featured ? { w: 960, h: 540, eager: true } : {})
      + '<div class="card-body">'
      + '<span class="card-format">' + escapeHtml(categoriaLabel(art)) + ' · Noticia</span>'
      + '<' + tag + ' class="card-title">' + escapeHtml(art.titulo) + '</' + tag + '>'
      + '<p class="card-dek">' + escapeHtml(dek(art, o.featured ? 260 : 170)) + '</p>'
      + '<p class="card-meta">' + metaLine(art) + '</p>'
      + iaBadgesHtml(art)
      + badgeIdioma(art)
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

  // «Otras fuentes» de una pieza (lista de { nombre, url }): ademas de la fuente principal. El enlace solo si es http(s) seguro.
  function otrasFuentesHtml(fuentes) {
    var lista = Array.isArray(fuentes) ? fuentes.filter(function (f) { return f && f.nombre; }) : [];
    if (!lista.length) return '';
    return '<p class="article-source article-source-extra">Otras fuentes:</p><ul class="article-sources">' + lista.map(function (f) {
      var url = safeUrl(f.url);
      return '<li>' + (url ? '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(f.nombre) + '</a>' : escapeHtml(f.nombre)) + '</li>';
    }).join('') + '</ul>';
  }

  window.SQPR = Object.assign(window.SQPR || {}, {
    CATEGORIAS: CATEGORIAS,
    CATEGORIA_IMAGEN: CATEGORIA_IMAGEN,
    FORMATO_LABEL: FORMATO_LABEL,
    SUBFORMATO_LABEL: SUBFORMATO_LABEL,
    DIVULGACION_IA_LABEL: DIVULGACION_IA_LABEL,
    DIVULGACION_IA_CLASS: DIVULGACION_IA_CLASS,
    iaBadgesHtml: iaBadgesHtml,
    contenidoCardHtml: contenidoCardHtml,
    bindCardPlayDelegation: bindCardPlayDelegation,
    noticiaComoContenido: noticiaComoContenido,
    withLang: withLang,
    badgeIdioma: badgeIdioma,
    escapeHtml: escapeHtml,
    stripHtml: stripHtml,
    safeUrl: safeUrl,
    otrasFuentesHtml: otrasFuentesHtml,
    sanitizeHtml: sanitizeHtml,
    dek: dek,
    readingMinutes: readingMinutes,
    categoriaLabel: categoriaLabel,
    articleUrl: articleUrl,
    metaLine: metaLine,
    cardHtml: cardHtml,
    skeletonCard: skeletonCard,
  });
})();
