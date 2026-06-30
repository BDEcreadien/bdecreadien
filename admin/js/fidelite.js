// ============================================================
// FIDÉLITÉ
// ============================================================
let fideliteData = { cartes: [] };
let fideliteSha = null;

async function initFidelite() {
  document.getElementById('fid-list').innerHTML = '<p style="text-align:center;padding:2rem;color:var(--gris-texte);font-size:14px;">Chargement…</p>';
  document.getElementById('fid-empty').style.display = 'none';
  document.getElementById('form-fidelite').classList.remove('visible');

  try {
    const file = await getFile('_data/fidelite.json');
    fideliteSha = file.sha;
    const bytes = Uint8Array.from(atob(file.content.replace(/\n/g,'')), c => c.charCodeAt(0));
    fideliteData = JSON.parse(new TextDecoder().decode(bytes));
    if (!Array.isArray(fideliteData.cartes)) fideliteData.cartes = [];
  } catch(e) {
    fideliteData = { cartes: [] };
    fideliteSha = null;
  }
  renderFideliteList();
}

function renderFideliteList() {
  const list = document.getElementById('fid-list');
  const empty = document.getElementById('fid-empty');
  const query = (document.getElementById('fid-search')?.value || '').toLowerCase().trim();
  const toutes = fideliteData.cartes || [];
  const cartes = toutes.filter(c => {
    if (!query) return true;
    const mots = query.split(/\s+/);
    const cibles = [c.prenom, c.nom].map(s => (s || '').toLowerCase());
    return mots.every(mot => cibles.some(cib => cib.startsWith(mot) || cib.includes(' ' + mot)));
  });
  if (!toutes.length) { list.innerHTML = ''; empty.textContent = 'Aucune carte créée pour l\'instant.'; empty.style.display = 'block'; return; }
  if (!cartes.length) { list.innerHTML = ''; empty.textContent = 'Aucune carte ne correspond à la recherche.'; empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  list.innerHTML = cartes.map((c) => {
    const i = fideliteData.cartes.indexOf(c);
    const pct = Math.round((c.tampons / (c.total || 10)) * 100);
    const lien = `https://bdecreadien.fr/carte.html?id=${c.id}`;
    const historique = (c.historique || []).slice().reverse();
    const historiqueHtml = historique.length ? `
      <div id="hist-${i}" style="display:none;margin-top:12px;border-top:1px solid var(--gris-border);padding-top:12px;">
        <div style="font-size:11px;font-weight:700;color:var(--gris-texte);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">${historique.length} passage${historique.length > 1 ? 's' : ''}</div>
        ${historique.map((h, hi) => {
          const realIndex = (c.historique.length - 1) - hi;
          return `<div style="font-size:12px;color:var(--gris-texte);padding:6px 0;border-bottom:1px solid var(--gris-border);display:flex;gap:8px;align-items:center;">
            <span style="color:var(--violet);font-weight:600;white-space:nowrap;flex-shrink:0;">${h.date}${h.heure ? ' ' + h.heure : ''}</span>
            <span style="flex:1;">validé par <strong>${h.validateur || '—'}</strong>${h.event ? ' · ' + h.event : ''}</span>
            <button onclick="supprimerPassage(${i},${realIndex})" style="background:none;border:none;cursor:pointer;color:rgba(220,50,50,0.5);font-size:16px;line-height:1;padding:0 4px;" title="Supprimer ce passage">×</button>
          </div>`;
        }).join('')}
      </div>` : '';

    return `<div class="item-card" style="flex-direction:column;align-items:stretch;">
      <div style="display:flex;align-items:flex-start;gap:1rem;">
        <div class="item-card-info" style="flex:1;min-width:0;">
          <div class="item-card-title">${c.prenom} ${c.nom}</div>
          <div class="item-card-sub" style="display:flex;align-items:center;gap:10px;margin-top:6px;">
            <div style="flex:1;max-width:160px;height:5px;background:var(--gris-border);border-radius:99px;overflow:hidden;">
              <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#463A90,#E85100);border-radius:99px;"></div>
            </div>
            <span style="font-size:12px;font-weight:600;color:var(--violet);">${c.tampons}/${c.total||10}</span>
            ${c.tampons >= (c.total||10) ? '<span style="font-size:11px;background:#1a9e5c;color:white;padding:2px 8px;border-radius:99px;font-weight:600;">OFFERT</span>' : ''}
          </div>
          <div style="font-size:11px;color:var(--gris-texte);margin-top:4px;">${c.email || ''}</div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:flex-start;flex-shrink:0;justify-content:flex-end;">
          <button class="btn-edit" onclick="ajouterTampon(${i})">+ Tampon</button>
          <button class="btn-edit" style="background:rgba(70,58,144,0.06);" onclick="navigator.clipboard.writeText('${lien}');showToast('Lien copié !','success')">Lien</button>
          ${historique.length ? `<button class="btn-edit" style="background:rgba(70,58,144,0.06);" onclick="toggleHist(${i},this)">Passages ↓</button>` : ''}
          ${c.tampons >= (c.total||10) ? `<button class="btn-edit" style="background:rgba(26,158,92,0.1);color:#1a9e5c;" onclick="reinitialiserCarte(${i})">Reset</button>` : ''}
          <button class="btn-delete" onclick="supprimerCarte(${i})">Supprimer</button>
        </div>
      </div>
      ${historiqueHtml}
    </div>`;
  }).join('');
}

function toggleHist(i, btn) {
  const el = document.getElementById('hist-' + i);
  const open = el.style.display !== 'none';
  el.style.display = open ? 'none' : 'block';
  btn.textContent = open ? 'Passages ↓' : 'Passages ↑';
}

async function supprimerPassage(carteIndex, passageIndex) {
  const c = fideliteData.cartes[carteIndex];
  if (!confirm(`Supprimer le passage du ${c.historique[passageIndex].date} ?`)) return;
  c.historique.splice(passageIndex, 1);
  c.tampons = Math.max(0, c.tampons - 1);
  try {
    await saveFidelite(`Fidélité : suppression passage — ${c.prenom} ${c.nom}`);
    renderFideliteList();
    showToast('Passage supprimé', 'success');
  } catch(e) {
    c.historique.splice(passageIndex, 0, c.historique[passageIndex]);
    c.tampons++;
    showToast('Erreur : ' + e.message, 'error');
  }
}

function showFormFidelite() {
  document.getElementById('form-fidelite').classList.add('visible');
  document.getElementById('fid-prenom').focus();
}
function hideFormFidelite() {
  document.getElementById('form-fidelite').classList.remove('visible');
  document.getElementById('fid-prenom').value = '';
  document.getElementById('fid-nom').value = '';
  document.getElementById('fid-email').value = '';
}

function genId() {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

async function saveFidelite(message) {
  const path = '_data/fidelite.json';
  try {
    const fresh = await getFile(path);
    fideliteSha = fresh.sha;
  } catch(e) { fideliteSha = null; }
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(fideliteData, null, 2))));
  const body = { message, content, branch: BRANCH };
  if (fideliteSha) body.sha = fideliteSha;
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
    method: 'PUT',
    headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) { const b = await res.json().catch(()=>({})); throw new Error(b.message || res.status); }
  const j = await res.json();
  fideliteSha = j.content.sha;
}

