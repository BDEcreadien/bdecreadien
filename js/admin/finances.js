/* BDE Admin — module finances
   Extrait tel quel de admin.html (scripts classiques, portée globale partagée). */
// ============================================================
// FINANCES
// ============================================================
const FIN_CATEGORIES = {
  soiree: { label: 'Soirée', emoji: '🎉' },
  repas: { label: 'Repas', emoji: '🍽️' },
  sortie: { label: 'Sortie', emoji: '🚌' },
  cotisation: { label: 'Cotisation', emoji: '💳' },
  sponsoring: { label: 'Sponsoring', emoji: '🤝' },
  virement_sumup: { label: 'Virement SumUp', emoji: '💰' },
  depense_course: { label: 'Dépense course', emoji: '🛒' },
  materiel: { label: 'Matériel', emoji: '📦' },
  autre: { label: 'Autre', emoji: '✨' },
};

let _finDateDebut = null, _finDateFin = null;
let _finTransactions = [];
let _finEditingId = null;
let _finSoldeInitial = 0;
let _finSoldeMoisPrecedents = 0; // cumul depuis 1er sept de l'année scolaire courante jusqu'à la veille du mois affiché

// ============================================================
// TRANSACTIONS RÉCURRENTES (dépliées à la volée)
// ============================================================
let _finRecurrentes = [];

async function finLoadRecurrentes() {
  try {
    const { data } = await window.Auth.sb.from('transactions_recurrentes').select('*').order('created_at', { ascending: false });
    _finRecurrentes = data || [];
  } catch (_) { _finRecurrentes = []; }
}

// Génère les transactions virtuelles pour chaque mois entre debut et fin
function finExpandRecurrentes(debut, fin) {
  if (!debut || !fin || !_finRecurrentes.length) return [];
  const out = [];
  for (const rc of _finRecurrentes) {
    const start = new Date(rc.date_debut + 'T00:00:00');
    const end = rc.date_fin ? new Date(rc.date_fin + 'T00:00:00') : null;
    const cur = new Date(debut.getFullYear(), debut.getMonth(), 1);
    const stop = new Date(fin.getFullYear(), fin.getMonth(), 1);
    while (cur <= stop) {
      const occ = new Date(cur.getFullYear(), cur.getMonth(), rc.jour_du_mois);
      if (occ >= start && (!end || occ <= end) && occ >= debut && occ <= fin) {
        out.push({
          id: `rc-${rc.id}-${occ.toISOString().slice(0, 10)}`,
          date: occ.toISOString().slice(0, 10),
          libelle: rc.libelle,
          categorie: rc.categorie,
          montant: Number(rc.montant),
          notes: rc.notes,
          _virtuel: true,
          _sourceId: rc.id
        });
      }
      cur.setMonth(cur.getMonth() + 1);
    }
  }
  return out;
}

function finRenderRecurrentes() {
  const el = document.getElementById('fin-liste-recur');
  if (!el) return;
  if (!_finRecurrentes.length) {
    el.innerHTML = '<p style="text-align:center;padding:16px;color:var(--gris-texte);font-size:13px;">Aucune transaction récurrente configurée.</p>';
    return;
  }
  el.innerHTML = _finRecurrentes.map(rc => {
    const c = FIN_CATEGORIES[rc.categorie] || { label: rc.categorie, emoji: '📌' };
    const isRec = Number(rc.montant) > 0;
    const finTxt = rc.date_fin ? `→ ${new Date(rc.date_fin).toLocaleDateString('fr-FR')}` : '→ indéfini';
    return `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-bottom:1px solid var(--gris-clair);">
        <div style="width:34px;text-align:center;font-size:18px;flex-shrink:0;">${c.emoji}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:14px;font-weight:600;color:var(--noir);">${escapeHtmlNl(rc.libelle)}</div>
          <div style="font-size:11px;color:var(--gris-texte);">${c.label} · le ${rc.jour_du_mois} du mois · depuis ${new Date(rc.date_debut).toLocaleDateString('fr-FR')} ${finTxt}</div>
        </div>
        <div style="font-size:15px;font-weight:800;color:${isRec ? '#22c55e' : '#dc2626'};flex-shrink:0;">${isRec ? '+' : ''}${Number(rc.montant).toFixed(2)} €<span style="font-size:10px;color:var(--gris-texte);font-weight:400;"> /mois</span></div>
        <button onclick="finRecurEdit('${rc.id}')" title="Modifier" style="background:none;border:none;color:var(--violet);cursor:pointer;padding:6px;font-size:14px;">✎</button>
        <button onclick="finRecurDelete('${rc.id}')" title="Supprimer" style="background:none;border:none;color:#dc2626;cursor:pointer;padding:6px;font-size:14px;">🗑</button>
      </div>
    `;
  }).join('');
}

let _finRecurEditingId = null;

function finRecurTogglerForm() {
  const f = document.getElementById('fin-form-recur');
  const visible = f.classList.contains('visible');
  if (visible) { f.classList.remove('visible'); _finRecurEditingId = null; return; }
  _finRecurEditingId = null;
  document.getElementById('rc-libelle').value = '';
  document.getElementById('rc-categorie').value = 'cotisation';
  document.getElementById('rc-type').value = 'depense';
  document.getElementById('rc-montant').value = '';
  document.getElementById('rc-jour').value = '1';
  document.getElementById('rc-date-debut').value = new Date().toISOString().slice(0, 10);
  document.getElementById('rc-date-fin').value = '';
  document.getElementById('rc-notes').value = '';
  f.classList.add('visible');
}

function finRecurEdit(id) {
  const rc = _finRecurrentes.find(x => x.id === id);
  if (!rc) return;
  _finRecurEditingId = id;
  document.getElementById('rc-libelle').value = rc.libelle;
  document.getElementById('rc-categorie').value = rc.categorie;
  document.getElementById('rc-type').value = Number(rc.montant) >= 0 ? 'recette' : 'depense';
  document.getElementById('rc-montant').value = Math.abs(Number(rc.montant));
  document.getElementById('rc-jour').value = rc.jour_du_mois || 1;
  document.getElementById('rc-date-debut').value = rc.date_debut;
  document.getElementById('rc-date-fin').value = rc.date_fin || '';
  document.getElementById('rc-notes').value = rc.notes || '';
  document.getElementById('fin-form-recur').classList.add('visible');
  document.getElementById('fin-form-recur').scrollIntoView({ behavior: 'smooth' });
}

async function finRecurSave() {
  const libelle = document.getElementById('rc-libelle').value.trim();
  const categorie = document.getElementById('rc-categorie').value;
  const type = document.getElementById('rc-type').value;
  const montantAbs = parseFloat(document.getElementById('rc-montant').value);
  const jour = parseInt(document.getElementById('rc-jour').value, 10) || 1;
  const dateDebut = document.getElementById('rc-date-debut').value;
  const dateFin = document.getElementById('rc-date-fin').value || null;
  const notes = document.getElementById('rc-notes').value.trim() || null;
  if (!libelle || isNaN(montantAbs) || montantAbs <= 0 || !dateDebut) {
    showToast('Remplis libellé, montant et date de début', 'error'); return;
  }
  if (jour < 1 || jour > 28) { showToast('Jour du mois entre 1 et 28', 'error'); return; }
  const montant = type === 'recette' ? montantAbs : -montantAbs;
  const payload = { libelle, categorie, montant, jour_du_mois: jour, date_debut: dateDebut, date_fin: dateFin, notes };
  const btn = document.getElementById('fin-btn-save-recur');
  btn.disabled = true; btn.textContent = 'Enregistrement…';
  let error;
  if (_finRecurEditingId) {
    ({ error } = await window.Auth.sb.from('transactions_recurrentes').update(payload).eq('id', _finRecurEditingId));
  } else {
    const user = await window.Auth.getUser();
    payload.created_by = user.id;
    ({ error } = await window.Auth.sb.from('transactions_recurrentes').insert(payload));
  }
  btn.disabled = false; btn.textContent = 'Enregistrer';
  if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
  showToast(_finRecurEditingId ? 'Récurrente modifiée' : 'Récurrente créée', 'success');
  document.getElementById('fin-form-recur').classList.remove('visible');
  _finRecurEditingId = null;
  await finLoadRecurrentes();
  finRenderRecurrentes();
  finRefreshAll();
}

async function finRecurDelete(id) {
  if (!confirm('Supprimer cette transaction récurrente ? Les mois passés déjà comptés disparaîtront.')) return;
  const { error } = await window.Auth.sb.from('transactions_recurrentes').delete().eq('id', id);
  if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
  showToast('Récurrente supprimée', 'success');
  await finLoadRecurrentes();
  finRenderRecurrentes();
  finRefreshAll();
}

// Recettes/Dépenses de la période courante = transactions + récurrentes dépliées.
// Les events validés (gains_reel/cout_reel) ne sont PAS ajoutés car ces montants proviennent
// déjà des transactions liées → sinon double comptabilisation.
// Cas d'un cash non tracé ? → il doit être créé en tant que transaction espèces.
function finPeriodeRecDep() {
  const virtuels = finExpandRecurrentes(_finDateDebut, _finDateFin);
  const all = _finTransactions.concat(virtuels);
  const rec = all.filter(t => Number(t.montant) > 0).reduce((s, t) => s + Number(t.montant), 0);
  const dep = all.filter(t => Number(t.montant) < 0).reduce((s, t) => s + Math.abs(Number(t.montant)), 0);
  return { rec, dep };
}

// Rafraîchit en parallèle tous les éléments financiers (tuiles, chart, events, PDF)
let _finRefreshBusy = false;

async function finRefreshAll() {
  if (_finRefreshBusy) return;
  _finRefreshBusy = true;
  finShowRefreshing(true);
  try {
    await Promise.all([
      finLoadTransactions(),  // → finRender() → tuiles + liste + PDF
      finLoadEvenements(),    // → finRenderEvenements()
      finLoadRecurrentes(),   // → récurrentes (impacte PDF + graphique)
      finLoadCourbeAnnuelle() // → graphique
    ]);
    finRenderRecurrentes();
  } finally {
    _finRefreshBusy = false;
    finShowRefreshing(false);
  }
}

function finShowRefreshing(on) {
  let el = document.getElementById('fin-refreshing');
  if (!el) {
    el = document.createElement('div');
    el.id = 'fin-refreshing';
    el.style.cssText = 'position:fixed;top:70px;right:20px;background:color-mix(in srgb,var(--accent) 95%,transparent);color:white;padding:8px 14px;border-radius:20px;font-size:12px;font-weight:600;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,0.2);display:none;align-items:center;gap:8px;';
    el.innerHTML = '<span style="display:inline-block;width:10px;height:10px;border:2px solid white;border-top-color:transparent;border-radius:50%;animation:finSpin 0.6s linear infinite;"></span>Actualisation…';
    document.body.appendChild(el);
    const style = document.createElement('style');
    style.textContent = '@keyframes finSpin { to { transform: rotate(360deg); } }';
    document.head.appendChild(style);
  }
  el.style.display = on ? 'flex' : 'none';
}

async function finLoadSoldeInitial() {
  try {
    const { data } = await window.Auth.sb.from('bde_config').select('value').eq('id', 'solde_initial').maybeSingle();
    _finSoldeInitial = data && data.value != null ? parseFloat(data.value) || 0 : 0;
  } catch (_) { _finSoldeInitial = 0; }
}

async function finSaveSoldeInitial() {
  // Le solde initial représente le report de l'année précédente : modifiable qu'à la rentrée (septembre)
  if (!_finDateDebut || _finDateDebut.getMonth() !== 8) {
    showToast('Le solde initial ne se modifie qu\'en septembre (rentrée BDE).', 'error');
    return;
  }
  const cur = _finSoldeInitial.toFixed(2).replace('.', ',');
  const input = prompt('Solde initial (report de l\'année précédente) en € :', cur);
  if (input == null) return;
  const val = parseFloat(String(input).replace(',', '.'));
  if (isNaN(val)) { showToast('Valeur invalide', 'error'); return; }
  const { error } = await window.Auth.sb.from('bde_config').upsert({ id: 'solde_initial', value: String(val) });
  if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
  _finSoldeInitial = val;
  showToast('Solde initial mis à jour', 'success');
  finRefreshAll();
}

function finRemplirAnnees() {
  const sel = document.getElementById('fin-annee');
  if (sel.options.length) return;
  const y = new Date().getFullYear();
  for (let i = y + 1; i >= y - 5; i--) {
    const opt = document.createElement('option');
    opt.value = String(i); opt.textContent = String(i);
    sel.appendChild(opt);
  }
}

function finSetMoisCourant(date) {
  document.getElementById('fin-mois').value = String(date.getMonth());
  document.getElementById('fin-annee').value = String(date.getFullYear());
}

function finMoisChange() {
  const m = parseInt(document.getElementById('fin-mois').value);
  const y = parseInt(document.getElementById('fin-annee').value);
  _finDateDebut = new Date(y, m, 1);
  _finDateFin = new Date(y, m + 1, 0);
  document.getElementById('fin-date-debut').value = _finDateDebut.toISOString().slice(0, 10);
  document.getElementById('fin-date-fin').value = _finDateFin.toISOString().slice(0, 10);
  finLoadTransactions();
}

function finNavMois(delta) {
  let m = parseInt(document.getElementById('fin-mois').value) + delta;
  let y = parseInt(document.getElementById('fin-annee').value);
  if (m < 0) { m = 11; y--; }
  if (m > 11) { m = 0; y++; }
  const anneeSel = document.getElementById('fin-annee');
  if (![...anneeSel.options].some(o => o.value === String(y))) {
    const opt = document.createElement('option');
    opt.value = String(y); opt.textContent = String(y);
    anneeSel.appendChild(opt);
  }
  document.getElementById('fin-mois').value = String(m);
  document.getElementById('fin-annee').value = String(y);
  finMoisChange();
}

function finPeriodeCustom() {
  const d = document.getElementById('fin-date-debut').value;
  const f = document.getElementById('fin-date-fin').value;
  if (!d || !f) return;
  _finDateDebut = new Date(d);
  _finDateFin = new Date(f);
  finLoadTransactions();
}

function finTxCatChange() {
  const sel = document.getElementById('tx-categorie');
  const input = document.getElementById('tx-categorie-custom');
  if (sel.value === '__custom__') {
    input.style.display = 'block';
    setTimeout(() => input.focus(), 50);
  } else {
    input.style.display = 'none';
    input.value = '';
  }
}

function finEvCatChange() {
  const sel = document.getElementById('fin-ev-categorie');
  const input = document.getElementById('fin-ev-categorie-custom');
  if (sel.value === '__custom__') {
    input.style.display = 'block';
    setTimeout(() => input.focus(), 50);
  } else {
    input.style.display = 'none';
    input.value = '';
  }
}

async function initFinances() {
  document.getElementById('fin-non-autorise').style.display = 'none';
  document.getElementById('fin-content').style.display = 'none';
  const profil = await window.Auth.getProfil();
  const autorise = profil && (profil.role === 'membre' || profil.role === 'admin') && profil.bureau === true;
  if (!autorise) {
    document.getElementById('fin-non-autorise').style.display = 'block';
    return;
  }
  document.getElementById('fin-content').style.display = 'block';
  document.getElementById('fin-form').classList.remove('visible');
  document.getElementById('tx-date').value = new Date().toISOString().slice(0, 10);
  await finLoadSoldeInitial();
  await finLoadRecurrentes();
  finRenderRecurrentes();
  finRemplirAnnees();
  if (!_finDateDebut) {
    finSetMoisCourant(new Date());
    finMoisChange();
  } else {
    finSetMoisCourant(_finDateDebut);
    finLoadTransactions();
  }
  finLoadCourbeAnnuelle();
}

