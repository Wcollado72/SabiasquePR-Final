// ============================================================
// noticias.js — Sabías que PR · Página Noticias (collage)
// ============================================================
// La cuadrícula es un COLLAGE de todas las secciones y subsecciones del sitio (Noticias,
// Revolución Humana, Educación...), no solo de Noticias. Combina dos fuentes: los artículos
// propios de /api/noticias y todo lo curado en /api/contenidos (la tabla `contenidos` sí soporta
// video con reproducción en línea). Ambas se normalizan a la misma forma y se pintan con
// SQPR.contenidoCardHtml (ver editorial.js). Cómo se escoge y se ordena el collage, y las reglas
// de región, 18+ y premium, viven en regiones.js (funciones puras con pruebas).
// Filtros: fila de categorías (interruptores: pulsar activa, pulsar otra vez desactiva; ninguna
// queda activa al entrar) y fila de regiones (Puerto Rico activo al entrar).
// Requiere editorial.js y regiones.js (window.SQPR, window.sqprRegiones) cargados antes.
// ============================================================

(function () {
  const cfg = window.SITE_CONFIG || {};
  const API_URL = cfg.apiUrl || 'http://localhost:3000';
  const SLOW_MS = 6000; // el plan gratuito de Render puede tardar en despertar
  const CLAVE_EDAD_SESION = 'sqpr_edad_confirmada_18mas'; // la misma que usa debate.js
  const S = window.SQPR;
  const R = window.sqprRegiones; // regiones.js
  let activeCategoria = '';
  let activeEnfoque = ''; // region activa (Puerto Rico por defecto, igual que Revolucion Humana)
  let adultoVerificado = false;

  document.addEventListener('DOMContentLoaded', async () => {
    const fromUrl = new URLSearchParams(location.search).get('categoria');
    if (fromUrl && S.CATEGORIAS[fromUrl]) activeCategoria = fromUrl;
    bindFilters();
    bindEnfoque();
    const list = document.getElementById('noticias-list');
    if (list) S.bindCardPlayDelegation(list);
    adultoVerificado = await edadAdultaConfirmada();
    loadNoticias();
  });

  // ¿El visitante ya confirmó que es mayor de 18? Misma regla que el debate 18+: con sesión, lo que
  // diga su perfil (/api/me); sin sesión, la confirmación guardada en esta pestaña. Ante cualquier
  // duda o error, NO (las secciones 18+ solo entran al collage con la edad confirmada).
  async function edadAdultaConfirmada() {
    try {
      if (sessionStorage.getItem(CLAVE_EDAD_SESION) === '1') return true;
      const haySesion = Object.keys(localStorage).some((k) => /^sb-.*-auth-token$/.test(k));
      if (!haySesion) return false;
      const sb = await esperarSupabase();
      if (!sb) return false;
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return false;
      const res = await fetch(API_URL + '/api/me', { headers: { Authorization: 'Bearer ' + session.access_token } });
      if (!res.ok) return false;
      const me = await res.json();
      return Boolean(me.user && me.user.edad_confirmada);
    } catch {
      return false;
    }
  }

  function esperarSupabase(timeoutMs = 1500, intervalMs = 50) {
    return new Promise((resolve) => {
      const inicio = Date.now();
      (function revisar() {
        if (window.supabase) return resolve(window.supabase);
        if (Date.now() - inicio >= timeoutMs) return resolve(null);
        setTimeout(revisar, intervalMs);
      })();
    });
  }

  function setActiveButton() {
    document.querySelectorAll('#noticias-filters .foro-filter-btn').forEach((b) => {
      const on = activeCategoria !== '' && (b.dataset.categoria || '') === activeCategoria;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }

  // Categorías como interruptores: pulsar la activa la desactiva y vuelve a verse todo.
  function bindFilters() {
    setActiveButton();
    document.querySelectorAll('#noticias-filters .foro-filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const elegida = btn.dataset.categoria || '';
        activeCategoria = activeCategoria === elegida ? '' : elegida;
        setActiveButton();
        loadNoticias();
      });
    });
  }

  // Segunda fila de botones (debajo de las categorias): filtra las tarjetas por region.
  // El filtro se aplica en el navegador sobre lo que ya devuelve la API (cada contenido trae
  // su `enfoque`), asi que no cambia ni la API ni la base de datos.
  function bindEnfoque() {
    const nav = document.getElementById('noticias-enfoque-filter');
    if (!nav) return;
    const inicial = nav.querySelector('.foro-filter-btn.active');
    activeEnfoque = (inicial && inicial.dataset.enfoque) || '';
    nav.addEventListener('click', (e) => {
      const btn = e.target.closest('.foro-filter-btn');
      if (!btn) return;
      nav.querySelectorAll('.foro-filter-btn').forEach((b) => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-pressed', String(b === btn));
      });
      activeEnfoque = btn.dataset.enfoque || '';
      loadNoticias();
    });
  }

  async function loadNoticias() {
    const el = document.getElementById('noticias-list');
    const hint = document.getElementById('noticias-hint');
    if (!el) return;
    el.setAttribute('aria-busy', 'true');
    el.innerHTML = [0, 1, 2].map(() => S.skeletonCard()).join('');
    const slowTimer = setTimeout(() => {
      if (hint) hint.textContent = 'Cargando… el servidor puede tardar unos segundos en despertar.';
    }, SLOW_MS);
    try {
      const cat = activeCategoria ? `categoria=${encodeURIComponent(activeCategoria)}` : '';
      const [noticiasRes, contenidosRes] = await Promise.all([
        fetch(S.withLang(API_URL + '/api/noticias' + (cat ? '?' + cat : ''))),
        // Sin `seccion`: el collage mezcla todas las secciones y subsecciones.
        fetch(S.withLang(API_URL + '/api/contenidos' + (cat ? '?' + cat : ''))),
      ]);
      const noticiasData = await noticiasRes.json();
      const contenidosData = await contenidosRes.json();
      if (!noticiasRes.ok) throw new Error(noticiasData.error || `Error ${noticiasRes.status}`);
      if (!contenidosRes.ok) throw new Error(contenidosData.error || `Error ${contenidosRes.status}`);

      const todos = (noticiasData.noticias || []).map(S.noticiaComoContenido).concat(contenidosData.contenidos || []);
      const items = R
        ? R.armarCollage(todos, { region: activeEnfoque, adultoVerificado })
        : todos.sort((a, b) => (a.fecha_publicacion < b.fecha_publicacion ? 1 : -1));

      // La primera pieza va grande (como la portada de una revista) si hay suficientes para acompañarla.
      el.innerHTML = items.length
        ? items.map((item, i) => {
          const html = S.contenidoCardHtml(item);
          return i === 0 && items.length >= 3 ? html.replace('<article class="card">', '<article class="card card-hero">') : html;
        }).join('')
        : '<p class="empty-state">Aún no hay noticias en esta selección.</p>';
    } catch (err) {
      el.innerHTML = `<p class="empty-state">No se pudieron cargar las noticias: ${S.escapeHtml(err.message)}</p>`;
    } finally {
      clearTimeout(slowTimer);
      if (hint) hint.textContent = '';
      el.setAttribute('aria-busy', 'false');
    }
  }
})();
