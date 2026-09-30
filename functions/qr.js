const SUPABASE_URL  = 'https://zgscyfpqwbmwemzqtvpx.supabase.co';
const SUPABASE_ANON = 'sb_publishable_m0ifDrZ8vL6MSMHPp00trQ_dkG3KzBm';

export async function onRequest() {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/bde_config?id=eq.qr_destination&select=value`,
      { headers: { 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${SUPABASE_ANON}` } }
    );
    const rows = await res.json();
    const dest = rows?.[0]?.value;
    if (dest && dest.startsWith('http')) {
      return new Response(null, {
        status: 302,
        headers: { Location: dest, 'Cache-Control': 'no-store, no-cache' },
      });
    }
  } catch (_) {}
  return new Response(null, {
    status: 302,
    headers: { Location: 'https://bdecreadien.fr', 'Cache-Control': 'no-store, no-cache' },
  });
}
