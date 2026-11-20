export async function sendEmail(apiKey, { from, to, subject, html }) {
  const m = from.match(/^(.+?)\s*<(.+)>$/)
  const sender = m ? { name: m[1].trim(), email: m[2].trim() } : { email: from }
  return fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
    body: JSON.stringify({
      sender,
      to: to.map(e => ({ email: e })),
      subject,
      htmlContent: html,
    }),
  })
}
