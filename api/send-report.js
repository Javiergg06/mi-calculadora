import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo no permitido' });

  const GMAIL_USER = (process.env.GMAIL_USER || '').trim();
  const GMAIL_APP_PASSWORD = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');

  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    const faltan = [];
    if (!GMAIL_USER) faltan.push('GMAIL_USER');
    if (!GMAIL_APP_PASSWORD) faltan.push('GMAIL_APP_PASSWORD');
    return res.status(500).json({
      error:
        'Vercel no esta leyendo: ' + faltan.join(' y ') + '. ' +
        'Las variables deben estar marcadas para el entorno PRODUCTION y hay que VOLVER A DESPLEGAR (Redeploy) despues de guardarlas. ' +
        'Revisa que el nombre sea exacto, sin espacios.',
    });
  }

  // El App Password de Gmail tiene 16 caracteres (sin espacios)
  if (GMAIL_APP_PASSWORD.length !== 16) {
    return res.status(500).json({
      error: 'GMAIL_APP_PASSWORD no parece una contraseña de aplicacion valida (debe tener 16 caracteres, sin espacios). Genera una en myaccount.google.com/apppasswords.',
    });
  }

  const { email, pdfBase64, monthLabel } = req.body || {};
  if (!email || !pdfBase64 || !monthLabel) {
    return res.status(400).json({ error: 'Faltan datos requeridos (email, pdfBase64 o monthLabel).' });
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD,
    },
  });

  // Verificar credenciales/conexion antes de intentar enviar (da errores claros)
  try {
    await transporter.verify();
  } catch (err) {
    console.error('SMTP verify error:', err);
    return res.status(502).json({ error: mapMailError(err) });
  }

  const safeName = monthLabel.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-');

  try {
    await transporter.sendMail({
      from: `Flux Finanzas <${GMAIL_USER}>`,
      to: email,
      subject: `Tu informe financiero de ${monthLabel} — Flux`,
      html: `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#f5f4fe;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:580px;margin:0 auto;padding:28px 16px;">

    <div style="background:linear-gradient(135deg,#3730a3 0%,#4f46e5 40%,#7c3aed 100%);border-radius:24px;padding:40px 32px;text-align:center;margin-bottom:20px;">
      <div style="font-size:44px;line-height:1;margin-bottom:14px;">⚡</div>
      <h1 style="margin:0 0 8px;color:#fff;font-size:28px;font-weight:900;letter-spacing:-0.5px;">Flux Finanzas</h1>
      <p style="margin:0;color:rgba(255,255,255,0.75);font-size:15px;font-weight:500;">Informe mensual · ${monthLabel}</p>
    </div>

    <div style="background:#fff;border-radius:20px;padding:32px;margin-bottom:16px;box-shadow:0 4px 20px rgba(99,102,241,0.09);">
      <p style="margin:0 0 20px;color:#111827;font-size:16px;line-height:1.7;">
        ¡Hola! 👋<br><br>
        Tu <strong>informe financiero de ${monthLabel}</strong> ya está listo. Adjunto encontrarás el PDF con un análisis completo de tus finanzas.
      </p>

      <div style="border-left:3px solid #6366f1;padding-left:16px;margin-bottom:0;">
        <p style="margin:0 0 10px;color:#374151;font-size:14px;font-weight:600;">El informe incluye:</p>
        <p style="margin:0 0 7px;color:#6b7280;font-size:14px;">📊 &nbsp;Resumen de gastos e ingresos del mes</p>
        <p style="margin:0 0 7px;color:#6b7280;font-size:14px;">🏷️ &nbsp;Desglose detallado por categorías con gráficos</p>
        <p style="margin:0 0 7px;color:#6b7280;font-size:14px;">📈 &nbsp;Evolución diaria de tus gastos</p>
        <p style="margin:0;color:#6b7280;font-size:14px;">🤖 &nbsp;Análisis inteligente: lo mejor y lo que mejorar</p>
      </div>
    </div>

    <p style="text-align:center;color:#9ca3af;font-size:12px;margin:0;line-height:1.8;">
      Generado automáticamente por <strong style="color:#6366f1;">Flux</strong> — Finanzas Personales<br>
      Si no solicitaste este informe, puedes ignorar este mensaje.
    </p>

  </div>
</body>
</html>`,
      attachments: [
        {
          filename: `flux-informe-${safeName}.pdf`,
          content: Buffer.from(pdfBase64, 'base64'),
          contentType: 'application/pdf',
        },
      ],
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('send-report error:', err);
    res.status(502).json({ error: mapMailError(err) });
  }
}

// Traduce errores tecnicos de nodemailer/Gmail a mensajes claros
function mapMailError(err) {
  const code = err && err.code;
  const msg  = (err && err.message) || '';

  if (code === 'EAUTH' || /invalid login|username and password not accepted|535/i.test(msg)) {
    return 'Gmail rechazo el usuario o la contraseña. Asegurate de usar una CONTRASEÑA DE APLICACION (no tu contraseña normal) y de tener activada la verificacion en 2 pasos.';
  }
  if (code === 'ESOCKET' || code === 'ECONNECTION' || code === 'ETIMEDOUT') {
    return 'No se pudo conectar con el servidor SMTP de Gmail. Reintenta en unos segundos.';
  }
  if (/Missing credentials/i.test(msg)) {
    return 'Faltan las credenciales de Gmail en el servidor (GMAIL_USER / GMAIL_APP_PASSWORD).';
  }
  return 'Error al enviar el email: ' + (msg || 'desconocido');
}