async function finLoadTransactions() {
  const debutStr = _finDateDebut.toISOString().slice(0, 10);
  const finStr = _finDateFin.toISOString().slice(0, 10);
  const { data, error } = await window.Auth.sb
    .from('transactions')
    .select('*')
    .gte('date', debutStr)
    .lte('date', finStr)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
  _finTransactions = data || [];
  await finLoadSoldeMoisPrecedents();
  finRender();
  finLoadEvenements();
}

// Calcule le solde net des mois précédents (du 1er sept de l'année scolaire à la veille du mois affiché)
async function finLoadSoldeMoisPrecedents() {
  // Année scolaire : commence en septembre. Si on est de sept à déc → année N. Sinon → année N-1.
  const anneeScolaireStart = _finDateDebut.getMonth() >= 8
    ? _finDateDebut.getFullYear()
    : _finDateDebut.getFullYear() - 1;
  const anneeScolaireDebutStr = `${anneeScolaireStart}-09-01`;
  // Veille du 1er du mois affiché
  const veille = new Date(_finDateDebut);
  veille.setDate(veille.getDate() - 1);
  const veilleStr = veille.toISOString().slice(0, 10);
  // Si on est en septembre de l'année scolaire, il n'y a pas de mois précédent
  if (anneeScolaireDebutStr > veilleStr) {
    _finSoldeMoisPrecedents = 0;
    return;
  }
  try {
    const { data } = await window.Auth.sb
      .from('transactions')
      .select('date, montant')
      .gte('date', anneeScolaireDebutStr)
      .lte('date', veilleStr);
    const virtuelsPrev = finExpandRecurrentes(new Date(anneeScolaireDebutStr + 'T00:00:00'), veille);
    const all = (data || []).concat(virtuelsPrev);
    _finSoldeMoisPrecedents = all.reduce((s, t) => s + (Number(t.montant) || 0), 0);
  } catch (_) { _finSoldeMoisPrecedents = 0; }
}

