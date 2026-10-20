import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { buildAdvertiseRecord, buildSubscribeRecord, handler, toPublicAd } from './forms.js';

test('subscribe record keeps only name, email, and active status', () => {
  const built = buildSubscribeRecord({
    name: 'Ada',
    email: 'Ada@Example.com',
    status: 'unsubscribed',
    role: 'service_role',
  });
  assert.equal(built.ok, true);
  assert.deepEqual(built.record, {
    name: 'Ada',
    email: 'ada@example.com',
    status: 'active',
  });
});

test('advertise record forces pending and drops client status', () => {
  const built = buildAdvertiseRecord({
    type: 'product',
    company_name: 'Example Co',
    product_name: 'Widget',
    contact_name: 'Pat',
    contact_email: 'pat@example.com',
    status: 'approved',
    notes: 'hello',
  });
  assert.equal(built.ok, true);
  assert.equal(built.record.status, 'pending');
  assert.equal(Object.hasOwn(built.record, 'approved'), false);
  assert.equal(built.record.contact_email, 'pat@example.com');
});

test('public ad projection drops contact fields', () => {
  const ad = toPublicAd({
    id: '1',
    type: 'service',
    company_name: 'Example',
    contact_email: 'secret@example.com',
    contact_name: 'Hidden',
    contact_phone: '555',
    notes: 'private',
    status: 'approved',
  });
  assert.deepEqual(Object.keys(ad).sort(), [
    'company_name',
    'id',
    'product_name',
    'services_provided',
    'type',
    'website_url',
  ]);
  assert.equal(JSON.stringify(ad).includes('secret@example.com'), false);
});

test('handler returns 503 when server credentials are missing', async () => {
  const previousUrl = process.env.SUPABASE_URL;
  const previousAnon = process.env.SUPABASE_ANON_KEY;
  const previousService = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const response = await handler({
    httpMethod: 'POST',
    headers: { origin: 'https://www.thedailypulse.space' },
    body: JSON.stringify({ action: 'subscribe', name: 'Ada', email: 'ada@example.com' }),
  });
  assert.equal(response.statusCode, 503);
  assert.equal(response.body.includes('eyJ'), false);
  if (previousUrl === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = previousUrl;
  if (previousAnon === undefined) delete process.env.SUPABASE_ANON_KEY;
  else process.env.SUPABASE_ANON_KEY = previousAnon;
  if (previousService === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = previousService;
});

test('handler stores a pending ad and does not echo the server key', async () => {
  const previousUrl = process.env.SUPABASE_URL;
  const previousService = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'server-only-test-key';
  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response('', { status: 201 });
  };

  try {
    const response = await handler({
      httpMethod: 'POST',
      headers: { origin: 'https://www.thedailypulse.space' },
      body: JSON.stringify({
        action: 'advertise',
        type: 'product',
        company_name: 'Example Co',
        product_name: 'Widget',
        contact_name: 'Pat',
        contact_email: 'pat@example.com',
        status: 'approved',
      }),
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.includes('server-only-test-key'), false);
    assert.equal(calls.length, 1);
    const sent = JSON.parse(calls[0].options.body);
    assert.equal(sent.status, 'pending');
    assert.equal(calls[0].options.headers.Authorization, 'Bearer server-only-test-key');
    assert.equal(String(calls[0].url).includes('/rest/v1/advertisements'), true);
  } finally {
    global.fetch = originalFetch;
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousService === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousService;
  }
});

test('list-ads strips contact fields returned by the database', async () => {
  const previousUrl = process.env.SUPABASE_URL;
  const previousAnon = process.env.SUPABASE_ANON_KEY;
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'server-only-anon';
  const originalFetch = global.fetch;
  global.fetch = async () => new Response(JSON.stringify([
    {
      id: '1',
      type: 'product',
      company_name: 'Example',
      product_name: 'Widget',
      contact_email: 'secret@example.com',
      contact_name: 'Hidden',
    },
  ]), { status: 200, headers: { 'Content-Type': 'application/json' } });

  try {
    const response = await handler({
      httpMethod: 'GET',
      headers: {},
      queryStringParameters: { action: 'list-ads' },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.includes('secret@example.com'), false);
    assert.equal(response.body.includes('Hidden'), false);
    const payload = JSON.parse(response.body);
    assert.equal(payload.ads[0].company_name, 'Example');
  } finally {
    global.fetch = originalFetch;
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousAnon === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = previousAnon;
  }
});

test('tracked pages do not embed a Supabase JWT', () => {
  const html = readFileSync(new URL('../../index3.html', import.meta.url), 'utf8');
  const home = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  assert.equal(html.includes('SUPABASE_ANON_KEY'), false);
  assert.equal(html.includes('eyJ'), false);
  assert.equal(home.includes('SUPABASE_ANON_KEY'), false);
  assert.equal(html.includes('/.netlify/functions/forms'), true);
});
