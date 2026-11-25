/* BDE Admin — module planning
   Extrait tel quel de admin.html (scripts classiques, portée globale partagée). */
// ============================================================
// PLANNING BUREAU
// ============================================================
let _plnEvents = [];
let _plnTaches = [];
let _plnInscriptions = [];
let _plnMembres = [];
let _plnTemplates = [];
let _plnCurrentTab = 'events';
let _plnTplBuffer = [];  // buffer d'édition des tâches d'un template

async function initPlanning() {
  adminRenderHero('step-planning', {
    icon: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    title: 'Organisation',
    sub: 'Répartition des membres sur les événements'
  });
  _plnCurrentTab = 'events';
  document.querySelectorAll('.pln-tab-btn').forEach(b => b.classList.toggle('pln-tab-active', b.dataset.tab === 'events'));
  document.querySelectorAll('.pln-tab-content').forEach(c => c.style.display = c.id === 'pln-tab-events' ? '' : 'none');
  await plnReload();
}

// Sync JSON → Supabase : importe les events créés depuis /admin?page=agenda
// (stockés dans _data/evenements.json) vers la table Supabase `evenements`
// pour qu'ils apparaissent dans Planning bureau.
async function plnSyncJsonEvents() {
  try {
    const res = await fetch('/_data/evenements.json?nc=' + Date.now());
    const raw = await res.json();
    const jsonEvs = Array.isArray(raw) ? raw : (raw.evenements || []);
    // Récupère les events Supabase existants
    const { data: existing } = await Auth.sb.from('evenements').select('id, titre, date, bureau_only');
    const key = e => `${(e.titre||'').toLowerCase().trim()}|${e.date||''}`;
    const jsonKeys = new Set(jsonEvs.filter(e => e.titre).map(key));
    // Supprime de Supabase les events non bureau_only qui ne sont plus dans le JSON
    const toDelete = (existing || []).filter(e => !e.bureau_only && !jsonKeys.has(key(e)));
    if (toDelete.length) {
      await Auth.sb.from('evenements').delete().in('id', toDelete.map(e => e.id));
    }
    if (!jsonEvs.length) return;
    const existingKeys = new Set((existing || []).map(key));
    const toInsert = jsonEvs.filter(e => e.titre && !existingKeys.has(key(e))).map(e => {
      const img = typeof e.imageUrl === 'object' ? e.imageUrl?.url : e.imageUrl;
      return {
        titre: e.titre,
        date: e.date || null,
        date_affichage: e.dateAffichage || null,
        horaire: e.horaire || null,
        horaire_debut: e.horaireDebut || null,
        horaire_fin: e.horaireFin || null,
        lieu: e.lieu || null,
        adresse: e.adresse || null,
        description: e.description || null,
        prix: e.prix || null,
        categorie: e.categorie || null,
        image_url: img || null,
        lien: e.lien || null,
        type_lien: e.typeLien || null,
        phare: e.phare === true,
        inscrits: e.inscrits || null,
        bureau_only: false,
        created_by: window._monProfilId || null
      };
    });
    if (toInsert.length) {
      const { error } = await Auth.sb.from('evenements').insert(toInsert);
      if (error) console.warn('[pln sync JSON→Supabase]', error);
    }
  } catch (err) {
    console.warn('[pln sync JSON→Supabase]', err);
  }
}

async function plnReload() {
  const sb = Auth.sb;
  // Sync auto : importe les events du JSON (admin agenda) dans Supabase pour qu'ils
  // soient visibles dans Planning bureau. Upsert par titre+date.
  await plnSyncJsonEvents();
  const [evRes, tacheRes, inscRes, memRes, tplRes] = await Promise.all([
    sb.from('evenements').select('id, titre, date, lieu, description, blocage_desinscription_h, created_at, bureau_only').order('date', { ascending: false, nullsFirst: false }),
    sb.from('taches_bureau').select('id, evenement_id, titre, description, capacite, ordre'),
    sb.from('inscriptions_taches').select('id, tache_id, membre_id, created_at, valide'),
    sb.from('profils').select('id, prenom, nom').eq('bureau', true).order('prenom'),
    sb.from('templates_taches').select('id, nom, taches').order('nom')
  ]);
  _plnEvents = evRes.data || [];
  _plnTaches = tacheRes.data || [];
  _plnInscriptions = inscRes.data || [];
  _plnMembres = memRes.data || [];
  _plnTemplates = tplRes.data || [];
  plnRenderCurrentTab();
}

