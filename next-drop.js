/* "Text me the next drop": phone and/or email, each with its own unticked consent box.
   Posts to /api/drop-signup. Off production that endpoint sends nothing and says so. */
(function () {
  var SMS_CONSENT = 'I agree to receive recurring automated marketing text messages from ONHIZM at the phone number provided. Consent is not a condition of purchase. Msg & data rates may apply. Msg frequency varies. Reply STOP to unsubscribe or HELP for help.';
  var EMAIL_CONSENT = 'I agree to receive marketing emails from ONHIZM. Consent is not a condition of purchase. Unsubscribe anytime.';
  var count = 0;

  function policyHref() {
    return location.pathname.indexOf('/products/') > -1 ? '../policy.html' : 'policy.html';
  }

  function render(target, handle) {
    var n = ++count;
    target.innerHTML =
      '<form class="next-drop-form" novalidate>' +
        '<div class="next-drop-form__row">' +
          '<label for="nd-phone-' + n + '">Phone</label>' +
          '<input id="nd-phone-' + n + '" name="phone" type="tel" inputmode="tel" autocomplete="tel">' +
        '</div>' +
        '<label class="next-drop-form__consent"><input type="checkbox" name="smsConsent"> <span>' + SMS_CONSENT.replace('&', '&amp;') + ' <a href="/privacy.html" target="_blank" rel="noopener">Privacy Policy</a> and <a href="/sms-terms.html" target="_blank" rel="noopener">SMS Terms</a>.</span></label>' +
        '<div class="next-drop-form__row">' +
          '<label for="nd-email-' + n + '">Email</label>' +
          '<input id="nd-email-' + n + '" name="email" type="email" autocomplete="email">' +
        '</div>' +
        '<label class="next-drop-form__consent"><input type="checkbox" name="emailConsent"> <span>' + EMAIL_CONSENT + '</span></label>' +
        '<button type="submit" class="btn btn--primary next-drop-form__send">Text me the next drop</button>' +
        '<p class="next-drop-form__status" role="status" aria-live="polite"></p>' +
      '</form>';
    var form = target.querySelector('form');
    form.addEventListener('submit', function (e) { e.preventDefault(); send(form, handle); });
    return form;
  }

  function send(form, handle) {
    var status = form.querySelector('[role=status]');
    var button = form.querySelector('button[type=submit]');
    var phone = form.phone.value.trim();
    var email = form.email.value.trim();
    var smsConsent = form.smsConsent.checked;
    var emailConsent = form.emailConsent.checked;
    if (!phone && !email) { status.textContent = 'Add a phone number or an email.'; return; }
    if (phone && !smsConsent) { status.textContent = 'Tick the box under your phone number so we can text you.'; return; }
    if (email && !emailConsent) { status.textContent = 'Tick the box under your email so we can email you.'; return; }
    if (email && !form.email.checkValidity()) { status.textContent = 'That email does not look right.'; return; }

    button.disabled = true;
    status.textContent = 'Sending...';
    fetch('/api/drop-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: phone, email: email,
        smsConsent: smsConsent, emailConsent: emailConsent,
        piece: handle || 'next-drop',
        sourcePage: location.href
      })
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) { return { ok: res.ok, data: data }; });
    }).then(function (r) {
      button.disabled = false;
      if (r.ok && r.data.preview) { status.textContent = 'Preview only. Nothing was sent.'; return; }
      if (r.ok && r.data.ok) { status.textContent = 'You are on the list.'; form.reset(); return; }
      status.textContent = r.data.error || 'That did not go through. Try again.';
    }).catch(function () {
      button.disabled = false;
      status.textContent = 'That did not go through. Try again.';
    });
  }

  window.OnhizmNextDrop = { render: render };
  Array.prototype.forEach.call(document.querySelectorAll('[data-next-drop]'), function (el) {
    render(el, el.getAttribute('data-next-drop'));
  });
})();
