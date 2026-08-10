/* POST /api/bank/transactions { account_uid, date_from? }
   Devuelve los movimientos de una cuenta. El cliente los deduplica
   y añade los cargos nuevos como gastos. */
import { applyCors, ebFetch } from './_lib.js';

export default async function handler(req, res) {
  const { origin, allow } = applyCors(req, res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  if (origin && !allow) return res.status(403).json({ error: 'Origen no permitido' });

  const body = (req.body && typeof req.body === 'object') ? req.body : {};
  const uid  = typeof body.account_uid === 'string' ? body.account_uid : '';
  if (!uid) return res.status(400).json({ error: 'Falta la cuenta' });
  const dateFrom = typeof body.date_from === 'string' ? body.date_from : '';

  try {
    let path = `/accounts/${encodeURIComponent(uid)}/transactions`;
    if (dateFrom) path += `?date_from=${encodeURIComponent(dateFrom)}`;
    const { ok, status, data } = await ebFetch(path);
    if (!ok) return res.status(502).json({ error: 'No se pudieron leer los movimientos', status, detail: data });
    return res.status(200).json({
      transactions: data.transactions || [],
      continuation: data.continuation_key || null,
    });
  } catch (e) {
    if (e.message === 'missing_config') return res.status(500).json({ error: 'Falta configurar la clave del banco' });
    return res.status(500).json({ error: 'Error interno' });
  }
}
