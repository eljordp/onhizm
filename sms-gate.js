(function () {
  const ACCESS_KEY = 'onhizm:sms-access:v1';
  const DISMISSED_KEY = 'onhizm:sms-gate-dismissed:v1';
  const CONSENT_TEXT =
    'I agree to receive recurring automated marketing text messages from ONHIZM at the phone number provided. Consent is not a condition of purchase. Msg & data rates may apply. Msg frequency varies. Reply STOP to unsubscribe or HELP for help.';

  let pendingUrl = null;
  let gateEl = null;

  function hasAccess() {
    try {
      const saved = JSON.parse(localStorage.getItem(ACCESS_KEY) || 'null');
      if (saved && saved.unlockedAt) return true;
    } catch {}
    return document.cookie.split('; ').some((row) => row === 'onhizm_sms_access=1');
  }

  function isDismissed() {
    try {
      return sessionStorage.getItem(DISMISSED_KEY) === '1';
    } catch {
      return false;
    }
  }

  function setAccess(phoneLast4) {
    const payload = { unlockedAt: new Date().toISOString(), phoneLast4 };
    localStorage.setItem(ACCESS_KEY, JSON.stringify(payload));
    document.cookie = 'onhizm_sms_access=1; Max-Age=31536000; Path=/; SameSite=Lax; Secure';
  }

  function isProtectedPath(pathname) {
    return pathname.endsWith('/shop.html') || pathname.includes('/products/');
  }

  function normalizePhone(value) {
    const raw = String(value || '').trim();
    const digits = raw.replace(/\D/g, '');
    if (raw.startsWith('+')) return `+${digits}`;
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    return raw;
  }

  function renderGate() {
    if (gateEl) return gateEl;

    gateEl = document.createElement('div');
    gateEl.className = 'sms-gate';
    gateEl.setAttribute('role', 'dialog');
    gateEl.setAttribute('aria-modal', 'true');
    gateEl.setAttribute('aria-labelledby', 'smsGateTitle');
    gateEl.innerHTML = `
      <div class="sms-gate__panel">
        <button type="button" class="sms-gate__close" aria-label="Close SMS signup">X</button>
        <span class="sms-gate__label">Text-First Drops</span>
        <h2 id="smsGateTitle">Unlock the next surprise drop.</h2>
        <p class="sms-gate__copy">ONHIZM pieces move by text first. Put your number in and the shop opens.</p>
        <form class="sms-gate__form" id="smsGateForm">
          <label class="sms-gate__field">
            <span>Phone number</span>
            <input type="tel" name="phone" inputmode="tel" autocomplete="tel" placeholder="(707) 555-0198" required>
          </label>
          <label class="sms-gate__consent">
            <input type="checkbox" name="consent" required>
            <span>${CONSENT_TEXT} <a href="${window.location.pathname.includes('/products/') ? '../policy.html' : 'policy.html'}" target="_blank" rel="noopener">Policy</a>.</span>
          </label>
          <button type="submit" class="sms-gate__submit">Unlock Shop</button>
          <p class="sms-gate__message" id="smsGateMessage" aria-live="polite"></p>
        </form>
      </div>
    `;

    document.body.appendChild(gateEl);
    gateEl.querySelector('.sms-gate__close').addEventListener('click', dismissGate);
    gateEl.querySelector('form').addEventListener('submit', submitGate);
    return gateEl;
  }

  function openGate(targetUrl) {
    pendingUrl = targetUrl || pendingUrl || window.location.href;
    renderGate();
    document.documentElement.classList.add('sms-gate-open');
    document.body.classList.add('sms-gate-open');
    const phone = gateEl.querySelector('input[name="phone"]');
    window.setTimeout(() => phone && phone.focus(), 50);
  }

  function closeGate() {
    document.documentElement.classList.remove('sms-gate-open');
    document.body.classList.remove('sms-gate-open');
    if (gateEl) {
      gateEl.remove();
      gateEl = null;
    }
  }

  function dismissGate() {
    try {
      sessionStorage.setItem(DISMISSED_KEY, '1');
    } catch {}
    closeGate();
  }

  async function submitGate(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const message = form.querySelector('#smsGateMessage');
    const button = form.querySelector('button[type="submit"]');
    const phone = normalizePhone(form.phone.value);

    message.textContent = '';
    button.disabled = true;
    button.textContent = 'Unlocking...';

    try {
      const response = await fetch('/api/sms-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          consentAccepted: form.consent.checked,
          sourcePage: window.location.href,
          intendedPath: pendingUrl,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Could not unlock access');
      }

      setAccess(data.phoneLast4 || phone.slice(-4));
      message.textContent = 'Unlocked. Taking you in...';
      message.classList.add('sms-gate__message--success');

      const destination = pendingUrl || window.location.href;
      const destinationUrl = new URL(destination, window.location.href);
      if (destinationUrl.href !== window.location.href && isProtectedPath(destinationUrl.pathname)) {
        window.location.href = destinationUrl.href;
      } else {
        closeGate();
      }
    } catch (err) {
      message.textContent = err.message || 'Could not unlock access. Try again.';
      message.classList.remove('sms-gate__message--success');
      button.disabled = false;
      button.textContent = 'Unlock Shop';
    }
  }

  function bindInlineForms() {
    document.querySelectorAll('[data-sms-gate-form]').forEach((form) => {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const phone = form.querySelector('[name="phone"]');
        const gate = renderGate();
        const gatePhone = gate.querySelector('input[name="phone"]');
        if (phone && gatePhone) gatePhone.value = phone.value;
        openGate(window.location.origin + '/shop.html');
      });
    });
  }

  function bindTimedGate() {
    if (hasAccess() || isDismissed()) return;

    window.setTimeout(() => {
      if (hasAccess() || isDismissed() || gateEl) return;
      const targetUrl = isProtectedPath(window.location.pathname)
        ? window.location.href
        : window.location.origin + '/shop.html';
      openGate(targetUrl);
    }, 5000);
  }

  document.addEventListener('click', (event) => {
    const cartLink = event.target.closest('.nav-link--cart, .mobile-nav__link[href="#"]');
    const link = event.target.closest('a[href]');

    if (!hasAccess() && cartLink) {
      event.preventDefault();
      openGate(link ? link.href : window.location.origin + '/shop.html');
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    bindInlineForms();
    bindTimedGate();
  });
})();
