export async function sendEmail(apiKey: string, { from, to, subject, html }: { from: string; to: string[]; subject: string; html: string }) {
  const m = from.match(/^(.+?)\s*<(.+)>$/)
  const sender = m ? { name: m[1].trim(), email: m[2].trim() } : { email: from }
  return fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
    body: JSON.stringify({
      sender,
      to: to.map((e: string) => ({ email: e })),
      subject,
      htmlContent: html,
    }),
  })
}
