import { brotliCompressSync, constants as zlibConstants, gzipSync } from 'node:zlib';

const COMPRESSIBLE_CONTENT_TYPE_PATTERN = /^(?:text\/|application\/(?:javascript|json|xml)|image\/svg\+xml)/i;
const MIN_COMPRESSIBLE_BYTES = 1024;

export const SECURITY_HEADERS = {
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
};

export const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function appendVaryHeader(res, token) {
  const normalizedToken = String(token || '').trim();
  if (!normalizedToken) {
    return;
  }

  const existingHeader = String(res.getHeader('Vary') || '');
  const varyTokens = new Set(
    existingHeader
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
  varyTokens.add(normalizedToken);
  res.setHeader('Vary', Array.from(varyTokens).join(', '));
}

function resolveCompressionEncoding(acceptEncodingHeader) {
  const value = String(acceptEncodingHeader || '').toLowerCase();
  if (value.includes('br')) {
    return 'br';
  }

  if (value.includes('gzip')) {
    return 'gzip';
  }

  return null;
}

function maybeCompressBody(req, body, contentType) {
  if (body === undefined || body === null) {
    return { body: null, compressed: false, encoding: null };
  }

  const bodyBuffer = Buffer.isBuffer(body)
    ? body
    : Buffer.from(String(body), 'utf8');

  if (
    bodyBuffer.byteLength < MIN_COMPRESSIBLE_BYTES
    || !COMPRESSIBLE_CONTENT_TYPE_PATTERN.test(String(contentType || ''))
  ) {
    return { body: bodyBuffer, compressed: false, encoding: null };
  }

  const encoding = resolveCompressionEncoding(req.headers['accept-encoding']);
  if (!encoding) {
    return { body: bodyBuffer, compressed: false, encoding: null };
  }

  const compressedBody = encoding === 'br'
    ? brotliCompressSync(bodyBuffer, {
      params: {
        [zlibConstants.BROTLI_PARAM_QUALITY]: 5,
      },
    })
    : gzipSync(bodyBuffer, { level: 6 });

  if (compressedBody.byteLength >= bodyBuffer.byteLength) {
    return { body: bodyBuffer, compressed: false, encoding: null };
  }

  return { body: compressedBody, compressed: true, encoding };
}

export function setHeaders(res, headers) {
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }
}

export function isSameOriginWriteRequest(req, requestUrl) {
  const origin = req.headers.origin;
  if (!origin) {
    return true;
  }

  try {
    const originUrl = new URL(origin);
    return originUrl.host === requestUrl.host;
  } catch {
    return false;
  }
}

export function applyCorsHeaders(res, origin) {
  if (!origin) {
    return;
  }

  appendVaryHeader(res, 'Origin');
  setHeaders(res, {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
}

export function sendResponse(req, res, {
  body = null,
  headers = {},
  statusCode = 200,
} = {}) {
  const contentType = headers['Content-Type'] || headers['content-type'] || '';
  const prepared = maybeCompressBody(req, body, contentType);

  if (body !== null) {
    appendVaryHeader(res, 'Accept-Encoding');
  }

  const responseHeaders = { ...headers };

  if (prepared.compressed && prepared.encoding) {
    responseHeaders['Content-Encoding'] = prepared.encoding;
  }

  if (prepared.body) {
    responseHeaders['Content-Length'] = String(prepared.body.byteLength);
  }

  res.writeHead(statusCode, responseHeaders);

  if (req.method === 'HEAD' || statusCode === 204 || statusCode === 304) {
    res.end();
    return;
  }

  res.end(prepared.body ?? undefined);
}

export function jsonResponse(req, res, statusCode, data) {
  const body = JSON.stringify(data);
  sendResponse(req, res, {
    body,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
    statusCode,
  });
}

export function textResponse(req, res, statusCode, body, headers = {}) {
  sendResponse(req, res, {
    body,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      ...headers,
    },
    statusCode,
  });
  return true;
}
