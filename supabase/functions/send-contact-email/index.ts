import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function buildEmailHtml(nom: string, email: string, sujet: string, message: string): string {
  const messageHtml = message.replace(/\n/g, '<br>');
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Message BDE CREAD</title>
</head>
<body style="margin:0;padding:0;background:#F0EFF8;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0EFF8;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(70,58,144,0.12);">

        <!-- HEADER -->
        <tr>
          <td style="background:linear-gradient(135deg,#463A90 0%,#8B1A6B 50%,#E85100 100%);padding:36px 40px;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:4px;text-transform:uppercase;color:rgba(255,255,255,0.6);">BDE CREAD LYON</p>
            <h1 style="margin:0;font-size:26px;font-weight:700;color:#ffffff;letter-spacing:1px;">Nouveau message</h1>
            <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.75);">Reçu depuis bdecreadien.fr/contact</p>
          </td>
        </tr>

        <!-- BODY -->
        <tr>
          <td style="background:#ffffff;padding:36px 40px;">

            <!-- Expéditeur -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="width:40px;vertical-align:top;padding-top:2px;">
                  <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#463A90,#E85100);color:white;font-weight:700;font-size:16px;text-align:center;line-height:36px;">${nom.charAt(0).toUpperCase()}</div>
                </td>
                <td style="padding-left:14px;vertical-align:top;">
                  <p style="margin:0;font-size:16px;font-weight:700;color:#1A1A2E;">${nom}</p>
                  <a href="mailto:${email}" style="font-size:13px;color:#463A90;text-decoration:none;">${email}</a>
                </td>
              </tr>
            </table>

            <!-- Sujet -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td>
                  <p style="margin:0 0 6px;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#463A90;">Sujet</p>
                  <div style="background:#F5F4FF;border-radius:10px;padding:12px 16px;display:inline-block;">
                    <p style="margin:0;font-size:15px;font-weight:600;color:#1A1A2E;">${sujet}</p>
                  </div>
                </td>
              </tr>
            </table>

            <!-- Séparateur -->
            <hr style="border:none;border-top:1px solid #EEEEEE;margin:0 0 28px;">

            <!-- Message -->
            <p style="margin:0 0 10px;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#463A90;">Message</p>
            <div style="background:#F8F8FF;border-left:3px solid #463A90;border-radius:0 12px 12px 0;padding:20px 24px;">
              <p style="margin:0;font-size:14px;color:#333333;line-height:1.8;">${messageHtml}</p>
            </div>

            <!-- Répondre -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;">
              <tr>
                <td align="center">
                  <a href="mailto:${email}?subject=Re: ${encodeURIComponent(sujet)}"
                     style="display:inline-block;background:linear-gradient(135deg,#463A90,#E85100);color:white;text-decoration:none;padding:13px 32px;border-radius:10px;font-size:14px;font-weight:700;letter-spacing:0.5px;">
                    Répondre à ${nom}
                  </a>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background:#F5F4FF;padding:20px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#888888;">
              BDE CREAD Lyon &bull;
              <a href="https://bdecreadien.fr" style="color:#463A90;text-decoration:none;">bdecreadien.fr</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { nom, email, sujet, message } = await req.json();

    if (!nom || !email || !sujet || !message) {
      return new Response(JSON.stringify({ error: 'Champs manquants' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY manquante');

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'BDE CREAD Lyon <contact@bdecreadien.fr>',
        to: ['bdecreadien@gmail.com'],
        reply_to: email,
        subject: `[BDE CREAD] ${sujet} — Message de ${nom}`,
        html: buildEmailHtml(nom, email, sujet, message),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(err);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
