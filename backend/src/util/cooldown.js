// Espera minima en memoria entre dos acciones de la misma persona (por id de
// usuario). Es una capa simple contra el spam rapido: se reinicia si el
// servidor se reinicia y no se comparte entre instancias, lo cual alcanza para
// el plan gratis de Render (una instancia). No reemplaza al rate limit de app.js.
function crearCooldown(ms) {
  const ultimo = new Map();
  return {
    // Segundos que faltan para poder actuar de nuevo (0 si ya puede).
    segundosRestantes(userId) {
      const t = ultimo.get(userId);
      if (!t) return 0;
      const falta = ms - (Date.now() - t);
      if (falta <= 0) { ultimo.delete(userId); return 0; }
      return Math.ceil(falta / 1000);
    },
    marcar(userId) {
      if (ultimo.size > 5000) {
        const ahora = Date.now();
        for (const [id, t] of ultimo) if (ahora - t >= ms) ultimo.delete(id);
      }
      ultimo.set(userId, Date.now());
    },
    reset() { ultimo.clear(); },
  };
}

module.exports = { crearCooldown };
