// Boton "Detras del farol" en la caja del autor de Revolucion Humana:
// revela el texto interpretativo de Aliado Imperfekto sobre la imagen
// de portada (misma logica de toggle que "Logica" en logica-humana.js).
(function () {
  const SIGNIFICADO_HTML = `
    <article class="lh-ensayo">
      <h4>Lo que esta imagen carga</h4>
      <p>Cuando terminé esta escena no tenía intención de convertirla en símbolo de nada — solo quería una imagen que representara caminar hacia algo mejor. Pero entre más la miro, más se explica sola, y me parece justo compartir lo que veo en ella, no como instrucción de cómo leerla, sino como la intención con la que fue armada.</p>
      <p>Al frente camina una mujer. No es casualidad que lidere: representa la continuación de la humanidad, la esperanza que sigue moviéndose hacia adelante aunque el camino no esté garantizado. Detrás de ella, una pareja de ancianos avanza más despacio — son la sabiduría, el respeto, la estructura sobre la que se construye todo lo demás. No van solos: una pareja de dos hombres camina junto al anciano, sosteniéndolo, protegiéndolo; una pareja de dos mujeres acompaña a la anciana, de la misma manera. No están ahí para llenar un cupo — están ahí porque eso es exactamente lo que demuestra unión real: comprensión, tolerancia con el cambio de los tiempos, la prueba de que cuidar a quien nos dio la base no depende de a quién ama quien cuida.</p>
      <p>Más adelante, un padre carga a su hijo en los hombros — no porque el niño no pueda caminar, sino porque ese padre eligió pensar primero en el futuro de su cría que en el suyo propio. Ese es el sacrificio silencioso que sostiene a cualquier generación que mejora: alguien decidiendo cargar peso extra para que otro llegue más lejos.</p>
      <p>Junto a ellos camina una familia completa, unida — el ejemplo de que la adversidad no tiene por qué separar, de que se puede atravesar lo difícil sin soltarse. Y cerca, una madre camina con su hijo, buscando, como tantos, una vida nueva — no porque la anterior no valiera, sino porque cree que hay algo mejor esperando si sigue caminando.</p>
      <p>Al final del grupo, sosteniendo el farol, va la figura encapuchada — no al frente, guiando, sino al final, cuidando que nadie se quede atrás. Ese lugar no es casualidad: los verdaderos protectores no necesitan ir primero. Van donde se les necesita, garantizando que el futuro que se ve en el horizonte llegue para todos los que caminan hacia él, no solo para quien va delante.</p>
      <p>No es una imagen sobre un grupo perfecto caminando hacia un final feliz garantizado. Es una imagen sobre lo que se necesita para intentarlo: liderazgo, memoria, sacrificio, unión, y alguien dispuesto a cuidar la retaguardia. Imperfectamente, como todo lo que vale la pena.</p>
      <p class="foro-meta">— Aliado Imperfekto</p>
    </article>`;

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('rh-btn-significado');
    const contenido = document.getElementById('rh-imagen-significado');
    if (!btn || !contenido) return;

    btn.addEventListener('click', () => {
      const abrir = contenido.hidden;
      contenido.hidden = !abrir;
      btn.setAttribute('aria-expanded', String(abrir));
      if (abrir) {
        contenido.innerHTML = SIGNIFICADO_HTML;
        contenido.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  });
})();
