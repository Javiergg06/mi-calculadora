/* GET /api/bank/aspsps?country=ES → lista de bancos disponibles.
   Sirve también para comprobar que la clave (JWT) está bien configurada. */
import { applyCors, ebFetch } from './_lib.js';

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  const country = (req.query.country || 'ES').toString().slice(0, 2).toUpperCase();
  try {
    const { ok, status, data } = await ebFetch(`/aspsps?country=${country}`);
    if (!ok) return res.status(502).json({ error: 'No se pudo listar bancos', status, detail: data });
    const banks = (data.aspsps || []).map((a) => ({
      name: a.name, country: a.country, logo: a.logo || null,
    }));
    return res.status(200).json({ banks });
  } catch (e) {
    if (e.message === 'missing_config') return res.status(500).json({
      error: 'Falta configurar credenciales',
      app_id_present: !!process.env.ENABLE_BANKING_APP_ID,
      pem_present: !!process.env.ENABLE_BANKING_PEM,
    });
    return res.status(500).json({ error: 'Error interno' });
  }
}
