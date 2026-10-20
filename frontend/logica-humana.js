// ============================================================
// logica-humana.js — Sabías que PR · Área personal de Aliado Imperfekto
// ============================================================
// Sub-sección "Lógica Humana" dentro de Revolución Humana: espacio de
// ensayos/recursos propios de Aliado Imperfekto. Es una sección normal,
// abierta a cualquiera -- 2026-09-27 se eliminaron los tres gates que
// tenía (edad 18+, premium, y el aviso de términos/Sección 230): el
// usuario decidió que ver el sitio completo debe ser gratis para
// cualquiera, con o sin cuenta, y que el aviso legal no era obligatorio
// por ley (Sección 230 protege a la plataforma sin necesidad de
// mostrárselo al usuario, y ya está cubierto de forma general en
// terminos.html). Solo queda el acordeón de "Herramientas".
// ============================================================

(function () {
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
        renderHerramientas(container);
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
