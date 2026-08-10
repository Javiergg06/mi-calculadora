/* POST /api/bank/session { code }
   Cambia el `code` del banco por una sesión con acceso a las cuentas. */
import { applyCors, ebFetch } from './_lib.js';

export default async function handler(req, res) {
  const { origin, allow } = applyCors(req, res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  if (origin && !allow) return res.status(403).json({ error: 'Origen no permitido' });

  const body = (req.body && typeof req.body === 'object') ? req.body : {};
  const code = typeof body.code === 'string' ? body.code : '';
  if (!code) return res.status(400).json({ error: 'Falta el código' });

  try {
    const { ok, status, data } = await ebFetch('/sessions', { method: 'POST', body: { code } });
    if (!ok) return res.status(502).json({ error: 'No se pudo crear la sesión', status, detail: data });
    // `accounts` puede venir como UIDs (string) u objetos {uid, ...}. Normalizamos.
    const accounts = (data.accounts || []).map((a) => (typeof a === 'string'
      ? { uid: a }
      : { uid: a.uid, name: a.name || a.product || null, iban: (a.account_id && a.account_id.iban) || a.iban || null, currency: a.currency || null }));
    return res.status(200).json({
      session_id: data.session_id || null,
      aspsp: data.aspsp || null,
      accounts,
    });
  } catch (e) {
    if (e.message === 'missing_config') return res.status(500).json({ error: 'Falta configurar la clave del banco' });
    return res.status(500).json({ error: 'Error interno' });
  }
}
