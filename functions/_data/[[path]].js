// Bloque l'accès HTTP public à /_data/* SAUF les fichiers explicitement publics.
// Les fichiers autorisés ne contiennent pas de données personnelles.
// fidelite.json (emails/nom des porteurs de carte) reste bloqué → RGPD.

const PUBLIC_ALLOWLIST = new Set([
  'config.json',
  'evenements.json',
  'videos.json',
  'annonces.json',
  'annonces-categories.json',
  'archives.json',
  'equipe.json',
  'galerie.json',
  'partenaires.json',
]);

export const onRequest = async (ctx) => {
  const url = new URL(ctx.request.url);
  // path segments after /_data/
  const rest = url.pathname.replace(/^\/_data\//, '');
  // premier segment (nom de fichier ou dossier)
  const first = rest.split('/')[0];

  if (PUBLIC_ALLOWLIST.has(first)) {
    // Laisser Cloudflare Pages servir le fichier statique
    return ctx.next();
  }
  return new Response('Not Found', { status: 404, headers: { 'Content-Type': 'text/plain' } });
};
