// Cloudflare Pages Function — upload image vers R2
// Bindings requis (Cloudflare dashboard > Pages > bdecreadien > Settings > Functions) :
//   R2 bucket binding : variable name = BUCKET, bucket = boutique
//   Environment variable : UPLOAD_SECRET = <secret aléatoire>
// Custom domain R2 : images.bdecreadien.fr → bucket boutique

export async function onRequestPost(context) {
  const { request, env } = context;

  const secret = request.headers.get('x-upload-secret');
  if (!env.UPLOAD_SECRET || secret !== env.UPLOAD_SECRET) {
    return json({ error: 'Non autorisé' }, 401);
  }

  let form;
  try { form = await request.formData(); }
  catch { return json({ error: 'Payload invalide' }, 400); }

  const file = form.get('file');
  const filename = form.get('filename') || `${Date.now()}.webp`;
  if (!file || typeof file === 'string') {
    return json({ error: 'Fichier manquant' }, 400);
  }

  const buf = await file.arrayBuffer();
  await env.BUCKET.put(filename, buf, {
    httpMetadata: { contentType: file.type || 'image/webp' },
  });

  const base = env.R2_PUBLIC_URL || 'https://images.bdecreadien.fr';
  return json({ url: `${base}/${filename}` });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
