/**
 * Server-side form proxy. Supabase keys are read from the environment only.
 * This function never returns contact fields or credential material.
 */

const MAX_BODY_BYTES = 8000;
const PUBLIC_AD_FIELDS = [
  'id',
  'type',
  'company_name',
  'product_name',
  'services_provided',
  'website_url',
];

const ALLOWED_ORIGINS = new Set([
  'https://thedailypulse.space',
  'https://www.thedailypulse.space',
  'http://localhost:8888',
  'http://127.0.0.1:8888',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+().\-\s]{0,40}$/;

function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  let cleaned = '';
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code > 31 && code !== 127) cleaned += char;
  }
  return cleaned.trim().slice(0, max);
}

function validEmail(email) {
  return email.length >= 3 && email.length <= 320 && EMAIL_RE.test(email);
}

export function buildSubscribeRecord(input) {
  const name = cleanText(input?.name, 200);
  const email = cleanText(input?.email, 320).toLowerCase();
  if (!name || !email) {
    return { ok: false, error: 'Name and email are required' };
  }
  if (!validEmail(email)) {
    return { ok: false, error: 'Please enter a valid email address' };
  }
  return { ok: true, record: { name, email, status: 'active' } };
}

export function buildAdvertiseRecord(input) {
  const type = input?.type === 'service' ? 'service' : input?.type === 'product' ? 'product' : '';
  const companyName = cleanText(input?.company_name, 200);
  const contactName = cleanText(input?.contact_name, 200);
  const contactEmail = cleanText(input?.contact_email, 320).toLowerCase();
  const contactPhone = cleanText(input?.contact_phone, 40);
  const productName = cleanText(input?.product_name, 200);
  const servicesProvided = cleanText(input?.services_provided, 2000);
  const notes = cleanText(input?.notes, 2000);
  const website = cleanText(input?.website_url, 500);

  if (!type || !companyName || !contactName || !contactEmail) {
    return { ok: false, error: 'Please complete the required fields' };
  }
  if (!validEmail(contactEmail)) {
    return { ok: false, error: 'Please enter a valid email address' };
  }
  if (contactPhone && !PHONE_RE.test(contactPhone)) {
    return { ok: false, error: 'Please enter a valid phone number' };
  }
  if (type === 'product' && !productName) {
    return { ok: false, error: 'Product name is required' };
  }
  if (type === 'service' && !servicesProvided) {
    return { ok: false, error: 'Services are required' };
  }

  let websiteUrl = null;
  if (website) {
    try {
      const parsed = new URL(website);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { ok: false, error: 'Website must be an http or https URL' };
      }
      websiteUrl = parsed.toString();
    } catch {
      return { ok: false, error: 'Website must be an http or https URL' };
    }
  }

  const record = {
    type,
    company_name: companyName,
    contact_name: contactName,
    contact_email: contactEmail,
    contact_phone: contactPhone || null,
    website_url: websiteUrl,
    notes: notes || null,
    status: 'pending',
  };
  if (type === 'product') {
    record.product_name = productName;
  } else {
    record.services_provided = servicesProvided;
  }
  return { ok: true, record };
}

export function toPublicAd(row) {
  const ad = {};
  for (const field of PUBLIC_AD_FIELDS) {
    ad[field] = row?.[field] ?? null;
  }
  return ad;
}

function originOf(event) {
  const headers = event.headers || {};
  return headers.origin || headers.Origin || '';
}

function responseHeaders(origin) {
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : 'https://www.thedailypulse.space';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json',
    Vary: 'Origin',
  };
}

function json(statusCode, body, origin) {
  return {
    statusCode,
    headers: responseHeaders(origin),
    body: JSON.stringify(body),
  };
}

function supabaseConfig() {
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
  return { url: url.replace(/\/$/, ''), key };
}

async function supabaseFetch(path, { method = 'GET', body, prefer } = {}) {
  const { url, key } = supabaseConfig();
  if (!url || !key) {
    const error = new Error('config');
    error.statusCode = 503;
    throw error;
  }
  const headers = {
    Accept: 'application/json',
    apikey: key,
    Authorization: `Bearer ${key}`,
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;
  return fetch(`${url}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function readErrorCode(response) {
  try {
    const data = await response.json();
    return data?.code || '';
  } catch {
    return '';
  }
}

async function insertRow(table, record) {
  const response = await supabaseFetch(`/rest/v1/${table}`, {
    method: 'POST',
    body: record,
    prefer: 'return=minimal',
  });
  if (response.ok) return { ok: true };
  const code = await readErrorCode(response);
  if (response.status === 409 || code === '23505') {
    return { ok: false, statusCode: 409, code: '23505', error: 'This email is already subscribed!' };
  }
  return { ok: false, statusCode: 502, error: 'Unable to save the submission' };
}

async function listAds() {
  const query = 'select=id,type,company_name,product_name,services_provided,website_url&order=created_at.desc';
  let response = await supabaseFetch(`/rest/v1/approved_advertisements?${query}`);
  if (response.status === 404) {
    response = await supabaseFetch(`/rest/v1/advertisements?status=eq.approved&${query}`);
  }
  if (!response.ok) {
    return json(502, { error: 'Unable to load advertisements' }, '');
  }
  const rows = await response.json();
  const ads = Array.isArray(rows) ? rows.map(toPublicAd) : [];
  return { ok: true, ads };
}

async function notifySubscription(name, email) {
  try {
    await supabaseFetch('/functions/v1/send-subscription-email', {
      method: 'POST',
      body: { name, email },
    });
  } catch {
    // The subscription row is already stored. Mail delivery is best-effort.
  }
}

function parseBody(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;
  if (raw.length > MAX_BODY_BYTES) {
    const error = new Error('too large');
    error.statusCode = 413;
    throw error;
  }
  return JSON.parse(raw);
}

export async function handler(event) {
  const origin = originOf(event);
  const method = event.httpMethod || 'GET';

  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: responseHeaders(origin), body: '' };
  }

  try {
    if (method === 'GET') {
      const action = event.queryStringParameters?.action || '';
      if (action !== 'list-ads') return json(400, { error: 'Unknown action' }, origin);
      const listed = await listAds();
      if (listed.statusCode) return { ...listed, headers: responseHeaders(origin) };
      return json(200, { ads: listed.ads }, origin);
    }

    if (method !== 'POST') return json(405, { error: 'Method not allowed' }, origin);

    let payload;
    try {
      payload = parseBody(event);
    } catch (error) {
      if (error.statusCode === 413) return json(413, { error: 'Request is too large' }, origin);
      return json(400, { error: 'Invalid request' }, origin);
    }

    if (payload.action === 'subscribe') {
      const built = buildSubscribeRecord(payload);
      if (!built.ok) return json(400, { error: built.error }, origin);
      const saved = await insertRow('newsletter_subscriptions', built.record);
      if (!saved.ok) return json(saved.statusCode, { error: saved.error, code: saved.code }, origin);
      await notifySubscription(built.record.name, built.record.email);
      return json(200, { success: true }, origin);
    }

    if (payload.action === 'advertise') {
      const built = buildAdvertiseRecord(payload);
      if (!built.ok) return json(400, { error: built.error }, origin);
      const saved = await insertRow('advertisements', built.record);
      if (!saved.ok) return json(saved.statusCode, { error: saved.error }, origin);
      return json(200, { success: true }, origin);
    }

    return json(400, { error: 'Unknown action' }, origin);
  } catch (error) {
    if (error.statusCode === 503) return json(503, { error: 'Forms are not configured' }, origin);
    return json(500, { error: 'Unable to process the request' }, origin);
  }
}