function plnSwitchTab(tab) {
  _plnCurrentTab = tab;
  document.querySelectorAll('.pln-tab-btn').forEach(b => b.classList.toggle('pln-tab-active', b.dataset.tab === tab));
  document.querySelectorAll('.pln-tab-content').forEach(c => c.style.display = c.id === `pln-tab-${tab}` ? '' : 'none');
  plnRenderCurrentTab();
}

function plnRenderCurrentTab() {
  if (_plnCurrentTab === 'events') plnRenderEvents();
  else if (_plnCurrentTab === 'members') plnRenderMembers();
  else if (_plnCurrentTab === 'templates') plnRenderTemplates();
}

// ============ TAB EVENTS ============
function plnRenderEvents() {
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = _plnEvents.filter(e => !e.date || e.date >= today).sort((a,b) => (a.date||'').localeCompare(b.date||''));
  const past = _plnEvents.filter(e => e.date && e.date < today);
  document.getElementById('pln-events-upcoming').innerHTML = upcoming.length
    ? upcoming.map(ev => plnEventCardHtml(ev, false)).join('')
    : '<div class="empty-state">Aucun événement à venir. Crée-en un !</div>';
  document.getElementById('pln-events-past').innerHTML = past.length
    ? past.map(ev => plnEventCardHtml(ev, true)).join('')
    : '<div class="empty-state">Pas encore d\'historique.</div>';
}

