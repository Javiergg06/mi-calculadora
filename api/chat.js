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

  // Solo POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  if (!GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY no está configurada');
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

    const systemPrompt = `Eres un asistente inteligente para gestión de gastos personales.
Tu usuario te habla sobre sus hábitos de gasto y tú das consejos prácticos, motivadores y personalizados.

Contexto financiero actual del usuario:
- Dinero disponible: €${Number(context.balance).toFixed(2)}
- Total gastado: €${Number(context.totalSpent).toFixed(2)}
- Número de gastos: ${context.numExpenses}
- Gastos por categoría:
${categoriesText}

Responde siempre en español, de forma breve (máx 2-3 párrafos), cercana y motivadora.
Usa emojis si es relevante.`;

    // Construir URL con API key
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `${systemPrompt}\n\nUsuario: ${message}`,
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 500,
          temperature: 0.7,
        },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error(`Gemini error ${geminiRes.status}:`, errText);
      return res.status(502).json({ error: `Gemini error: ${geminiRes.status}` });
    }

    const data = await geminiRes.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No pude generar una respuesta.';

    res.status(200).json({ reply });
  } catch (error) {
    console.error('Chat handler error:', error);
    res.status(500).json({ error: error.message || 'Error interno' });
  }
}
