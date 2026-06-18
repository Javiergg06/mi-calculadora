/* ===========================================================
   /api/chat — Proxy seguro a OpenRouter (Gemini)
   La clave vive SOLO aquí (env OPENROUTER_API_KEY), nunca en el cliente.
   Protecciones: allowlist de origen + rate limit + validación de entrada.
   NOTA: el rate limit en memoria es "best-effort" (las funciones de
   Vercel son efímeras y se escalan). El backstop REAL contra abuso es
   poner un tope de gasto diario/mensual en el panel de OpenRouter.
   Para límite duradero: Vercel KV / Upstash Redis (fase backend).
   =========================================================== */

// Orígenes permitidos: la propia web (*.vercel.app), localhost (dev) y
// el contenedor de la futura app Android (Capacitor).
const ALLOWED_ORIGIN_RE = /^(https?:\/\/localhost(:\d+)?|capacitor:\/\/localhost|https:\/\/[a-z0-9-]+\.vercel\.app)$/i;

// Rate limit best-effort por IP (ventana deslizante simple en memoria)
const RL = new Map();
const RL_MAX = 15;          // peticiones
const RL_WINDOW = 60_000;   // por minuto
function rateLimited(ip) {
  const now = Date.now();
  const e = RL.get(ip);
  if (!e || now > e.reset) { RL.set(ip, { count: 1, reset: now + RL_WINDOW }); return false; }
  e.count += 1;
  return e.count > RL_MAX;
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  const allowOrigin = origin && ALLOWED_ORIGIN_RE.test(origin) ? origin : '';

  // CORS: solo refleja orígenes de la allowlist (nada de '*')
  if (allowOrigin) res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  // Bloquea peticiones de navegador desde OTROS sitios (drive-by abuse).
  // (curl sin cabecera Origin pasa este filtro, pero lo frenan el rate
  //  limit por IP y el tope de gasto de OpenRouter.)
  if (origin && !allowOrigin) return res.status(403).json({ error: 'Origen no permitido' });

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (rateLimited(ip)) return res.status(429).json({ error: 'Demasiadas peticiones. Espera un minuto.' });

  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  if (!OPENROUTER_API_KEY) {
    console.error('OPENROUTER_API_KEY no configurada');
    return res.status(500).json({ error: 'Servicio no disponible' });
  }

  try {
    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const context = (body.context && typeof body.context === 'object') ? body.context : {};

    if (!message) return res.status(400).json({ error: 'Mensaje requerido' });
    if (message.length > 2000) return res.status(413).json({ error: 'Mensaje demasiado largo' });

    // Sanea y acota el contexto antes de meterlo en el prompt
    const balance     = Number.isFinite(+context.balance) ? +context.balance : 0;
    const totalSpent  = Number.isFinite(+context.totalSpent) ? +context.totalSpent : 0;
    const numExpenses = Number.isFinite(+context.numExpenses) ? Math.trunc(+context.numExpenses) : 0;
    const catsObj     = (context.categories && typeof context.categories === 'object') ? context.categories : {};
    const categoriesText =
      Object.entries(catsObj).slice(0, 50)
        .map(([cat, amt]) => `- ${String(cat).slice(0, 40)}: €${(Number(amt) || 0).toFixed(2)}`)
        .join('\n') || 'Sin gastos aún.';

    const systemPrompt = `Eres Flux AI, un asistente inteligente para gestión de gastos personales.
Das consejos prácticos, motivadores y personalizados sobre finanzas. Tu contenido es informativo
y educativo; NO es asesoramiento financiero, fiscal ni de inversión profesional.

Contexto financiero actual del usuario:
- Dinero disponible: €${balance.toFixed(2)}
- Total gastado: €${totalSpent.toFixed(2)}
- Número de gastos: ${numExpenses}
- Gastos por categoría:
${categoriesText}

Responde siempre en español, de forma breve (máx 2-3 párrafos), cercana y motivadora. Usa emojis si es relevante.`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://mi-calculadora-bq83.vercel.app',
        'X-Title': 'Flux Finanzas',
      },
      body: JSON.stringify({
        // Modelo GRATIS de OpenRouter (coste 0€). Si algún día se añade
        // crédito, se puede cambiar a uno de pago mejor para usuarios premium.
        model: 'meta-llama/llama-3.3-70b-instruct:free',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: message },
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.error(`OpenRouter error ${response.status}`);
      return res.status(502).json({ error: 'Servicio de IA no disponible' });
    }

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content || 'No pude generar una respuesta.';
    res.status(200).json({ reply });
  } catch (error) {
    console.error('Chat handler error:', error);
    res.status(500).json({ error: 'Error interno' });
  }
}
