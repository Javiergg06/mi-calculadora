/* POST /api/bank/start { aspsp_name, aspsp_country }
   Inicia la autorización: devuelve { url, state }.
   El cliente guarda `state`, redirige a `url` (login del banco). */
import crypto from 'node:crypto';
import { applyCors, ebFetch, hostUrls } from './_lib.js';

export default async function handler(req, res) {
  const { origin, allow } = applyCors(req, res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  if (origin && !allow) return res.status(403).json({ error: 'Origen no permitido' });

  const body    = (req.body && typeof req.body === 'object') ? req.body : {};
  const name    = typeof body.aspsp_name === 'string' ? body.aspsp_name : '';
  const country = typeof body.aspsp_country === 'string' ? body.aspsp_country.slice(0, 2).toUpperCase() : 'ES';
  if (!name) return res.status(400).json({ error: 'Falta el banco' });

  const state       = crypto.randomUUID();
  const validUntil  = new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString(); // 10 días
  const { redirect } = hostUrls(req);
  try {
    const { ok, status, data } = await ebFetch('/auth', {
      method: 'POST',
      body: {
        access: { valid_until: validUntil },
        aspsp: { name, country },
        state,
        redirect_url: redirect,
        psu_type: 'personal',
      },
    });
    if (!ok) return res.status(502).json({ error: 'No se pudo iniciar la conexión', status, detail: data });
    return res.status(200).json({ url: data.url, state });
  } catch (e) {
    if (e.message === 'missing_config') return res.status(500).json({ error: 'Falta configurar la clave del banco' });
    return res.status(500).json({ error: 'Error interno' });
  }
}
