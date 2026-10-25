import { indexNowFileCandidates, readIndexNowKey, sameKeyFile } from '../../lib/search-index.js';

function text(statusCode, body, { cacheable = false, robots = '' } = {}) {
  const headers = {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': cacheable ? 'public, max-age=300' : 'no-store',
    'X-Content-Type-Options': 'nosniff',
  };
  if (robots) headers['X-Robots-Tag'] = robots;
  return { statusCode, headers, body };
}

export async function handler(event) {
  const key = readIndexNowKey();
  const requested = indexNowFileCandidates(event);
  if (!key || !requested.some((file) => sameKeyFile(file, key))) {
    return text(404, 'Not found');
  }
  return text(200, key, { cacheable: true, robots: 'noindex' });
}