function finRender() {
  const { rec: recettes, dep: depenses } = finPeriodeRecDep();
  const soldePeriode = recettes - depenses;
  // Solde total = solde initial (rentrée sept) + cumul des mois précédents + net du mois affiché
  const soldeTotal = _finSoldeInitial + _finSoldeMoisPrecedents + soldePeriode;

  document.getElementById('fin-periode-label').textContent =
    `Du ${_finDateDebut.toLocaleDateString('fr-FR')} au ${_finDateFin.toLocaleDateString('fr-FR')}`;

  const tuile = (label, val, color, extra = '') => `
    <div style="background:white;border-radius:14px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,0.05);position:relative;">
      <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${color};margin-bottom:6px;">${label}</div>
      <div style="font-size:28px;font-weight:800;color:var(--noir);line-height:1;">${val}</div>
      ${extra}
    </div>`;
  document.getElementById('fin-tuiles').innerHTML =
    tuile('Recettes', recettes.toFixed(2) + ' €', '#22c55e') +
    tuile('Dépenses', depenses.toFixed(2) + ' €', '#dc2626') +
    tuile(
      'Solde total',
      soldeTotal.toFixed(2) + ' €',
      soldeTotal >= 0 ? 'var(--violet)' : '#dc2626',
      // Ligne "Initial : X € [modifier]" affichée uniquement en septembre (rentrée BDE)
      (() => {
        const estSeptembre = _finDateDebut && _finDateDebut.getMonth() === 8;
        if (!estSeptembre) return '';
        return `<div style="font-size:10px;color:var(--gris-texte);margin-top:4px;">Initial : ${_finSoldeInitial.toFixed(2)} € <button onclick="finSaveSoldeInitial()" style="background:none;border:none;color:var(--violet);cursor:pointer;font-size:10px;text-decoration:underline;padding:0 0 0 4px;">modifier</button></div>`;
      })()
    ) +
    (() => {
      // Solde total estimatif = solde total actuel + prévisionnel des events non-validés du mois affiché
      const debutStr = _finDateDebut.toISOString().slice(0, 10);
      const finStr = _finDateFin.toISOString().slice(0, 10);
      let prevMoisNonValide = 0;
      let nbEvNonValides = 0;
      for (const ev of _finEvenements) {
        if (!ev.date || ev.date < debutStr || ev.date > finStr) continue;
        if (ev.valide) continue; // event validé → déjà dans les recettes/dépenses réelles
        const gP = Number(ev.gains_previsionnel) || 0;
        const cP = Number(ev.budget_previsionnel) || 0;
        prevMoisNonValide += (gP - cP);
        nbEvNonValides++;
      }
      const soldeEstim = soldeTotal + prevMoisNonValide;
      const couleur = soldeEstim >= 0 ? '#16a34a' : '#dc2626';
      return tuile('Solde estimatif', soldeEstim.toFixed(2) + ' €', couleur);
    })();

  const list = document.getElementById('fin-liste');
  const virtuels = finExpandRecurrentes(_finDateDebut, _finDateFin);
  const all = _finTransactions.concat(virtuels).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (!all.length) {
    list.innerHTML = '<p style="text-align:center;padding:24px;color:var(--gris-texte);font-size:13px;">Aucune transaction sur cette période.</p>';
    pdfRegenererPreview();
    return;
  }
  list.innerHTML = all.map(tx => {
    const c = FIN_CATEGORIES[tx.categorie] || { label: tx.categorie.replace(/_/g, ' ').replace(/^./, s => s.toUpperCase()), emoji: '📌' };
    const isRecette = Number(tx.montant) > 0;
    const dateStr = new Date(tx.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    const isVirt = tx._virtuel;
    const badge = isVirt ? '<span style="background:color-mix(in srgb,var(--accent) 16%,white);color:var(--accent);padding:1px 6px;border-radius:8px;font-size:9px;font-weight:700;letter-spacing:0.5px;margin-left:6px;">RÉCURRENTE</span>' : '';
    const actions = isVirt
      ? `<span style="color:#999;font-size:11px;padding:0 12px;">automatique</span>`
      : `<button onclick="finEdit('${tx.id}')" title="Modifier" style="background:none;border:none;color:var(--violet);cursor:pointer;padding:6px;font-size:14px;">✎</button>
         <button onclick="finDelete('${tx.id}')" title="Supprimer" style="background:none;border:none;color:#dc2626;cursor:pointer;padding:6px;font-size:14px;">🗑</button>`;
    return `
      <div style="display:flex;align-items:center;gap:8px;padding:10px 8px 10px 6px;border-bottom:1px solid var(--gris-clair);${isVirt ? 'background:#f8fafc;' : ''}">
        <div style="width:22px;text-align:center;font-size:18px;flex-shrink:0;">${c.emoji}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:600;color:var(--noir);line-height:1.3;word-wrap:break-word;">${escapeHtmlNl(tx.libelle)}${badge}</div>
          <div style="font-size:11px;color:var(--gris-texte);line-height:1.3;word-wrap:break-word;">${dateStr} · ${c.label}${tx.moyen_paiement ? ' · ' + finMoyenLabel(tx.moyen_paiement) : ''}${tx.fournisseur ? ' · <strong>' + escapeHtmlNl(tx.fournisseur) + '</strong>' : ''}${tx.notes ? ' · ' + escapeHtmlNl(tx.notes).slice(0, 60) : ''}</div>
        </div>
        <div style="font-size:14px;font-weight:800;color:${isRecette ? '#22c55e' : '#dc2626'};flex-shrink:0;">${isRecette ? '+' : ''}${Number(tx.montant).toFixed(2)} €</div>
        ${actions}
      </div>
    `;
  }).join('');
  // Regénère le preview PDF à chaque render
  pdfRegenererPreview();
}

// ============================================================
// COURBE ANNUELLE - Recettes/Dépenses sur l'année scolaire (Sept→Août)
// ============================================================
function finRemplirAnneesCourbe() {
  const sel = document.getElementById('fin-courbe-annee');
  if (!sel || sel.options.length) return;
  const now = new Date();
  const currentStart = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  for (let s = currentStart + 1; s >= currentStart - 3; s--) {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = `${s} – ${s + 1}`;
    sel.appendChild(opt);
  }
  sel.value = currentStart;
}

async function finLoadCourbeAnnuelle() {
  finRemplirAnneesCourbe();
  const sel = document.getElementById('fin-courbe-annee');
  if (!sel) return;
  const yStart = parseInt(sel.value, 10);
  const dateDebut = `${yStart}-09-01`;
  const dateFin = `${yStart + 1}-08-31`;
  const [txRes, evRes] = await Promise.all([
    window.Auth.sb.from('transactions').select('date, montant').gte('date', dateDebut).lte('date', dateFin),
    window.Auth.sb.from('finance_evenements').select('date, gains_previsionnel, budget_previsionnel, gains_reel, cout_reel, valide').gte('date', dateDebut).lte('date', dateFin)
  ]);
  if (txRes.error) { showToast('Courbe : ' + txRes.error.message, 'error'); return; }
  // Déplie les récurrentes sur l'année scolaire
  const virtuels = finExpandRecurrentes(new Date(dateDebut + 'T00:00:00'), new Date(dateFin + 'T00:00:00'));
  const txAll = (txRes.data || []).concat(virtuels.map(v => ({ date: v.date, montant: v.montant })));
  finRenderCourbeAnnuelle(txAll, evRes.data || [], yStart);
}

function finRenderCourbeAnnuelle(transactions, evenements, yStart) {
  const months = Array.from({ length: 12 }, () => ({ recettes: 0, depenses: 0, prev: 0 }));
  const idxOfDate = dstr => {
    const d = new Date(dstr + 'T00:00:00');
    const mn = d.getMonth(), yr = d.getFullYear();
    const idx = yr === yStart ? mn - 8 : mn + 4;
    return (idx < 0 || idx > 11) ? -1 : idx;
  };
  for (const t of transactions) {
    const idx = idxOfDate(t.date);
    if (idx < 0) continue;
    const m = Number(t.montant) || 0;
    if (m >= 0) months[idx].recettes += m;
    else months[idx].depenses += -m;
  }
  for (const ev of evenements) {
    if (!ev.date) continue;
    const idx = idxOfDate(ev.date);
    if (idx < 0) continue;
    const gP = Number(ev.gains_previsionnel) || 0;
    const cP = Number(ev.budget_previsionnel) || 0;
    months[idx].prev += (gP - cP);
    // NOTE : on n'ajoute PAS ev.gains_reel/cout_reel car ils sont déjà comptés
    // via les transactions liées (sinon double comptabilisation).
    if (!ev.valide) {
      // Events non validés (prévu) → bars grises hachurées
      months[idx].prevRec = (months[idx].prevRec || 0) + gP;
      months[idx].prevDep = (months[idx].prevDep || 0) + cP;
    }
  }
  const monthShort = ['sept.', 'oct.', 'nov.', 'déc.', 'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août'];
  const monthFull = ['Septembre', 'Octobre', 'Novembre', 'Décembre', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août'];
  const yearOfIdx = i => (i <= 3 ? yStart : yStart + 1);

  // Détermine l'index du mois "actuel" dans l'année scolaire affichée (ou -1 si année scolaire pas courante)
  const today = new Date();
  const tYear = today.getFullYear(), tMonth = today.getMonth();
  let currentIdx = -1;
  if (tYear === yStart && tMonth >= 8) currentIdx = tMonth - 8;
  else if (tYear === yStart + 1 && tMonth <= 7) currentIdx = tMonth + 4;
  else if (tYear > yStart + 1 || (tYear === yStart + 1 && tMonth > 7)) currentIdx = 11; // année passée : tout est réel
  // else currentIdx = -1 (année future : tout est projection)

  // Moyenne recettes/dépenses sur les mois "vécus" (jusqu'au mois courant) avec au moins une donnée
  const realIdxLimit = currentIdx; // mois <= currentIdx sont "réels"
  let sumRec = 0, sumDep = 0, cntReal = 0;
  for (let i = 0; i <= realIdxLimit; i++) {
    if (months[i].recettes > 0 || months[i].depenses > 0) {
      sumRec += months[i].recettes;
      sumDep += months[i].depenses;
      cntReal++;
    }
  }
  const avgRec = cntReal > 0 ? sumRec / cntReal : 0;
  const avgDep = cntReal > 0 ? sumDep / cntReal : 0;

  // Solde cumulé mois par mois (démarre au solde initial)
  // Pour les mois passés/actuel → recettes/dépenses réelles
  // Pour les mois futurs → moyenne des mois passés (projection)
  const soldes = [];
  const projected = []; // true si ce mois est en projection
  let running = Number(_finSoldeInitial) || 0;
  for (let i = 0; i < 12; i++) {
    const isProjected = currentIdx >= 0 && i > currentIdx;
    if (isProjected) {
      running += avgRec - avgDep;
    } else {
      running += months[i].recettes - months[i].depenses;
    }
    soldes.push(running);
    projected.push(isProjected);
  }
  const soldeInitial = Number(_finSoldeInitial) || 0;

  // Amplitude Y : couvre bars + courbe solde + prévisionnel (positive et négative)
  const maxRec = Math.max(0, ...months.map(m => Math.max(m.recettes, m.prevRec || 0)));
  const maxDep = Math.max(0, ...months.map(m => Math.max(m.depenses, m.prevDep || 0)));
  const maxSolde = Math.max(soldeInitial, ...soldes, 0);
  const minSolde = Math.min(soldeInitial, ...soldes, 0);
  const yPos = Math.max(maxRec, maxSolde, 1);
  const yNeg = Math.max(maxDep, Math.abs(minSolde), 1);

  const steps = [50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000];
  const pickStep = target => { let s = 500; for (const v of steps) { if (target / v <= 5) { s = v; break; } s = v; } return s; };
  // Échelle symétrique : la ligne "0" est au centre pour comparer visuellement gains vs dépenses
  const yAmp = Math.max(yPos, yNeg);
  const step = pickStep(yAmp);
  const yMaxPos = Math.max(step, Math.ceil(yAmp / step) * step);
  const yMaxNeg = yMaxPos;

  // Ticks symétriques
  const ticks = [];
  for (let v = step; v <= yMaxPos; v += step) ticks.push(v);
  ticks.push(0);
  for (let v = -step; v >= -yMaxNeg; v -= step) ticks.push(v);

  const w = 860, h = 380, padL = 62, padR = 24, padT = 20, padB = 44;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;
  const xStep = chartW / 12;
  const xCenter = i => padL + i * xStep + xStep / 2;
  const yZero = padT + (yMaxPos / (yMaxPos + yMaxNeg)) * chartH;
  const yScale = v => v >= 0
    ? yZero - (v / yMaxPos) * (yZero - padT)
    : yZero + (Math.abs(v) / yMaxNeg) * ((padT + chartH) - yZero);
  const fmt = v => {
    const abs = Math.abs(v);
    return (v < 0 ? '-' : '') + (abs >= 1000 ? (abs / 1000).toFixed(abs % 1000 === 0 ? 0 : 1) + 'k' : String(abs));
  };

  const grid = ticks.map(v => {
    const y = yScale(v);
    const strong = v === 0;
    return `<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="${strong ? '#bbb' : '#eee'}" stroke-width="${strong ? 1.2 : 1}"/>
      <text x="${padL - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="${strong ? '#666' : '#999'}" font-weight="${strong ? '600' : '400'}">${fmt(v)} €</text>`;
  }).join('');
  const xTicks = monthShort.map((lbl, i) =>
    `<text x="${xCenter(i)}" y="${h - padB + 18}" text-anchor="middle" font-size="11" fill="#555" font-weight="500">${lbl}</text>
     <text x="${xCenter(i)}" y="${h - padB + 32}" text-anchor="middle" font-size="10" fill="#888">${String(yearOfIdx(i)).slice(2)}</text>`
  ).join('');

  // Bars : recettes (vert au-dessus de 0) et dépenses (rouge en dessous)
  const barW = Math.max(4, Math.min(18, xStep * 0.28));
  const jsStr = s => `'${String(s).replace(/'/g, "\\'")}'`;
  const bars = months.map((m, i) => {
    const cx = xCenter(i);
    const lbl = jsStr(`${monthFull[i]} ${yearOfIdx(i)}`);
    let out = '';
    // Prévu (events non validés) : contour hachuré derrière la barre réelle
    const prevRec = m.prevRec || 0;
    const prevDep = m.prevDep || 0;
    if (prevRec > 0) {
      const y = yScale(prevRec);
      out += `<rect x="${cx - barW - 1}" y="${y}" width="${barW}" height="${yZero - y}" fill="none" stroke="#22c55e" stroke-width="1.5" stroke-dasharray="3,2" rx="2"
        style="cursor:pointer;"
        onmousemove="finBarShowTip(event, 'prevRec', ${prevRec}, ${lbl})"
        onmouseleave="finBarHideTip()"/>`;
    }
    if (prevDep > 0) {
      const y = yScale(-prevDep);
      out += `<rect x="${cx + 1}" y="${yZero}" width="${barW}" height="${y - yZero}" fill="none" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="3,2" rx="2"
        style="cursor:pointer;"
        onmousemove="finBarShowTip(event, 'prevDep', ${prevDep}, ${lbl})"
        onmouseleave="finBarHideTip()"/>`;
    }
    if (m.recettes > 0) {
      const y = yScale(m.recettes);
      out += `<rect x="${cx - barW - 1}" y="${y}" width="${barW}" height="${yZero - y}" fill="#22c55e" rx="2"
        style="cursor:pointer;"
        onmousemove="finBarShowTip(event, 'rec', ${m.recettes}, ${lbl})"
        onmouseleave="finBarHideTip()"/>`;
    }
    if (m.depenses > 0) {
      const y = yScale(-m.depenses);
      out += `<rect x="${cx + 1}" y="${yZero}" width="${barW}" height="${y - yZero}" fill="#dc2626" rx="2"
        style="cursor:pointer;"
        onmousemove="finBarShowTip(event, 'dep', ${m.depenses}, ${lbl})"
        onmouseleave="finBarHideTip()"/>`;
    }
    return out;
  }).join('');

  // Courbe solde cumulé (smooth via Catmull-Rom-like path)
  const soldePts = soldes.map((s, i) => ({ x: xCenter(i), y: yScale(s), projected: projected[i] }));
  const startPt = { x: padL + xStep * 0.15, y: yScale(soldeInitial), projected: false };
  const allPts = [startPt, ...soldePts];
  const smoothPath = pts => {
    if (pts.length < 2) return '';
    let d = `M ${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return d;
  };
  // Séparation : trait plein pour la partie réelle, pointillés pour la projection
  // Trouve l'index dans allPts où la projection commence
  const firstProjIdx = allPts.findIndex(p => p.projected);
  let soldeLine = '';
  if (firstProjIdx === -1) {
    // Tout est réel
    soldeLine = `<path d="${smoothPath(allPts)}" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
  } else {
    const realPts = allPts.slice(0, firstProjIdx);
    // On étend le trait plein jusqu'au premier point de projection pour éviter un "trou"
    const projPts = allPts.slice(Math.max(0, firstProjIdx - 1));
    if (realPts.length >= 2) {
      soldeLine += `<path d="${smoothPath(realPts)}" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    }
    if (projPts.length >= 2) {
      soldeLine += `<path d="${smoothPath(projPts)}" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="6,4" opacity="0.7"/>`;
    }
  }
  const soldeDots = soldePts.map(p => `<circle cx="${p.x}" cy="${p.y}" r="3" fill="${p.projected ? 'white' : '#2563eb'}" stroke="#2563eb" stroke-width="1.5" pointer-events="none"/>`).join('');

  // Overlays pour hover
  const overlays = months.map((m, i) => {
    const cx = xCenter(i);
    const solde = soldes[i];
    const soldeMois = m.recettes - m.depenses;
    const lbl = jsStr(`${monthFull[i]} ${yearOfIdx(i)}`);
    const args = [i, m.recettes, m.depenses, soldeMois, solde, m.prev, lbl].join(',');
    return `<rect x="${cx - xStep / 2}" y="${padT}" width="${xStep}" height="${chartH}" fill="transparent"
      onmousemove="finCourbeShowTip(event, ${args})"
      onmouseleave="finCourbeHideTip()"></rect>`;
  }).join('');

  document.getElementById('fin-courbe-svg').innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" style="width:100%;min-width:600px;height:auto;display:block;font-family:inherit;">
      ${grid}
      ${xTicks}
      ${overlays}
      ${bars}
      ${soldeLine}
      ${soldeDots}
    </svg>
    <div id="fin-courbe-tip" style="position:absolute;display:none;background:white;border:1px solid #ddd;border-radius:10px;padding:10px 12px;box-shadow:0 6px 20px rgba(0,0,0,0.14);font-size:12px;pointer-events:none;z-index:20;min-width:200px;"></div>`;
}

// Mini tooltip pour une barre seule (recette ou dépense)
function finBarShowTip(evt, type, val, label) {
  evt.stopPropagation();
  const tip = document.getElementById('fin-courbe-tip');
  const wrap = document.getElementById('fin-courbe-svg');
  if (!tip || !wrap) return;
  const rect = wrap.getBoundingClientRect();
  const isRec = type === 'rec' || type === 'prevRec';
  const isPrev = type === 'prevRec' || type === 'prevDep';
  const color = isRec ? '#22c55e' : '#dc2626';
  const kind = (isPrev ? 'Prévu ' : '') + (isRec ? 'Recette' : 'Dépense');
  const sign = isRec ? '+' : '-';
  tip.innerHTML = `
    <div style="font-weight:700;margin-bottom:4px;color:#111;">${label}</div>
    <div style="color:${color};font-weight:700;font-size:14px;">${kind} : ${sign}${Math.abs(val).toFixed(2)} €</div>
    ${isPrev ? '<div style="font-size:11px;color:#999;margin-top:2px;">Event non validé - pas encore compté</div>' : ''}`;
  tip.style.display = 'block';
  const x = evt.clientX - rect.left;
  const y = evt.clientY - rect.top;
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  const left = Math.min(Math.max(x + 14, 4), wrap.clientWidth - tw - 4);
  const top = Math.max(y - th - 12, 4);
  tip.style.left = left + 'px';
  tip.style.top = top + 'px';
}
function finBarHideTip() {
  const tip = document.getElementById('fin-courbe-tip');
  if (tip) tip.style.display = 'none';
}

function finCourbeShowTip(evt, idx, rec, dep, soldeMois, soldeCumule, prev, label) {
  const tip = document.getElementById('fin-courbe-tip');
  const wrap = document.getElementById('fin-courbe-svg');
  if (!tip || !wrap) return;
  const rect = wrap.getBoundingClientRect();
  tip.innerHTML = `
    <div style="font-weight:700;margin-bottom:6px;color:#111;">${label}</div>
    <div style="color:#22c55e;font-weight:600;">Recettes : ${rec.toFixed(2)} €</div>
    <div style="color:#dc2626;font-weight:600;">Dépenses : ${dep.toFixed(2)} €</div>
    <div style="color:${soldeMois >= 0 ? '#22c55e' : '#dc2626'};font-weight:600;">Solde du mois : ${(soldeMois >= 0 ? '+' : '') + soldeMois.toFixed(2)} €</div>
    ${prev !== 0 ? `<div style="color:#6b7280;font-weight:600;">Prévu (events) : ${(prev >= 0 ? '+' : '') + prev.toFixed(2)} €</div>` : ''}
    <div style="margin-top:6px;padding-top:6px;border-top:1px solid #eee;font-weight:700;color:${soldeCumule >= 0 ? '#2563eb' : '#dc2626'};">Solde cumulé : ${soldeCumule >= 0 ? '+' : ''}${soldeCumule.toFixed(2)} €</div>`;
  tip.style.display = 'block';
  const x = evt.clientX - rect.left;
  const y = evt.clientY - rect.top;
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  const left = Math.min(Math.max(x + 14, 4), wrap.clientWidth - tw - 4);
  const top = Math.max(y - th - 12, 4);
  tip.style.left = left + 'px';
  tip.style.top = top + 'px';
}

function finCourbeHideTip() {
  const tip = document.getElementById('fin-courbe-tip');
  if (tip) tip.style.display = 'none';
}

function finTogglerForm() {
  const f = document.getElementById('fin-form');
  const visible = f.classList.contains('visible');
  if (visible) {
    f.classList.remove('visible');
    _finEditingId = null;
  } else {
    _finEditingId = null;
    document.getElementById('tx-libelle').value = '';
    document.getElementById('tx-fournisseur').value = '';
    document.getElementById('tx-montant').value = '';
    document.getElementById('tx-notes').value = '';
    document.getElementById('tx-type').value = 'depense';
    document.getElementById('tx-moyen').value = 'cb';
    document.getElementById('tx-categorie').value = 'soiree';
    document.getElementById('tx-categorie-custom').value = '';
    document.getElementById('tx-categorie-custom').style.display = 'none';
    document.getElementById('tx-date').value = new Date().toISOString().slice(0, 10);
    f.classList.add('visible');
  }
}

function finEdit(id) {
  const tx = _finTransactions.find(t => t.id === id);
  if (!tx) return;
  _finEditingId = id;
  document.getElementById('tx-date').value = tx.date;
  document.getElementById('tx-libelle').value = tx.libelle;
  document.getElementById('tx-fournisseur').value = tx.fournisseur || '';
  document.getElementById('tx-moyen').value = tx.moyen_paiement || 'autre';
  const catSel = document.getElementById('tx-categorie');
  const catInput = document.getElementById('tx-categorie-custom');
  const known = [...catSel.options].some(o => o.value === tx.categorie);
  if (known) {
    catSel.value = tx.categorie;
    catInput.style.display = 'none';
    catInput.value = '';
  } else {
    catSel.value = '__custom__';
    catInput.style.display = 'block';
    catInput.value = tx.categorie;
  }
  document.getElementById('tx-montant').value = Math.abs(Number(tx.montant));
  document.getElementById('tx-type').value = Number(tx.montant) >= 0 ? 'recette' : 'depense';
  document.getElementById('tx-notes').value = tx.notes || '';
  document.getElementById('fin-form').classList.add('visible');
  document.getElementById('fin-form').scrollIntoView({ behavior: 'smooth' });
}

async function finSaveTransaction() {
  const date = document.getElementById('tx-date').value;
  const libelle = document.getElementById('tx-libelle').value.trim();
  let categorie = document.getElementById('tx-categorie').value;
  if (categorie === '__custom__') {
    categorie = document.getElementById('tx-categorie-custom').value.trim().toLowerCase().replace(/\s+/g, '_');
    if (!categorie) { showToast('Nomme la catégorie personnalisée', 'error'); return; }
  }
  const montantAbs = parseFloat(document.getElementById('tx-montant').value);
  const type = document.getElementById('tx-type').value;
  const notes = document.getElementById('tx-notes').value.trim() || null;
  const fournisseur = document.getElementById('tx-fournisseur').value.trim() || null;
  const moyen_paiement = document.getElementById('tx-moyen').value || 'autre';
  if (!date || !libelle || isNaN(montantAbs) || montantAbs < 0) {
    showToast('Remplis tous les champs correctement', 'error'); return;
  }
  const montant = type === 'recette' ? montantAbs : -montantAbs;
  const btn = document.getElementById('fin-btn-save');
  btn.disabled = true; btn.textContent = 'Enregistrement…';
  const payload = { date, libelle, categorie, montant, notes, fournisseur, moyen_paiement };
  let error;
  if (_finEditingId) {
    ({ error } = await window.Auth.sb.from('transactions').update(payload).eq('id', _finEditingId));
  } else {
    const user = await window.Auth.getUser();
    payload.created_by = user.id;
    ({ error } = await window.Auth.sb.from('transactions').insert(payload));
  }
  btn.disabled = false; btn.textContent = 'Enregistrer';
  if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
  showToast(_finEditingId ? 'Transaction modifiée' : 'Transaction ajoutée', 'success');
  document.getElementById('fin-form').classList.remove('visible');
  _finEditingId = null;
  finRefreshAll();
}

async function finDelete(id) {
  if (!confirm('Supprimer cette transaction ?')) return;
  const { error } = await window.Auth.sb.from('transactions').delete().eq('id', id);
  if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
  showToast('Transaction supprimée', 'success');
  finRefreshAll();
}

// ============================================================
// FINANCES - ÉVÉNEMENTS PRÉVISIONNELS
// ============================================================
let _finEvenements = [];
let _finEvEditingId = null;

async function finLoadEvenements() {
  // Charge événements de la période courante + du mois suivant (pour prévisionnel)
  const monthAfter = new Date(_finDateFin); monthAfter.setDate(monthAfter.getDate() + 1);
  const monthAfterEnd = new Date(monthAfter.getFullYear(), monthAfter.getMonth() + 1, 0);
  const debutStr = _finDateDebut.toISOString().slice(0, 10);
  const finStr = monthAfterEnd.toISOString().slice(0, 10);
  const { data, error } = await window.Auth.sb
    .from('finance_evenements').select('*').gte('date', debutStr).lte('date', finStr).order('date');
  if (error) { console.warn(error); _finEvenements = []; }
  else _finEvenements = data || [];
  finRenderEvenements();
  // Rafraîchit tuiles + PDF car les recettes/dépenses dépendent aussi des events validés
  finRender();
}

function finRenderEvenements() {
  const el = document.getElementById('fin-liste-ev');
  if (!el) return;
  // On ne montre QUE les events du mois affiché (le mois suivant est chargé pour le prévisionnel
  // mais ne doit pas apparaître dans la liste de ce mois-ci)
  const debutStr = _finDateDebut ? _finDateDebut.toISOString().slice(0, 10) : '';
  const finStr = _finDateFin ? _finDateFin.toISOString().slice(0, 10) : '';
  const evPeriode = _finEvenements.filter(ev => {
    if (!ev.date) return false;
    return ev.date >= debutStr && ev.date <= finStr;
  });
  if (!evPeriode.length) {
    el.innerHTML = '<p style="text-align:center;padding:20px;color:var(--gris-texte);font-size:13px;">Aucun événement sur cette période. Ajoutes-en pour construire le prévisionnel.</p>';
    return;
  }
  const now = new Date();
  el.innerHTML = evPeriode.map(ev => {
    const dateObj = ev.date ? new Date(ev.date) : null;
    const dateStr = dateObj ? dateObj.toLocaleDateString('fr-FR') : '(sans date)';
    const passe = dateObj && dateObj < now;
    const cat = FIN_CATEGORIES[ev.categorie_budget] || { label: ev.categorie_budget || 'Autre', emoji: '📅' };
    const gPrev = ev.gains_previsionnel != null ? Number(ev.gains_previsionnel) : null;
    const cPrev = ev.budget_previsionnel != null ? Number(ev.budget_previsionnel) : null;
    const gReel = ev.gains_reel != null ? Number(ev.gains_reel) : null;
    const cReel = ev.cout_reel != null ? Number(ev.cout_reel) : null;
    const soldePrev = (gPrev != null || cPrev != null) ? (gPrev || 0) - (cPrev || 0) : null;
    const soldeReel = (gReel != null || cReel != null) ? (gReel || 0) - (cReel || 0) : null;
    const fmt = v => (v >= 0 ? '+' : '') + v.toFixed(2) + ' €';
    const soldePrevTxt = soldePrev != null ? fmt(soldePrev) : '-';
    const soldeReelTxt = soldeReel != null ? fmt(soldeReel) : '-';
    const badgeValide = ev.valide
      ? '<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">Validé</span>'
      : (passe ? '<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">À valider</span>' : '');
    const btnValider = !ev.valide
      ? `<button onclick="finValiderEv('${ev.id}')" title="Valider les gains finaux" style="background:#22c55e;color:white;border:none;border-radius:6px;padding:5px 10px;cursor:pointer;font-size:12px;font-weight:600;">✓</button>`
      : `<button onclick="finDevaliderEv('${ev.id}')" title="Dévalider" style="background:#f3f4f6;color:#666;border:none;border-radius:6px;padding:5px 10px;cursor:pointer;font-size:12px;">↺</button>`;
    return `
      <div style="display:flex;align-items:center;gap:8px;padding:10px 8px 10px 6px;border-bottom:1px solid var(--gris-clair);">
        <div style="width:22px;text-align:center;font-size:18px;flex-shrink:0;">${cat.emoji}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:600;color:var(--noir);display:flex;align-items:center;gap:6px;flex-wrap:wrap;line-height:1.25;">${escapeHtmlNl(ev.titre)} ${badgeValide}</div>
          <div style="font-size:11px;color:var(--gris-texte);line-height:1.3;word-wrap:break-word;">${dateStr} · ${cat.label}${ev.lieu ? ' · ' + escapeHtmlNl(ev.lieu) : ''}</div>
        </div>
        <div style="text-align:right;font-size:11px;flex-shrink:0;min-width:88px;line-height:1.4;">
          <div style="color:var(--gris-texte);">P: <strong style="color:${soldePrev != null && soldePrev >= 0 ? 'var(--violet)' : '#dc2626'};">${soldePrevTxt}</strong></div>
          <div style="color:var(--gris-texte);">R: <strong style="color:${soldeReel == null ? '#999' : (soldeReel >= 0 ? '#22c55e' : '#dc2626')};">${soldeReelTxt}</strong></div>
        </div>
        ${btnValider}
        <button onclick="finEditEv('${ev.id}')" title="Modifier" style="background:none;border:none;color:var(--violet);cursor:pointer;padding:4px;font-size:13px;">✎</button>
        <button onclick="finDeleteEv('${ev.id}')" title="Supprimer" style="background:none;border:none;color:#dc2626;cursor:pointer;padding:4px;font-size:13px;">🗑</button>
      </div>
    `;
  }).join('');
}

async function finValiderEv(id) {
  const ev = _finEvenements.find(e => e.id === id);
  if (!ev) return;
  if (ev.gains_reel == null && ev.cout_reel == null) {
    if (!confirm('Aucun gain ni coût réel renseigné. Valider quand même ? (utilise 0)')) return;
  }
  const { error } = await window.Auth.sb.from('finance_evenements').update({ valide: true }).eq('id', id);
  if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
  showToast('Événement validé', 'success');
  finRefreshAll();
}

async function finDevaliderEv(id) {
  if (!confirm('Retirer la validation de cet événement ?')) return;
  const { error } = await window.Auth.sb.from('finance_evenements').update({ valide: false }).eq('id', id);
  if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
  showToast('Validation retirée', 'success');
  finRefreshAll();
}

function finTogglerFormEv() {
  const f = document.getElementById('fin-form-ev');
  const visible = f.classList.contains('visible');
  if (visible) { f.classList.remove('visible'); _finEvEditingId = null; return; }
  _finEvEditingId = null;
  document.getElementById('fin-ev-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('fin-ev-titre').value = '';
  document.getElementById('fin-ev-lieu').value = '';
  document.getElementById('fin-ev-categorie').value = 'soiree';
  document.getElementById('fin-ev-categorie-custom').value = '';
  document.getElementById('fin-ev-categorie-custom').style.display = 'none';
  document.getElementById('ev-gains-prev').value = '';
  document.getElementById('ev-budget').value = '';
  document.getElementById('ev-gains-reel').value = '';
  document.getElementById('ev-cout-reel').value = '';
  document.getElementById('ev-valide').checked = false;
  document.getElementById('ev-desc').value = '';
  finRenderEvTxSelectors([]);
  finEvUpdateSoldes();
  f.classList.add('visible');
  finAutoEstimation();
  document.getElementById('fin-ev-categorie').onchange = () => { finEvCatChange(); finAutoEstimation(); };
}

function finMoyenLabel(m) {
  return ({ cb:'💳 CB', virement:'🔁 Virement', especes:'💵 Espèces', cheque:'📝 Chèque', autre:'✨ Autre' })[m || 'autre'] || '✨ Autre';
}
function finEvUpdatePartialReste(input) {
  const total = parseFloat(input.dataset.txTotal) || 0;
  const val = input.value !== '' ? parseFloat(input.value) : total;
  const reste = Math.max(0, total - (isNaN(val) ? 0 : val));
  const el = document.getElementById(input.id + '-reste');
  if (!el) return;
  el.style.color = reste > 0.005 ? '#b45309' : '#16a34a';
  el.innerHTML = `→ Reste non affecté sur cette transaction : <strong>${reste.toFixed(2)} €</strong>`;
}

function finEvToggleSumup(cb) {
  if (!cb.dataset.partialId) return;
  const wrap = document.getElementById(cb.dataset.partialId + '-wrap');
  if (!wrap) return;
  wrap.style.display = cb.checked ? 'flex' : 'none';
  if (!cb.checked) {
    const input = document.getElementById(cb.dataset.partialId);
    if (input) input.value = '';
  }
}

// Calcule combien d'un montant de transaction est déjà réclamé par d'autres events
// (via leurs tx_montants_partiels, ou via finance_evenement_id si pas de partial spécifié)
function finEvCalcClaimedByOthers(txId, excludeEvId) {
  const tx = _finTransactions.find(t => t.id === txId);
  if (!tx) return 0;
  const txTotal = Math.abs(Number(tx.montant));
  let claimed = 0;
  for (const ev of (_finEvenements || [])) {
    if (ev.id === excludeEvId) continue;
    const partials = ev.tx_montants_partiels || {};
    if (partials[txId] != null) {
      claimed += parseFloat(partials[txId]) || 0;
    } else if (tx.finance_evenement_id === ev.id) {
      // Cet event détient la transaction sans partial → occupe le total
      claimed += txTotal;
    }
  }
  return Math.min(claimed, txTotal);
}

function finEvUpdateSoldes() {
  const num = id => parseFloat(document.getElementById(id).value) || 0;
  // Réel = somme des transactions cochées uniquement
  const wrapR = document.getElementById('ev-tx-recettes-list');
  const wrapD = document.getElementById('ev-tx-depenses-list');
  let sumRec = 0, sumDep = 0;
  if (wrapR) wrapR.querySelectorAll('input[type=checkbox]:checked').forEach(cb => {
    const partial = cb.dataset.partialId ? document.getElementById(cb.dataset.partialId) : null;
    const val = partial && partial.value !== '' ? parseFloat(partial.value) : Math.abs(parseFloat(cb.dataset.montant) || 0);
    sumRec += isNaN(val) ? 0 : val;
  });
  if (wrapD) wrapD.querySelectorAll('input[type=checkbox]:checked').forEach(cb => {
    const partial = cb.dataset.partialId ? document.getElementById(cb.dataset.partialId) : null;
    const val = partial && partial.value !== '' ? parseFloat(partial.value) : Math.abs(parseFloat(cb.dataset.montant) || 0);
    sumDep += isNaN(val) ? 0 : val;
  });
  const gainsReel = sumRec;
  const coutReel = sumDep;
  const hidGains = document.getElementById('ev-gains-reel');
  const hidCout = document.getElementById('ev-cout-reel');
  if (hidGains) hidGains.value = gainsReel > 0 ? gainsReel.toFixed(2) : '';
  if (hidCout) hidCout.value = coutReel > 0 ? coutReel.toFixed(2) : '';
  const affG = document.getElementById('ev-gains-reel-affiche');
  const affC = document.getElementById('ev-cout-reel-affiche');
  if (affG) affG.textContent = gainsReel.toFixed(2) + ' €';
  if (affC) affC.textContent = coutReel.toFixed(2) + ' €';
  const sPrev = num('ev-gains-prev') - num('ev-budget');
  const sReel = gainsReel - coutReel;
  const elP = document.getElementById('ev-solde-prev');
  const elR = document.getElementById('ev-solde-reel');
  if (elP) { elP.textContent = (sPrev >= 0 ? '+' : '') + sPrev.toFixed(2) + ' €'; elP.style.color = sPrev >= 0 ? '#22c55e' : '#dc2626'; }
  if (elR) { elR.textContent = (sReel >= 0 ? '+' : '') + sReel.toFixed(2) + ' €'; elR.style.color = sReel >= 0 ? '#22c55e' : '#dc2626'; }
}
// Remplit les listes de transactions du mois affiché avec des checkboxes
// preselectedIds = tableau d'ids déjà liés à l'événement (pour édition)
function finRenderEvTxSelectors(preselectedIds, montantsPartiels) {
  const preSet = new Set(preselectedIds || []);
  const partials = montantsPartiels || {};
  const evId = _finEvEditingId;
  // Filtre : transactions du mois affiché OU déjà liées à cet event
  const monthTx = _finTransactions.filter(t => {
    if (evId && t.finance_evenement_id === evId) return true;
    if (!t.date) return false;
    const d = new Date(t.date + 'T00:00:00');
    return d >= _finDateDebut && d <= _finDateFin;
  }).sort((a,b) => (a.date || '').localeCompare(b.date || ''));
  const recettes = monthTx.filter(t => Number(t.montant) > 0);
  const depenses = monthTx.filter(t => Number(t.montant) < 0);
  const render = (list, kind) => list.map(t => {
    const isPreset = preSet.has(t.id) || (evId && t.finance_evenement_id === evId);
    const dateStr = new Date(t.date).toLocaleDateString('fr-FR', { day:'2-digit', month:'short' });
    const txTotal = Math.abs(Number(t.montant));
    // Partial + partage : recettes uniquement. Dépenses = full amount, ownership unique.
    const supportsPartial = kind === 'recette';
    let disabled, availableForThis, claimedByOthers;
    if (supportsPartial) {
      claimedByOthers = finEvCalcClaimedByOthers(t.id, evId);
      availableForThis = Math.max(0, txTotal - claimedByOthers);
      disabled = availableForThis <= 0.005 && !isPreset;
    } else {
      // Dépenses : logique historique - un seul event peut la lier
      const linkedElsewhere = t.finance_evenement_id && t.finance_evenement_id !== evId;
      claimedByOthers = 0;
      availableForThis = txTotal;
      disabled = linkedElsewhere;
    }
    const partialId = `ev-partial-${kind}-${t.id}`;
    const savedPartial = partials[t.id] != null ? partials[t.id] : '';
    const initReste = savedPartial !== '' ? (availableForThis - parseFloat(savedPartial)).toFixed(2) : availableForThis.toFixed(2);
    const shareInfo = supportsPartial && claimedByOthers > 0.005
      ? `<div style="font-size:11px;color:#b91c1c;padding:4px 6px;margin-bottom:4px;background:#fef2f2;border-radius:4px;">
          Déjà utilisé ailleurs : <strong>${claimedByOthers.toFixed(2)} €</strong> · Dispo ici : <strong>${availableForThis.toFixed(2)} €</strong>
        </div>` : '';
    const partialInput = (supportsPartial && !disabled) ? `
      <div id="${partialId}-wrap" style="display:${isPreset ? 'flex' : 'none'};flex-direction:column;gap:4px;margin-top:4px;padding:6px 8px;background:rgba(251,191,36,.12);border-radius:6px;border:1px solid rgba(251,191,36,.4);">
        ${shareInfo}
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          <span style="font-size:11px;color:#92400e;flex-shrink:0;">Montant lié à cet event :</span>
          <input id="${partialId}" type="number" step="0.01" min="0" max="${availableForThis}" placeholder="${availableForThis.toFixed(2)}" value="${savedPartial}"
            style="width:90px;padding:3px 6px;border:1px solid #d97706;border-radius:4px;font-size:12px;font-weight:700;color:#92400e;background:white;"
            data-tx-total="${availableForThis}" oninput="finEvUpdatePartialReste(this);finEvUpdateSoldes()" onclick="event.stopPropagation()">
          <span style="font-size:11px;color:#92400e;">€ / ${availableForThis.toFixed(2)} € dispo</span>
        </div>
        <div id="${partialId}-reste" style="font-size:11px;color:${parseFloat(initReste) > 0 ? '#b45309' : '#16a34a'};padding-left:2px;">
          → Reste non affecté sur cette transaction : <strong>${initReste} €</strong>
        </div>
      </div>` : '';
    const showRestBadge = supportsPartial && claimedByOthers > 0.005 && !disabled;
    return `<div style="${disabled ? 'opacity:.5;' : ''}${isPreset ? 'background:rgba(124,58,237,.08);' : ''}border-radius:6px;margin-bottom:2px;">
      <label style="display:flex !important;align-items:center;gap:8px;padding:6px 8px;margin-bottom:0 !important;cursor:${disabled ? 'not-allowed' : 'pointer'};text-transform:none;letter-spacing:0;font-size:13px;color:var(--noir);font-weight:normal;">
        <input type="checkbox" ${isPreset ? 'checked' : ''} ${disabled ? 'disabled' : ''} data-tx-id="${t.id}" data-montant="${t.montant}" data-partial-id="${supportsPartial && !disabled ? partialId : ''}" onchange="finEvToggleSumup(this);finEvUpdateSoldes()" style="flex-shrink:0;width:18px !important;height:18px !important;padding:0 !important;margin:0 !important;border:1px solid #999 !important;border-radius:3px !important;accent-color:#7c3aed;">
        <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
          <strong style="color:var(--noir);">${escapeHtmlNl(t.libelle)}</strong>
          <span style="color:var(--gris-texte);font-size:11px;font-weight:normal;"> · ${dateStr} · ${finMoyenLabel(t.moyen_paiement)}</span>
          ${showRestBadge ? `<span style="color:#b45309;font-size:11px;font-weight:600;"> · reste ${availableForThis.toFixed(2)} €</span>` : ''}
          ${disabled && supportsPartial ? '<span style="color:#dc2626;font-size:11px;font-weight:600;"> · entièrement utilisé ailleurs</span>' : ''}
          ${disabled && !supportsPartial ? '<span style="color:#dc2626;font-size:11px;font-weight:600;"> · (déjà lié à un autre event)</span>' : ''}
        </span>
        <span style="font-weight:700;color:${kind === 'recette' ? '#16a34a' : '#dc2626'};flex-shrink:0;">${Number(t.montant).toFixed(2)} €</span>
      </label>
      ${partialInput}
    </div>`;
  }).join('') || `<div style="color:var(--gris-texte);font-size:12px;padding:8px;text-align:center;">Aucune transaction ${kind} ce mois-ci.</div>`;
  document.getElementById('ev-tx-recettes-list').innerHTML = render(recettes, 'recette');
  document.getElementById('ev-tx-depenses-list').innerHTML = render(depenses, 'depense');
}

async function finAutoEstimation() {
  let cat = document.getElementById('fin-ev-categorie').value;
  if (cat === '__custom__') {
    cat = document.getElementById('fin-ev-categorie-custom').value.trim().toLowerCase().replace(/\s+/g, '_');
  }
  const hint = document.getElementById('ev-hint-moy');
  hint.textContent = '';
  if (!cat) return;
  try {
    const { data } = await window.Auth.sb.rpc('moyenne_cout_categorie', { p_categorie: cat, p_limit: 5 });
    if (data != null) {
      hint.textContent = `- moyenne des 5 derniers ${cat} : ${Number(data).toFixed(2)} €`;
      const budgetInput = document.getElementById('ev-budget');
      if (!budgetInput.value) budgetInput.placeholder = Number(data).toFixed(2);
    }
  } catch (_) {}
}

function finEditEv(id) {
  const ev = _finEvenements.find(e => e.id === id);
  if (!ev) return;
  _finEvEditingId = id;
  document.getElementById('fin-ev-date').value = ev.date || '';
  document.getElementById('fin-ev-titre').value = ev.titre || '';
  document.getElementById('fin-ev-lieu').value = ev.lieu || '';
  const evCatSel = document.getElementById('fin-ev-categorie');
  const evCatInput = document.getElementById('fin-ev-categorie-custom');
  const evKnown = [...evCatSel.options].some(o => o.value === (ev.categorie_budget || 'soiree'));
  if (evKnown) {
    evCatSel.value = ev.categorie_budget || 'soiree';
    evCatInput.style.display = 'none';
    evCatInput.value = '';
  } else {
    evCatSel.value = '__custom__';
    evCatInput.style.display = 'block';
    evCatInput.value = ev.categorie_budget || '';
  }
  document.getElementById('ev-gains-prev').value = ev.gains_previsionnel != null ? ev.gains_previsionnel : '';
  document.getElementById('ev-budget').value = ev.budget_previsionnel != null ? ev.budget_previsionnel : '';
  document.getElementById('ev-gains-reel').value = ev.gains_reel != null ? ev.gains_reel : '';
  document.getElementById('ev-cout-reel').value = ev.cout_reel != null ? ev.cout_reel : '';
  document.getElementById('ev-valide').checked = !!ev.valide;
  document.getElementById('ev-desc').value = ev.description || '';
  // Pré-coche toutes les transactions déjà liées à cet event
  const preselectedIds = _finTransactions.filter(t => t.finance_evenement_id === ev.id).map(t => t.id);
  finRenderEvTxSelectors(preselectedIds, ev.tx_montants_partiels || {});
  finEvUpdateSoldes();
  document.getElementById('fin-form-ev').classList.add('visible');
  document.getElementById('fin-form-ev').scrollIntoView({ behavior: 'smooth' });
  finAutoEstimation();
}

async function finSaveEv() {
  const titre = document.getElementById('fin-ev-titre').value.trim();
  const date = document.getElementById('fin-ev-date').value || null;
  const lieu = document.getElementById('fin-ev-lieu').value.trim() || null;
  let categorie_budget = document.getElementById('fin-ev-categorie').value;
  if (categorie_budget === '__custom__') {
    categorie_budget = document.getElementById('fin-ev-categorie-custom').value.trim().toLowerCase().replace(/\s+/g, '_');
    if (!categorie_budget) { showToast('Nomme la catégorie personnalisée', 'error'); return; }
  }
  const gainsPrevVal = document.getElementById('ev-gains-prev').value;
  const budgetVal = document.getElementById('ev-budget').value;
  const gainsReelVal = document.getElementById('ev-gains-reel').value;
  const coutVal = document.getElementById('ev-cout-reel').value;
  const valide = document.getElementById('ev-valide').checked;
  const description = document.getElementById('ev-desc').value.trim() || null;
  if (!titre) { showToast('Titre requis', 'error'); return; }
  const payload = {
    titre, date, lieu, categorie_budget, description, valide,
    gains_previsionnel: gainsPrevVal ? parseFloat(gainsPrevVal) : null,
    budget_previsionnel: budgetVal ? parseFloat(budgetVal) : null,
    gains_reel: gainsReelVal ? parseFloat(gainsReelVal) : null,
    cout_reel: coutVal ? parseFloat(coutVal) : null,
  };
  const btn = document.getElementById('fin-btn-save-ev');
  btn.disabled = true; btn.textContent = 'Enregistrement…';
  let error, savedId = _finEvEditingId;
  if (_finEvEditingId) {
    ({ error } = await window.Auth.sb.from('finance_evenements').update(payload).eq('id', _finEvEditingId));
  } else {
    const user = await window.Auth.getUser();
    payload.created_by = user.id;
    const { data, error: e2 } = await window.Auth.sb.from('finance_evenements').insert(payload).select('id').single();
    error = e2;
    if (data) savedId = data.id;
  }
  if (error) { btn.disabled = false; btn.textContent = 'Enregistrer'; showToast('Erreur : ' + error.message, 'error'); return; }

  // Sync des transactions liées à cet event
  try {
    const checkedCbs = [...document.querySelectorAll('#ev-tx-recettes-list input:checked, #ev-tx-depenses-list input:checked')];
    const checkedIds = checkedCbs.map(cb => cb.getAttribute('data-tx-id')).filter(Boolean);
    // Collecte les montants partiels - recettes ET dépenses (uniquement pour les cases cochées)
    const montantsPartiels = {};
    checkedCbs.forEach(cb => {
      const txId = cb.getAttribute('data-tx-id');
      const partialId = cb.dataset.partialId;
      if (!txId || !partialId) return;
      const input = document.getElementById(partialId);
      if (input && input.value !== '') montantsPartiels[txId] = parseFloat(input.value);
    });
    // 1. Détache toutes les transactions liées qui ne sont plus cochées
    const currentlyLinked = _finTransactions.filter(t => t.finance_evenement_id === savedId);
    const toDetach = currentlyLinked.filter(t => !checkedIds.includes(t.id)).map(t => t.id);
    if (toDetach.length) await window.Auth.sb.from('transactions').update({ finance_evenement_id: null }).in('id', toDetach);
    // 2. Lie les nouvelles transactions cochées
    if (checkedIds.length) await window.Auth.sb.from('transactions').update({ finance_evenement_id: savedId }).in('id', checkedIds);
    // 3. Sauvegarde les montants partiels sur l'événement
    await window.Auth.sb.from('finance_evenements').update({ tx_montants_partiels: montantsPartiels }).eq('id', savedId);
  } catch (err) { console.error('[fin ev tx sync]', err); showToast('Événement OK mais erreur sur les transactions liées : ' + err.message, 'error'); }

  btn.disabled = false; btn.textContent = 'Enregistrer';
  showToast(_finEvEditingId ? 'Événement modifié' : 'Événement ajouté', 'success');
  document.getElementById('fin-form-ev').classList.remove('visible');
  _finEvEditingId = null;
  finRefreshAll();
}

async function finDeleteEv(id) {
  if (!confirm('Supprimer cet événement ?')) return;
  const { error } = await window.Auth.sb.from('finance_evenements').delete().eq('id', id);
  if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
  showToast('Événement supprimé', 'success');
  finRefreshAll();
}

// ============================================================
// SUMUP IMPORT
// ============================================================
const SUMUP_PROXY = 'https://sumup-proxy.bdecreadien.workers.dev';

let _sumupItems = [];
// Map variante → produit parent (ex: "5 tickets" → "Tickets tombolat")
let _sumupVariantMap = {};

// Alias manuels : { "5 tickets": "Tickets tombolat", ... } stockés en localStorage
function finSumupGetAliases() {
  try { return JSON.parse(localStorage.getItem('sumup_aliases') || '{}'); } catch { return {}; }
}
function finSumupSaveAliases(map) {
  try { localStorage.setItem('sumup_aliases', JSON.stringify(map)); } catch {}
}
function finSumupNormalize(productSummary) {
  if (!productSummary) return 'Vente SumUp';
  const aliases = finSumupGetAliases();
  return aliases[productSummary.toLowerCase()] || productSummary;
}

function finSumupOpenAliases() {
  const aliases = finSumupGetAliases();
  // Produits uniques dans les transactions chargées
  const produits = [...new Set(_sumupItems.map(t => t.product_summary).filter(Boolean))].sort();
  const rows = produits.map(p => {
    const group = aliases[p.toLowerCase()] || '';
    return `<tr>
      <td style="padding:6px 8px;font-size:13px;border-bottom:1px solid var(--gris-border);">${escapeHtmlNl(p)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid var(--gris-border);">
        <input type="text" value="${escapeHtmlNl(group)}" data-produit="${escapeHtmlNl(p)}"
          placeholder="(inchangé)"
          style="width:100%;border:1px solid var(--gris-border);border-radius:5px;padding:4px 8px;font-size:13px;background:var(--bg-input,#fff);">
      </td>
    </tr>`;
  }).join('');

  const modal = document.createElement('div');
  modal.id = 'sumup-alias-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
  modal.innerHTML = `
    <div style="background:var(--bg-card,#fff);border-radius:12px;width:100%;max-width:500px;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,.2);">
      <div style="padding:16px 20px;border-bottom:1px solid var(--gris-border);display:flex;justify-content:space-between;align-items:center;">
        <h3 style="margin:0;font-size:15px;">Regrouper des produits SumUp</h3>
        <button onclick="document.getElementById('sumup-alias-modal').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--gris-texte);">×</button>
      </div>
      <p style="margin:10px 20px 0;font-size:12px;color:var(--gris-texte);">Tape le nom du groupe dans la colonne droite pour regrouper plusieurs variantes ensemble. Laisse vide pour ne pas regrouper.</p>
      <div style="overflow-y:auto;flex:1;padding:0 20px;">
        <table style="width:100%;border-collapse:collapse;margin:12px 0;">
          <thead><tr>
            <th style="text-align:left;font-size:11px;color:var(--gris-texte);padding:4px 8px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Nom SumUp</th>
            <th style="text-align:left;font-size:11px;color:var(--gris-texte);padding:4px 8px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Groupe affiché</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div style="padding:12px 20px;border-top:1px solid var(--gris-border);display:flex;gap:8px;justify-content:flex-end;">
        <button onclick="document.getElementById('sumup-alias-modal').remove()" style="background:none;border:1px solid var(--gris-border);border-radius:6px;padding:7px 16px;font-size:13px;cursor:pointer;">Annuler</button>
        <button onclick="finSumupSaveAliasesFromModal()" style="background:#1a7f37;color:white;border:none;border-radius:6px;padding:7px 16px;font-size:13px;font-weight:600;cursor:pointer;">Enregistrer</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

function finSumupSaveAliasesFromModal() {
  const aliases = finSumupGetAliases();
  document.querySelectorAll('#sumup-alias-modal input[data-produit]').forEach(inp => {
    const key = inp.dataset.produit.toLowerCase();
    const val = inp.value.trim();
    if (val) aliases[key] = val;
    else delete aliases[key];
  });
  finSumupSaveAliases(aliases);
  document.getElementById('sumup-alias-modal').remove();
  finSumupRender();
  showToast('Regroupements enregistrés', 'success');
}

async function finSumupLoad() {
  const btn = document.getElementById('fin-btn-sumup');
  btn.disabled = true; btn.textContent = 'Chargement…';
  try {
    if (!_finDateDebut || !_finDateFin) { showToast("Sélectionne une période d'abord", 'error'); return; }
    const debut = _finDateDebut.toISOString().slice(0, 10);
    const fin = _finDateFin.toISOString().slice(0, 10);
    // Récupère toutes les pages (SumUp limite à ~100 par requête)
    _sumupItems = [];
    let offset = 0;
    const pageSize = 100;
    while (true) {
      const txResp = await fetch(`${SUMUP_PROXY}/sumup/v0.1/me/transactions/history?newest_time=${fin}T23:59:59Z&oldest_time=${debut}T00:00:00Z&limit=${pageSize}&offset=${offset}`);
      if (!txResp.ok) { showToast('Erreur SumUp : ' + txResp.status, 'error'); return; }
      const data = await txResp.json();
      const items = (data.items || []).filter(t => t.status === 'SUCCESSFUL');
      _sumupItems.push(...items);
      if (items.length < pageSize) break; // dernière page
      offset += pageSize;
      if (offset > 2000) break; // sécurité anti-boucle infinie
    }
    finSumupRender();
  } catch (e) {
    showToast('Erreur : ' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = '⟳ Charger les ventes';
  }
}

// Construit l'arbre : produit → moyen → [{date, count, montant, refs}]
function finSumupTree(items) {
  const tree = {};
  items.forEach(tx => {
    const produit = finSumupNormalize(tx.product_summary);
    const moyen = tx.payment_type === 'CASH' ? 'especes' : 'virement_sumup';
    const date = tx.timestamp ? tx.timestamp.slice(0, 10) : '';
    const montant = parseFloat(tx.amount || 0);
    if (!tree[produit]) tree[produit] = { label: produit, moyens: {}, total: 0, allRefs: [] };
    tree[produit].total += montant;
    tree[produit].allRefs.push(tx.id);
    if (!tree[produit].moyens[moyen]) tree[produit].moyens[moyen] = { dates: {}, total: 0, allRefs: [] };
    tree[produit].moyens[moyen].total += montant;
    tree[produit].moyens[moyen].allRefs.push(tx.id);
    if (!tree[produit].moyens[moyen].dates[date]) tree[produit].moyens[moyen].dates[date] = { count: 0, montant: 0, refs: [] };
    tree[produit].moyens[moyen].dates[date].count++;
    tree[produit].moyens[moyen].dates[date].montant += montant;
    tree[produit].moyens[moyen].dates[date].refs.push(tx.id);
  });
  return tree;
}

function finSumupImportedRefs() {
  const s = new Set();
  _finTransactions.forEach(t => { if (t.sumup_ref) t.sumup_ref.split(',').forEach(r => s.add(r.trim())); });
  return s;
}

function finSumupRender() {
  const list = document.getElementById('fin-sumup-list');
  if (!_sumupItems.length) {
    list.innerHTML = '<p style="font-size:13px;color:var(--gris-texte);text-align:center;padding:16px 0;">Aucune vente SumUp réussie sur cette période.</p>';
    return;
  }
  const importedRefs = finSumupImportedRefs();
  const tree = finSumupTree(_sumupItems);
  const produits = Object.values(tree);
  const pending = produits.filter(p => !p.allRefs.every(r => importedRefs.has(r)));
  const done = produits.filter(p => p.allRefs.every(r => importedRefs.has(r)));

  const totalPending = pending.reduce((s, p) => s + p.total, 0);
  const nbPending = pending.reduce((s, p) => s + p.allRefs.length, 0);

  list.innerHTML = `
    ${pending.length ? `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
      <label style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;cursor:pointer;text-transform:none;letter-spacing:0;">
        <input type="checkbox" id="sumup-select-all" onchange="finSumupSelectAll(this)" style="width:16px;height:16px;accent-color:#1a7f37;">
        Tout sélectionner (${pending.length} produits · ${nbPending} ventes · ${totalPending.toFixed(2)} €)
      </label>
      <button onclick="finSumupImportSelection()" style="background:#1a7f37;color:white;border:none;border-radius:6px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer;">
        Importer la sélection
      </button>
    </div>
    <div id="sumup-pending-list">
      ${pending.map((p, i) => finSumupProduitHtml(p, i, importedRefs, false)).join('')}
    </div>` : '<p style="font-size:13px;color:#16a34a;text-align:center;padding:8px 0;">✓ Toutes les ventes sont importées.</p>'}
    ${done.length ? `
    <div style="margin-top:14px;font-size:11px;color:var(--gris-texte);font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Déjà importés (${done.length} produits)</div>
    ${done.map((p, i) => finSumupProduitHtml(p, i + 9999, importedRefs, true)).join('')}` : ''}
  `;
}

function finSumupProduitHtml(p, idx, importedRefs, imported) {
  const nbVentes = p.allRefs.length;
  const moyenLabels = { especes: 'Espèces', virement_sumup: 'Carte' };
  // Sous-lignes : moyen → dates
  const sousLignes = Object.entries(p.moyens).map(([moyen, moyenData]) => {
    const dateLines = Object.entries(moyenData.dates)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => {
        const dateStr = new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
        return `<div style="display:flex;justify-content:space-between;padding:1px 0 1px 16px;font-size:11px;color:var(--gris-texte);">
          <span>${dateStr} · ${d.count} vente${d.count > 1 ? 's' : ''}</span>
          <span style="font-weight:600;">${d.montant.toFixed(2)} €</span>
        </div>`;
      }).join('');
    return `<div style="padding:3px 0 3px 8px;border-left:2px solid var(--gris-border);margin:3px 0 3px 8px;">
      <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:600;color:var(--gris-texte);">
        <span>${moyenLabels[moyen] || moyen}</span>
        <span>${moyenData.total.toFixed(2)} €</span>
      </div>
      ${dateLines}
    </div>`;
  }).join('');

  return `<div style="border:1px solid ${imported ? 'rgba(34,197,94,.3)' : 'var(--gris-border)'};border-radius:8px;margin-bottom:6px;background:${imported ? 'rgba(34,197,94,.05)' : 'var(--bg-card,#fafafa)'};">
    <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;">
      ${imported
        ? '<span style="width:16px;flex-shrink:0;color:#16a34a;font-size:14px;">✓</span>'
        : `<input type="checkbox" class="sumup-cb" data-produit="${escapeHtmlNl(p.label)}" style="width:16px;height:16px;flex-shrink:0;accent-color:#1a7f37;">`}
      <span style="flex:1;font-size:13px;font-weight:700;color:var(--noir);">${escapeHtmlNl(p.label)}</span>
      <span style="font-size:12px;color:var(--gris-texte);">${nbVentes} vente${nbVentes > 1 ? 's' : ''}</span>
      <span style="font-weight:700;color:${imported ? '#16a34a' : 'var(--noir)'};font-size:13px;">${p.total.toFixed(2)} €</span>
    </div>
    <div style="padding:0 10px 8px;">${sousLignes}</div>
  </div>`;
}

function finSumupSelectAll(cb) {
  document.querySelectorAll('#sumup-pending-list .sumup-cb').forEach(c => c.checked = cb.checked);
}

async function finSumupImportSelection() {
  const checked = [...document.querySelectorAll('#sumup-pending-list .sumup-cb:checked')];
  if (!checked.length) { showToast('Sélectionne au moins un produit', 'error'); return; }

  const importedRefs = finSumupImportedRefs();
  const tree = finSumupTree(_sumupItems);
  const selectedLabels = new Set(checked.map(c => c.dataset.produit));
  const user = await window.Auth.getUser();
  let ok = 0, err = 0;

  for (const label of selectedLabels) {
    const p = tree[label];
    if (!p) continue;
    // Une transaction par produit+moyen (détail moyen conservé, dates fusionnées)
    for (const [moyen, moyenData] of Object.entries(p.moyens)) {
      const pendingRefs = moyenData.allRefs.filter(r => !importedRefs.has(r));
      if (!pendingRefs.length) continue;
      const nbVentes = pendingRefs.length;
      const montant = moyenData.dates
        ? Object.values(moyenData.dates).filter(d => d.refs.some(r => pendingRefs.includes(r))).reduce((s, d) => s + d.montant, 0)
        : moyenData.total;
      const libelle = nbVentes > 1 ? `${label} (×${nbVentes})` : label;
      // Date = la plus récente du groupe
      const derniereDate = Object.keys(moyenData.dates).sort().pop() || new Date().toISOString().slice(0, 10);
      const { error } = await window.Auth.sb.from('transactions').insert({
        date: derniereDate,
        montant: parseFloat(montant.toFixed(2)),
        libelle,
        categorie: 'vente',
        moyen_paiement: moyen,
        sumup_ref: pendingRefs.join(','),
        created_by: user.id,
      });
      if (error) err++; else ok++;
    }
  }
  if (ok) showToast(`${ok} transaction(s) créée(s)`, 'success');
  if (err) showToast(`${err} erreur(s)`, 'error');
  await finLoadTransactions();
  finSumupRender();
}

// ============================================================
// PDF FINANCES (via jsPDF chargé à la demande)
// ============================================================
let _jsPdfLoaded = false;
let _logoDataUrl = null;

function loadJsPdf() {
  return new Promise((resolve, reject) => {
    if (_jsPdfLoaded || window.jspdf) { _jsPdfLoaded = true; resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js';
    s.onload = () => { _jsPdfLoaded = true; resolve(); };
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// Charge le logo BDE et le convertit en JPEG blanc (évite le fond noir jsPDF sur PNG transparent)
async function loadLogo() {
  if (_logoDataUrl) return _logoDataUrl;
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const size = 320;
      const radius = 36;
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      // Clip coins légèrement arrondis
      ctx.beginPath();
      ctx.moveTo(radius, 0);
      ctx.lineTo(size - radius, 0);
      ctx.quadraticCurveTo(size, 0, size, radius);
      ctx.lineTo(size, size - radius);
      ctx.quadraticCurveTo(size, size, size - radius, size);
      ctx.lineTo(radius, size);
      ctx.quadraticCurveTo(0, size, 0, size - radius);
      ctx.lineTo(0, radius);
      ctx.quadraticCurveTo(0, 0, radius, 0);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, 0, 0, size, size);
      _logoDataUrl = canvas.toDataURL('image/jpeg', 0.92);
      resolve(_logoDataUrl);
    };
    img.onerror = () => resolve(null);
    img.src = '/assets/Logo-pdf.png?v=7';
  });
}

// Ouvre le PDF dans un modal pour aperçu avant téléchargement
function pdfPreview(doc, filename) {
  const pdfBlob = doc.output('blob');
  const typedBlob = pdfBlob.type === 'application/pdf' ? pdfBlob : new Blob([pdfBlob], { type: 'application/pdf' });
  const url = URL.createObjectURL(typedBlob);
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';
  modal.innerHTML = `
    <div style="background:white;border-radius:16px;max-width:900px;width:100%;height:90vh;display:flex;flex-direction:column;overflow:hidden;">
      <div style="padding:14px 20px;border-bottom:1px solid var(--gris-border);display:flex;justify-content:space-between;align-items:center;gap:12px;">
        <h3 style="margin:0;font-size:16px;">Aperçu du PDF - ${filename}</h3>
        <div style="display:flex;gap:8px;">
          <button onclick="this.closest('.pdf-preview-modal').remove()" style="padding:8px 14px;background:none;border:1px solid var(--gris-border);border-radius:6px;cursor:pointer;font-size:13px;">Fermer</button>
          <button onclick="(function(u,f){const a=document.createElement('a');a.href=u;a.download=f;document.body.appendChild(a);a.click();a.remove();})('${url}','${filename}')" style="padding:8px 14px;background:var(--gradient);color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;">⬇ Télécharger</button>
        </div>
      </div>
      <object data="${url}" type="application/pdf" style="flex:1;width:100%;border:none;">
        <div style="padding:40px;text-align:center;color:#666;">Aperçu impossible dans ce navigateur. Utilise "Télécharger" ci-dessus.</div>
      </object>
    </div>
  `;
  modal.className = 'pdf-preview-modal';
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

let _pdfTypeActuel = 'resume';
let _pdfCurrentUrl = null;
let _pdfCurrentFilename = null;

function pdfChangerType(type) {
  _pdfTypeActuel = type;
  const tabR = document.getElementById('pdf-tab-resume');
  const tabD = document.getElementById('pdf-tab-detaille');
  if (tabR) tabR.style.cssText = type === 'resume' ? 'background:var(--violet);color:white;' : '';
  if (tabD) tabD.style.cssText = type === 'detaille' ? 'background:var(--violet);color:white;' : '';
  pdfRegenererPreview();
}

// PDF.js - chargé à la demande (rend le PDF en canvas image, pas d'iframe = pas d'auto-download Windows)
let _pdfjsLoaded = false;
function loadPdfJs() {
  return new Promise((resolve, reject) => {
    if (_pdfjsLoaded || window.pdfjsLib) { _pdfjsLoaded = true; resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
    s.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
      }
      _pdfjsLoaded = true;
      resolve();
    };
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// Rend le PDF (blob URL) sous forme de <canvas> dans le conteneur. Aucun iframe/object = aucun auto-download Windows.
async function pdfRendreEnCanvas(blob) {
  const wrap = document.getElementById('pdf-preview-canvas-wrap');
  if (!wrap) return;
  wrap.innerHTML = '';
  try {
    await loadPdfJs();
    const arrayBuffer = await blob.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    // Densité d'écran (Retina = 2x) pour un rendu net après le downscale CSS
    const dpr = window.devicePixelRatio || 1;
    // Facteur de scale généreux : 2 en base × densité écran → images nettes même en Retina
    const scale = 2 * dpr;
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      // Le canvas est downscalé en CSS à sa taille "logique" pour que ça reste dans la mise en page,
      // mais les pixels réels sont dpr× → net sur Retina.
      canvas.style.cssText = `width:${viewport.width / dpr}px;max-width:100%;height:auto;background:white;box-shadow:0 8px 30px rgba(0,0,0,0.4);border-radius:4px;`;
      wrap.appendChild(canvas);
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;
    }
  } catch (e) {
    console.error('[pdfjs render]', e);
    wrap.innerHTML = `<div style="color:#fca5a5;padding:40px;text-align:center;">Erreur rendu aperçu : ${e.message}<br>Utilise le bouton Télécharger pour ouvrir le PDF.</div>`;
  }
}

// Construit un doc jsPDF selon le type actuel et met à jour _pdfCurrentUrl + _pdfCurrentFilename
async function pdfConstruire() {
  await loadJsPdf();
  await loadLogo();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  if (_pdfTypeActuel === 'detaille') {
    await pdfConstruireDetaille(doc);
    _pdfCurrentFilename = pdfFilename('rapport-detaille');
  } else {
    pdfConstruireResume(doc);
    _pdfCurrentFilename = pdfFilename('resume');
  }
  if (_pdfCurrentUrl) URL.revokeObjectURL(_pdfCurrentUrl);
  const pdfBlob = doc.output('blob');
  const typedBlob = pdfBlob.type === 'application/pdf' ? pdfBlob : new Blob([pdfBlob], { type: 'application/pdf' });
  _pdfCurrentUrl = URL.createObjectURL(typedBlob);
}

// Prévisualisation à la demande (compat - plus utilisée directement mais gardée pour d'anciens appels)
async function pdfApercu() {
  return pdfRegenererPreview();
}

// Téléchargement à la demande (bouton "Télécharger" - ancien flux, gardé pour compat)
async function pdfTelecharger() {
  try {
    if (!_pdfCurrentUrl || !_pdfCurrentFilename) {
      await pdfConstruire();
    }
    const a = document.createElement('a');
    a.href = _pdfCurrentUrl; a.download = _pdfCurrentFilename;
    document.body.appendChild(a); a.click(); a.remove();
  } catch (e) {
    console.error('[pdf telecharger]', e);
    showToast('Erreur : ' + e.message, 'error');
  }
}

// Nouveau flux : télécharge directement le type demandé, sans iframe ni preview
async function pdfTelechargerType(type) {
  _pdfTypeActuel = type;
  try {
    await pdfConstruire();
    const a = document.createElement('a');
    a.href = _pdfCurrentUrl; a.download = _pdfCurrentFilename;
    document.body.appendChild(a); a.click(); a.remove();
    showToast('PDF ' + (type === 'detaille' ? 'détaillé' : 'résumé') + ' téléchargé', 'success');
  } catch (e) {
    console.error('[pdf telecharger type]', e);
    showToast('Erreur : ' + e.message, 'error');
  }
}

// Détection Windows : c'est là qu'on a le pb d'auto-download PDF en iframe
const _isWindows = /Windows/i.test(navigator.userAgent || '');

// Régénère l'aperçu - iframe natif sur Mac/Linux (net et rapide), canvas PDF.js sur Windows (pas d'auto-download)
async function pdfRegenererPreview() {
  const iframe = document.getElementById('pdf-preview-iframe');
  const wrap = document.getElementById('pdf-preview-wrap');
  const loader = document.getElementById('pdf-preview-loading');
  if (!iframe && !wrap) return;
  if (loader) loader.style.display = 'flex';
  try {
    await loadJsPdf();
    await loadLogo();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    if (_pdfTypeActuel === 'detaille') {
      await pdfConstruireDetaille(doc);
      _pdfCurrentFilename = pdfFilename('rapport-detaille');
    } else {
      pdfConstruireResume(doc);
      _pdfCurrentFilename = pdfFilename('resume');
    }
    if (_pdfCurrentUrl) URL.revokeObjectURL(_pdfCurrentUrl);
    const pdfBlob = doc.output('blob');
    const typedBlob = pdfBlob.type === 'application/pdf' ? pdfBlob : new Blob([pdfBlob], { type: 'application/pdf' });
    _pdfCurrentUrl = URL.createObjectURL(typedBlob);

    if (_isWindows) {
      // Windows : rendu canvas via PDF.js pour éviter l'auto-download déclenché par les blob PDF en iframe
      if (iframe) iframe.style.display = 'none';
      // Injecte un conteneur canvas dans le wrap si absent
      let canvasWrap = wrap.querySelector('#pdf-preview-canvas-live');
      if (!canvasWrap) {
        canvasWrap = document.createElement('div');
        canvasWrap.id = 'pdf-preview-canvas-live';
        canvasWrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:16px;';
        wrap.appendChild(canvasWrap);
      }
      // Rendu haute qualité
      await pdfRendreEnCanvasLive(typedBlob, canvasWrap);
    } else {
      // Mac/Linux : iframe natif (net et fluide)
      if (iframe) {
        iframe.style.display = '';
        iframe.src = _pdfCurrentUrl;
      }
    }
  } catch (e) {
    console.error('[pdf preview]', e);
  } finally {
    if (loader) loader.style.display = 'none';
  }
}

async function pdfRendreEnCanvasLive(blob, container) {
  container.innerHTML = '';
  try {
    await loadPdfJs();
    const arrayBuffer = await blob.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const dpr = window.devicePixelRatio || 1;
    // Scale généreux pour rester net à 210mm de large
    const scale = 2.5 * dpr;
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      // Affiché à taille A4 réelle
      canvas.style.cssText = 'width:210mm;max-width:100%;height:auto;background:white;box-shadow:0 8px 30px rgba(0,0,0,0.4);border-radius:2px;';
      container.appendChild(canvas);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    }
  } catch (e) {
    console.error('[pdfjs render]', e);
    container.innerHTML = `<div style="color:#fca5a5;padding:40px;text-align:center;">Erreur rendu : ${e.message}<br>Utilise le bouton Télécharger.</div>`;
  }
}

function pdfConstruireResume(doc) {
  const { rec: recettes, dep: depenses } = finPeriodeRecDep();
  const soldePeriode = recettes - depenses;
  // Solde total = solde initial (rentrée sept) + cumul des mois précédents + net du mois affiché
  const soldeTotal = _finSoldeInitial + _finSoldeMoisPrecedents + soldePeriode;
  const periodeLabel = `Du ${_finDateDebut.toLocaleDateString('fr-FR')} au ${_finDateFin.toLocaleDateString('fr-FR')}`;
  pdfHeader(doc, 'Résumé financier');
  doc.setFontSize(10); doc.setTextColor(110); doc.text(periodeLabel, 15, 62);
  doc.setFontSize(14); doc.setTextColor(30); doc.setFont(undefined, 'bold'); doc.text('Récapitulatif', 15, 72); doc.setFont(undefined, 'normal');
  const rows = [
    ['Solde initial (report)', _finSoldeInitial.toFixed(2) + ' EUR', 100, 100, 100],
    ['Recettes', recettes.toFixed(2) + ' EUR', 34, 197, 94],
    ['Dépenses', depenses.toFixed(2) + ' EUR', 220, 38, 38],
    ['Solde de la période', soldePeriode.toFixed(2) + ' EUR', soldePeriode >= 0 ? 70 : 220, soldePeriode >= 0 ? 58 : 38, soldePeriode >= 0 ? 144 : 38],
    ['Solde total', soldeTotal.toFixed(2) + ' EUR', soldeTotal >= 0 ? 70 : 220, soldeTotal >= 0 ? 58 : 38, soldeTotal >= 0 ? 144 : 38],
    ['Nombre de transactions', String(_finTransactions.length + finExpandRecurrentes(_finDateDebut, _finDateFin).length), 100, 100, 100],
  ];
  let y = 90;
  rows.forEach(([label, val, r, g, b]) => {
    doc.setFillColor(248, 248, 250); doc.rect(15, y - 6, 180, 12, 'F');
    doc.setFontSize(11); doc.setTextColor(80); doc.text(label, 20, y + 2);
    doc.setFontSize(13); doc.setTextColor(r, g, b); doc.text(val, 190, y + 2, { align: 'right' });
    y += 16;
  });
  pdfFooter(doc);
}

async function pdfConstruireDetaille(doc) {
  const { rec: recettes, dep: depenses } = finPeriodeRecDep();
  const soldePeriode = recettes - depenses;
  // Solde total = solde initial (rentrée sept) + cumul des mois précédents + net du mois affiché
  const soldeTotal = _finSoldeInitial + _finSoldeMoisPrecedents + soldePeriode;
  const periodeLabel = `Du ${_finDateDebut.toLocaleDateString('fr-FR')} au ${_finDateFin.toLocaleDateString('fr-FR')}`;

  // P1
  pdfHeader(doc, 'Rapport financier détaillé');
  doc.setFontSize(10); doc.setTextColor(110); doc.text(periodeLabel, 15, 62);
  doc.setFontSize(14); doc.setTextColor(30); doc.setFont(undefined, 'bold'); doc.text('Récapitulatif', 15, 72); doc.setFont(undefined, 'normal');
  const rows = [
    ['Solde initial (report)', _finSoldeInitial.toFixed(2) + ' EUR', 100, 100, 100],
    ['Recettes', recettes.toFixed(2) + ' EUR', 34, 197, 94],
    ['Dépenses', depenses.toFixed(2) + ' EUR', 220, 38, 38],
    ['Solde de la période', soldePeriode.toFixed(2) + ' EUR', soldePeriode >= 0 ? 70 : 220, soldePeriode >= 0 ? 58 : 38, soldePeriode >= 0 ? 144 : 38],
    ['Solde total', soldeTotal.toFixed(2) + ' EUR', soldeTotal >= 0 ? 70 : 220, soldeTotal >= 0 ? 58 : 38, soldeTotal >= 0 ? 144 : 38],
  ];
  let y = 90;
  rows.forEach(([label, val, r, g, b]) => {
    doc.setFillColor(248, 248, 250); doc.rect(15, y - 6, 180, 14, 'F');
    doc.setFontSize(12); doc.setTextColor(80); doc.text(label, 20, y + 3);
    doc.setFontSize(15); doc.setTextColor(r, g, b); doc.text(val, 190, y + 3, { align: 'right' });
    y += 18;
  });
  y += 8; doc.setFontSize(14); doc.setTextColor(30); doc.text('Répartition par catégorie', 15, y); y += 8;
  const byCat = {};
  const virtCat = finExpandRecurrentes(_finDateDebut, _finDateFin);
  _finTransactions.concat(virtCat).forEach(t => {
    if (!byCat[t.categorie]) byCat[t.categorie] = { rec: 0, dep: 0 };
    if (t.montant > 0) byCat[t.categorie].rec += Number(t.montant);
    else byCat[t.categorie].dep += Math.abs(Number(t.montant));
  });
  Object.entries(byCat)
    .map(([cat, v]) => ({ cat, net: v.rec - v.dep }))
    .sort((a, b) => b.net - a.net)
    .forEach(({ cat, net }) => {
      if (net === 0) return;
      const c = FIN_CATEGORIES[cat] || { label: cat.replace(/_/g, ' ').replace(/^./, s => s.toUpperCase()) };
      doc.setFontSize(10); doc.setTextColor(80);
      doc.text(c.label, 20, y);
      doc.setTextColor(net >= 0 ? 34 : 220, net >= 0 ? 197 : 38, net >= 0 ? 94 : 38);
      doc.text((net >= 0 ? '+' : '') + net.toFixed(2) + ' EUR', 190, y, { align: 'right' });
      y += 6;
    });
  pdfFooter(doc);

  // P2 - Détail des transactions (aperçu global)
  doc.addPage(); pdfHeader(doc, 'Détail des transactions');
  doc.setFontSize(10); doc.setTextColor(110); doc.text(periodeLabel, 15, 62);
  const virtuelsPdf = finExpandRecurrentes(_finDateDebut, _finDateFin);
  // Ajoute events validés comme pseudo-transactions (2 lignes : gains + coût)
  const evTxPdf = [];
  for (const ev of _finEvenements) {
    if (!ev.valide || !ev.date) continue;
    const d = new Date(ev.date + 'T00:00:00');
    if (d < _finDateDebut || d > _finDateFin) continue;
    const gR = Number(ev.gains_reel) || 0;
    const cR = Number(ev.cout_reel) || 0;
    if (gR > 0) evTxPdf.push({ date: ev.date, libelle: `${ev.titre} (gains event)`, categorie: ev.categorie_budget || 'autre', montant: gR, _fromEvent: true });
    if (cR > 0) evTxPdf.push({ date: ev.date, libelle: `${ev.titre} (coût event)`, categorie: ev.categorie_budget || 'autre', montant: -cR, _fromEvent: true });
  }
  const allTxPdf = _finTransactions.concat(virtuelsPdf).concat(evTxPdf).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  if (!allTxPdf.length) {
    doc.setFontSize(12); doc.setTextColor(150); doc.text('Aucune transaction sur cette période.', 105, 100, { align: 'center' });
  } else {
    y = 72;
    doc.setFontSize(9); doc.setTextColor(120);
    doc.text('DATE', 15, y); doc.text('LIBELLÉ', 40, y); doc.text('CATÉGORIE', 130, y); doc.text('MONTANT', 195, y, { align: 'right' });
    doc.setDrawColor(200); doc.line(15, y + 2, 195, y + 2); y += 8;
    let netP2 = 0;
    allTxPdf.forEach(tx => {
      if (y > 265) {
        doc.addPage(); pdfHeader(doc, 'Détail des transactions (suite)');
        // Redessine les en-têtes de colonnes et laisse de la place sous le titre
        y = 60;
        doc.setFontSize(9); doc.setTextColor(120);
        doc.text('DATE', 15, y); doc.text('LIBELLÉ', 40, y); doc.text('CATÉGORIE', 130, y); doc.text('MONTANT', 195, y, { align: 'right' });
        doc.setDrawColor(200); doc.line(15, y + 2, 195, y + 2); y += 8;
      }
      const c = FIN_CATEGORIES[tx.categorie] || { label: (tx.categorie || 'autre').replace(/_/g, ' ').replace(/^./, s => s.toUpperCase()) };
      const dateStr = new Date(tx.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      doc.setFontSize(9); doc.setTextColor(50);
      doc.text(dateStr, 15, y);
      let suffix = '';
      if (tx._virtuel) suffix = ' [récur.]';
      else if (tx._fromEvent) suffix = ' [event]';
      const libelleBase = (tx.libelle || '') + suffix;
      const libelleAvecFournisseur = tx.fournisseur ? `${libelleBase} - ${tx.fournisseur}` : libelleBase;
      const libelleShort = libelleAvecFournisseur.length > 45 ? libelleAvecFournisseur.slice(0, 42) + '…' : libelleAvecFournisseur;
      doc.text(libelleShort, 40, y);
      doc.text(c.label, 130, y);
      const mNum = Number(tx.montant);
      netP2 += mNum;
      doc.setTextColor(mNum >= 0 ? 34 : 220, mNum >= 0 ? 197 : 38, mNum >= 0 ? 94 : 38);
      doc.text((mNum >= 0 ? '+' : '') + mNum.toFixed(2) + ' EUR', 195, y, { align: 'right' });
      y += 6;
    });
    // Ligne SOLDE FINAL
    if (y > 260) { doc.addPage(); pdfHeader(doc, 'Solde final'); y = 60; }
    y += 3;
    doc.setDrawColor(60); doc.setLineWidth(0.5); doc.line(15, y, 195, y); y += 8;
    doc.setFontSize(9); doc.setTextColor(100);
    doc.text('Solde au début du mois', 15, y);
    doc.text((_finSoldeInitial + _finSoldeMoisPrecedents).toFixed(2) + ' EUR', 195, y, { align: 'right' });
    y += 6;
    doc.setTextColor(100);
    doc.text('Somme des mouvements période', 15, y);
    doc.setTextColor(netP2 >= 0 ? 34 : 220, netP2 >= 0 ? 197 : 38, netP2 >= 0 ? 94 : 38);
    doc.text((netP2 >= 0 ? '+' : '') + netP2.toFixed(2) + ' EUR', 195, y, { align: 'right' });
    y += 6;
    doc.setDrawColor(30); doc.setLineWidth(0.4); doc.line(15, y, 195, y); y += 8;
    const soldeFinalP2 = _finSoldeInitial + _finSoldeMoisPrecedents + netP2;
    doc.setFontSize(12); doc.setFont(undefined, 'bold'); doc.setTextColor(30);
    doc.text('SOLDE FINAL', 15, y);
    doc.setTextColor(soldeFinalP2 >= 0 ? 34 : 220, soldeFinalP2 >= 0 ? 197 : 38, soldeFinalP2 >= 0 ? 94 : 38);
    doc.text((soldeFinalP2 >= 0 ? '+' : '') + soldeFinalP2.toFixed(2) + ' EUR', 195, y, { align: 'right' });
    doc.setFont(undefined, 'normal');
  }
  pdfFooter(doc);

  // P3 - Événements validés (dans le budget réel)
  doc.addPage(); pdfHeader(doc, 'Événements validés');
  doc.setFontSize(10); doc.setTextColor(110); doc.text(periodeLabel, 15, 62);
  const evs = await pdfChargerEvenements(_finDateDebut, _finDateFin);
  const evsValides = evs.filter(e => e.valide);
  doc.setFontSize(9); doc.setTextColor(140);
  doc.text('Événements dont les gains/coûts réels sont validés et comptés dans le budget.', 15, 68);
  if (!evsValides.length) {
    doc.setFontSize(12); doc.setTextColor(150); doc.text('Aucun événement validé sur cette période.', 105, 100, { align: 'center' });
  } else {
    y = 78;
    doc.setFontSize(9); doc.setTextColor(120);
    doc.text('DATE', 15, y); doc.text('ÉVÉNEMENT', 40, y); doc.text('GAINS', 130, y, { align: 'right' }); doc.text('COÛT', 160, y, { align: 'right' }); doc.text('SOLDE', 195, y, { align: 'right' });
    doc.setDrawColor(200); doc.line(15, y + 2, 195, y + 2); y += 8;
    // Calcul des gains/coûts par event depuis les transactions (même logique que le dashboard)
    const evIdSet = new Set(evsValides.map(e => e.id));
    let totRec = 0, totDep = 0;
    evsValides.forEach(ev => {
      if (y > 265) { doc.addPage(); pdfHeader(doc, 'Événements validés (suite)'); y = 60; }
      const partials = ev.tx_montants_partiels || {};
      let gR = 0, cR = 0;
      for (const tx of _finTransactions) {
        const mnt = Number(tx.montant);
        let amount;
        if (partials[tx.id] != null) {
          amount = parseFloat(partials[tx.id]) || 0;
        } else if (tx.finance_evenement_id === ev.id) {
          amount = Math.abs(mnt);
        } else {
          continue;
        }
        if (mnt >= 0) gR += amount;
        else cR += amount;
      }
      const solde = gR - cR;
      totRec += gR; totDep += cR;
      const dateStr = ev.date ? new Date(ev.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';
      doc.setFontSize(9); doc.setTextColor(50);
      doc.text(dateStr, 15, y);
      const titre = ((ev.titre || '') + (ev.lieu ? ' · ' + ev.lieu : '')).slice(0, 55);
      doc.text(titre, 40, y);
      doc.setTextColor(34, 197, 94); doc.text('+' + gR.toFixed(2), 130, y, { align: 'right' });
      doc.setTextColor(220, 38, 38); doc.text('-' + cR.toFixed(2), 160, y, { align: 'right' });
      doc.setTextColor(solde >= 0 ? 34 : 220, solde >= 0 ? 197 : 38, solde >= 0 ? 94 : 38);
      doc.text((solde >= 0 ? '+' : '') + solde.toFixed(2), 195, y, { align: 'right' });
      y += 6;
    });
    // Transactions hors événements : pas liées à un event validé de la période et pas en partial
    const debutStr = _finDateDebut.toISOString().slice(0, 10);
    const finStr = _finDateFin.toISOString().slice(0, 10);
    const capturedByEvTx = new Set();
    for (const ev of evsValides) {
      const partials = ev.tx_montants_partiels || {};
      for (const txId of Object.keys(partials)) capturedByEvTx.add(txId);
      for (const tx of _finTransactions) {
        if (tx.finance_evenement_id === ev.id) capturedByEvTx.add(String(tx.id));
      }
    }
    const txHors = _finTransactions.filter(t => !capturedByEvTx.has(String(t.id)) && t.date >= debutStr && t.date <= finStr);
    const horsRec = txHors.filter(t => Number(t.montant) > 0).reduce((s, t) => s + Number(t.montant), 0);
    const horsDep = txHors.filter(t => Number(t.montant) < 0).reduce((s, t) => s + Math.abs(Number(t.montant)), 0);

    if (horsRec > 0 || horsDep > 0) {
      y += 2;
      doc.setDrawColor(60); doc.line(15, y, 195, y); y += 7;
      doc.setFontSize(9); doc.setFont(undefined, 'normal'); doc.setTextColor(100);
      doc.text('Sous-total événements', 15, y);
      doc.setTextColor(34, 197, 94); doc.text('+' + totRec.toFixed(2), 130, y, { align: 'right' });
      doc.setTextColor(220, 38, 38); doc.text('-' + totDep.toFixed(2), 160, y, { align: 'right' });
      const netEv = totRec - totDep;
      doc.setTextColor(netEv >= 0 ? 34 : 220, netEv >= 0 ? 197 : 38, netEv >= 0 ? 94 : 38);
      doc.text((netEv >= 0 ? '+' : '') + netEv.toFixed(2), 195, y, { align: 'right' });
      y += 6;
      doc.setTextColor(100);
      doc.text('Transactions hors événements', 15, y);
      if (horsRec > 0) { doc.setTextColor(34, 197, 94); doc.text('+' + horsRec.toFixed(2), 130, y, { align: 'right' }); }
      if (horsDep > 0) { doc.setTextColor(220, 38, 38); doc.text('-' + horsDep.toFixed(2), 160, y, { align: 'right' }); }
      const netHors = horsRec - horsDep;
      doc.setTextColor(netHors >= 0 ? 34 : 220, netHors >= 0 ? 197 : 38, netHors >= 0 ? 94 : 38);
      doc.text((netHors >= 0 ? '+' : '') + netHors.toFixed(2), 195, y, { align: 'right' });
      y += 2;
      doc.setDrawColor(30); doc.line(15, y, 195, y); y += 7;
      const grandRec = totRec + horsRec, grandDep = totDep + horsDep;
      doc.setFontSize(10); doc.setFont(undefined, 'bold'); doc.setTextColor(30);
      doc.text('TOTAL GÉNÉRAL', 15, y);
      doc.setTextColor(34, 197, 94); doc.text('+' + grandRec.toFixed(2), 130, y, { align: 'right' });
      doc.setTextColor(220, 38, 38); doc.text('-' + grandDep.toFixed(2), 160, y, { align: 'right' });
      const netVal = grandRec - grandDep;
      doc.setTextColor(netVal >= 0 ? 34 : 220, netVal >= 0 ? 197 : 38, netVal >= 0 ? 94 : 38);
      doc.text((netVal >= 0 ? '+' : '') + netVal.toFixed(2) + ' EUR', 195, y, { align: 'right' });
      doc.setFont(undefined, 'normal');
    } else {
      y += 2;
      doc.setDrawColor(60); doc.line(15, y, 195, y); y += 7;
      doc.setFontSize(10); doc.setFont(undefined, 'bold'); doc.setTextColor(30);
      doc.text('TOTAL VALIDÉ', 15, y);
      doc.setTextColor(34, 197, 94); doc.text('+' + totRec.toFixed(2), 130, y, { align: 'right' });
      doc.setTextColor(220, 38, 38); doc.text('-' + totDep.toFixed(2), 160, y, { align: 'right' });
      const netVal = totRec - totDep;
      doc.setTextColor(netVal >= 0 ? 34 : 220, netVal >= 0 ? 197 : 38, netVal >= 0 ? 94 : 38);
      doc.text((netVal >= 0 ? '+' : '') + netVal.toFixed(2) + ' EUR', 195, y, { align: 'right' });
      doc.setFont(undefined, 'normal');
    }
  }
  pdfFooter(doc);

  // P4 - Prévisionnel du mois SUIVANT (M+1)
  doc.addPage(); pdfHeader(doc, 'Prévisionnel du mois suivant');
  // Calcule mois+1 par rapport à _finDateDebut (mois de la période courante)
  const nextStart = new Date(_finDateDebut.getFullYear(), _finDateDebut.getMonth() + 1, 1);
  const nextEnd = new Date(nextStart.getFullYear(), nextStart.getMonth() + 1, 0);
  const moisSuivantLabel = nextStart.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  doc.setFontSize(10); doc.setTextColor(110);
  doc.text(`Mois de ${moisSuivantLabel} (du ${nextStart.toLocaleDateString('fr-FR')} au ${nextEnd.toLocaleDateString('fr-FR')})`, 15, 62);
  doc.setFontSize(9); doc.setTextColor(140);
  doc.text('Ce qui est prévu pour le mois suivant : events en attente + dépenses/recettes récurrentes.', 15, 68);
  y = 78;

  // Fetch events du mois suivant
  const evsNext = await pdfChargerEvenements(nextStart, nextEnd);
  const evsPrev = evsNext.filter(e => !e.valide);

  // Section events non-validés
  doc.setFontSize(11); doc.setFont(undefined, 'bold'); doc.setTextColor(30);
  doc.text('Événements en attente de validation', 15, y);
  doc.setFont(undefined, 'normal');
  y += 4;
  doc.setDrawColor(70); doc.setLineWidth(0.4); doc.line(15, y, 195, y); y += 5;
  let totalPrevEv = 0;
  if (!evsPrev.length) {
    doc.setFontSize(9); doc.setTextColor(150); doc.text('Aucun événement en attente pour le mois suivant.', 15, y); y += 8;
  } else {
    doc.setFontSize(8); doc.setTextColor(120);
    doc.text('DATE', 15, y); doc.text('ÉVÉNEMENT', 40, y); doc.text('G.PRÉVU', 130, y, { align: 'right' }); doc.text('C.PRÉVU', 160, y, { align: 'right' }); doc.text('SOLDE PRÉVU', 195, y, { align: 'right' });
    doc.setDrawColor(220); doc.line(15, y + 1.5, 195, y + 1.5); y += 5;
    evsPrev.forEach(ev => {
      if (y > 260) { doc.addPage(); pdfHeader(doc, 'Prévisionnel (suite)'); y = 60; }
      const gP = Number(ev.gains_previsionnel) || 0;
      const cP = Number(ev.budget_previsionnel) || 0;
      const solde = gP - cP;
      totalPrevEv += solde;
      const dateStr = ev.date ? new Date(ev.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';
      doc.setFontSize(9); doc.setTextColor(50);
      doc.text(dateStr, 15, y);
      doc.text((ev.titre || '').slice(0, 45), 40, y);
      doc.setTextColor(34, 197, 94); doc.text('+' + gP.toFixed(2), 130, y, { align: 'right' });
      doc.setTextColor(220, 38, 38); doc.text('-' + cP.toFixed(2), 160, y, { align: 'right' });
      doc.setTextColor(solde >= 0 ? 34 : 220, solde >= 0 ? 197 : 38, solde >= 0 ? 94 : 38);
      doc.text((solde >= 0 ? '+' : '') + solde.toFixed(2), 195, y, { align: 'right' });
      y += 5;
    });
    y += 2;
  }

  y += 4;

  // Section récurrentes actives sur le mois suivant
  doc.setFontSize(11); doc.setFont(undefined, 'bold'); doc.setTextColor(30);
  doc.text('Transactions récurrentes du mois suivant', 15, y);
  doc.setFont(undefined, 'normal');
  y += 4;
  doc.setDrawColor(70); doc.setLineWidth(0.4); doc.line(15, y, 195, y); y += 5;

  // Compte occurrences par récurrente dans le mois suivant
  let totalRecur = 0;
  const recurLignes = [];
  for (const rc of _finRecurrentes) {
    const start = new Date(rc.date_debut + 'T00:00:00');
    const end = rc.date_fin ? new Date(rc.date_fin + 'T00:00:00') : null;
    const occ = new Date(nextStart.getFullYear(), nextStart.getMonth(), rc.jour_du_mois);
    if (occ < start) continue;
    if (end && occ > end) continue;
    if (occ < nextStart || occ > nextEnd) continue;
    const mMois = Number(rc.montant);
    totalRecur += mMois;
    recurLignes.push({ rc, occ, mMois });
  }
  if (!recurLignes.length) {
    doc.setFontSize(9); doc.setTextColor(150); doc.text('Aucune récurrente active le mois suivant.', 15, y); y += 8;
  } else {
    doc.setFontSize(8); doc.setTextColor(120);
    doc.text('DATE', 15, y); doc.text('LIBELLÉ', 40, y); doc.text('CATÉGORIE', 120, y); doc.text('MONTANT', 195, y, { align: 'right' });
    doc.setDrawColor(220); doc.line(15, y + 1.5, 195, y + 1.5); y += 5;
    recurLignes.forEach(({ rc, occ, mMois }) => {
      if (y > 260) { doc.addPage(); pdfHeader(doc, 'Prévisionnel (suite)'); y = 60; }
      const c = FIN_CATEGORIES[rc.categorie] || { label: rc.categorie };
      doc.setFontSize(9); doc.setTextColor(50);
      doc.text(occ.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }), 15, y);
      doc.text((rc.libelle || '').slice(0, 55), 40, y);
      doc.text(c.label, 120, y);
      doc.setTextColor(mMois >= 0 ? 34 : 220, mMois >= 0 ? 197 : 38, mMois >= 0 ? 94 : 38);
      doc.text((mMois >= 0 ? '+' : '') + mMois.toFixed(2) + ' EUR', 195, y, { align: 'right' });
      y += 5;
    });
    y += 2;
  }

  // Sous-total PRÉVISIONNEL UNIQUE (events non validés + récurrentes du mois suivant)
  y += 4;
  doc.setDrawColor(180); doc.setLineWidth(0.3); doc.line(15, y, 195, y); y += 7;
  doc.setFontSize(11); doc.setFont(undefined, 'bold'); doc.setTextColor(60);
  doc.text(`PRÉVISIONNEL UNIQUE (${moisSuivantLabel})`, 15, y);
  const prevUnique = totalPrevEv + totalRecur;
  doc.setTextColor(prevUnique >= 0 ? 34 : 220, prevUnique >= 0 ? 197 : 38, prevUnique >= 0 ? 94 : 38);
  doc.text((prevUnique >= 0 ? '+' : '') + prevUnique.toFixed(2) + ' EUR', 195, y, { align: 'right' });
  doc.setFont(undefined, 'normal');
  y += 8;

  // PRÉVISIONNEL TOTAL = solde du compte actuel + prévisionnel unique
  const soldeActuel = _finSoldeInitial + _finSoldeMoisPrecedents + soldePeriode;
  const prevTotal = soldeActuel + prevUnique;
  doc.setFontSize(9); doc.setTextColor(120);
  doc.text(`Solde actuel du compte : ${soldeActuel.toFixed(2)} EUR (initial ${_finSoldeInitial.toFixed(2)} + cumul ${_finSoldeMoisPrecedents >= 0 ? '+' : ''}${_finSoldeMoisPrecedents.toFixed(2)} + période ${soldePeriode >= 0 ? '+' : ''}${soldePeriode.toFixed(2)})`, 15, y);
  y += 4;
  doc.setDrawColor(30); doc.setLineWidth(0.5); doc.line(15, y, 195, y); y += 7;
  doc.setFontSize(12); doc.setFont(undefined, 'bold'); doc.setTextColor(30);
  doc.text('PRÉVISIONNEL TOTAL (solde projeté fin de mois suivant)', 15, y);
  doc.setTextColor(prevTotal >= 0 ? 34 : 220, prevTotal >= 0 ? 197 : 38, prevTotal >= 0 ? 94 : 38);
  doc.text((prevTotal >= 0 ? '+' : '') + prevTotal.toFixed(2) + ' EUR', 195, y, { align: 'right' });
  doc.setFont(undefined, 'normal');
  pdfFooter(doc);
  // (Page "Vue annuelle" retirée du PDF - visible uniquement dans l'admin)
}

// Snapshot du graphique SVG converti en image, ajouté en page 5
async function pdfAjouterGraphique(doc) {
  doc.addPage();
  pdfHeader(doc, 'Vue annuelle - Recettes vs Dépenses');
  const sel = document.getElementById('fin-courbe-annee');
  if (sel) {
    doc.setFontSize(10); doc.setTextColor(110);
    doc.text('Année scolaire ' + sel.value + ' – ' + (parseInt(sel.value, 10) + 1), 15, 62);
  }
  const svg = document.querySelector('#fin-courbe-svg svg');
  if (!svg) {
    doc.setFontSize(12); doc.setTextColor(150);
    doc.text('Graphique non disponible.', 105, 100, { align: 'center' });
    pdfFooter(doc);
    return;
  }
  try {
    const xml = new XMLSerializer().serializeToString(svg);
    const svg64 = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)));
    const img = new Image();
    img.src = svg64;
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
    const canvas = document.createElement('canvas');
    const scale = 2;
    canvas.width = 1600; canvas.height = 700;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const png = canvas.toDataURL('image/png');
    // Cadre A4 (largeur 210mm - marges 15mm) → 180mm large ; ratio conservé
    const imgW = 180, imgH = imgW * (canvas.height / canvas.width);
    doc.addImage(png, 'PNG', 15, 72, imgW, imgH);
    // Légende
    let y = 72 + imgH + 8;
    doc.setFontSize(9); doc.setTextColor(80);
    doc.setFillColor(34, 197, 94); doc.rect(15, y - 3, 4, 4, 'F');
    doc.text('Recettes (transactions + récurrentes + events validés)', 22, y);
    y += 6;
    doc.setFillColor(220, 38, 38); doc.rect(15, y - 3, 4, 4, 'F');
    doc.text('Dépenses (transactions + récurrentes + events validés)', 22, y);
    y += 6;
    doc.setDrawColor(37, 99, 235); doc.setLineWidth(0.6); doc.line(15, y - 1, 19, y - 1);
    doc.setTextColor(80); doc.text('Solde cumulé (démarre au solde initial ' + _finSoldeInitial.toFixed(2) + ' €)', 22, y);
  } catch (e) {
    doc.setFontSize(11); doc.setTextColor(150);
    doc.text('Impossible de générer le graphique : ' + (e.message || e), 105, 100, { align: 'center' });
  }
  pdfFooter(doc);
}


async function pdfChargerEvenements(debut, fin) {
  const debutStr = debut.toISOString().slice(0, 10);
  const finStr = fin.toISOString().slice(0, 10);
  try {
    const { data } = await window.Auth.sb.from('finance_evenements').select('*').gte('date', debutStr).lte('date', finStr).order('date');
    return data || [];
  } catch (_) { return []; }
}

function pdfHeader(doc, titre) {
  // Logo à gauche (non encadré) - JPEG blanc pour éviter fond noir
  if (_logoDataUrl) {
    try { doc.addImage(_logoDataUrl, 'JPEG', 15, 12, 22, 22); } catch (_) {}
  }
  // Coordonnées BDE à droite
  doc.setFontSize(11); doc.setTextColor(30); doc.setFont(undefined, 'bold');
  doc.text('BDE CREAD LYON', 195, 16, { align: 'right' });
  doc.setFont(undefined, 'normal');
  doc.setFontSize(8); doc.setTextColor(110);
  doc.text('232 Rue Paul Bert, 69003 Lyon', 195, 21, { align: 'right' });
  doc.text('bdecreadien@gmail.com', 195, 25, { align: 'right' });
  doc.text('bdecreadien.fr', 195, 29, { align: 'right' });
  // Trait sous le header
  doc.setDrawColor(70,1,134); doc.setLineWidth(0.8);
  doc.line(15, 40, 195, 40);
  doc.setLineWidth(0.2);
  // Titre du rapport
  doc.setFontSize(16); doc.setTextColor(30); doc.setFont(undefined, 'bold');
  doc.text(titre.toUpperCase(), 15, 50);
  doc.setFont(undefined, 'normal');
}

function pdfFooter(doc) {
  const h = doc.internal.pageSize.getHeight();
  doc.setDrawColor(220); doc.setLineWidth(0.2);
  doc.line(15, h - 12, 195, h - 12);
  doc.setFontSize(8); doc.setTextColor(140);
  doc.text('BDE CREAD Lyon · 232 Rue Paul Bert, 69003 Lyon · bdecreadien@gmail.com', 105, h - 6, { align: 'center' });
}

function pdfFilename(prefix) {
  const d1 = _finDateDebut.toISOString().slice(0, 10);
  const d2 = _finDateFin.toISOString().slice(0, 10);
  return `bde-cread-${prefix}-${d1}-au-${d2}.pdf`;
}

