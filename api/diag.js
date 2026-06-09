// Endpoint de diagnóstico SEGURO: nunca devuelve el valor de ningún secreto.
// Solo dice si las variables existen, su longitud, y qué nombres de variables
// relacionadas con email ve Vercel (para detectar typos en el nombre).
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  // Nombres de todas las variables que contengan "mail" o "gmail" (sin valores)
  const mailVarNames = Object.keys(process.env)
    .filter((k) => /mail/i.test(k))
    .sort();

  res.status(200).json({
    GMAIL_USER: {
      existe: Boolean(user),
      longitud: user ? user.length : 0,
      // solo mostramos el dominio para confirmar que es el correcto, no el usuario completo
      dominio: user && user.includes('@') ? '@' + user.split('@')[1] : null,
    },
    GMAIL_APP_PASSWORD: {
      existe: Boolean(pass),
      longitud: pass ? pass.replace(/\s/g, '').length : 0, // debe ser 16
    },
    nombres_de_variables_email_que_ve_vercel: mailVarNames,
    pista:
      mailVarNames.length === 0
        ? 'Vercel no ve NINGUNA variable con "mail" en el nombre. No estan guardadas en este proyecto/entorno, o el deploy es anterior a guardarlas.'
        : 'Vercel ve estas variables. Si los nombres no son exactamente GMAIL_USER y GMAIL_APP_PASSWORD, hay un typo.',
  });
}
