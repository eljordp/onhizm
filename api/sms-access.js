const CONSENT_TEXT =
  'I agree to receive recurring automated marketing text messages from ONHIZM at the phone number provided. Consent is not a condition of purchase. Msg & data rates may apply. Msg frequency varies. Reply STOP to unsubscribe or HELP for help.';

function normalizePhone(value) {
  const raw = String(value || '').trim();
  const digits = raw.replace(/\D/g, '');

  if (raw.startsWith('+')) {
    const normalized = `+${digits}`;
    return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
  }

  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers['x-real-ip'] || '';
}

function buildContactPayload(phone, now, sourcePage, intendedPath, ip, userAgent, includeTags = true) {
  return {
    identifiers: [
      {
        type: 'phone',
        id: phone,
        channels: {
          sms: {
            status: 'subscribed',
            statusDate: now,
          },
        },
        sendWelcomeMessage: false,
      },
    ],
    countryCode: phone.startsWith('+1') ? 'US' : undefined,
    ...(includeTags ? { tags: ['source:onhizm-sms-gate', 'sms-drop-access'] } : {}),
    customProperties: {
      sms_gate_consent_accepted: true,
      sms_gate_consent_text: CONSENT_TEXT,
      sms_gate_consent_date: now,
      sms_gate_source_page: sourcePage,
      sms_gate_intended_path: intendedPath,
      sms_gate_ip: ip,
      sms_gate_user_agent: userAgent,
    },
  };
}

async function omnisendRequest(path, { apiKey, method = 'GET', body } = {}) {
  const response = await fetch(`https://api.omnisend.com/api${path}`, {
    method,
    headers: {
      Authorization: `Omnisend-API-Key ${apiKey}`,
      'Omnisend-Version': '2026-03-15',
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  return { response, data };
}

function getFirstContact(data) {
  const contacts = Array.isArray(data?.contacts) ? data.contacts : [];
  return contacts[0] || null;
}

function summarizeOmnisendError(data) {
  return data?.detail || data?.title || data?.error || data?.message || data;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OMNISEND_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'SMS access is not configured yet' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const phone = normalizePhone(body.phone);
  const consentAccepted = body.consentAccepted === true;

  if (!phone) {
    return res.status(400).json({ error: 'Enter a valid phone number' });
  }

  if (!consentAccepted) {
    return res.status(400).json({ error: 'SMS consent is required for drop access' });
  }

  const now = new Date().toISOString();
  const sourcePage = String(body.sourcePage || req.headers.referer || '').slice(0, 500);
  const intendedPath = String(body.intendedPath || '').slice(0, 500);
  const userAgent = String(req.headers['user-agent'] || '').slice(0, 500);
  const ip = String(getClientIp(req) || '').slice(0, 80);

  try {
    let existingContact = null;
    const lookup = await omnisendRequest(`/contacts?phone=${encodeURIComponent(phone)}&limit=1`, { apiKey });

    if (lookup.response.ok) {
      existingContact = getFirstContact(lookup.data);
    } else if (lookup.response.status === 403) {
      console.warn('Omnisend SMS gate phone lookup skipped: API key needs contacts.read scope');
    } else if (lookup.response.status !== 403) {
      console.error('Omnisend SMS gate lookup error:', lookup.response.status, lookup.data);
    }

    const payload = buildContactPayload(
      phone,
      now,
      sourcePage,
      intendedPath,
      ip,
      userAgent,
      !existingContact
    );

    const sync = existingContact
      ? await omnisendRequest(`/contacts/${encodeURIComponent(existingContact.id)}`, {
          apiKey,
          method: 'PATCH',
          body: payload,
        })
      : await omnisendRequest('/contacts', {
          apiKey,
          method: 'POST',
          body: payload,
        });

    if (!sync.response.ok) {
      console.error('Omnisend SMS gate sync error:', sync.response.status, sync.data);
      return res.status(sync.response.status >= 500 ? 502 : 400).json({
        error: 'Could not unlock SMS access',
        details: summarizeOmnisendError(sync.data),
      });
    }

    console.info('Omnisend SMS gate synced:', {
      action: existingContact ? 'updated' : 'created',
      status: sync.response.status,
      contactId: sync.data?.id || existingContact?.id || null,
      phoneLast4: phone.slice(-4),
      sourcePage,
    });

    return res.status(200).json({
      ok: true,
      action: existingContact ? 'updated' : 'created',
      phoneLast4: phone.slice(-4),
    });
  } catch (err) {
    console.error('SMS access handler error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
