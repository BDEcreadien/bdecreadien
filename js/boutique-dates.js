/* Ouverture et fermeture de la boutique (bde_parametres), réglées dans l'admin > Boutique.
   Lues sans cache : une fermeture doit s'appliquer tout de suite.
   État : 'avant' | 'ouverte' | 'fermee'. Sans date d'ouverture, la boutique est fermée. */
window.boutiqueEtat = function (ouverture, fermeture) {
  const t = Date.now();
  if (!ouverture) return 'fermee';
  if (t < ouverture) return 'avant';
  return fermeture && t >= fermeture ? 'fermee' : 'ouverte';
};

// Renvoie null si la lecture échoue : la page appelante ne redirige alors personne
window.boutiqueDates = async function () {
  try {
    const r = await fetch(window.SUPABASE_URL + '/rest/v1/bde_parametres?select=cle,valeur&cle=in.(boutique_ouverture,boutique_fermeture)', {
      headers: { apikey: window.SUPABASE_ANON, Authorization: 'Bearer ' + window.SUPABASE_ANON }, cache: 'no-store'
    });
    if (!r.ok) return null;
    const p = {};
    (await r.json()).forEach(l => { p[l.cle] = l.valeur; });
    const date = v => (v && !isNaN(new Date(v)) ? new Date(v) : null);
    const ouverture = date(p.boutique_ouverture), fermeture = date(p.boutique_fermeture);
    return { ouverture, fermeture, etat: window.boutiqueEtat(ouverture, fermeture) };
  } catch (_) { return null; }
};
