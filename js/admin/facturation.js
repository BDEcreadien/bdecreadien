/* BDE Admin — module facturation
   Extrait tel quel de admin.html (scripts classiques, portée globale partagée). */
// ============================================================================
// FACTURATION
// ============================================================================
const FAC_EMETTEUR_DEFAUT = {
  nom: 'Bureau Des Etudiants Créadien',
  rna: 'Numéro RNA : W691100565',
  adresse: 'CREAD,\n232 Rue Paul Bert,\n69003, Lyon 3e, FRANCE',
  intitule: 'BDE Créadien\n232 Rue Paul Bert\n69003, Lyon',
  domiciliation: 'Code banque : 13825\nCode guichet : 00200\nNuméro de compte : 08014344104\nClé RIB : 76\nIBAN : FR76 1382 5002 0008 0143 4410 476\nCode BIC - code SWIFT : CEPAFRPP382',
  mode: 'Chèque ou Virement',
  tva: 'TVA non applicable, article 293 B du Code de Général des Impôts.',
  legal: "Association Loi 1901 enregistrée - Num RNA : W691100565\nEn cas de retard de paiement sera exigible, conformément à l'article L 441-10 du Code de Commerce, une pénalité de retard de 10%, ainsi qu'une indémnité forfaitaire pour frais de recouvrement de 40 €.\nAucun escompte ne sera accordé en cas de paiement anticipé."
};
let _facEmetteur = { ...FAC_EMETTEUR_DEFAUT };
let _facCourante = null;
let _facListe = [];

function facAnneeScolaire(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  const y = d.getFullYear(), m = d.getMonth() + 1;
  const start = m >= 9 ? y : y - 1;
  return String(start).slice(-2) + String(start + 1).slice(-2);
}
function facFmtMontant(n) {
  const v = Number(n) || 0;
  if (Number.isInteger(v)) return v.toLocaleString('fr-FR') + ' €';
  return v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}
function facFmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function facEscapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function facLoadEmetteur() {
  try {
    const { data } = await Auth.sb.from('bde_config').select('value').eq('id', 'facture_emetteur').maybeSingle();
    if (data && data.value) {
      _facEmetteur = { ...FAC_EMETTEUR_DEFAUT, ...(typeof data.value === 'string' ? JSON.parse(data.value) : data.value) };
    }
  } catch (_) {}
}
async function facSaveEmetteurToDb() {
  const profil = await Auth.getProfil();
  const { error } = await Auth.sb.from('bde_config').upsert({
    id: 'facture_emetteur', value: _facEmetteur, updated_at: new Date().toISOString(), updated_by: profil?.id || null
  });
  if (error) { showToast('Erreur : ' + error.message, 'error'); return false; }
  return true;
}

async function initFactures() {
  await facLoadEmetteur();
  await facChargerListe();
  document.getElementById('fac-view-list').style.display = '';
  document.getElementById('fac-view-edit').style.display = 'none';
  document.getElementById('fac-view-params').style.display = 'none';
}

async function facChargerListe() {
  const { data, error } = await Auth.sb.from('factures')
    .select('*').order('date_facturation', { ascending: false }).order('numero', { ascending: false });
  const wrap = document.getElementById('fac-list-content');
  if (error) { wrap.innerHTML = `<div style="padding:20px;color:#dc2626;">Erreur : ${facEscapeHtml(error.message)}</div>`; return; }
  _facListe = data || [];
  if (!_facListe.length) { wrap.innerHTML = `<div style="padding:24px;text-align:center;color:#999;font-size:13px;">Aucune facture. Clique sur « + Nouvelle facture ».</div>`; return; }
  wrap.innerHTML = _facListe.map(f => `
    <div class="fac-row">
      <div style="font-weight:600;">${facEscapeHtml(f.numero)}</div>
      <div>${facFmtDate(f.date_facturation)}</div>
      <div style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${facEscapeHtml(f.client_nom || '-')}</div>
      <div style="text-align:right;font-weight:600;">${facFmtMontant(f.total_ttc)}</div>
      <div class="fac-row-actions" style="justify-content:flex-end;">
        <button onclick="facOuvrir('${f.id}')">Ouvrir</button>
        ${f.pdf_path ? `<button onclick="facTelechargerPdfExistant('${f.id}')">PDF</button>` : ''}
        <button class="btn-del" onclick="facSupprimer('${f.id}')">Suppr.</button>
      </div>
    </div>`).join('');
}

