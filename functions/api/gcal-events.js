const ICS_URL = 'https://calendar.google.com/calendar/ical/4ecec32ec639d124f22369adfff74b9d7d91ef12bb10ef4751686bb166a9d49b%40group.calendar.google.com/public/basic.ics';

export async function onRequest() {
  try {
    const res = await fetch(ICS_URL);
    if (!res.ok) return json({ error: 'Fetch ICS failed: ' + res.status }, 502);
    const text = await res.text();
    const events = parseICS(text);
    return json(events);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}

function decodeICSText(s) {
  return (s || '').replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\').trim();
}

function parseICSDate(val) {
  if (!val || val.length < 8) return null;
  return `${val.substring(0, 4)}-${val.substring(4, 6)}-${val.substring(6, 8)}`;
}

function parseICSTime(val, isUtc) {
  const tIdx = val.indexOf('T');
  if (tIdx < 0) return null;
  let h = parseInt(val.substring(tIdx + 1, tIdx + 3));
  const min = parseInt(val.substring(tIdx + 3, tIdx + 5));
  if (isUtc) h = (h + 2) % 24; // UTC → Europe/Paris (approx CEST)
  return `${h.toString().padStart(2, '0')}h${min.toString().padStart(2, '0')}`;
}

function parseICS(text) {
  // Unfold continuation lines
  const unfolded = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  const events = [];
  const blocks = unfolded.split('BEGIN:VEVENT');

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split('END:VEVENT')[0];
    const props = {};

    for (const line of block.split(/\r?\n/)) {
      const colonIdx = line.indexOf(':');
      if (colonIdx < 0) continue;
      const key = line.substring(0, colonIdx).split(';')[0].toUpperCase();
      props[key] = line.substring(colonIdx + 1);
    }

    const summary = props['SUMMARY'];
    const dtstart = props['DTSTART'] || '';
    if (!summary || !dtstart) continue;

    const date = parseICSDate(dtstart);
    if (!date) continue;

    const isUtc = dtstart.endsWith('Z');
    const horaire = parseICSTime(dtstart, isUtc);
    const dtend = props['DTEND'] || '';
    const horaireDebut = horaire;
    const horaireFin = parseICSTime(dtend, dtend.endsWith('Z'));

    events.push({
      titre: decodeICSText(summary),
      date,
      lieu: decodeICSText(props['LOCATION'] || ''),
      description: decodeICSText(props['DESCRIPTION'] || ''),
      horaire: horaireDebut && horaireFin ? `${horaireDebut} – ${horaireFin}` : (horaireDebut || null),
      horaireDebut: horaireDebut || null,
      horaireFin: horaireFin || null,
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  return events
    .filter(e => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
}
