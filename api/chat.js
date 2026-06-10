export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token,X-Requested-With,Accept,Accept-Version,Content-Length,Content-MD5,Content-Type,Date,X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

  if (!OPENROUTER_API_KEY) {
    console.error('OPENROUTER_API_KEY no está configurada');
    return res.status(500).json({ error: 'API Key no configurada' });
  }

  try {
    const { message, context } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Mensaje requerido' });
    }

    // Construir contexto de gastos
    const categoriesText =
      Object.entries(context.categories || {})
        .map(([cat, amt]) => `- ${cat}: €${Number(amt).toFixed(2)}`)
        .join('\n') || 'Sin gastos aún.';

    const systemPrompt = `Eres Flux AI, un asistente inteligente para gestión de gastos personales.
Das consejos prácticos, motivadores y personalizados sobre finanzas.

Contexto financiero actual del usuario:
- Dinero disponible: €${Number(context.balance).toFixed(2)}
- Total gastado: €${Number(context.totalSpent).toFixed(2)}
- Número de gastos: ${context.numExpenses}
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
        model: 'google/gemini-2.0-flash-001',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: message },
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`OpenRouter error ${response.status}:`, errText);
      return res.status(502).json({ error: `Error del modelo: ${response.status}` });
    }

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content || 'No pude generar una respuesta.';

    res.status(200).json({ reply });
  } catch (error) {
    console.error('Chat handler error:', error);
    res.status(500).json({ error: error.message || 'Error interno' });
  }
}
