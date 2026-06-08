/* ===========================================================
   API ROUTE: /api/chat
   Procesa mensajes del chatbot usando Gemini
   =========================================================== */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export default async function handler(req, res) {
  // Solo POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'API Key no configurada' });
  }

  try {
    const { message, context } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Mensaje requerido' });
    }

    // Construir contexto de gastos para el prompt
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
Usa emojis si es relevante. Personaliza tus respuestas basándote en los datos del usuario.`;

    // Llamar a Gemini
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: systemPrompt + '\n\nUsuario: ' + message,
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 500,
          temperature: 0.7,
        },
      }),
      searchParams: {
        key: GEMINI_API_KEY,
      },
    });

    // Agregar key como parámetro de query
    const url = new URL('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent');
    url.searchParams.set('key', GEMINI_API_KEY);

    const geminiRes = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: systemPrompt + '\n\nUsuario: ' + message,
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
      const err = await geminiRes.text();
      console.error('Gemini API error:', err);
      return res.status(502).json({ error: 'Error de API de Gemini' });
    }

    const data = await geminiRes.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No pude generar una respuesta.';

    res.status(200).json({ reply });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}
