/* BDE Admin — module fidelite
   Extrait tel quel de admin.html (scripts classiques, portée globale partagée). */
// FIDÉLITÉ
// ============================================================
let fideliteData = { cartes: [] };
let fideliteSha = null;

async function initFidelite() {
  document.getElementById('fid-list').innerHTML = '<p style="text-align:center;padding:2rem;color:var(--gris-texte);font-size:14px;">Chargement…</p>';
  document.getElementById('fid-empty').style.display = 'none';
  document.getElementById('form-fidelite').classList.remove('visible');

  // 1) Cartes Supabase (auto-créées à l'inscription)
  let sbCartes = [];
  try {
    const { data, error } = await window.Auth.sb
      .from('cartes_fidelite')
      .select('user_id, tampons, total, historique, created_at, profils(prenom, nom, email)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    sbCartes = (data || []).map(c => ({
      id: c.user_id,
      user_id: c.user_id,
      prenom: c.profils?.prenom || '',
      nom: c.profils?.nom || '',
      email: c.profils?.email || '',
      tampons: c.tampons,
      total: c.total,
      createdAt: c.created_at,
      historique: Array.isArray(c.historique) ? c.historique : [],
      source: 'supabase'
    }));
  } catch(e) { console.warn('Supabase cartes load failed', e); }

  // 2) Cartes JSON legacy (anciennes cartes créées avant migration)
  let jsonCartes = [];
  try {
    const file = await getFile('_data/fidelite.json');
    fideliteSha = file.sha;
    const bytes = Uint8Array.from(atob(file.content.replace(/\n/g,'')), c => c.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    jsonCartes = (parsed.cartes || []).map(c => ({ ...c, source: 'json' }));
  } catch(e) { fideliteSha = null; }

  // Déduplication : si un email est déjà en Supabase, on ignore la carte JSON legacy
  const sbEmails = new Set(sbCartes.map(c => (c.email || '').toLowerCase().trim()).filter(Boolean));
  const jsonSansDoublons = jsonCartes.filter(c => {
    const e = (c.email || '').toLowerCase().trim();
    return !e || !sbEmails.has(e);
  });
  fideliteData = { cartes: [...sbCartes, ...jsonSansDoublons] };
  renderFideliteList();
}

