// Bloque l'accès HTTP public à /_data/* — contient des données historiques
// (fidelite.json legacy, evenements.json, etc.). Ces fichiers restent lisibles
// via l'API GitHub (getFile côté admin authentifié), mais pas exposés au web.
export const onRequest = () =>
  new Response('Not Found', { status: 404, headers: { 'Content-Type': 'text/plain' } });
