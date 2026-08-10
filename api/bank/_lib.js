/* ===========================================================
   Utilidades compartidas para la conexión bancaria (Enable Banking).
   La clave privada (.pem) y el Application ID viven SOLO en el
   servidor, como variables de entorno en Vercel. Nunca en el cliente.
     - ENABLE_BANKING_APP_ID  → el id de la aplicación (no secreto)
     - ENABLE_BANKING_PEM     → contenido del archivo .pem (SECRETO)
   Los archivos con "_" delante no se publican como endpoint en Vercel.
   =========================================================== */
import crypto from 'node:crypto';

// Orígenes permitidos (misma allowlist que /api/chat)
export const ALLOWED_ORIGIN_RE = /^(https?:\/\/localhost(:\d+)?|capacitor:\/\/localhost|https:\/\/[a-z0-9-]+\.vercel\.app)$/i;

export function applyCors(req, res) {
  const origin = req.headers.origin;
  const allow = origin && ALLOWED_ORIGIN_RE.test(origin) ? origin : '';
  if (allow) res.setHeader('Access-Control-Allow-Origin', allow);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return { origin, allow };
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

// Firma un JWT RS256 con la clave privada de la aplicación.
export function getJwt() {
  const appId = process.env.ENABLE_BANKING_APP_ID;
  let pem = process.env.ENABLE_BANKING_PEM;
  if (!appId || !pem) throw new Error('missing_config');
  pem = pem.replace(/\\n/g, '\n'); // por si se pegó en una sola línea
  const now = Math.floor(Date.now() / 1000);
  const header = { typ: 'JWT', alg: 'RS256', kid: appId };
  const body   = { iss: 'enablebanking.com', aud: 'api.enablebanking.com', iat: now, exp: now + 3600 };
  const input  = b64url(JSON.stringify(header)) + '.' + b64url(JSON.stringify(body));
  const sig    = crypto.sign('RSA-SHA256', Buffer.from(input), pem);
  return input + '.' + b64url(sig);
}

const BASE = 'https://api.enablebanking.com';

// Llamada autenticada a la API de Enable Banking.
export async function ebFetch(path, { method = 'GET', body } = {}) {
  const jwt = getJwt();
  const r = await fetch(BASE + path, {
    method,
    headers: { 'Authorization': 'Bearer ' + jwt, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data; try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  return { ok: r.ok, status: r.status, data };
}

// URL de retorno registrada en la aplicación de Enable Banking.
export const REDIRECT_URL = 'https://mi-calculadora-bq83.vercel.app/api/bank/callback';
export const APP_BASE     = 'https://mi-calculadora-bq83.vercel.app/';
