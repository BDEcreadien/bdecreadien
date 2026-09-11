// GET /api/planning-ics?token=xxx
// Retourne un fichier .ics avec toutes les tâches (ponctuelles + récurrentes dépliées)
// de la personne dont le profils.ics_token correspond.
// À abonner dans Google Cal / Apple Cal / Outlook.

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) return new Response('missing token', { status: 400 });

  const SUPA = env.SUPABASE_URL;
  const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPA || !KEY) return new Response('server config', { status: 500 });

  const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };

  // 1) Trouve le membre
  const profilRes = await fetch(`${SUPA}/rest/v1/profils?select=id,prenom,nom&ics_token=eq.${encodeURIComponent(token)}&limit=1`, { headers });
  const profils = await profilRes.json();
  if (!Array.isArray(profils) || !profils.length) return new Response('token invalid', { status: 404 });
  const membre = profils[0];

  // 2) Tâches ponctuelles (les 12 derniers mois + 12 prochains pour large window)
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 12, 1).toISOString().slice(0, 10);
  const end = new Date(now.getFullYear(), now.getMonth() + 13, 1).toISOString().slice(0, 10);
  const tachesRes = await fetch(
    `${SUPA}/rest/v1/planning_taches?select=id,titre,description,jour,horaire_debut,horaire_fin,notes,statut,priorite&membre_id=eq.${membre.id}&jour=gte.${start}&jour=lt.${end}`,
    { headers }
  );
  const taches = await tachesRes.json();

  // 3) Récurrentes
  const recRes = await fetch(
    `${SUPA}/rest/v1/planning_taches_recurrentes?select=*&membre_id=eq.${membre.id}`,
    { headers }
  );
  const rec = await recRes.json();

  // 4) Génère les événements ICS
  const events = [];

  const pad = n => String(n).padStart(2, '0');
  const toIcsDate = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}`;
  const toIcsDateTime = (d) => `${toIcsDate(d)}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
  const esc = s => (s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n').replace(/\r/g, '');

  const makeEvent = (uid, titre, desc, dateStr, hDebut, hFin, priorite) => {
    const dateOnly = !hDebut;
    let dtStart, dtEnd;
    if (dateOnly) {
      // Toute la journée
      const d = new Date(dateStr + 'T00:00:00Z');
      const nextDay = new Date(d.getTime() + 24 * 3600 * 1000);
      dtStart = `DTSTART;VALUE=DATE:${toIcsDate(d)}`;
      dtEnd = `DTEND;VALUE=DATE:${toIcsDate(nextDay)}`;
    } else {
      // Créneau horaire (Europe/Paris fixe pour simplifier — on stocke sans TZ, on assume Paris local)
      const [hd, md] = hDebut.split(':').map(Number);
      const dStart = new Date(dateStr + 'T00:00:00Z');
      dStart.setUTCHours(hd - 2, md, 0, 0);  // Paris été = UTC+2, on ajuste grosso modo
      const dEnd = new Date(dStart);
      if (hFin) {
        const [hf, mf] = hFin.split(':').map(Number);
        dEnd.setUTCHours(hf - 2, mf, 0, 0);
        if (dEnd <= dStart) dEnd.setUTCDate(dEnd.getUTCDate() + 1);
      } else {
        dEnd.setUTCHours(dEnd.getUTCHours() + 1);
      }
      dtStart = `DTSTART:${toIcsDateTime(dStart)}`;
      dtEnd = `DTEND:${toIcsDateTime(dEnd)}`;
    }
    const summary = (priorite === 'urgente' ? '⚠️ ' : '') + esc(titre);
    const description = esc([desc, notes].filter(Boolean).join('\n\n'));
    events.push([
      'BEGIN:VEVENT',
      `UID:${uid}@bdecreadien.fr`,
      `DTSTAMP:${toIcsDateTime(new Date())}`,
      dtStart,
      dtEnd,
      `SUMMARY:${summary}`,
      description ? `DESCRIPTION:${description}` : null,
      'END:VEVENT'
    ].filter(Boolean).join('\r\n'));
  };

  let notes = '';
  for (const t of taches) {
    notes = t.notes || '';
    makeEvent(`tache-${t.id}`, t.titre, t.description, t.jour, t.horaire_debut, t.horaire_fin, t.priorite);
  }

  // Récurrentes : déplie sur ±12 mois
  const startDate = new Date(start + 'T00:00:00Z');
  const endDate = new Date(end + 'T00:00:00Z');
  for (const r of rec) {
    const rDebut = r.date_debut ? new Date(r.date_debut + 'T00:00:00Z') : startDate;
    const rFin = r.date_fin ? new Date(r.date_fin + 'T00:00:00Z') : endDate;
    // Parcourt chaque semaine de la fenêtre, cible jour_semaine (1=lun ... 6=sam)
    const cur = new Date(Math.max(startDate.getTime(), rDebut.getTime()));
    // Aligne cur sur le lundi de sa semaine
    const dow = (cur.getUTCDay() + 6) % 7 + 1;  // 1=lun ... 7=dim
    if (dow > 1) cur.setUTCDate(cur.getUTCDate() - (dow - 1));
    while (cur <= endDate && cur <= rFin) {
      const occ = new Date(cur.getTime() + (r.jour_semaine - 1) * 24 * 3600 * 1000);
      if (occ >= rDebut && occ <= rFin && occ >= startDate && occ <= endDate) {
        notes = r.notes || '';
        makeEvent(`recur-${r.id}-${occ.toISOString().slice(0,10)}`, r.titre + ' (récurrent)', r.description, occ.toISOString().slice(0,10), r.horaire_debut, r.horaire_fin, r.priorite);
      }
      cur.setUTCDate(cur.getUTCDate() + 7);
    }
  }

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BDE CREAD//Planning perso//FR',
    `X-WR-CALNAME:BDE CREAD – Planning de ${esc(membre.prenom || '')} ${esc(membre.nom || '')}`.trim(),
    'X-WR-TIMEZONE:Europe/Paris',
    'CALSCALE:GREGORIAN',
    ...events,
    'END:VCALENDAR'
  ].join('\r\n');

  return new Response(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'public, max-age=1800',
      'Content-Disposition': `inline; filename="bde-planning-${membre.id}.ics"`
    }
  });
}