function plnEventCardHtml(ev, past) {
  const dateFmt = ev.date ? new Date(ev.date + 'T00:00:00').toLocaleDateString('fr-FR', {weekday:'long', day:'numeric', month:'long'}) : 'Date à définir';
  const taches = _plnTaches.filter(t => t.evenement_id === ev.id).sort((a,b) => (a.ordre||0) - (b.ordre||0));
  const totalInscrits = _plnInscriptions.filter(i => taches.some(t => t.id === i.tache_id)).length;

  const tachesHtml = taches.length ? taches.map(t => plnTacheRowHtml(t, past)).join('') : `
    <div style="padding:14px;background:var(--gris-clair);border-radius:8px;text-align:center;font-size:13px;color:var(--gris-texte);">
      Aucune tâche définie${!past ? ' - <a href="#" onclick="plnOpenTacheForm(null,\''+ev.id+'\');return false;" style="color:var(--violet);font-weight:600;">en ajouter</a>' : '.'}
    </div>`;

  const actions = !past ? `
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button class="btn-edit" onclick="plnOpenTacheForm(null,'${ev.id}')" style="padding:6px 12px;font-size:12px;">+ Tâche</button>
      <button class="btn-edit" onclick="plnOpenEventForm('${ev.id}')" style="padding:6px 12px;font-size:12px;">Modifier</button>
      <button class="btn-edit" onclick="plnNotifyBureau('${ev.id}')" style="padding:6px 12px;font-size:12px;background:#f1f5f9;color:var(--violet);border-color:var(--violet);">🔔 Prévenir les membres BDE</button>
      <button class="btn-edit" onclick="plnSharEvent('${ev.id}')" style="padding:6px 12px;font-size:12px;background:#e6f7ec;color:#1a7a40;border-color:#1a7a40;" title="Copier le lien pour partager">🔗 Partager</button>
      <button class="btn-delete" onclick="plnDeleteEvent('${ev.id}')" style="padding:6px 12px;font-size:12px;">Supprimer</button>
    </div>` : '';

  return `
    <div class="form-card visible" style="margin-bottom:14px;${past ? 'opacity:0.7;' : ''}">
      <div style="display:flex;justify-content:space-between;align-items:start;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
        <div style="flex:1;min-width:200px;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:var(--gris-texte);">${dateFmt}</div>
          <div style="font-weight:700;font-size:18px;margin-top:2px;">${escapeHtml(ev.titre || '-')}</div>
          ${ev.lieu ? `<div style="font-size:13px;color:var(--gris-texte);margin-top:2px;">📍 ${escapeHtml(ev.lieu)}</div>` : ''}
          ${ev.description ? `<div style="font-size:13px;color:var(--noir);margin-top:8px;white-space:pre-wrap;">${escapeHtml(ev.description)}</div>` : ''}
        </div>
        <div style="text-align:right;">
          <span style="background:var(--violet);color:white;padding:4px 12px;border-radius:99px;font-size:12px;font-weight:700;">${totalInscrits} inscri${totalInscrits > 1 ? 'ts' : 't'}</span>
          ${ev.blocage_desinscription_h != null && !past ? `<div style="font-size:11px;color:var(--gris-texte);margin-top:4px;">Blocage désinscr. ${ev.blocage_desinscription_h}h avant</div>` : ''}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:0;">${tachesHtml}</div>
      ${actions ? `<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--gris-border);">${actions}</div>` : ''}
    </div>`;
}

function plnTacheRowHtml(tache, past) {
  const inscrits = _plnInscriptions.filter(i => i.tache_id === tache.id);
  const isMine = inscrits.some(i => i.membre_id === window._monProfilId);
  const full = tache.capacite != null && inscrits.length >= tache.capacite;
  const disabled = past || (full && !isMine);
  const noms = inscrits.map(i => {
    const m = _plnMembres.find(x => x.id === i.membre_id);
    const label = m ? `${m.prenom || ''} ${(m.nom || '').charAt(0)}.`.trim() : '?';
    // Bouton valider/dévalider pour bureau
    const btn = i.valide
      ? `<button onclick="plnDevaliderInsc('${i.id}')" title="Retirer validation" style="background:#dcfce7;border:1px solid #16a34a;color:#15803d;border-radius:10px;padding:1px 6px;font-size:10px;cursor:pointer;margin-left:3px;">✓</button>`
      : `<button onclick="plnValiderInsc('${i.id}')" title="Valider cette inscription (apparaîtra en couleur dans Mon planning)" style="background:transparent;border:1px dashed #9ca3af;color:#6b7280;border-radius:10px;padding:1px 6px;font-size:10px;cursor:pointer;margin-left:3px;">Valider</button>`;
    return `<span style="display:inline-flex;align-items:center;">${label}${btn}</span>`;
  }).join(' &nbsp; ');
  const compteur = tache.capacite != null ? `${inscrits.length}/${tache.capacite}` : `${inscrits.length}`;
  return `
    <div class="pln-tache-row ${isMine ? 'mine' : ''}">
      <div class="pln-tache-checkbox ${isMine ? 'checked' : ''} ${disabled ? 'disabled' : ''}"
           ${!disabled ? `onclick="plnToggleInscription('${tache.id}')"` : ''}>
        ${isMine ? '✓' : ''}
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:600;font-size:14px;">${escapeHtml(tache.titre)}<span style="color:var(--gris-texte);font-weight:400;margin-left:8px;font-size:12px;">${compteur}${tache.capacite == null ? ' inscrit(s)' : ''}</span></div>
        ${tache.description ? `<div style="font-size:12px;color:var(--gris-texte);margin-top:2px;">${escapeHtml(tache.description)}</div>` : ''}
        ${noms ? `<div style="font-size:12px;color:var(--noir);margin-top:4px;">${escapeHtml(noms)}</div>` : ''}
      </div>
      ${!past ? `<div style="display:flex;gap:4px;">
        <button onclick="plnOpenTacheForm('${tache.id}')" style="background:none;border:1px solid var(--gris-border);border-radius:6px;padding:4px 8px;cursor:pointer;font-size:11px;color:var(--gris-texte);">✎</button>
        <button onclick="plnDeleteTache('${tache.id}')" style="background:none;border:1px solid var(--gris-border);border-radius:6px;padding:4px 8px;cursor:pointer;font-size:11px;color:#c0392b;">✕</button>
      </div>` : ''}
    </div>`;
}

async function plnToggleInscription(tacheId) {
  if (!window._monProfilId) return showToast('Profil non chargé', 'error');
  const existing = _plnInscriptions.find(i => i.tache_id === tacheId && i.membre_id === window._monProfilId);
  if (existing) {
    const { error } = await Auth.sb.from('inscriptions_taches').delete().eq('id', existing.id);
    if (error) {
      const msg = error.message || '';
      if (msg.includes('bloquée')) return showToast(msg, 'error');
      return showToast('Erreur : ' + msg, 'error');
    }
    _plnInscriptions = _plnInscriptions.filter(i => i.id !== existing.id);
  } else {
    const { data, error } = await Auth.sb.from('inscriptions_taches').insert({ tache_id: tacheId, membre_id: window._monProfilId }).select().single();
    if (error) {
      const msg = error.message || '';
      if (msg.includes('Capacité')) return showToast(msg, 'error');
      return showToast('Erreur : ' + msg, 'error');
    }
    _plnInscriptions.push(data);
  }
  plnRenderEvents();
}

async function plnValiderInsc(id) {
  const { error } = await Auth.sb.from('inscriptions_taches').update({ valide: true, valide_par: window._monProfilId, valide_at: new Date().toISOString() }).eq('id', id);
  if (error) return showToast('Erreur : ' + error.message, 'error');
  const insc = _plnInscriptions.find(i => i.id === id);
  if (insc) insc.valide = true;
  plnRenderEvents();
  showToast('Inscription validée - visible en couleur dans Mon planning', 'success');
}

async function plnDevaliderInsc(id) {
  if (!confirm('Retirer la validation de cette inscription ?')) return;
  const { error } = await Auth.sb.from('inscriptions_taches').update({ valide: false, valide_par: null, valide_at: null }).eq('id', id);
  if (error) return showToast('Erreur : ' + error.message, 'error');
  const insc = _plnInscriptions.find(i => i.id === id);
  if (insc) insc.valide = false;
  plnRenderEvents();
  showToast('Validation retirée', 'success');
}

// ============ MODAL EVENT ============
function plnOpenEventForm(evId) {
  const modal = document.getElementById('pln-modal-event');
  const ev = evId ? _plnEvents.find(e => e.id === evId) : null;
  document.getElementById('pln-ev-id').value = evId || '';
  document.getElementById('pln-ev-titre').value = ev?.titre || '';
  document.getElementById('pln-ev-date').value = ev?.date || '';
  document.getElementById('pln-ev-lieu').value = ev?.lieu || '';
  document.getElementById('pln-ev-desc').value = ev?.description || '';
  document.getElementById('pln-ev-blocage').value = ev ? (ev.blocage_desinscription_h == null ? '' : String(ev.blocage_desinscription_h)) : '24';
  document.getElementById('pln-modal-event-title').textContent = ev ? "Modifier l'événement" : 'Nouvel événement';
  document.getElementById('pln-ev-save-btn').textContent = ev ? 'Enregistrer' : 'Créer';
  // Templates : masqués en édition
  // Template : dispo aussi en édition (permet d'ajouter les tâches d'un modèle à un event existant)
  document.getElementById('pln-ev-template-wrap').style.display = '';
  const tplSel = document.getElementById('pln-ev-template');
  tplSel.innerHTML = '<option value="">- Aucun (tâches vides) -</option>' + _plnTemplates.map(t => `<option value="${t.id}">${escapeHtml(t.nom)}</option>`).join('');
  tplSel.value = '';
  modal.classList.add('visible');
}
function plnCloseEventForm() { document.getElementById('pln-modal-event').classList.remove('visible'); }

async function plnSaveEvent() {
  const id = document.getElementById('pln-ev-id').value || null;
  const titre = document.getElementById('pln-ev-titre').value.trim();
  if (!titre) return showToast('Titre obligatoire', 'error');
  const blocageVal = document.getElementById('pln-ev-blocage').value;
  const payload = {
    titre,
    date: document.getElementById('pln-ev-date').value || null,
    lieu: document.getElementById('pln-ev-lieu').value.trim() || null,
    description: document.getElementById('pln-ev-desc').value.trim() || null,
    blocage_desinscription_h: blocageVal === '' ? null : parseInt(blocageVal, 10)
  };
  let evId = id;
  if (id) {
    const { error } = await Auth.sb.from('evenements').update(payload).eq('id', id);
    if (error) return showToast('Erreur : ' + error.message, 'error');
  } else {
    payload.created_by = window._monProfilId || null;
    payload.bureau_only = true;  // événement interne bureau (setup, briefing) → invisible du public
    const { data, error } = await Auth.sb.from('evenements').insert(payload).select().single();
    if (error) return showToast('Erreur : ' + error.message, 'error');
    evId = data.id;
  }
  // Application du template s'il y en a un (marche pour création ET édition)
  const tplId = document.getElementById('pln-ev-template').value;
  if (tplId && evId) {
    const tpl = _plnTemplates.find(t => t.id === tplId);
    if (tpl && Array.isArray(tpl.taches) && tpl.taches.length) {
      // Compte les tâches existantes pour ordre
      const existing = _plnTaches.filter(t => t.evenement_id === evId).length;
      const rows = tpl.taches.map((t, i) => ({
        evenement_id: evId,
        titre: t.titre || 'Tâche',
        description: t.description || null,
        capacite: t.capacite != null ? Number(t.capacite) : null,
        ordre: t.ordre != null ? Number(t.ordre) + existing : existing + i
      }));
      const { error: te } = await Auth.sb.from('taches_bureau').insert(rows);
      if (te) showToast('Événement enregistré mais tâches du modèle non ajoutées : ' + te.message, 'error');
    }
  }
  showToast(id ? 'Événement modifié' : 'Événement créé', 'success');
  plnCloseEventForm();
  await plnReload();
}

async function plnDeleteEvent(id) {
  if (!confirm('Supprimer cet événement (et toutes ses tâches + inscriptions) ?')) return;
  const { error } = await Auth.sb.from('evenements').delete().eq('id', id);
  if (error) return showToast('Erreur : ' + error.message, 'error');
  showToast('Supprimé', 'success');
  await plnReload();
}

function plnSharEvent(eventId) {
  const url = `https://bdecreadien.fr/event.html?id=${eventId}`;
  navigator.clipboard.writeText(url).then(() => {
    showToast('Lien copié - envoie-le aux membres BDE', 'success');
  }).catch(() => {
    prompt('Copie ce lien :', url);
  });
}

