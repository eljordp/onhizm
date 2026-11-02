const SMS_CONSENT =
  'I agree to receive recurring automated marketing text messages from ONHIZM at the phone number provided. Consent is not a condition of purchase. Msg & data rates may apply. Msg frequency varies. Reply STOP to unsubscribe or HELP for help.';
const EMAIL_CONSENT =
  'I agree to receive marketing emails from ONHIZM. Consent is not a condition of purchase. Unsubscribe anytime.';

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function cleanPiece(value) {
  return String(value || 'next-drop').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 80) || 'next-drop';
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

export function buildPayload({ phone, email, piece, now, sourcePage, includeTags }) {
  const identifiers = [];
  if (phone) identifiers.push({ type: 'phone', id: phone, channels: { sms: { status: 'subscribed', statusDate: now } } });
  if (email) identifiers.push({ type: 'email', id: email, channels: { email: { status: 'subscribed', statusDate: now } } });
  return {
    identifiers,
    ...(includeTags ? { tags: ['source:onhizm-next-drop', `piece:${piece}`] } : {}),
    customProperties: {
      next_drop_piece: piece,
      next_drop_signup_date: now,
      next_drop_source_page: sourcePage,
      ...(phone ? { next_drop_sms_consent_text: SMS_CONSENT } : {}),
      ...(email ? { next_drop_email_consent_text: EMAIL_CONSENT } : {}),
    },
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body || '{}'); } catch { return res.status(400).json({ error: 'Bad request' }); }
  }

  const rawPhone = String(body.phone || '').trim();
  const rawEmail = String(body.email || '').trim();
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  const email = rawEmail ? normalizeEmail(rawEmail) : null;

  if (rawPhone && !phone) return res.status(400).json({ error: 'Enter a valid phone number' });
  if (rawEmail && !email) return res.status(400).json({ error: 'Enter a valid email' });
  if (!phone && !email) return res.status(400).json({ error: 'Add a phone number or an email' });
  if (phone && body.smsConsent !== true) return res.status(400).json({ error: 'Text consent is required for a phone number' });
  if (email && body.emailConsent !== true) return res.status(400).json({ error: 'Email consent is required for an email' });

  // Nothing leaves this function unless it is the production site.
  if (process.env.VERCEL_ENV !== 'production') return res.status(200).json({ ok: true, preview: true });

  const apiKey = process.env.OMNISEND_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Sign-up is not configured yet' });

  const now = new Date().toISOString();
  const piece = cleanPiece(body.piece);
  const sourcePage = String(body.sourcePage || req.headers.referer || '').slice(0, 500);

  try {
    let existing = null;
    const lookup = await omnisendRequest(
      phone ? `/contacts?phone=${encodeURIComponent(phone)}&limit=1` : `/contacts?email=${encodeURIComponent(email)}&limit=1`,
      { apiKey }
    );
    if (lookup.response.ok && Array.isArray(lookup.data?.contacts)) existing = lookup.data.contacts[0] || null;

    const payload = buildPayload({ phone, email, piece, now, sourcePage, includeTags: !existing });
    const sync = existing
      ? await omnisendRequest(`/contacts/${encodeURIComponent(existing.id)}`, { apiKey, method: 'PATCH', body: payload })
      : await omnisendRequest('/contacts', { apiKey, method: 'POST', body: payload });

    if (!sync.response.ok) {
      console.error('Omnisend next-drop sync error:', sync.response.status, sync.data);
      return res.status(502).json({ error: 'That did not go through. Try again.' });
    }
    return res.status(200).json({ ok: true, action: existing ? 'updated' : 'created' });
  } catch (error) {
    console.error('Next-drop signup failed:', error);
    return res.status(500).json({ error: 'That did not go through. Try again.' });
  }
}
