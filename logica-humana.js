// ============================================================
// logica-humana.js — Sabías que PR · Área personal de Aliado Imperfekto
// ============================================================
// Sub-sección "Lógica Humana" dentro de Revolución Humana: solo premium,
// con su propio disclaimer (separado del de Corrupción Humana) y una
// sección de "Herramientas" con ensayos/recursos propios. El muro de pago
// real vive en el servidor (backend/src/routes/contenidos.js,
// aplicarMuroDePago trata subseccion==='logica-humana' como premium
// completo) -- este script solo controla la experiencia del gate.
// Mismo patrón getToken/apiFetch duplicado que ya es el estándar del sitio.
// ============================================================

(function () {
  const cfg = window.SITE_CONFIG || {};
  const API_URL = cfg.apiUrl || 'http://localhost:3000';
  const isSupabaseConfigured = cfg.supabaseUrl && !cfg.supabaseUrl.includes('YOUR_SUPABASE');
  let supabase = null;
  let currentUser = null;
  let currentUserRol = 'usuario';
  let currentUserEdadConfirmada = false;
  let currentUserTerminosOk = false;

  const TERMINOS_HTML = `
    <div class="debate-disclaimer box box-blog">
      <h3>⚠️ Antes de entrar a Lógica Humana</h3>
      <p>Esta es la sección personal de <strong>Aliado Imperfekto</strong> dentro de Sabías que PR: tema libre, tono reflexivo, escrita sin pretender tener siempre la razón. Es una sección para mayores de 18 años.</p>
      <p>Igual que en el resto del sitio, lo que protege legalmente a esta plataforma por lo que aquí se publica es la <strong>Sección 230 de la Communications Decency Act</strong> de EE. UU. — la moderación es mínima, pero casos extremos (amenazas u otro contenido ilegal) se reportan y se revisan.</p>
      <p>Al continuar, aceptas estos términos bajo tu propia responsabilidad.</p>
      <label class="admin-checkbox"><input type="checkbox" id="lh-terminos-check"> Entiendo y acepto los términos de esta sección.</label>
      <button type="button" id="lh-terminos-btn" class="btn btn-alt" disabled>Entrar</button>
    </div>`;

  async function waitForSharedSupabase(timeoutMs = 1500, intervalMs = 50) {
    return new Promise((resolve) => {
      const start = Date.now();
      (function check() {
        if (window.supabase) return resolve(window.supabase);
        if (Date.now() - start >= timeoutMs) return resolve(null);
        setTimeout(check, intervalMs);
      })();
    });
  }

  async function getToken() {
    if (!supabase) return null;
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  }

  async function apiFetch(path, options = {}) {
    const token = await getToken();
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(API_URL + path, Object.assign({}, options, { headers }));
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
  }

  async function activarLogicaHumana(root) {
    if (isSupabaseConfigured && !supabase) {
      try {
        const shared = await waitForSharedSupabase();
        supabase = shared || (await (async () => {
          const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
          return createClient(cfg.supabaseUrl, cfg.supabaseKey);
        })());
        const { data: { session } } = await supabase.auth.getSession();
        currentUser = session?.user ?? null;
        if (currentUser) {
          const me = await apiFetch('/api/me');
          currentUserRol = me.user?.rol || 'usuario';
          currentUserEdadConfirmada = Boolean(me.user?.edad_confirmada);
          currentUserTerminosOk = Boolean(me.user?.logica_humana_terminos_ok);
        }
      } catch (err) {
        console.warn('[Lógica Humana] Supabase no disponible:', err.message);
      }
    }

    if (!currentUser || (currentUserRol !== 'premium' && currentUserRol !== 'admin')) {
      root.innerHTML = '<p class="foro-loading">Esta sección es solo para cuentas premium — redirigiendo…</p>';
      location.href = 'premium.html';
      return;
    }
    if (!currentUserEdadConfirmada) {
      renderEdadGate(root);
      return;
    }
    if (!currentUserTerminosOk) {
      renderTerminosGate(root);
      return;
    }
    renderHerramientas(root);
  }

  function renderEdadGate(root) {
    root.innerHTML = `
      <div class="debate-disclaimer box box-blog">
        <h3>⚠️ Lógica Humana es una sección para mayores de 18 años</h3>
        <p>Antes de continuar, confirma bajo tu propia responsabilidad que eres mayor de edad. No se realiza ninguna verificación de identidad.</p>
        <label class="admin-checkbox"><input type="checkbox" id="lh-edad-check"> Confirmo que soy mayor de 18 años.</label>
        <button type="button" id="lh-edad-btn" class="btn btn-alt" disabled>Continuar</button>
      </div>`;
    const check = document.getElementById('lh-edad-check');
    const btn = document.getElementById('lh-edad-btn');
    check.addEventListener('change', () => { btn.disabled = !check.checked; });
    btn.addEventListener('click', async () => {
      try {
        await apiFetch('/api/perfil/confirmar-edad', { method: 'POST' });
        currentUserEdadConfirmada = true;
        activarLogicaHumana(root);
      } catch (err) { alert('' + err.message); }
    });
  }

  function renderTerminosGate(root) {
    root.innerHTML = TERMINOS_HTML;
    const check = document.getElementById('lh-terminos-check');
    const btn = document.getElementById('lh-terminos-btn');
    check.addEventListener('change', () => { btn.disabled = !check.checked; });
    btn.addEventListener('click', async () => {
      try {
        await apiFetch('/api/perfil/confirmar-terminos-logica-humana', { method: 'POST' });
        currentUserTerminosOk = true;
        activarLogicaHumana(root);
      } catch (err) { alert('' + err.message); }
    });
  }

  function renderHerramientas(root) {
    root.innerHTML = `
      <section class="box box-blog lh-herramientas">
        <h3>Herramientas para pensar en voz alta</h3>
        <p>Recursos propios de Aliado Imperfekto para acompañar la reflexión — uno a la vez, con calma.</p>
        <div class="lh-herramientas-botones">
          <button type="button" class="btn btn-alt" id="lh-btn-logica">Lógica</button>
        </div>
        <div id="lh-herramienta-contenido" hidden></div>
      </section>`;

    document.getElementById('lh-btn-logica').addEventListener('click', () => {
      const contenido = document.getElementById('lh-herramienta-contenido');
      if (!contenido.hidden) { contenido.hidden = true; return; }
      contenido.hidden = false;
      contenido.innerHTML = ENSAYO_LOGICA_HTML;
      contenido.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  const ENSAYO_LOGICA_HTML = `
    <article class="lh-ensayo">
      <h4>La lógica como sacrificio: el precio de un futuro mejor</h4>
      <p>Hay una idea peligrosa flotando en la manera en que hablamos del progreso humano: que basta con querer las cosas mejor para que mejoren. Que la buena intención, sola, alcanza. No alcanza. Lo que mueve a una persona, a una familia, a un pueblo entero de un lugar peor a uno mejor, no es el deseo — es la lógica aplicada con disciplina, incluso cuando esa lógica exige renunciar a algo que amamos.</p>
      <p>Empecemos por lo incómodo: usar la lógica como herramienta principal para progresar no es gratis. Tiene un precio, y ese precio casi nunca se paga en abstracto. Se paga en la mesa familiar, en la conversación con un amigo de toda la vida, en la costumbre que heredamos sin haberla elegido nunca.</p>
      <p>Cuando alguien empieza a mirar su vida, su comunidad, su país, con lógica en vez de con costumbre, lo primero que encuentra no son soluciones — son contradicciones. Cosas que hacemos porque siempre se hicieron así, no porque produzcan el resultado que decimos querer. Y ahí empieza el sacrificio: hay que estar dispuesto a que la lógica le gane a la costumbre, aunque la costumbre tenga la cara de alguien que queremos.</p>
      <h5>El sacrificio individual</h5>
      <p>A nivel individual, pensar con lógica significa aceptar que uno puede estar equivocado — no como posibilidad remota, sino como algo que probablemente ya está pasando ahora mismo, en alguna idea que sostenemos con firmeza. Es incómodo. Duele más que estar equivocado en un dato suelto: duele porque a veces la idea equivocada es parte de cómo nos definimos.</p>
      <p>El sacrificio individual no es solo intelectual. Es también el sacrificio de la comodidad de tener razón. De pertenecer sin cuestionar. De repetir lo que el grupo repite porque repetirlo cuesta menos que pensarlo. Elegir la lógica sobre la comodidad es elegir, muchas veces, el camino más solitario en el momento — aunque termine siendo el más acompañado con el tiempo, cuando otros llegan a la misma conclusión por su propio camino.</p>
      <h5>El sacrificio familiar</h5>
      <p>La familia es donde la lógica se pone más difícil de sostener, porque ahí el costo no es abstracto: tiene nombre, tiene cara, tiene años de cariño detrás. Decirle a un padre que una tradición que él vivió como verdad absoluta ya no sostiene el peso de lo que sabemos hoy, no es un ejercicio académico. Es arriesgar la cena de Nochebuena, la relación con un hermano, la paz de una casa.</p>
      <p>Y sin embargo, ahí es exactamente donde más se necesita. Las ideas que más nos cuestan de cambiar suelen ser las que aprendimos más temprano, de la gente que más confiamos, en el momento en que menos preguntas hacíamos. Romper con una idea heredada no es faltarle el respeto a quien nos la dio — es, paradójicamente, la forma más seria de tomarnos en serio lo que ellos mismos querían para nosotros: un futuro mejor que el suyo.</p>
      <h5>El sacrificio cultural</h5>
      <p>A nivel de pueblo, de país, de cultura, el sacrificio se multiplica porque ya no hablamos de una sola conversación difícil, sino de miles, simultáneas, muchas veces sin que nadie se ponga de acuerdo en tenerlas al mismo tiempo. Una cultura no cambia de opinión en una sola generación sin fricción — cambia con generaciones enteras que se sienten, en algún momento, extrañas entre sí. Los mayores ven "perderse" algo que construyeron con sacrificio real. Los jóvenes ven "cargar" algo que nunca eligieron.</p>
      <p>Usar la lógica como sociedad significa aceptar esa fricción como el costo de no quedarnos donde estamos. Significa que vamos a equivocarnos en público, corregir en público, y volver a equivocarnos — porque ese es, literalmente, el único método que ha funcionado alguna vez para que un grupo de seres imperfectos construya algo mejor de lo que cualquiera de ellos podría construir solo.</p>
      <h5>Por qué vale la pena de todas formas</h5>
      <p>Nada de esto es un argumento contra la lógica. Es, más bien, la razón por la que tan pocos la sostienen hasta el final: porque parece más barata la costumbre, hasta que se suma la factura completa — generaciones repitiendo el mismo error porque nadie quiso pagar el precio de cuestionarlo a tiempo.</p>
      <p>El sacrificio individual, familiar y cultural que exige pensar con lógica no es un efecto secundario desafortunado del progreso. Es, literalmente, cómo se ve el progreso desde adentro, mientras está pasando. No hay una versión de mejorar como sociedad que no incluya, en algún punto, decirle a alguien que queremos: "creo que esto que hacíamos ya no nos sirve" — y sostenerlo, aunque cueste.</p>
      <h5>El cierre</h5>
      <p>No escribo esto desde la certeza de tener razón en todo lo que cuestiono. La escribo, precisamente, desde lo contrario: sabiendo que voy a equivocarme, que ya me he equivocado, y que seguiré haciéndolo mientras siga pensando en voz alta en este espacio. Eso también es parte del sacrificio — exponerse a estar mal, en público, con nombre y todo, aunque aquí ese nombre sea un pseudónimo.</p>
      <p>Pero hay algo que sostiene todo esto, y es esperanza, no ingenuidad: cada generación que ha decidido pagar el precio de pensar distinto a la anterior — con respeto, sin odio, sin querer borrar a quien pensaba diferente, solo insistiendo en preguntar más — le ha dejado a la siguiente un mundo con un poco menos de lo que no funcionaba y un poco más de lo que sí.</p>
      <p>No le vamos a dejar a los que amamos, ni a los que no conoceremos nunca, un mundo perfecto. Eso no está en nuestras manos, y prometerlo sería mentir. Lo que sí está en nuestras manos es dejarles uno mejor que el que recibimos — con la misma lógica incómoda, el mismo sacrificio necesario, y la misma esperanza terca que trajo hasta aquí a cada generación que decidió no conformarse. Ese es el trabajo. Empieza, como casi todo lo que de verdad importa, en una sola conversación difícil a la vez.</p>
      <p class="foro-meta">— Aliado Imperfekto</p>
    </article>`;

  document.addEventListener('DOMContentLoaded', () => {
    const subnav = document.getElementById('rh-subnav');
    const container = document.getElementById('rh-logica-gate');
    if (!subnav || !container) return;

    function activar(subseccion) {
      if (subseccion === 'logica-humana') {
        container.hidden = false;
        activarLogicaHumana(container);
      } else {
        container.hidden = true;
        container.innerHTML = '';
      }
    }

    subnav.addEventListener('click', (e) => {
      const btn = e.target.closest('.foro-filter-btn');
      if (btn) activar(btn.dataset.subseccion || '');
    });

    const activeBtn = subnav.querySelector('.foro-filter-btn.active');
    if (activeBtn) activar(activeBtn.dataset.subseccion || '');
  });
})();