async function plnNotifyBureau(eventId, includeSelf) {
  const ev = _plnEvents.find(e => e.id === eventId);
  if (!ev) return;
  const label = includeSelf ? `Test : t'envoyer une notif à toi-même pour "${ev.titre}" ?` : `Envoyer une notification push à tous les membres BDE pour "${ev.titre}" ?`;
  if (!confirm(label)) return;
  try {
    const { data: sess } = await Auth.sb.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) return showToast('Session expirée', 'error');
    const dateStr = ev.date ? new Date(ev.date + 'T00:00:00').toLocaleDateString('fr-FR', {day:'numeric', month:'long'}) : 'date à définir';
    const res = await fetch(`${SUPABASE_URL}/functions/v1/notify-planning`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON,
      },
      body: JSON.stringify({
        title: (includeSelf ? '🧪 TEST - ' : '🔔 ') + ev.titre,
        message: `${dateStr}${ev.lieu ? ' · ' + ev.lieu : ''} - inscris-toi aux tâches`,
        url: 'https://bdecreadien.fr/mon-espace.html#bde-planning',
        include_self: !!includeSelf,
      }),
    });
    const body = await res.json().catch(() => ({}));
    console.log('[notify-planning] response', res.status, body);
    if (!res.ok) return showToast('Erreur : ' + (body.error || res.status), 'error');
    const p = body.push?.sent || 0;
    const e = body.email?.sent || 0;
    if (p === 0 && e === 0) return showToast('Aucun destinataire (0 envoi)', 'info');
    showToast(`${p} push + ${e} email(s) envoyés`, 'success');
  } catch (e) {
    showToast('Erreur réseau : ' + e.message, 'error');
  }
}

