export async function onRequest({ params, env, request }) {
  const url = new URL(request.url);
  url.pathname = '/ticket.html';
  url.searchParams.set('slug', params.slug);
  return env.ASSETS.fetch(url.toString());
}
