// reporte.js — cuadro para reportar contenido, compartido por el debate (debate.js) y los comentarios de
// noticias y contenidos (comentarios.js). Resuelve el motivo escrito o null si la persona cancela.
(function () {
  function tr(texto) {
    return window.SQPR && window.SQPR.t ? window.SQPR.t(texto) : texto;
  }

  function pedirMotivoReporte() {
    return new Promise((resolve) => {
      const dlg = document.createElement('dialog');
      dlg.className = 'debate-dialog';
      dlg.innerHTML = `
        <form>
          <h3>${tr('Reportar contenido')}</h3>
          <p class="admin-hint">${tr('Cuéntanos qué está mal. El equipo lo revisa y decide.')}</p>
          <label for="debate-reporte-motivo">${tr('Motivo del reporte (mínimo 5 caracteres)')}</label>
          <textarea id="debate-reporte-motivo" rows="4" maxlength="500" required></textarea>
          <p class="form-status" aria-live="polite"></p>
          <div class="debate-dialog-actions">
            <button type="button" class="btn-alt" data-accion="cancelar">${tr('Cancelar')}</button>
            <button type="submit">${tr('Enviar reporte')}</button>
          </div>
        </form>`;
      document.body.appendChild(dlg);
      const ta = dlg.querySelector('textarea');
      const estado = dlg.querySelector('.form-status');
      const cerrar = (valor) => { dlg.close(); dlg.remove(); resolve(valor); };
      dlg.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        const motivo = ta.value.trim();
        if (motivo.length < 5) {
          estado.textContent = tr('Escribe al menos 5 caracteres.');
          estado.className = 'form-status error';
          return;
        }
        cerrar(motivo);
      });
      dlg.querySelector('[data-accion="cancelar"]').addEventListener('click', () => cerrar(null));
      dlg.addEventListener('cancel', (e) => { e.preventDefault(); cerrar(null); });
      dlg.showModal();
      ta.focus();
    });
  }

  window.SQPR = window.SQPR || {};
  window.SQPR.pedirMotivoReporte = pedirMotivoReporte;
})();
