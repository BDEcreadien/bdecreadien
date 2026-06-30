// ============================================================
// AUTOCOMPLETE LIEU
// ============================================================
let nominatimTimer = null;
function initLieuAutocomplete() {
  const input = document.getElementById('ev-adresse');
  const list = document.getElementById('lieu-suggestions');
  if (!input) return;
  input.addEventListener('input', () => {
    clearTimeout(nominatimTimer);
    const q = input.value.trim();
    if (q.length < 3) { list.style.display = 'none'; return; }
    nominatimTimer = setTimeout(() => searchLieu(q), 350);
  });
  document.addEventListener('click', e => { if (!e.target.closest('.autocomplete-wrap')) list.style.display = 'none'; });
}
async function searchLieu(q) {
  const list = document.getElementById('lieu-suggestions');
  try {
    const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=6&autocomplete=1`);
    const json = await res.json();
    const results = json.features || [];
    if (!results.length) { list.innerHTML = '<div class="autocomplete-item" style="color:var(--gris-texte);cursor:default;">Aucun résultat</div>'; list.style.display = 'block'; return; }
    list.innerHTML = results.map((r, i) => {
      const p = r.properties;
      return `<div class="autocomplete-item" onclick="selectLieu(${i})"><strong>${p.label}</strong></div>`;
    }).join('');
    list._results = results;
    list.style.display = 'block';
  } catch(e) { list.style.display = 'none'; }
}
function selectLieu(i) {
  const list = document.getElementById('lieu-suggestions');
  const p = list._results[i].properties;
  document.getElementById('ev-adresse').value = p.label;
  list.style.display = 'none';
}