function capitalize(s) {
  return s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

async function creerCarte() {
  const prenom = capitalize(document.getElementById('fid-prenom').value.trim());
  const nom = capitalize(document.getElementById('fid-nom').value.trim());
  const email = document.getElementById('fid-email').value.trim();
  if (!prenom || !nom) return showToast('Prénom et nom requis', 'error');
  const carte = { id: genId(), prenom, nom, email, tampons: 0, total: 10, createdAt: new Date().toISOString().split('T')[0] };
  fideliteData.cartes.push(carte);
  try {
    await saveFidelite(`Fidélité : nouvelle carte — ${prenom} ${nom}`);
    hideFormFidelite();
    renderFideliteList();
    showToast('Carte créée !', 'success');
  } catch(e) { fideliteData.cartes.pop(); showToast('Erreur : ' + e.message, 'error'); }
}

function ajouterTampon(i) {
  const c = fideliteData.cartes[i];
  if (c.tampons >= (c.total || 10)) return showToast('Carte déjà complète', 'error');
  const modal = document.getElementById('modal-tampon');
  modal.style.display = 'flex';
  document.getElementById('mt-validateur').value = '';
  document.getElementById('mt-event').value = '';
  document.getElementById('mt-validateur').focus();
  modal.dataset.carteIndex = i;
}

async function confirmerTampon() {
  const modal = document.getElementById('modal-tampon');
  const i = parseInt(modal.dataset.carteIndex);
  const validateur = document.getElementById('mt-validateur').value.trim();
  const event = document.getElementById('mt-event').value.trim();
  let ok = true;
  if (!validateur) { document.getElementById('mt-validateur').style.borderColor='#c0392b'; ok=false; }
  else document.getElementById('mt-validateur').style.borderColor='';
  if (!event) { document.getElementById('mt-event').style.borderColor='#c0392b'; ok=false; }
  else document.getElementById('mt-event').style.borderColor='';
  if (!ok) return;

  modal.style.display = 'none';
  const c = fideliteData.cartes[i];
  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' });
  const heureStr = now.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
  c.tampons++;
  if (!Array.isArray(c.historique)) c.historique = [];
  c.historique.push({ date: dateStr, heure: heureStr, validateur, event });
  try {
    await saveFidelite(`Fidélité : tampon #${c.tampons} — ${c.prenom} ${c.nom} (${event})`);
    renderFideliteList();
    showToast(`Tampon ${c.tampons}/${c.total||10} ajouté !`, 'success');
  } catch(e) { c.tampons--; c.historique.pop(); showToast('Erreur : ' + e.message, 'error'); }
}

function fermerModalTampon() {
  document.getElementById('modal-tampon').style.display = 'none';
}

async function reinitialiserCarte(i) {
  const c = fideliteData.cartes[i];
  if (!confirm(`Réinitialiser la carte de ${c.prenom} ${c.nom} ? (les tampons seront remis à 0)`)) return;
  const old = c.tampons;
  c.tampons = 0;
  try {
    await saveFidelite(`Fidélité : réinitialisation carte — ${c.prenom} ${c.nom}`);
    renderFideliteList();
    showToast('Carte réinitialisée', 'success');
  } catch(e) { c.tampons = old; showToast('Erreur : ' + e.message, 'error'); }
}

async function supprimerCarte(i) {
  const c = fideliteData.cartes[i];
  if (!confirm(`Supprimer la carte de ${c.prenom} ${c.nom} ?`)) return;
  fideliteData.cartes.splice(i, 1);
  try {
    await saveFidelite(`Fidélité : suppression carte — ${c.prenom} ${c.nom}`);
    renderFideliteList();
    showToast('Carte supprimée', 'success');
  } catch(e) { fideliteData.cartes.splice(i, 0, c); showToast('Erreur : ' + e.message, 'error'); }
}
