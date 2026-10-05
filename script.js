// ============================================================
// script.js — Sabías que PR · v2
// Incluye: dark mode, menú hamburguesa, carrito Stripe,
//          newsletter Mailchimp, formulario Formspree, nav activo
// ============================================================

document.addEventListener('DOMContentLoaded', () => {

  // ══════════════════════════════════════════════════════════
  // 1. TEMA — Claro por defecto; el modo oscuro se guarda en localStorage
  // ══════════════════════════════════════════════════════════
  const html        = document.documentElement;
  const themeToggle = document.getElementById('theme-toggle');
  const themeLabel  = themeToggle?.querySelector('.theme-label');

  // Claro por defecto; solo se usa oscuro si la persona lo eligió
  const initTheme = localStorage.getItem('sqpr-theme') === 'dark' ? 'dark' : 'light';

  applyTheme(initTheme);

  themeToggle?.addEventListener('click', () => {
    const next = html.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('sqpr-theme', next);
  });

  function applyTheme(theme) {
    html.dataset.theme = theme;
    if (themeLabel) themeLabel.textContent = theme === 'dark' ? 'Claro' : 'Oscuro';
    themeToggle?.setAttribute('aria-label', theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
  }

  // ══════════════════════════════════════════════════════════
  // 2. MENÚ HAMBURGUESA
  // ══════════════════════════════════════════════════════════
  const navToggle = document.querySelector('.nav-toggle');
  const navMenu   = document.querySelector('#nav-menu');

  if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
      const isOpen = navMenu.classList.toggle('nav-open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
    });
    document.addEventListener('click', e => {
      if (!navToggle.contains(e.target) && !navMenu.contains(e.target)) {
        navMenu.classList.remove('nav-open');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
    navMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      navMenu.classList.remove('nav-open');
      navToggle.setAttribute('aria-expanded', 'false');
    }));
  }

  // ══════════════════════════════════════════════════════════
  // 3. ENLACE ACTIVO EN NAV
  // ══════════════════════════════════════════════════════════
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav a').forEach(a => {
    a.classList.toggle('nav-active', a.getAttribute('href') === currentPage);
  });

  // ══════════════════════════════════════════════════════════
  // 4. CARRITO DE COMPRAS (con soporte Stripe Payment Links)
  // ══════════════════════════════════════════════════════════
  let cart = [];

  const cartBtn      = document.getElementById('cart-btn');
  const cartDrawer   = document.getElementById('cart-drawer');
  const cartClose    = document.getElementById('cart-close');
  const cartOverlay  = document.getElementById('cart-overlay');
  const cartItemsEl  = document.getElementById('cart-items');
  const cartTotalEl  = document.getElementById('cart-total');
  const cartCountEl  = document.getElementById('cart-count');
  const cartCheckout = document.getElementById('cart-checkout');

  // ── Foco accesible para el carrito y el modal de login ─────
  // Al abrir, el foco entra al panel; Tab se queda dentro; Escape cierra;
  // al cerrar, el foco vuelve a donde estaba.
  const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  let lastFocus = null;

  function focusables(root) {
    return Array.from(root.querySelectorAll(FOCUSABLE)).filter(el => el.offsetParent !== null);
  }
  function trapTab(e, root) {
    if (e.key !== 'Tab' || !root) return;
    const items = focusables(root);
    if (!items.length) return;
    const first = items[0];
    const last  = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  function restoreFocus(fallback) {
    const target = lastFocus && document.contains(lastFocus) ? lastFocus : fallback;
    lastFocus = null;
    target?.focus();
  }

  // Abrir/cerrar carrito (cerrado = `inert`, así sus botones no reciben Tab)
  if (cartDrawer) cartDrawer.inert = true;
  function openCart() {
    if (!cartDrawer) return;
    if (!cartDrawer.classList.contains('open')) lastFocus = document.activeElement;
    cartDrawer.inert = false;
    cartDrawer.classList.add('open');
    cartOverlay?.classList.add('open');
    cartDrawer.removeAttribute('aria-hidden');
    cartClose?.focus();
  }
  function closeCart() {
    if (!cartDrawer) return;
    const wasOpen = cartDrawer.classList.contains('open');
    cartDrawer.classList.remove('open');
    cartOverlay?.classList.remove('open');
    cartDrawer.setAttribute('aria-hidden', 'true');
    cartDrawer.inert = true;
    if (wasOpen) restoreFocus(cartBtn);
  }

  cartBtn?.addEventListener('click', openCart);
  cartClose?.addEventListener('click', closeCart);
  cartOverlay?.addEventListener('click', closeCart);

  // Añadir al carrito (lo dispara el listener delegado de data-cart-action)
  window.addToCart = function(btn) {
    const id    = btn.dataset.productId;
    const name  = btn.dataset.productName;
    const price = parseFloat(btn.dataset.productPrice);
    const link  = btn.dataset.stripeLink;

    const existing = cart.find(i => i.id === id);
    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({ id, name, price, link, qty: 1 });
    }

    updateCartUI();
    showToast(`"${name}" añadido al carrito 🛒`);
    openCart();
  };

  function updateCartUI() {
    if (!cartItemsEl || !cartTotalEl || !cartCountEl) return;

    const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const count = cart.reduce((s, i) => s + i.qty, 0);

    cartCountEl.textContent = count;
    cartTotalEl.textContent = '$' + total.toFixed(2);

    if (cart.length === 0) {
      cartItemsEl.innerHTML = '<p class="cart-empty">Tu carrito está vacío.</p>';
      return;
    }

    // Sin onclick="..." en el HTML generado: un CSP sin 'unsafe-inline' no
    // ejecuta manejadores en linea. Los botones llevan data-cart-action y un
    // solo listener delegado (mas abajo) los atiende.
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    cartItemsEl.innerHTML = cart.map(item => `
      <div class="cart-item">
        <span class="cart-item-name">${esc(item.name)}</span>
        <div class="cart-item-controls">
          <button type="button" class="qty-btn" data-cart-action="qty" data-id="${esc(item.id)}" data-delta="-1">−</button>
          <span class="cart-item-qty">${item.qty}</span>
          <button type="button" class="qty-btn" data-cart-action="qty" data-id="${esc(item.id)}" data-delta="1">+</button>
        </div>
        <span class="cart-item-price">$${(item.price * item.qty).toFixed(2)}</span>
        <button type="button" class="cart-remove" data-cart-action="remove" data-id="${esc(item.id)}" aria-label="Eliminar">✕</button>
      </div>`).join('');
  }

  window.changeQty = function(id, delta) {
    const item = cart.find(i => i.id === id);
    if (!item) return;
    item.qty = Math.max(0, item.qty + delta);
    if (item.qty === 0) cart = cart.filter(i => i.id !== id);
    updateCartUI();
  };

  window.removeItem = function(id) {
    cart = cart.filter(i => i.id !== id);
    updateCartUI();
  };

  // Un solo listener para los botones del carrito (los de la tienda y los del
  // propio panel del carrito, que se vuelven a pintar con cada cambio).
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-cart-action]');
    if (!el) return;
    const accion = el.dataset.cartAction;
    if (accion === 'add') window.addToCart(el);
    else if (accion === 'qty') window.changeQty(el.dataset.id, Number(el.dataset.delta));
    else if (accion === 'remove') window.removeItem(el.dataset.id);
  });

  // Checkout unificado → una sola sesion de Stripe con todos los productos
  // del carrito como line_items, sin importar cuantos sean. Requiere sesion
  // iniciada porque el pedido queda asociado a la cuenta (ver "Mis pedidos").
  function waitForSharedSupabase(timeoutMs = 1500, intervalMs = 50) {
    return new Promise((resolve) => {
      const start = Date.now();
      (function check() {
        if (window.supabase) return resolve(window.supabase);
        if (Date.now() - start >= timeoutMs) return resolve(null);
        setTimeout(check, intervalMs);
      })();
    });
  }

  cartCheckout?.addEventListener('click', async () => {
    if (cart.length === 0) { showToast('Tu carrito está vacío.'); return; }

    const supabase = await waitForSharedSupabase();
    const { data: { session } = {} } = supabase ? await supabase.auth.getSession() : {};
    if (!session) {
      showToast('Inicia sesión para completar tu compra.');
      closeCart();
      window.openLoginModal?.();
      return;
    }

    const apiUrl = (window.SITE_CONFIG && window.SITE_CONFIG.apiUrl) || 'http://localhost:3000';
    const originalLabel = cartCheckout.textContent;
    cartCheckout.disabled = true;
    cartCheckout.textContent = 'Procesando...';
    try {
      const res = await fetch(apiUrl + '/api/stripe/create-checkout-session-tienda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ items: cart.map(i => ({ productId: i.id, qty: i.qty })) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo iniciar el pago.');
      window.location.href = data.url;
    } catch (err) {
      showToast('⚠️ ' + err.message);
      cartCheckout.disabled = false;
      cartCheckout.textContent = originalLabel;
    }
  });

  // ══════════════════════════════════════════════════════════
  // 4b. LOGIN — Modal accesible desde cualquier página
  // ══════════════════════════════════════════════════════════
  const loginTriggerBtn   = document.getElementById('login-trigger-btn');
  const loginModalOverlay = document.getElementById('login-modal-overlay');
  const loginModalClose   = document.getElementById('login-modal-close');

  const loginModal = document.getElementById('login-modal');
  const isLoginOpen = () => loginModalOverlay?.classList.contains('open');

  function openLoginModal() {
    if (!loginModalOverlay) return;
    if (!isLoginOpen()) lastFocus = document.activeElement;
    loginModalOverlay.classList.add('open');
    loginTriggerBtn?.setAttribute('aria-expanded', 'true');
    window.onLoginModalOpen?.();
    const emailField = document.getElementById('login-email');
    (emailField?.offsetParent ? emailField : (focusables(loginModal || loginModalOverlay)[0] || loginModalClose))?.focus();
  }
  function closeLoginModal() {
    const wasOpen = isLoginOpen();
    loginModalOverlay?.classList.remove('open');
    loginTriggerBtn?.setAttribute('aria-expanded', 'false');
    if (wasOpen) restoreFocus(loginTriggerBtn);
  }

  loginTriggerBtn?.addEventListener('click', () => {
    isLoginOpen() ? closeLoginModal() : openLoginModal();
  });
  loginModalClose?.addEventListener('click', closeLoginModal);
  loginModalOverlay?.addEventListener('click', (e) => {
    if (e.target === loginModalOverlay) closeLoginModal();
  });
  document.addEventListener('keydown', (e) => {
    const cartOpen = cartDrawer?.classList.contains('open');
    if (e.key === 'Escape') {
      if (isLoginOpen()) closeLoginModal();
      else if (cartOpen) closeCart();
      return;
    }
    if (isLoginOpen()) trapTab(e, loginModal);
    else if (cartOpen) trapTab(e, cartDrawer);
  });

  // Cualquier enlace/botón con esta clase abre el modal de login (usado por
  // los avisos "inicia sesión para..." del foro/premium/admin). Delegado en
  // document porque varios de estos avisos se insertan dinámicamente
  // después de este DOMContentLoaded (ej. renderDetail() del foro, el gate
  // del panel de admin) y no existirían todavía si se enlazaran uno a uno.
  document.addEventListener('click', (e) => {
    if (e.target.closest('.login-modal-trigger')) {
      e.preventDefault();
      openLoginModal();
    }
  });

  window.openLoginModal  = openLoginModal;
  window.closeLoginModal = closeLoginModal;

  // ══════════════════════════════════════════════════════════
  // 5. NEWSLETTER — Beehiiv, via nuestro propio backend
  // ══════════════════════════════════════════════════════════
  // La llave de Beehiiv es secreta y nunca puede llegar al navegador (a
  // diferencia del truco JSONP que usaba Mailchimp con solo un id publico)
  // -- por eso este formulario le manda el correo a nuestra propia API
  // (/api/newsletter/subscribe), y es el backend quien habla con Beehiiv.
  document.querySelectorAll('.newsletter-form').forEach(form => {
    const statusEl = form.parentElement?.querySelector('.newsletter-status');

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const emailInput = form.querySelector('input[type="email"]');
      const email = emailInput?.value?.trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setNLStatus(statusEl, 'Escribe un correo electrónico válido.', 'error');
        return;
      }

      setNLStatus(statusEl, 'Suscribiendo...', 'info');

      try {
        const apiUrl = (window.SITE_CONFIG && window.SITE_CONFIG.apiUrl) || 'http://localhost:3000';
        const res = await fetch(apiUrl + '/api/newsletter/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) {
          setNLStatus(statusEl, '¡Suscripción exitosa! Revisa tu correo para confirmar.', 'ok');
          form.reset();
        } else {
          setNLStatus(statusEl, data.error || 'No se pudo completar la suscripción.', 'error');
        }
      } catch {
        setNLStatus(statusEl, 'Error de conexión. Inténtalo de nuevo.', 'error');
      }
    });
  });

  function setNLStatus(el, msg, type) {
    if (!el) return;
    el.textContent = msg;
    el.className = 'newsletter-status ' + type;
  }

  // ══════════════════════════════════════════════════════════
  // 5b. RELLENO CON LA SESIÓN — correo (y nombre, si se conoce) en el
  //     formulario de contacto y en los del boletín
  // ══════════════════════════════════════════════════════════
  // Idea del usuario (2026-10-05): con la sesion iniciada el correo ya viene
  // escrito, pero la persona puede escribir otro. Reglas: solo se rellena un campo
  // VACIO que la persona no haya tocado; al cerrar sesion se vacia lo que rellenamos
  // nosotros; sin sesion no se toca nada. Se escribe con .value (nunca como HTML).
  // INICIO relleno-sesion
  (async function rellenarConLaSesion() {
    const camposCorreo = [...document.querySelectorAll('.newsletter-form input[type="email"], #contact-form #email')];
    const campoNombre = document.querySelector('#contact-form #nombre');
    const pista = document.getElementById('email-hint');
    const todos = [...camposCorreo, campoNombre].filter(Boolean);
    if (!todos.length) return;

    todos.forEach(campo => campo.addEventListener('input', () => {
      campo.dataset.editado = '1';
      if (pista && campo.id === 'email') pista.hidden = true;
    }));

    function poner(campo, valor) {
      if (valor) {
        if (campo.value.trim() === '' && campo.dataset.editado !== '1') {
          campo.value = valor;
          campo.dataset.rellenado = '1';
        }
      } else if (campo.dataset.rellenado === '1' && campo.dataset.editado !== '1') {
        campo.value = '';
        delete campo.dataset.rellenado;
      }
    }

    function aplicar(session) {
      const usuario = session?.user ?? null;
      const meta = usuario?.user_metadata || {};
      const nombre = String(meta.full_name || meta.name || meta.nombre || '').trim();
      camposCorreo.forEach(campo => poner(campo, usuario?.email || ''));
      if (campoNombre) poner(campoNombre, nombre);
      const correoContacto = document.querySelector('#contact-form #email');
      if (pista) pista.hidden = !(usuario && correoContacto && correoContacto.dataset.rellenado === '1' && correoContacto.dataset.editado !== '1');
    }

    const cliente = await waitForSharedSupabase(5000);
    if (!cliente) return;
    const { data: { session } = {} } = await cliente.auth.getSession();
    aplicar(session);
    cliente.auth.onAuthStateChange((_evento, nuevaSesion) => aplicar(nuevaSesion));
  })();
  // FIN relleno-sesion

  // ══════════════════════════════════════════════════════════
  // 6. FORMULARIO DE CONTACTO — Formspree AJAX
  // ══════════════════════════════════════════════════════════
  const contactForm = document.querySelector('#contact-form');
  const formStatus  = document.querySelector('#form-status');
  const submitBtn   = document.querySelector('#submit-btn');

  if (contactForm) {
    contactForm.addEventListener('submit', async e => {
      e.preventDefault();

      const nombre  = (contactForm.nombre?.value  || '').trim();
      const email   = (contactForm.email?.value   || '').trim();
      const mensaje = (contactForm.mensaje?.value || '').trim();
      const errores = [];

      if (nombre.length < 2)  errores.push('Por favor escribe tu nombre completo.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errores.push('Escribe un correo válido.');
      if (mensaje.length < 10) errores.push('El mensaje debe tener al menos 10 caracteres.');

      if (errores.length > 0) { setFStatus('error', errores.join(' ')); return; }

      const action = contactForm.getAttribute('action') || '';
      if (action.includes('YOUR_FORM_ID')) {
        setFStatus('ok',
          'Formulario validado. Activa el envío real configurando ' +
          '<a href="https://formspree.io" target="_blank">formspree.io</a> en build.js.'
        );
        return;
      }

      setFStatus('info', 'Enviando...');
      if (submitBtn) submitBtn.disabled = true;

      try {
        const res = await fetch(action, {
          method: 'POST',
          body: new FormData(contactForm),
          headers: { Accept: 'application/json' },
        });
        if (res.ok) {
          setFStatus('ok', '¡Mensaje enviado! Te responderemos pronto.');
          contactForm.reset();
        } else {
          const d = await res.json().catch(() => ({}));
          setFStatus('error', '' + (d.errors?.map(x => x.message).join(', ') || 'Error.'));
        }
      } catch {
        setFStatus('error', 'Sin conexión. Escríbenos a <a href="mailto:sabiasquepr@yahoo.com">sabiasquepr@yahoo.com</a>');
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  function setFStatus(type, html) {
    if (!formStatus) return;
    formStatus.innerHTML = html;
    formStatus.className = 'form-status ' + type;
  }

  // ══════════════════════════════════════════════════════════
  // 7. TOAST NOTIFICATIONS
  // ══════════════════════════════════════════════════════════
  function showToast(msg, duration = 3500) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast-show'));
    setTimeout(() => {
      toast.classList.remove('toast-show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  window.showToast = showToast; // Exponer globalmente

});
