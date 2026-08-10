/* GET /api/bank/callback?code=...&state=...
   El banco redirige aquí tras autorizar. Reenviamos a la app (raíz)
   con los parámetros para que el cliente cree la sesión. No usa secretos. */
import { hostUrls } from './_lib.js';

export default async function handler(req, res) {
  const q = req.query || {};
  const qs = new URLSearchParams();
  if (q.code)  qs.set('bank_code',  String(q.code));
  if (q.state) qs.set('bank_state', String(q.state));
  if (q.error) qs.set('bank_error', String(q.error));
  const { appBase } = hostUrls(req);
  res.writeHead(302, { Location: appBase + '?' + qs.toString() });
  res.end();
}