async function facProchainNumero(annee) {
  const { data } = await Auth.sb.from('factures').select('numero').eq('annee_scolaire', annee);
  const nums = (data || []).map(r => parseInt((r.numero.split('-')[1] || '0'), 10)).filter(n => !isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `${annee}-${String(next).padStart(3, '0')}`;
}

async function facNouvelle() {
  const today = new Date().toISOString().slice(0, 10);
  const annee = facAnneeScolaire(today);
  const numero = await facProchainNumero(annee);
  _facCourante = {
    id: null, numero, annee_scolaire: annee, date_facturation: today, date_echeance: 'x',
    client_nom: '', client_ligne1: '', client_ligne2: '', client_ligne3: '',
    lignes: [{ intitule: '', montant: 0 }],
    total_ttc: 0, mode_paiement: _facEmetteur.mode, emetteur: { ..._facEmetteur }
  };
  facRemplirEditor();
  document.getElementById('fac-view-list').style.display = 'none';
  document.getElementById('fac-view-edit').style.display = '';
  document.getElementById('fac-e-titre').textContent = 'Facture ' + numero + ' (nouvelle)';
  document.getElementById('fac-e-del-btn').style.display = 'none';
}

async function facOuvrir(id) {
  const f = _facListe.find(x => x.id === id);
  if (!f) return;
  _facCourante = {
    ...f,
    lignes: Array.isArray(f.lignes) ? f.lignes : (typeof f.lignes === 'string' ? JSON.parse(f.lignes) : []),
    emetteur: (f.emetteur && Object.keys(f.emetteur).length) ? f.emetteur : { ..._facEmetteur }
  };
  if (!_facCourante.lignes.length) _facCourante.lignes = [{ intitule: '', montant: 0 }];
  facRemplirEditor();
  document.getElementById('fac-view-list').style.display = 'none';
  document.getElementById('fac-view-edit').style.display = '';
  document.getElementById('fac-e-titre').textContent = 'Facture ' + f.numero;
  document.getElementById('fac-e-del-btn').style.display = '';
}

function facRemplirEditor() {
  const f = _facCourante, e = f.emetteur || _facEmetteur;
  document.getElementById('fac-e-date').value = f.date_facturation;
  document.getElementById('fac-e-echeance').value = f.date_echeance || '';
  document.getElementById('fac-e-mode').value = f.mode_paiement || e.mode || '';
  document.getElementById('fac-c-numero').textContent = f.numero;
  document.getElementById('fac-c-date').textContent = facFmtDate(f.date_facturation);
  document.getElementById('fac-c-emetteur-nom').textContent = e.nom || '';
  document.getElementById('fac-c-emetteur-rna').textContent = e.rna || '';
  document.getElementById('fac-c-emetteur-adresse').innerHTML = facEscapeHtml(e.adresse || '').replace(/\n/g, '<br>');
  document.getElementById('fac-c-client-nom').textContent = f.client_nom || '';
  document.getElementById('fac-c-client-l1').textContent = f.client_ligne1 || '';
  document.getElementById('fac-c-client-l2').textContent = f.client_ligne2 || '';
  document.getElementById('fac-c-client-l3').textContent = f.client_ligne3 || '';
  document.getElementById('fac-c-intitule').textContent = e.intitule || '';
  document.getElementById('fac-c-domiciliation').textContent = e.domiciliation || '';
  document.getElementById('fac-c-tva').textContent = e.tva || '';
  document.getElementById('fac-c-echeance').textContent = f.date_echeance || '';
  document.getElementById('fac-c-mode').textContent = f.mode_paiement || '';
  document.getElementById('fac-c-legal').innerHTML = facEscapeHtml(e.legal || '').replace(/\n/g, '<br>');
  facRenderLignes();
  facRecalcTotaux();

  // Écoute des zones éditables
  document.getElementById('fac-c-client-nom').oninput = e2 => f.client_nom = e2.target.innerText.trim();
  document.getElementById('fac-c-client-l1').oninput = e2 => f.client_ligne1 = e2.target.innerText.trim();
  document.getElementById('fac-c-client-l2').oninput = e2 => f.client_ligne2 = e2.target.innerText.trim();
  document.getElementById('fac-c-client-l3').oninput = e2 => f.client_ligne3 = e2.target.innerText.trim();
  document.getElementById('fac-e-date').onchange = e2 => { f.date_facturation = e2.target.value; document.getElementById('fac-c-date').textContent = facFmtDate(f.date_facturation); };
  document.getElementById('fac-e-echeance').oninput = e2 => { f.date_echeance = e2.target.value; document.getElementById('fac-c-echeance').textContent = f.date_echeance; };
  document.getElementById('fac-e-mode').oninput = e2 => { f.mode_paiement = e2.target.value; document.getElementById('fac-c-mode').textContent = f.mode_paiement; };
}

function facRenderLignes() {
  const tb = document.getElementById('fac-c-lignes');
  tb.innerHTML = _facCourante.lignes.map((l, i) => `
    <tr>
      <td><div contenteditable="true" data-idx="${i}" data-champ="intitule" data-placeholder="Désignation" style="white-space:pre-wrap;">${facEscapeHtml(l.intitule || '')}</div></td>
      <td class="right"><span style="display:inline-flex;align-items:baseline;gap:4px;justify-content:flex-end;"><span contenteditable="true" data-idx="${i}" data-champ="montant" data-placeholder="0" style="text-align:right;min-width:28px;display:inline-block;">${l.montant ? String(l.montant).replace('.', ',') : ''}</span><span style="color:#333;">€</span></span></td>
      <td class="action">${_facCourante.lignes.length > 1 ? `<button onclick="facSupprimerLigne(${i})" title="Supprimer">✕</button>` : ''}</td>
    </tr>`).join('');
  tb.querySelectorAll('[contenteditable="true"]').forEach(el => {
    el.oninput = () => {
      const idx = parseInt(el.dataset.idx, 10);
      const champ = el.dataset.champ;
      const val = el.innerText.trim();
      if (champ === 'montant') {
        _facCourante.lignes[idx].montant = parseFloat(val.replace(/\s/g, '').replace(',', '.')) || 0;
        facRecalcTotaux();
      } else {
        _facCourante.lignes[idx].intitule = val;
      }
    };
  });
}
function facAjouterLigne() {
  _facCourante.lignes.push({ intitule: '', montant: 0 });
  facRenderLignes(); facRecalcTotaux();
}
function facSupprimerLigne(idx) {
  if (_facCourante.lignes.length <= 1) return;
  _facCourante.lignes.splice(idx, 1);
  facRenderLignes(); facRecalcTotaux();
}
function facRecalcTotaux() {
  const total = _facCourante.lignes.reduce((s, l) => s + (Number(l.montant) || 0), 0);
  _facCourante.total_ttc = total;
  const s = facFmtMontant(total);
  document.getElementById('fac-c-total-1').textContent = s;
  document.getElementById('fac-c-total-2').textContent = s;
}

async function facEnregistrer() {
  const f = _facCourante;
  if (!f.client_nom || !f.client_nom.trim()) { showToast('Renseigne au moins le nom du client.', 'error'); return; }
  const payload = {
    numero: f.numero,
    annee_scolaire: f.annee_scolaire,
    date_facturation: f.date_facturation,
    date_echeance: f.date_echeance || null,
    client_nom: f.client_nom,
    client_ligne1: f.client_ligne1 || '',
    client_ligne2: f.client_ligne2 || '',
    client_ligne3: f.client_ligne3 || '',
    lignes: f.lignes,
    total_ttc: f.total_ttc,
    mode_paiement: f.mode_paiement,
    emetteur: f.emetteur
  };
  let error, saved;
  if (f.id) {
    ({ data: saved, error } = await Auth.sb.from('factures').update(payload).eq('id', f.id).select().single());
  } else {
    const profil = await Auth.getProfil();
    payload.created_by = profil?.id || null;
    ({ data: saved, error } = await Auth.sb.from('factures').insert(payload).select().single());
  }
  if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
  _facCourante.id = saved.id;
  showToast('Facture enregistrée', 'success');
  // Génère et upload le PDF
  try {
    const blob = await facGenererPdfBlob();
    const path = `${f.annee_scolaire}/${f.numero}.pdf`;
    const { error: upErr } = await Auth.sb.storage.from('factures').upload(path, blob, { contentType: 'application/pdf', upsert: true });
    if (!upErr) {
      await Auth.sb.from('factures').update({ pdf_path: path }).eq('id', saved.id);
    }
  } catch (e) { console.warn('PDF upload failed', e); }
  await facChargerListe();
}

async function facSupprimerCourante() {
  if (!_facCourante || !_facCourante.id) return;
  return facSupprimer(_facCourante.id, true);
}
async function facSupprimer(id, revenirListe = false) {
  const f = _facListe.find(x => x.id === id) || _facCourante;
  if (!confirm(`Supprimer la facture ${f?.numero || ''} ? Cette action est irréversible.`)) return;
  if (f?.pdf_path) { try { await Auth.sb.storage.from('factures').remove([f.pdf_path]); } catch (_) {} }
  const { error } = await Auth.sb.from('factures').delete().eq('id', id);
  if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
  showToast('Facture supprimée', 'success');
  if (revenirListe) facBackToList(); else await facChargerListe();
}

function facBackToList() {
  _facCourante = null;
  document.getElementById('fac-view-list').style.display = '';
  document.getElementById('fac-view-edit').style.display = 'none';
  document.getElementById('fac-view-params').style.display = 'none';
  facChargerListe();
}

// ---------- Paramètres émetteur ----------
async function facOpenParams() {
  await facLoadEmetteur();
  document.getElementById('fac-p-nom').value = _facEmetteur.nom || '';
  document.getElementById('fac-p-rna').value = _facEmetteur.rna || '';
  document.getElementById('fac-p-adresse').value = _facEmetteur.adresse || '';
  document.getElementById('fac-p-intitule').value = _facEmetteur.intitule || '';
  document.getElementById('fac-p-domiciliation').value = _facEmetteur.domiciliation || '';
  document.getElementById('fac-p-mode').value = _facEmetteur.mode || '';
  document.getElementById('fac-p-tva').value = _facEmetteur.tva || '';
  document.getElementById('fac-p-legal').value = _facEmetteur.legal || '';
  document.getElementById('fac-view-list').style.display = 'none';
  document.getElementById('fac-view-edit').style.display = 'none';
  document.getElementById('fac-view-params').style.display = '';
}
async function facSaveParams() {
  _facEmetteur = {
    nom: document.getElementById('fac-p-nom').value.trim(),
    rna: document.getElementById('fac-p-rna').value.trim(),
    adresse: document.getElementById('fac-p-adresse').value,
    intitule: document.getElementById('fac-p-intitule').value,
    domiciliation: document.getElementById('fac-p-domiciliation').value,
    mode: document.getElementById('fac-p-mode').value.trim(),
    tva: document.getElementById('fac-p-tva').value.trim(),
    legal: document.getElementById('fac-p-legal').value
  };
  if (await facSaveEmetteurToDb()) {
    showToast('Paramètres enregistrés', 'success');
    facBackToList();
  }
}

// ---------- PDF ----------
let _facHtml2CanvasLoaded = false;
function facLoadHtml2Canvas() {
  return new Promise((resolve, reject) => {
    if (_facHtml2CanvasLoaded || window.html2canvas) { _facHtml2CanvasLoaded = true; resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
    s.onload = () => { _facHtml2CanvasLoaded = true; resolve(); };
    s.onerror = () => reject(new Error('html2canvas load failed'));
    document.head.appendChild(s);
  });
}

async function facGenererPdfBlob() {
  await loadJsPdf();
  await facLoadHtml2Canvas();
  const { jsPDF } = window.jspdf;
  const canvasEl = document.getElementById('fac-canvas');
  canvasEl.classList.add('fac-pdf-mode');
  try {
    const canvas = await window.html2canvas(canvasEl, {
      scale: 3,
      backgroundColor: '#ffffff',
      useCORS: true,
      letterRendering: true,
      windowWidth: canvasEl.scrollWidth
    });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;
    if (imgH <= pageH) {
      pdf.addImage(imgData, 'PNG', 0, 0, imgW, imgH, undefined, 'FAST');
    } else {
      let pos = 0;
      while (pos < imgH) {
        pdf.addImage(imgData, 'PNG', 0, -pos, imgW, imgH, undefined, 'FAST');
        pos += pageH;
        if (pos < imgH) pdf.addPage();
      }
    }
    return pdf.output('blob');
  } finally {
    canvasEl.classList.remove('fac-pdf-mode');
  }
}

async function facTelechargerPdf() {
  try {
    const blob = await facGenererPdfBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Facture_${_facCourante.numero}.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (e) { showToast('Erreur PDF : ' + e.message, 'error'); }
}