// ============ MODAL TÂCHE ============
function plnOpenTacheForm(tacheId, eventId) {
  const t = tacheId ? _plnTaches.find(x => x.id === tacheId) : null;
  document.getElementById('pln-tache-id').value = tacheId || '';
  document.getElementById('pln-tache-event-id').value = eventId || t?.evenement_id || '';
  document.getElementById('pln-tache-titre').value = t?.titre || '';
  document.getElementById('pln-tache-desc').value = t?.description || '';
  document.getElementById('pln-tache-capacite').value = t?.capacite ?? '';
  document.getElementById('pln-modal-tache-title').textContent = tacheId ? 'Modifier la tâche' : 'Nouvelle tâche';
  document.getElementById('pln-modal-tache').classList.add('visible');
}
function plnCloseTacheForm() { document.getElementById('pln-modal-tache').classList.remove('visible'); }

async function plnSaveTache() {
  const id = document.getElementById('pln-tache-id').value || null;
  const evId = document.getElementById('pln-tache-event-id').value;
  const titre = document.getElementById('pln-tache-titre').value.trim();
  if (!titre) return showToast('Titre obligatoire', 'error');
  const capVal = document.getElementById('pln-tache-capacite').value;
  const payload = {
    titre,
    description: document.getElementById('pln-tache-desc').value.trim() || null,
    capacite: capVal ? parseInt(capVal, 10) : null
  };
  if (id) {
    const { error } = await Auth.sb.from('taches_bureau').update(payload).eq('id', id);
    if (error) return showToast('Erreur : ' + error.message, 'error');
  } else {
    payload.evenement_id = evId;
    const currentMax = Math.max(-1, ..._plnTaches.filter(t => t.evenement_id === evId).map(t => t.ordre || 0));
    payload.ordre = currentMax + 1;
    const { error } = await Auth.sb.from('taches_bureau').insert(payload);
    if (error) return showToast('Erreur : ' + error.message, 'error');
  }
  showToast(id ? 'Tâche modifiée' : 'Tâche ajoutée', 'success');
  plnCloseTacheForm();
  await plnReload();
  // Notif push
  const ev = _plnEvents.find(e => e.id === (payload.evenement_id || evId));
  fetch('https://bde-notif.bdecreadien.workers.dev/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ titre, type: id ? 'update' : 'add', evenement: ev ? ev.titre : null })
  }).catch(() => {});
}

