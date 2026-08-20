// ============================================================
// script.js — Sabías que PR · v2
// Incluye: dark mode, menú hamburguesa, carrito Stripe,
//          newsletter Mailchimp, formulario Formspree, nav activo
// ============================================================

document.addEventListener('DOMContentLoaded', () => {

  // ══════════════════════════════════════════════════════════
  // 1. DARK MODE — Toggle con localStorage y prefers-color-scheme
  // ══════════════════════════════════════════════════════════
  const html        = document.documentElement;
  const themeToggle = document.getElementById('theme-toggle');
  const themeIcon   = themeToggle?.querySelector('.theme-icon');
  const themeLabel  = themeToggle?.querySelector('.theme-label');

  // Leer preferencia guardada o del sistema
  const savedTheme  = localStorage.getItem('sqpr-theme');
  const systemDark  = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initTheme   = savedTheme || (systemDark ? 'dark' : 'light');

  applyTheme(initTheme);

  themeToggle?.addEventListener('click', () => {
    const next = html.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('sqpr-theme', next);
  });

  function applyTheme(theme) {
    html.dataset.theme = theme;
    if (themeIcon)  themeIcon.textContent  = theme === 'dark' ? '☀️' : '🌙';
    if (themeLabel) themeLabel.textContent = theme === 'dark' ? 'Claro' : 'Oscuro';
  }

  // Escuchar cambios del sistema operativo
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!localStorage.getItem('sqpr-theme')) applyTheme(e.matches ? 'dark' : 'light');
  });

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

  // Abrir/cerrar carrito
  function openCart()  { cartDrawer?.classList.add('open');  cartOverlay?.classList.add('open'); cartDrawer?.removeAttribute('aria-hidden'); }
  function closeCart() { cartDrawer?.classList.remove('open'); cartOverlay?.classList.remove('open'); cartDrawer?.setAttribute('aria-hidden', 'true'); }

  cartBtn?.addEventListener('click', openCart);
  cartClose?.addEventListener('click', closeCart);
  cartOverlay?.addEventListener('click', closeCart);

  // Añadir al carrito (llamado desde HTML con onclick)
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

    cartItemsEl.innerHTML = cart.map(item => `
      <div class="cart-item">
        <span class="cart-item-name">${item.name}</span>
        <div class="cart-item-controls">
          <button class="qty-btn" onclick="changeQty('${item.id}', -1)">−</button>
          <span class="cart-item-qty">${item.qty}</span>
          <button class="qty-btn" onclick="changeQty('${item.id}', 1)">+</button>
        </div>
        <span class="cart-item-price">$${(item.price * item.qty).toFixed(2)}</span>
        <button class="cart-remove" onclick="removeItem('${item.id}')" aria-label="Eliminar">✕</button>
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

  // Checkout → Stripe
  // Si todos los productos tienen el mismo Stripe link → redirigir directo
  // Si hay mezcla → mostrar lista con links individuales
  cartCheckout?.addEventListener('click', () => {
    if (cart.length === 0) { showToast('Tu carrito está vacío.'); return; }

    const realLinks = cart.filter(i => i.link && !i.link.startsWith('YOUR_'));

    if (realLinks.length === 0) {
      // Stripe no configurado aún
      showToast('🛒 Pagos vía Stripe próximamente. ¡Gracias por tu interés!');
      return;
    }

    if (realLinks.length === 1 && cart.length === 1) {
      // Un solo producto con link → ir directo
      window.open(realLinks[0].link, '_blank');
    } else {
      // Múltiples productos → mostrar resumen con links individuales
      const summary = cart.map(i => {
        const hasLink = i.link && !i.link.startsWith('YOUR_');
        return hasLink
          ? `• <a href="${i.link}" target="_blank" rel="noopener">${i.name} x${i.qty} — $${(i.price*i.qty).toFixed(2)}</a>`
          : `• ${i.name} x${i.qty} — $${(i.price*i.qty).toFixed(2)} (link próximamente)`;
      }).join('<br>');
      const div = cartItemsEl;
      if (div) {
        div.innerHTML = `<div class="checkout-summary">
          <p style="font-weight:700;margin-bottom:8px;">Compra por producto:</p>
          <p style="line-height:2;">${summary}</p>
          <p style="margin-top:12px;font-size:0.78rem;color:#6b7280;">Nota: En la versión completa habrá un checkout unificado vía Stripe.</p>
        </div>`;
      }
    }
  });

  // ══════════════════════════════════════════════════════════
  // 5. NEWSLETTER — Mailchimp JSONP
  // ══════════════════════════════════════════════════════════
  const cfg = window.SITE_CONFIG || {};

  document.querySelectorAll('.newsletter-form').forEach(form => {
    const statusEl = form.parentElement?.querySelector('.newsletter-status');

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const emailInput = form.querySelector('input[type="email"]');
      const email = emailInput?.value?.trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setNLStatus(statusEl, '❌ Escribe un correo electrónico válido.', 'error');
        return;
      }

      setNLStatus(statusEl, '⏳ Suscribiendo...', 'info');

      if (!cfg.mcUser || cfg.mcUser === 'YOUR_MC_USER') {
        // Mailchimp no configurado aún
        setTimeout(() => {
          setNLStatus(statusEl, '✅ ¡Gracias! Te avisaremos cuando el boletín esté activo.', 'ok');
          form.reset();
        }, 600);
        return;
      }

      // JSONP real a Mailchimp
      try {
        const result = await subscribeMailchimp(email, cfg.mcUser, cfg.mcList, cfg.mcServer);
        if (result.ok) {
          setNLStatus(statusEl, '✅ ¡Suscripción exitosa! Revisa tu correo para confirmar.', 'ok');
          form.reset();
        } else {
          const msg = result.msg?.replace(/<[^>]*>/g, '') || 'Error desconocido.';
          setNLStatus(statusEl, '❌ ' + msg, 'error');
        }
      } catch {
        setNLStatus(statusEl, '❌ Error de conexión. Inténtalo de nuevo.', 'error');
      }
    });
  });

  function setNLStatus(el, msg, type) {
    if (!el) return;
    el.textContent = msg;
    el.className = 'newsletter-status ' + type;
  }

  function subscribeMailchimp(email, user, list, server) {
    return new Promise(resolve => {
      const cbName = 'mc_cb_' + Date.now();
      const scriptId = cbName + '_script';

      window[cbName] = data => {
        delete window[cbName];
        document.getElementById(scriptId)?.remove();
        resolve({ ok: data.result === 'success', msg: data.msg });
      };

      const url = `https://${server}.list-manage.com/subscribe/post-json` +
        `?u=${encodeURIComponent(user)}&id=${encodeURIComponent(list)}` +
        `&EMAIL=${encodeURIComponent(email)}&c=${cbName}`;

      const script = document.createElement('script');
      script.id  = scriptId;
      script.src = url;
      script.onerror = () => resolve({ ok: false, msg: 'Error de red.' });
      document.body.appendChild(script);

      // Timeout de seguridad
      setTimeout(() => {
        if (window[cbName]) {
          delete window[cbName];
          document.getElementById(scriptId)?.remove();
          resolve({ ok: false, msg: 'Tiempo de espera agotado.' });
        }
      }, 8000);
    });
  }

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
          '✅ Formulario validado. Activa el envío real configurando ' +
          '<a href="https://formspree.io" target="_blank">formspree.io</a> en build.js.'
        );
        return;
      }

      setFStatus('info', '⏳ Enviando...');
      if (submitBtn) submitBtn.disabled = true;

      try {
        const res = await fetch(action, {
          method: 'POST',
          body: new FormData(contactForm),
          headers: { Accept: 'application/json' },
        });
        if (res.ok) {
          setFStatus('ok', '✅ ¡Mensaje enviado! Te responderemos pronto.');
          contactForm.reset();
        } else {
          const d = await res.json().catch(() => ({}));
          setFStatus('error', '❌ ' + (d.errors?.map(x => x.message).join(', ') || 'Error.'));
        }
      } catch {
        setFStatus('error', '❌ Sin conexión. Escríbenos a <a href="mailto:sabiasquepr@yahoo.com">sabiasquepr@yahoo.com</a>');
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