function renderFideliteList() {
  const list = document.getElementById('fid-list');
  const empty = document.getElementById('fid-empty');
  const query = (document.getElementById('fid-search')?.value || '').toLowerCase().trim();
  const sortMode = document.getElementById('fid-sort')?.value || 'nom';
  const eventFilter = (document.getElementById('fid-event-filter')?.value || '').trim();
  const toutes = fideliteData.cartes || [];

  // Normalise : retire accents, met en minuscule
  const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  let cartes = toutes.filter(c => {
    if (query) {
      const mots = query.split(/\s+/);
      const cibles = [c.prenom, c.nom].map(s => norm(s));
      if (!mots.every(mot => cibles.some(cib => cib.startsWith(norm(mot)) || cib.includes(' ' + norm(mot))))) return false;
    }
    if (eventFilter) {
      const nf = norm(eventFilter);
      return (c.historique || []).some(h => h.event && norm(h.event).includes(nf));
    }
    return true;
  });

  // Tri
  // Convertit un h.date (attendu format JJ/MM/AAAA) + h.heure (HH:MM) → timestamp
  const toTs = (h) => {
    if (!h?.date) return 0;
    const m = h.date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return new Date(h.date).getTime() || 0;
    const heure = h.heure && /^\d{1,2}:\d{2}/.test(h.heure) ? h.heure : '00:00';
    return new Date(`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}T${heure}:00`).getTime() || 0;
  };
  const dernierPassage = (c) => {
    const h = (c.historique || []);
    if (!h.length) return 0;
    return Math.max(...h.map(toTs));
  };
  const nomComplet = (c) => `${(c.prenom||'').toLowerCase()} ${(c.nom||'').toLowerCase()}`.trim();

  if (sortMode === 'nom') {
    cartes.sort((a, b) => nomComplet(a).localeCompare(nomComplet(b), 'fr', { sensitivity: 'base' }));
  } else if (sortMode === 'tampons-desc') {
    cartes.sort((a, b) => (b.tampons || 0) - (a.tampons || 0) || nomComplet(a).localeCompare(nomComplet(b), 'fr'));
  } else if (sortMode === 'tampons-asc') {
    cartes.sort((a, b) => (a.tampons || 0) - (b.tampons || 0) || nomComplet(a).localeCompare(nomComplet(b), 'fr'));
  } else if (sortMode === 'passage-desc') {
    cartes.sort((a, b) => dernierPassage(b) - dernierPassage(a) || nomComplet(a).localeCompare(nomComplet(b), 'fr'));
  } else if (sortMode === 'passage-asc') {
    cartes.sort((a, b) => {
      const da = dernierPassage(a), db = dernierPassage(b);
      // Ceux sans passage à la fin
      if (!da && db) return 1;
      if (da && !db) return -1;
      return da - db;
    });
  } else if (sortMode === 'jamais') {
    cartes = cartes.filter(c => !(c.historique && c.historique.length));
    cartes.sort((a, b) => nomComplet(a).localeCompare(nomComplet(b), 'fr'));
  }

  if (!toutes.length) { list.innerHTML = ''; empty.textContent = 'Aucune carte créée pour l\'instant.'; empty.style.display = 'block'; return; }
  if (!cartes.length) {
    list.innerHTML = '';
    empty.textContent = sortMode === 'jamais' ? 'Aucune carte sans passage.' : 'Aucune carte ne correspond à la recherche.';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  const nf = eventFilter ? norm(eventFilter) : '';

  // Mode filtre event : affichage simplifié - juste qui a participé
  if (nf) {
    list.innerHTML = `
      <div style="margin-bottom:16px;padding:10px 16px;background:#f8fafc;border-radius:10px;border:1px solid color-mix(in srgb,var(--accent) 16%,white);font-size:13px;font-weight:700;color:var(--accent)">
        ${cartes.length} participant${cartes.length > 1 ? 's' : ''} à "${eventFilter}"
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">
        ${cartes.map((c, ci) => {
          const passages = (c.historique || []).filter(h => h.event && norm(h.event).includes(nf));
          const pid = 'fev-' + ci;
          return `
          <div style="background:white;border:1.5px solid color-mix(in srgb,var(--accent) 16%,white);border-radius:12px;overflow:hidden;cursor:pointer" onclick="(function(el){const d=el.querySelector('.fev-detail');const open=d.style.display!=='none';d.style.display=open?'none':'block';el.style.borderColor=open?'#dbeafe':'#2563eb'})(this)">
            <div style="padding:12px 14px;display:flex;align-items:center;gap:10px">
              <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent-h));display:flex;align-items:center;justify-content:center;flex-shrink:0;font-weight:700;font-size:13px;color:white">
                ${(c.prenom||'?')[0].toUpperCase()}
              </div>
              <div style="min-width:0;flex:1">
                <div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.prenom} ${c.nom}</div>
                <div style="font-size:11px;color:#888">${passages.length} passage${passages.length > 1 ? 's' : ''}</div>
              </div>
              <span style="font-size:11px;color:#bbb">▾</span>
            </div>
            <div class="fev-detail" style="display:none;border-top:1px solid #eef2f7;padding:10px 14px;background:#f8fafc">
              ${passages.map(h => `
                <div style="font-size:12px;padding:5px 0;border-bottom:1px solid #eef2f7;display:flex;flex-direction:column;gap:1px">
                  <span style="font-weight:700;color:var(--accent)">${h.date}${h.heure ? ' · ' + h.heure : ''}</span>
                  <span style="color:#555">${h.event || ''}</span>
                  <span style="color:#aaa;font-size:11px">par ${h.validateur || '-'}</span>
                </div>`).join('')}
            </div>
          </div>`;
        }).join('')}
      </div>`;
    return;
  }

  // Mode normal : cartes complètes
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
            <span style="flex:1;">validé par <strong>${h.validateur || '-'}</strong>${h.event ? ' · ' + h.event : ''}</span>
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
              <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--accent),var(--accent),var(--accent-h),var(--accent-h),var(--accent-h),var(--accent-2));border-radius:99px;"></div>
            </div>
            <span style="font-size:12px;font-weight:600;color:var(--violet);">${c.tampons}/${c.total||10}</span>
            ${c.tampons >= (c.total||10) ? '<span style="font-size:11px;background:#1a9e5c;color:white;padding:2px 8px;border-radius:99px;font-weight:600;">OFFERT</span>' : ''}
          </div>
          <div style="font-size:11px;color:var(--gris-texte);margin-top:4px;">${c.email || ''}</div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:flex-start;flex-shrink:0;justify-content:flex-end;">
          <button class="btn-edit" onclick="ajouterTampon(${i})">+ Tampon</button>
          <button class="btn-edit" style="background:color-mix(in srgb,var(--accent) 6%,transparent);" onclick="navigator.clipboard.writeText('${lien}');showToast('Lien copié !','success')">Lien</button>
          ${historique.length ? `<button class="btn-edit" style="background:color-mix(in srgb,var(--accent) 6%,transparent);" onclick="toggleHist(${i},this)">Passages ↓</button>` : ''}
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
  const backup = c.historique[passageIndex];
  c.historique.splice(passageIndex, 1);
  c.tampons = Math.max(0, c.tampons - 1);
  try {
    if (c.source === 'supabase') {
      const { error } = await window.Auth.sb.from('cartes_fidelite').update({ tampons: c.tampons, historique: c.historique }).eq('user_id', c.user_id);
      if (error) throw error;
    } else {
      await saveFidelite(`Fidélité : suppression passage - ${c.prenom} ${c.nom}`);
    }
    renderFideliteList();
    showToast('Passage supprimé', 'success');
  } catch(e) {
    c.historique.splice(passageIndex, 0, backup);
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
    await saveFidelite(`Fidélité : nouvelle carte - ${prenom} ${nom}`);
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
    if (c.source === 'supabase') {
      const { error } = await window.Auth.sb.from('cartes_fidelite').update({ tampons: c.tampons, historique: c.historique }).eq('user_id', c.user_id);
      if (error) throw error;
    } else {
      await saveFidelite(`Fidélité : tampon #${c.tampons} - ${c.prenom} ${c.nom} (${event})`);
    }
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
  const oldHist = c.historique || [];
  c.tampons = 0;
  c.historique = [];
  try {
    if (c.source === 'supabase') {
      const { error } = await window.Auth.sb.from('cartes_fidelite').update({ tampons: 0, historique: [] }).eq('user_id', c.user_id);
      if (error) throw error;
    } else {
      await saveFidelite(`Fidélité : réinitialisation carte - ${c.prenom} ${c.nom}`);
    }
    renderFideliteList();
    showToast('Carte réinitialisée', 'success');
  } catch(e) { c.tampons = old; c.historique = oldHist; showToast('Erreur : ' + e.message, 'error'); }
}

async function supprimerCarte(i) {
  const c = fideliteData.cartes[i];
  if (c.source === 'supabase') {
    return showToast('Impossible : cette carte est liée à un compte étudiant. Supprime le compte pour supprimer la carte.', 'error');
  }
  if (!confirm(`Supprimer la carte de ${c.prenom} ${c.nom} ?`)) return;
  fideliteData.cartes.splice(i, 1);
  try {
    await saveFidelite(`Fidélité : suppression carte - ${c.prenom} ${c.nom}`);
    renderFideliteList();
    showToast('Carte supprimée', 'success');
  } catch(e) { fideliteData.cartes.splice(i, 0, c); showToast('Erreur : ' + e.message, 'error'); }
}

// ============================================================