async function plnDeleteTache(id) {
  const inscrits = _plnInscriptions.filter(i => i.tache_id === id).length;
  const msg = inscrits > 0
    ? `Cette tâche a ${inscrits} inscription(s). Supprimer quand même ?`
    : 'Supprimer cette tâche ?';
  if (!confirm(msg)) return;
  const { error } = await Auth.sb.from('taches_bureau').delete().eq('id', id);
  if (error) return showToast('Erreur : ' + error.message, 'error');
  showToast('Tâche supprimée', 'success');
  await plnReload();
}

// ============ TAB MEMBRES ============
function plnRenderMembers() {
  const period = document.getElementById('pln-members-period').value;
  const cutoff = period === 'all' ? null
    : period === 'year' ? new Date(Date.now() - 365 * 86400000)
    : period === 'quarter' ? new Date(Date.now() - 90 * 86400000)
    : new Date(Date.now() - 30 * 86400000);
  const inscInPeriod = cutoff
    ? _plnInscriptions.filter(i => new Date(i.created_at) >= cutoff)
    : _plnInscriptions;

  const stats = _plnMembres.map(m => {
    const mine = inscInPeriod.filter(i => i.membre_id === m.id);
    const tacheIds = mine.map(i => i.tache_id);
    const eventsIds = [...new Set(_plnTaches.filter(t => tacheIds.includes(t.id)).map(t => t.evenement_id))];
    const events = eventsIds.map(id => _plnEvents.find(e => e.id === id)).filter(Boolean);
    return { membre: m, nbTaches: mine.length, nbEvents: eventsIds.length, events };
  }).sort((a,b) => b.nbTaches - a.nbTaches);

  if (!stats.length) {
    document.getElementById('pln-members-recap').innerHTML = '<div class="empty-state">Aucun membre bureau trouvé.</div>';
    return;
  }
  const cellStyle = 'padding:12px;border-bottom:1px solid var(--gris-border);vertical-align:top;font-size:14px;';
  const rows = stats.map((s, i) => {
    const nom = `${s.membre.prenom || ''} ${s.membre.nom || ''}`.trim() || '-';
    const evList = s.events.slice(0, 4).map(e => escapeHtml(e.titre || '-')).join(', ') + (s.events.length > 4 ? `, +${s.events.length - 4}` : '');
    const medal = i === 0 ? '🥇 ' : i === 1 ? '🥈 ' : i === 2 ? '🥉 ' : '';
    return `<tr>
      <td style="${cellStyle}font-weight:600;">${medal}${escapeHtml(nom)}</td>
      <td style="${cellStyle}text-align:center;"><span style="background:var(--violet);color:white;padding:3px 10px;border-radius:99px;font-size:12px;font-weight:700;">${s.nbTaches}</span></td>
      <td style="${cellStyle}text-align:center;">${s.nbEvents}</td>
      <td style="${cellStyle}color:var(--gris-texte);font-size:13px;">${evList || '-'}</td>
    </tr>`;
  }).join('');
  const headStyle = 'padding:10px 12px;background:var(--gris-clair);text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:var(--gris-texte);font-weight:700;';
  document.getElementById('pln-members-recap').innerHTML = `
    <table style="width:100%;border-collapse:collapse;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.05);">
      <thead><tr>
        <th style="${headStyle}">Membre</th>
        <th style="${headStyle}text-align:center;">Tâches</th>
        <th style="${headStyle}text-align:center;">Events</th>
        <th style="${headStyle}">Derniers events</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ============ TAB TEMPLATES ============
function plnRenderTemplates() {
  if (!_plnTemplates.length) {
    document.getElementById('pln-templates-list').innerHTML = '<div class="empty-state">Aucun modèle. Crée-en un !</div>';
    return;
  }
  document.getElementById('pln-templates-list').innerHTML = _plnTemplates.map(t => {
    const taches = Array.isArray(t.taches) ? t.taches : [];
    const tHtml = taches.map(x => `
      <div style="padding:6px 10px;background:var(--gris-clair);border-radius:6px;font-size:12px;">
        ${escapeHtml(x.titre || '-')}${x.capacite != null ? ` <span style="color:var(--gris-texte);">(${x.capacite})</span>` : ''}
      </div>`).join('');
    return `
      <div class="form-card visible" style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:start;gap:12px;flex-wrap:wrap;margin-bottom:10px;">
          <div>
            <div style="font-weight:700;font-size:16px;">${escapeHtml(t.nom)}</div>
            <div style="font-size:12px;color:var(--gris-texte);margin-top:2px;">${taches.length} tâche${taches.length > 1 ? 's' : ''}</div>
          </div>
          <div style="display:flex;gap:6px;">
            <button class="btn-edit" onclick="plnOpenTemplateForm('${t.id}')" style="padding:6px 12px;font-size:12px;">Modifier</button>
            <button class="btn-delete" onclick="plnDeleteTemplate('${t.id}')" style="padding:6px 12px;font-size:12px;">Supprimer</button>
          </div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">${tHtml}</div>
      </div>`;
  }).join('');
}

function plnOpenTemplateForm(id) {
  const t = id ? _plnTemplates.find(x => x.id === id) : null;
  document.getElementById('pln-tpl-id').value = id || '';
  document.getElementById('pln-tpl-nom').value = t?.nom || '';
  _plnTplBuffer = t && Array.isArray(t.taches) ? JSON.parse(JSON.stringify(t.taches)) : [];
  document.getElementById('pln-modal-template-title').textContent = id ? 'Modifier le modèle' : 'Nouveau modèle';
  plnTplRenderBuffer();
  document.getElementById('pln-modal-template').classList.add('visible');
}
function plnCloseTemplateForm() { document.getElementById('pln-modal-template').classList.remove('visible'); }

function plnTplRenderBuffer() {
  const cont = document.getElementById('pln-tpl-taches');
  if (!_plnTplBuffer.length) {
    cont.innerHTML = '<div style="padding:12px;background:var(--gris-clair);border-radius:8px;text-align:center;font-size:13px;color:var(--gris-texte);">Aucune tâche. Ajoute-en une ci-dessous.</div>';
    return;
  }
  cont.innerHTML = _plnTplBuffer.map((t, i) => `
    <div style="display:flex;gap:6px;align-items:center;">
      <input type="text" value="${escapeHtml(t.titre || '')}" oninput="_plnTplBuffer[${i}].titre=this.value" placeholder="Titre de la tâche" style="flex:2;padding:8px 10px;border:1px solid var(--gris-border);border-radius:8px;font-size:13px;">
      <input type="number" min="1" value="${t.capacite ?? ''}" oninput="_plnTplBuffer[${i}].capacite=this.value?parseInt(this.value,10):null" placeholder="Capa" style="width:70px;padding:8px 10px;border:1px solid var(--gris-border);border-radius:8px;font-size:13px;">
      <button onclick="plnTplRemoveTache(${i})" style="background:none;border:1px solid var(--gris-border);border-radius:8px;padding:6px 10px;cursor:pointer;color:#c0392b;">✕</button>
    </div>`).join('');
}
function plnTplAddTache() { _plnTplBuffer.push({ titre: '', description: '', capacite: null, ordre: _plnTplBuffer.length }); plnTplRenderBuffer(); }
function plnTplRemoveTache(i) { _plnTplBuffer.splice(i, 1); _plnTplBuffer.forEach((t, k) => t.ordre = k); plnTplRenderBuffer(); }

async function plnSaveTemplate() {
  const id = document.getElementById('pln-tpl-id').value || null;
  const nom = document.getElementById('pln-tpl-nom').value.trim();
  if (!nom) return showToast('Nom obligatoire', 'error');
  const taches = _plnTplBuffer.filter(t => (t.titre || '').trim()).map((t, i) => ({
    titre: t.titre.trim(), description: t.description || '', capacite: t.capacite || null, ordre: i
  }));
  const payload = { nom, taches };
  if (id) {
    const { error } = await Auth.sb.from('templates_taches').update(payload).eq('id', id);
    if (error) return showToast('Erreur : ' + error.message, 'error');
  } else {
    payload.created_by = window._monProfilId || null;
    const { error } = await Auth.sb.from('templates_taches').insert(payload);
    if (error) return showToast('Erreur : ' + error.message, 'error');
  }
  showToast(id ? 'Modèle modifié' : 'Modèle créé', 'success');
  plnCloseTemplateForm();
  await plnReload();
}

async function plnDeleteTemplate(id) {
  if (!confirm('Supprimer ce modèle ?')) return;
  const { error } = await Auth.sb.from('templates_taches').delete().eq('id', id);
  if (error) return showToast('Erreur : ' + error.message, 'error');
  showToast('Modèle supprimé', 'success');
  await plnReload();
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

