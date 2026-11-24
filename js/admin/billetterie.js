/* BDE Admin — module billetterie
   Extrait tel quel de admin.html (scripts classiques, portée globale partagée). */
// ============================================================================
// BILLETTERIE
// ============================================================================
let _bilCourante = null, _bilListe = [];

async function initBilletterie() {
  document.getElementById('bil-view-list').style.display = '';
  document.getElementById('bil-view-edit').style.display = 'none';
  await bilChargerListe();
}

async function bilChargerListe() {
  const wrap = document.getElementById('bil-list-content');
  const { data, error } = await Auth.sb.from('billetteries').select('*').order('created_at', { ascending: false });
  if (error) { wrap.innerHTML = `<div style="padding:20px;color:#dc2626;">Erreur : ${escapeHtml(error.message)}</div>`; return; }
  _bilListe = data || [];
  if (!_bilListe.length) {
    wrap.innerHTML = `
      <div class="bil-empty">
        <div style="font-size:48px;margin-bottom:12px;">🎟️</div>
        <h3>Aucune billetterie pour l'instant</h3>
        <p>Clique sur « + Nouvelle billetterie » pour créer ta première page de vente.</p>
      </div>`;
    return;
  }
  wrap.innerHTML = `<div class="bil-list-grid">${_bilListe.map(b => {
    const tarifs = Array.isArray(b.tarifs) ? b.tarifs : (typeof b.tarifs === 'string' ? JSON.parse(b.tarifs) : []);
    const min = tarifs.length ? Math.min(...tarifs.map(t => t.prix_centimes)) : 0;
    const max = tarifs.length ? Math.max(...tarifs.map(t => t.prix_centimes)) : 0;
    const prixTxt = tarifs.length ? (min === max ? `${(min/100).toFixed(0)}€` : `${(min/100).toFixed(0)}€–${(max/100).toFixed(0)}€`) : '-';
    const publicUrl = `${location.origin}/billetterie/${b.slug}`;
    const nbTarifs = tarifs.length;
    return `
      <div class="bil-item">
        <div class="bil-item-header">
          <span class="bil-status ${b.actif ? 'actif' : 'inactif'}">${b.actif ? '● Active' : '○ Inactive'}</span>
          <h3 class="bil-item-title">${escapeHtml(b.titre)}</h3>
          <div class="bil-item-meta">
            ${b.date_affiche ? `<span>${escapeHtml(b.date_affiche)}</span>` : ''}
            ${b.lieu_affiche ? `<span>${escapeHtml(b.lieu_affiche)}</span>` : ''}
            <span>💰 ${prixTxt}</span>
            <span>🎟️ ${nbTarifs} tarif${nbTarifs > 1 ? 's' : ''}</span>
          </div>
        </div>
        <div class="bil-item-body">
          <div class="bil-url-box">
            <span class="bil-url" title="${escapeHtml(publicUrl)}">${escapeHtml(publicUrl)}</span>
            <button onclick="bilCopierLien('${escapeHtml(publicUrl)}', this)" title="Copier le lien">📋 Copier</button>
            <a href="${escapeHtml(publicUrl)}" target="_blank" title="Ouvrir dans un nouvel onglet">↗ Ouvrir</a>
          </div>
          <div class="bil-item-actions">
            <button class="primary" onclick="bilOuvrir('${b.id}')">✏️ Modifier</button>
            <button onclick="bilVoirParticipants('${b.id}', '${escapeHtml(b.titre)}')">👥 Participants</button>
          </div>
        </div>
      </div>`;
  }).join('')}</div>`;
}

async function bilCopierLien(url, btn) {
  try {
    await navigator.clipboard.writeText(url);
    const original = btn.innerHTML;
    btn.innerHTML = '✓ Copié !';
    btn.style.background = '#dcfce7';
    btn.style.color = '#166534';
    btn.style.borderColor = '#86efac';
    setTimeout(() => {
      btn.innerHTML = original;
      btn.style.background = '';
      btn.style.color = '';
      btn.style.borderColor = '';
    }, 1500);
  } catch (e) {
    showToast('Impossible de copier - copie manuellement le lien', 'error');
  }
}

function bilNouvelle() {
  _bilCourante = {
    id: null, slug: '', hello_asso_form_slug: '', titre: '',
    date_affiche: '', lieu_affiche: '', description: '',
    max_par_acheteur: 4, places_max: null, cta_texte: 'Payer ma place', actif: true,
    places_restantes_visible: false, places_restantes_seuil: null, places_restantes_mode: 'exact',
    tarifs: [{ id: 'standard', nom: 'Standard', desc: '', prix_centimes: 1500 }]
  };
  bilRemplirEditor();
  document.getElementById('bil-view-list').style.display = 'none';
  document.getElementById('bil-view-edit').style.display = '';
  document.getElementById('bil-e-titre').textContent = 'Nouvelle billetterie';
  document.getElementById('bil-e-del-btn').style.display = 'none';
}

async function bilOuvrir(id) {
  const b = _bilListe.find(x => x.id === id);
  if (!b) return;
  _bilCourante = {
    ...b,
    tarifs: Array.isArray(b.tarifs) ? b.tarifs : (typeof b.tarifs === 'string' ? JSON.parse(b.tarifs) : [])
  };
  if (!_bilCourante.tarifs.length) _bilCourante.tarifs = [{ id: 'standard', nom: 'Standard', desc: '', prix_centimes: 1500 }];
  bilRemplirEditor();
  document.getElementById('bil-view-list').style.display = 'none';
  document.getElementById('bil-view-edit').style.display = '';
  document.getElementById('bil-e-titre').textContent = 'Modifier : ' + b.titre;
  document.getElementById('bil-e-del-btn').style.display = '';
}

function bilRemplirEditor() {
  const b = _bilCourante;
  document.getElementById('bil-e-slug').value = b.slug || '';
  document.getElementById('bil-e-ha-slug').value = b.hello_asso_form_slug || '';
  document.getElementById('bil-e-titre-page').value = b.titre || '';
  document.getElementById('bil-e-date').value = b.date_affiche || '';
  document.getElementById('bil-e-lieu').value = b.lieu_affiche || '';
  document.getElementById('bil-e-desc').value = b.description || '';
  document.getElementById('bil-e-max').value = b.max_par_acheteur || 4;
  document.getElementById('bil-e-places-max').value = b.places_max || '';
  document.getElementById('bil-e-cta').value = b.cta_texte || 'Payer ma place';
  document.getElementById('bil-e-pr-visible').checked = !!b.places_restantes_visible;
  document.getElementById('bil-e-pr-seuil').value = b.places_restantes_seuil || '';
  document.getElementById('bil-e-pr-mode').value = b.places_restantes_mode || 'exact';
  document.getElementById('bil-e-pr-options').style.display = b.places_restantes_visible ? '' : 'none';
  document.getElementById('bil-e-actif').checked = !!b.actif;
  // Formulaire participants
  const fc = b.formulaire_champs || {};
  document.getElementById('bil-fc-tel').checked = fc.tel !== false;
  document.getElementById('bil-fc-tel-req').value = fc.tel_required ? '1' : '0';
  document.getElementById('bil-fc-classe').checked = !!fc.classe;
  document.getElementById('bil-fc-classe-req').value = fc.classe_required ? '1' : '0';
  document.getElementById('bil-fc-classe-opts').style.display = fc.classe ? '' : 'none';
  document.getElementById('bil-fc-classe-label').value = fc.classe_label || '';
  document.getElementById('bil-fc-suggestions').checked = !!fc.suggestions;
  document.getElementById('bil-fc-suggestions-req').value = fc.suggestions_required ? '1' : '0';
  document.getElementById('bil-fc-suggestions-opts').style.display = fc.suggestions ? '' : 'none';
  document.getElementById('bil-fc-suggestions-label').value = fc.suggestions_label || '';
  _bilFcCustomFields = (fc.custom_fields || []).map(f => ({...f}));
  bilFcRenderCustom();
  const urlPrev = document.getElementById('bil-e-url-preview');
  if (urlPrev) urlPrev.textContent = b.slug ? `${location.origin}/billetterie/${b.slug}` : '-';
  bilRenderTarifs();
  bilPromoCharger(b.slug);
  bilRefreshPreview();
}

function bilRenderTarifs() {
  const wrap = document.getElementById('bil-e-tarifs');
  wrap.innerHTML = _bilCourante.tarifs.map((t, i) => `
    <div class="bil-tarif">
      <div>
        <input placeholder="Nom du tarif" value="${escapeHtml(t.nom || '')}" oninput="bilTarifChange(${i}, 'nom', this.value)" style="width:100%;margin-bottom:4px;">
        <input placeholder="Description (facultative)" value="${escapeHtml(t.desc || '')}" oninput="bilTarifChange(${i}, 'desc', this.value)" style="width:100%;">
      </div>
      <div>
        <input type="number" min="1" placeholder="Prix €" value="${(t.prix_centimes || 0) / 100}" oninput="bilTarifChange(${i}, 'prix_euros', this.value)" style="width:100%;">
      </div>
      <button class="del" onclick="bilSupprimerTarif(${i})" ${_bilCourante.tarifs.length <= 1 ? 'disabled' : ''}>✕</button>
    </div>
  `).join('');
}

function bilTarifChange(idx, champ, val) {
  const t = _bilCourante.tarifs[idx];
  if (champ === 'prix_euros') t.prix_centimes = Math.round(parseFloat(val || '0') * 100);
  else t[champ] = val;
  if (champ === 'nom') t.id = (val || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tarif';
  bilOnChange();
}
function bilAjouterTarif() {
  _bilCourante.tarifs.push({ id: 'tarif-' + (_bilCourante.tarifs.length + 1), nom: 'Nouveau tarif', desc: '', prix_centimes: 1000 });
  bilRenderTarifs(); bilOnChange();
}
function bilSupprimerTarif(idx) {
  if (_bilCourante.tarifs.length <= 1) return;
  _bilCourante.tarifs.splice(idx, 1);
  bilRenderTarifs(); bilOnChange();
}

function bilFcToggle(field, checked) {
  document.getElementById(`bil-fc-${field}-opts`).style.display = checked ? '' : 'none';
  bilOnChange();
}

let _bilFcCustomFields = [];

function bilFcRenderCustom() {
  const wrap = document.getElementById('bil-fc-custom-list');
  if (!wrap) return;
  wrap.innerHTML = _bilFcCustomFields.map((f, i) => {
    const isChoice = f.type === 'choice';
    return `
    <div style="background:#f8fafc;border:1.5px solid #e8eef6;border-radius:12px;padding:10px 12px;margin-bottom:8px;">
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:${isChoice ? '8px' : '0'}">
        <input value="${escapeHtml(f.label)}" placeholder="Libellé (ex: Choix de pizza)"
          style="flex:2;min-width:140px;padding:6px 10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;outline:none;"
          oninput="_bilFcCustomFields[${i}].label=this.value;bilOnChange()">
        <select onchange="_bilFcCustomFields[${i}].type=this.value;bilFcRenderCustom();bilOnChange()"
          style="font-size:12px;padding:6px 8px;border-radius:8px;border:1.5px solid #e2e8f0;background:white;cursor:pointer;font-weight:600;color:#2563eb;">
          <option value="text" ${!isChoice?'selected':''}>Texte libre</option>
          <option value="choice" ${isChoice?'selected':''}>Choix (liste)</option>
        </select>
        <select onchange="_bilFcCustomFields[${i}].required=this.value==='1';bilOnChange()"
          style="font-size:12px;padding:6px 8px;border-radius:8px;border:1.5px solid #e2e8f0;background:white;">
          <option value="0" ${f.required?'':'selected'}>Facultatif</option>
          <option value="1" ${f.required?'selected':''}>Obligatoire</option>
        </select>
        <button type="button" onclick="bilFcRemoveCustom(${i})"
          style="background:none;border:1.5px solid #fca5a5;color:#dc2626;border-radius:8px;padding:5px 10px;cursor:pointer;font-weight:700;">✕</button>
      </div>
      ${isChoice ? `
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="font-size:11px;font-weight:700;color:#888;white-space:nowrap;">Options :</span>
        <input value="${escapeHtml((f.options||[]).join(', '))}" placeholder="ex: Margherita, 4 fromages, Végétarienne"
          style="flex:1;padding:6px 10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;outline:none;"
          oninput="_bilFcCustomFields[${i}].options=this.value.split(',').map(s=>s.trim()).filter(Boolean);bilOnChange()">
      </div>` : ''}
    </div>`;
  }).join('');
}

function bilFcAddCustom() {
  _bilFcCustomFields.push({ label: '', type: 'text', placeholder: '' });
  bilFcRenderCustom();
}

function bilFcRemoveCustom(i) {
  _bilFcCustomFields.splice(i, 1);
  bilFcRenderCustom();
  bilOnChange();
}

// ── Codes promo ──────────────────────────────────
let _bilPromos = []; // { id, code, type, valeur, max_utilisations, nb_utilisations, actif, _new, _deleted }
let _bilPromoSlug = null;

async function bilPromoCharger(slug) {
  _bilPromoSlug = slug;
  document.getElementById('bil-promo-list').innerHTML = '';
  document.getElementById('bil-promo-msg').textContent = '';
  if (!slug) return;
  const { data } = await Auth.sb.from('billetterie_codes_promo').select('*').eq('billetterie_slug', slug).order('created_at');
  _bilPromos = (data || []).map(r => ({ ...r, valeur: r.type === 'fixed' ? r.valeur / 100 : r.valeur }));
  bilPromoRender();
}

function bilPromoRender() {
  const list = document.getElementById('bil-promo-list');
  const btn = document.getElementById('bil-promo-save-btn');
  if (!_bilPromos.length) { list.innerHTML = '<div style="font-size:13px;color:#aaa;padding:4px 0;">Aucun code pour cet événement.</div>'; btn.style.display = 'none'; return; }
  btn.style.display = '';
  list.innerHTML = _bilPromos.map((p, i) => p._deleted ? '' : `
    <div style="display:flex;gap:8px;align-items:center;background:#f8fafc;border-radius:10px;padding:10px 12px;flex-wrap:wrap;">
      <input value="${escapeHtml(p.code)}" placeholder="CODE" oninput="_bilPromos[${i}].code=this.value.toUpperCase().replace(/\\s/g,'');this.value=_bilPromos[${i}].code;"
        style="width:110px;padding:7px 10px;border-radius:8px;border:1.5px solid #e2e8f0;font-size:13px;font-weight:700;text-transform:uppercase;">
      <select onchange="_bilPromos[${i}].type=this.value;bilPromoRender()" style="padding:7px 10px;border-radius:8px;border:1.5px solid #e2e8f0;font-size:13px;">
        <option value="percent" ${p.type==='percent'?'selected':''}>%</option>
        <option value="fixed"   ${p.type==='fixed'?'selected':''}>€</option>
      </select>
      <input type="number" min="${p.type==='percent'?1:0.01}" step="${p.type==='percent'?1:0.01}" value="${p.valeur||''}" placeholder="${p.type==='percent'?'50':'2'}" oninput="_bilPromos[${i}].valeur=parseFloat(this.value)||0"
        style="width:70px;padding:7px 10px;border-radius:8px;border:1.5px solid #e2e8f0;font-size:13px;">
      <span style="font-size:11px;color:#888;">max&nbsp;uses</span>
      <input type="number" min="1" value="${p.max_utilisations||''}" placeholder="∞" oninput="_bilPromos[${i}].max_utilisations=parseInt(this.value)||null"
        style="width:60px;padding:7px 10px;border-radius:8px;border:1.5px solid #e2e8f0;font-size:13px;">
      ${p.nb_utilisations ? `<span style="font-size:11px;color:#888;">${p.nb_utilisations} utilisé${p.nb_utilisations>1?'s':''}</span>` : ''}
      <button onclick="bilPromoSupprimer(${i})" style="margin-left:auto;background:#fee2e2;color:#dc2626;border:none;border-radius:8px;padding:6px 10px;cursor:pointer;font-size:12px;font-weight:700;">✕</button>
    </div>`).join('');
}

function bilPromoAjouter() {
  _bilPromos.push({ id: null, code: '', type: 'percent', valeur: 50, max_utilisations: null, nb_utilisations: 0, actif: true, _new: true });
  bilPromoRender();
  document.getElementById('bil-promo-save-btn').style.display = '';
}

function bilPromoSupprimer(i) {
  if (_bilPromos[i]._new) _bilPromos.splice(i, 1);
  else _bilPromos[i]._deleted = true;
  bilPromoRender();
}

async function bilPromoSauvegarder() {
  if (!_bilPromoSlug) return;
  const btn = document.getElementById('bil-promo-save-btn');
  const msg = document.getElementById('bil-promo-msg');
  btn.disabled = true; btn.textContent = 'Enregistrement…';
  const res = await fetch('/api/admin-promo-save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug: _bilPromoSlug, promos: _bilPromos }),
  }).then(r => r.json()).catch(() => ({ error: true }));
  btn.disabled = false; btn.textContent = 'Enregistrer les codes promo';
  const ok = !!res.ok;
  msg.style.color = ok ? '#166534' : '#dc2626';
  msg.textContent = ok ? 'Codes sauvegardés ✓' : 'Erreur lors de la sauvegarde.';
  if (ok) bilPromoCharger(_bilPromoSlug);
}

function bilExtractSlug(raw) {
  // Si c'est une URL (contient ://), on prend le dernier segment de chemin
  if (raw.includes('://') || raw.startsWith('/')) {
    try {
      const url = raw.startsWith('/') ? new URL('http://x' + raw) : new URL(raw);
      const parts = url.pathname.split('/').filter(Boolean);
      raw = parts[parts.length - 1] || raw;
    } catch (_) {
      const m = raw.match(/\/([^/?#]+)\/?$/);
      if (m) raw = m[1];
    }
  }
  return bilSlugify(raw);
}

function bilSlugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // enleve accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function bilOnChange() {
  const b = _bilCourante;
  const titreEl = document.getElementById('bil-e-titre-page');
  const slugEl = document.getElementById('bil-e-slug');
  const haSlugEl = document.getElementById('bil-e-ha-slug');
  const newTitre = titreEl.value;
  const oldTitre = b.titre || '';
  b.titre = newTitre;

  // Auto-génère le slug tant que l'utilisateur n'a pas édité le champ manuellement
  // et qu'on est en création (pas de b.id)
  if (!b.id && !b._slugTouched) {
    const auto = bilSlugify(newTitre);
    slugEl.value = auto;
    b.slug = auto;
    // Auto-remplit aussi le slug HelloAsso s'il est vide (l'utilisateur peut le corriger)
    if (!b._haSlugTouched) {
      haSlugEl.value = auto;
      b.hello_asso_form_slug = auto;
    }
  } else {
    const slugRaw = slugEl.value.trim();
    b.slug = bilExtractSlug(slugRaw);
    if (b.slug !== slugRaw) slugEl.value = b.slug;
    const haRaw = haSlugEl.value.trim();
    const haMatch = haRaw.match(/\/(?:evenements|adhesions|billetteries|billetterie)\/([^/?#]+)/);
    b.hello_asso_form_slug = haMatch ? haMatch[1] : haRaw;
  }

  b.date_affiche = document.getElementById('bil-e-date').value;
  b.lieu_affiche = document.getElementById('bil-e-lieu').value;
  b.description = document.getElementById('bil-e-desc').value;
  b.max_par_acheteur = parseInt(document.getElementById('bil-e-max').value, 10) || 4;
  const pmVal = parseInt(document.getElementById('bil-e-places-max').value, 10);
  b.places_max = pmVal > 0 ? pmVal : null;
  b.cta_texte = document.getElementById('bil-e-cta').value;
  b.places_restantes_visible = document.getElementById('bil-e-pr-visible').checked;
  document.getElementById('bil-e-pr-options').style.display = b.places_restantes_visible ? '' : 'none';
  const prSeuil = parseInt(document.getElementById('bil-e-pr-seuil').value, 10);
  b.places_restantes_seuil = prSeuil > 0 ? prSeuil : null;
  b.places_restantes_mode = document.getElementById('bil-e-pr-mode').value || 'exact';
  b.actif = document.getElementById('bil-e-actif').checked;
  // Formulaire participants
  const fc = {};
  if (!document.getElementById('bil-fc-tel').checked) fc.tel = false;
  else if (document.getElementById('bil-fc-tel-req').value === '1') fc.tel_required = true;
  if (document.getElementById('bil-fc-classe').checked) {
    fc.classe = true;
    if (document.getElementById('bil-fc-classe-req').value === '1') fc.classe_required = true;
    const lbl = document.getElementById('bil-fc-classe-label').value.trim();
    if (lbl) fc.classe_label = lbl;
  }
  if (document.getElementById('bil-fc-suggestions').checked) {
    fc.suggestions = true;
    if (document.getElementById('bil-fc-suggestions-req').value === '1') fc.suggestions_required = true;
    const lbl = document.getElementById('bil-fc-suggestions-label').value.trim();
    if (lbl) fc.suggestions_label = lbl;
  }
  if (_bilFcCustomFields.length) fc.custom_fields = _bilFcCustomFields.filter(f => f.label.trim());
  b.formulaire_champs = fc;
  // Mise à jour du preview URL en direct
  const urlPrev = document.getElementById('bil-e-url-preview');
  if (urlPrev) urlPrev.textContent = b.slug ? `${location.origin}/billetterie/${b.slug}` : '-';
  // Debounce preview iframe
  clearTimeout(window._bilPrevTimer);
  window._bilPrevTimer = setTimeout(bilRefreshPreview, 400);
}

async function bilCopierLienEditor(btn) {
  const url = document.getElementById('bil-e-url-preview').textContent;
  if (!url || url === '-') { showToast('Renseigne un slug d\'abord.', 'error'); return; }
  await bilCopierLien(url, btn);
}

// Marque les champs slug comme "touchés" dès que l'utilisateur les édite
document.addEventListener('input', (e) => {
  if (!_bilCourante) return;
  if (e.target.id === 'bil-e-slug') _bilCourante._slugTouched = true;
  if (e.target.id === 'bil-e-ha-slug') _bilCourante._haSlugTouched = true;
});

function bilRefreshPreview() {
  const iframe = document.getElementById('bil-preview');
  const b = _bilCourante;
  // Envoie la config via postMessage à la page billetterie (mode preview)
  const cfg = encodeURIComponent(JSON.stringify(b));
  iframe.src = `/ticket.html?preview=${cfg}`;
}

function bilPreviewInNewTab() {
  if (!_bilCourante?.slug) { showToast('Renseigne un slug d\'abord.', 'error'); return; }
  window.open(`/billetterie/${_bilCourante.slug}`, '_blank');
}

async function bilEnregistrer() {
  const b = _bilCourante;
  if (!b) return;
  // Nettoie le slug au cas où une URL complète a été collée
  b.slug = bilExtractSlug(b.slug || '');
  const slugEl2 = document.getElementById('bil-e-slug');
  if (slugEl2) slugEl2.value = b.slug;
  if (!b.slug || !b.titre) { showToast('Slug et titre requis.', 'error'); return; }
  if (/[^a-z0-9-]/.test(b.slug)) { showToast('Le slug ne doit contenir que des lettres minuscules, chiffres et tirets (ex: course-soiree-flams).', 'error'); return; }
  const hasTarifPayant = b.tarifs.some(t => t.prix_centimes > 0);
  if (!b.hello_asso_form_slug && hasTarifPayant) { showToast('Slug HelloAsso requis pour les tarifs payants.', 'error'); return; }
  if (!b.tarifs.length || b.tarifs.some(t => !t.nom || t.prix_centimes == null)) {
    showToast('Au moins 1 tarif complet requis.', 'error'); return;
  }
  const payload = {
    slug: b.slug,
    hello_asso_form_slug: b.hello_asso_form_slug,
    titre: b.titre,
    date_affiche: b.date_affiche || '',
    lieu_affiche: b.lieu_affiche || '',
    description: b.description || '',
    max_par_acheteur: b.max_par_acheteur,
    cta_texte: b.cta_texte || 'Payer ma place',
    actif: !!b.actif,
    tarifs: b.tarifs,
    formulaire_champs: b.formulaire_champs || {},
    remise_boutique_centimes: b.remise_boutique_centimes || 0,
    places_max: b.places_max || null,
    places_restantes_visible: !!b.places_restantes_visible,
    places_restantes_seuil: b.places_restantes_seuil || null,
    places_restantes_mode: b.places_restantes_mode || 'exact',
  };
  let error, saved;
  if (b.id) {
    ({ data: saved, error } = await Auth.sb.from('billetteries').update(payload).eq('id', b.id).select().single());
  } else {
    ({ data: saved, error } = await Auth.sb.from('billetteries').insert(payload).select().single());
  }
  if (error) {
    console.error('[bil] supabase error', error);
    // Erreur classique : slug déjà pris
    if (String(error.message).includes('duplicate') || error.code === '23505') {
      showToast('Ce slug existe déjà. Change-le pour un slug unique.', 'error');
    } else {
      showToast('Erreur : ' + error.message, 'error');
    }
    return;
  }
  _bilCourante.id = saved.id;
  showToast('✅ Billetterie enregistrée', 'success');
  await bilChargerListe();
}

async function bilSupprimerCourante() {
  if (!_bilCourante?.id) return;
  if (!confirm(`Supprimer la billetterie "${_bilCourante.titre}" ? Les ventes déjà enregistrées ne seront pas supprimées.`)) return;
  const { error } = await Auth.sb.from('billetteries').delete().eq('id', _bilCourante.id);
  if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
  showToast('Billetterie supprimée', 'success');
  bilBackToList();
}

let _bilParticipantsData = [];
let _bilParticipantsBilletterieId = null;

function bilStatutChip(statut) {
  const s = (statut || 'en_attente').toLowerCase();
  const cfg = (s === 'payee' || s === 'confirme')
    ? { bg:'#dcfce7', color:'#166534', label:'payé' }
    : s === 'confirmee'
    ? { bg:'#ede9fe', color:'#5b21b6', label:'promo / code' }
    : s === 'rejoint'
    ? { bg:'#dbeafe', color:'#1e40af', label:'présent' }
    : (s === 'annule' || s === 'annulee')
    ? { bg:'#fee2e2', color:'#991b1b', label:'annulé' }
    : s === 'remboursee'
    ? { bg:'#fee2e2', color:'#991b1b', label:'remboursé' }
    : { bg:'#fef9c3', color:'#854d0e', label:'en attente' };
  return `<span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:.3px;background:${cfg.bg};color:${cfg.color};">${cfg.label}</span>`;
}

let _bilParticipantsPlacesMax = null;

async function bilVoirParticipants(billetterieId, titre) {
  _bilParticipantsBilletterieId = billetterieId;
  const bil = _bilListe.find(x => x.id === billetterieId);
  _bilParticipantsPlacesMax = bil?.places_max || null;
  document.getElementById('bil-p-titre').textContent = `Participants — ${titre}`;
  document.getElementById('bil-view-list').style.display = 'none';
  document.getElementById('bil-view-edit').style.display = 'none';
  document.getElementById('bil-view-participants').style.display = '';
  bilRendreParticipants(null, billetterieId);
}

async function bilRendreParticipants(existingData, billetterieId) {
  const id = billetterieId || _bilParticipantsBilletterieId;
  const wrap = document.getElementById('bil-p-content');
  wrap.innerHTML = '<div style="padding:40px;text-align:center;color:#999;font-size:13px;">Chargement…</div>';

  if (!existingData) {
    const { data, error } = await Auth.sb
      .from('billetterie_inscriptions')
      .select('*')
      .eq('billetterie_id', id)
      .order('created_at', { ascending: false });
    if (error) { wrap.innerHTML = `<div style="padding:20px;color:#dc2626;">Erreur : ${escapeHtml(error.message)}</div>`; return; }
    _bilParticipantsData = data || [];
  } else {
    _bilParticipantsData = existingData;
  }

  if (!_bilParticipantsData.length) {
    wrap.innerHTML = '<div style="padding:40px;text-align:center;color:#999;">Aucune inscription enregistrée pour l\'instant.</div>';
    return;
  }

  // Colonnes dynamiques depuis custom_answers
  const customKeysSet = new Set();
  _bilParticipantsData.forEach(r => {
    if (r.custom_answers && typeof r.custom_answers === 'object')
      Object.keys(r.custom_answers).forEach(k => customKeysSet.add(k));
  });
  const customKeys = [...customKeysSet];

  const total    = _bilParticipantsData.length;
  const confirmes = _bilParticipantsData.filter(r => ['confirme','confirmee','rejoint','payee'].includes((r.statut||'').toLowerCase())).length;
  const presents  = _bilParticipantsData.filter(r => r.scanne).length;
  const boissons  = _bilParticipantsData.filter(r => r.boisson_scannee).length;

  wrap.innerHTML = `
    <style>
      .bil-p-cards { display:flex; flex-direction:column; gap:10px; }
      .bil-p-card  { background:white; border:1px solid #ede9fe; border-radius:14px; padding:14px 16px; display:flex; align-items:center; gap:12px; }
      .bil-p-card:hover { background:#f8fafc; }
      .bil-p-avatar { width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:white;font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0; }
      .bil-p-avatar.scanned { background:linear-gradient(135deg,#059669,#10b981); }
      .bil-p-info  { flex:1; min-width:0; }
      .bil-p-name  { font-weight:700; color:#0f172a; font-size:14px; }
      .bil-p-sub   { font-size:12px; color:#888; margin-top:1px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .bil-p-right { display:flex; flex-direction:column; align-items:flex-end; gap:5px; flex-shrink:0; }
      .bil-p-badges { display:flex; flex-wrap:wrap; gap:4px; justify-content:flex-end; }
      .bil-p-actions { display:flex; gap:4px; }
      .bil-p-scan-badge { font-size:10px; font-weight:700; color:#059669; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:20px; padding:2px 8px; white-space:nowrap; }
      .bil-p-boisson-badge { font-size:10px; font-weight:700; color:#ea580c; background:#fff7ed; border:1px solid #fed7aa; border-radius:20px; padding:2px 8px; white-space:nowrap; }
    </style>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:10px;">
      <div style="background:#f8fafc;border:1px solid #dbeafe;border-radius:14px;padding:14px 16px;">
        <div style="font-size:28px;font-weight:800;color:#2563eb;">${total}${_bilParticipantsPlacesMax ? `<span style="font-size:16px;font-weight:500;color:#9ca3af;"> / ${_bilParticipantsPlacesMax}</span>` : ''}</div>
        <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-top:2px;">Inscriptions</div>
      </div>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:14px;padding:14px 16px;">
        <div style="font-size:28px;font-weight:800;color:#059669;">${presents}</div>
        <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-top:2px;">Présents</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:16px;">
      <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:14px;padding:14px 16px;">
        <div style="font-size:28px;font-weight:800;color:#ea580c;">${boissons}</div>
        <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-top:2px;">Boissons</div>
      </div>
      <a href="scan-entree.html?bil=${id}" target="_blank" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:linear-gradient(135deg,#2563eb,#1d4ed8);border-radius:14px;padding:14px 16px;text-decoration:none;cursor:pointer;">
        <svg width="26" height="26" fill="none" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" stroke="white" stroke-width="2"/><rect x="14" y="3" width="7" height="7" rx="1" stroke="white" stroke-width="2"/><rect x="3" y="14" width="7" height="7" rx="1" stroke="white" stroke-width="2"/><rect x="14" y="14" width="3" height="3" rx=".5" fill="white"/><rect x="19" y="14" width="2" height="2" rx=".5" fill="white"/><rect x="19" y="19" width="2" height="2" rx=".5" fill="white"/><rect x="14" y="19" width="2" height="2" rx=".5" fill="white"/></svg>
        <span style="font-size:11px;font-weight:800;color:white;text-transform:uppercase;letter-spacing:.5px">Scanner</span>
      </a>
    </div>
    <input type="search" id="bil-search" oninput="bilFiltrerParticipants()" placeholder="🔍 Rechercher par nom, email…"
      style="width:100%;border:1.5px solid #ede9fe;border-radius:12px;padding:10px 14px;font-size:14px;margin-bottom:12px;outline:none;box-sizing:border-box;"
      onfocus="this.style.borderColor='#bfdbfe'" onblur="this.style.borderColor='#ede9fe'">
    <div class="bil-p-cards" id="bil-p-cards">
      ${_bilParticipantsData.map((r) => {
        const initials = ((r.prenom||'').charAt(0) + (r.nom||'').charAt(0)).toUpperCase();
        const isScanned = r.scanne;
        const isRejoint = r.statut?.toLowerCase() === 'rejoint';
        const present = isScanned || isRejoint;
        const hasBoisson = r.boisson_scannee;
        const customLine = customKeys.map(k => r.custom_answers?.[k]).filter(Boolean).join(' · ');
        const scanTime = isScanned && r.scanne_at ? new Date(r.scanne_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : null;
        const scanBadge = present ? `<span class="bil-p-scan-badge">✓ Scanné${scanTime ? ' ' + scanTime : ''}</span>` : '';
        const boissonBadge = hasBoisson ? `<span class="bil-p-boisson-badge">🍹 Boisson</span>` : '';
        return `<div class="bil-p-card">
          <div class="bil-p-avatar ${present ? 'scanned' : ''}">${initials}</div>
          <div class="bil-p-info">
            <div class="bil-p-name">${escapeHtml(r.prenom||'')} ${escapeHtml(r.nom||'')}</div>
            <div class="bil-p-sub">${escapeHtml(r.email||'')}${customLine ? ' · ' + escapeHtml(customLine) : ''}</div>
          </div>
          <div class="bil-p-right">
            <div class="bil-p-badges">${bilStatutChip(r.statut)}${scanBadge}${boissonBadge}</div>
            <div class="bil-p-actions">
              <button onclick="bilEnvoyerEmail('${r.id}', this)"
                style="padding:4px 8px;border-radius:20px;border:1px solid #bfdbfe;cursor:pointer;font-size:11px;font-weight:600;background:white;color:#6d28d9;transition:all .15s;"
                title="Renvoyer l'email billet">✉</button>
              <button onclick="bilToggleBoisson('${r.id}', ${hasBoisson})"
                style="padding:4px 8px;border-radius:20px;border:1px solid ${hasBoisson ? '#fed7aa' : '#e5e7eb'};cursor:pointer;font-size:11px;font-weight:600;background:white;color:${hasBoisson ? '#ea580c' : '#374151'};transition:all .15s;"
                title="${hasBoisson ? 'Retirer boisson' : 'Valider boisson'}">🍹</button>
              <button onclick="bilToggleRejoint('${r.id}', ${present})"
                style="padding:4px 8px;border-radius:20px;border:1px solid #e5e7eb;cursor:pointer;font-size:11px;font-weight:600;background:white;color:#374151;transition:all .15s;">
                ${present ? '↩' : '✓'}
              </button>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>
    <div style="margin-top:10px;font-size:12px;color:#aaa;text-align:right;">${total} inscription${total > 1 ? 's' : ''}</div>`;
}

function bilFiltrerParticipants() {
  const q = (document.getElementById('bil-search')?.value || '').toLowerCase().trim();
  const cards = document.getElementById('bil-p-cards');
  if (!cards) return;
  const customKeysSet = new Set();
  _bilParticipantsData.forEach(r => {
    if (r.custom_answers && typeof r.custom_answers === 'object')
      Object.keys(r.custom_answers).forEach(k => customKeysSet.add(k));
  });
  const customKeys = [...customKeysSet];
  const filtered = q ? _bilParticipantsData.filter(r =>
    `${r.prenom||''} ${r.nom||''} ${r.email||''}`.toLowerCase().includes(q)
  ) : _bilParticipantsData;
  cards.innerHTML = filtered.length ? filtered.map((r) => {
    const initials = ((r.prenom||'').charAt(0) + (r.nom||'').charAt(0)).toUpperCase();
    const isScanned = r.scanne;
    const isRejoint = r.statut?.toLowerCase() === 'rejoint';
    const present = isScanned || isRejoint;
    const hasBoisson = r.boisson_scannee;
    const customLine = customKeys.map(k => r.custom_answers?.[k]).filter(Boolean).join(' · ');
    const scanTime = isScanned && r.scanne_at ? new Date(r.scanne_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : null;
    const scanBadge = present ? `<span class="bil-p-scan-badge">✓ Scanné${scanTime ? ' ' + scanTime : ''}</span>` : '';
    const boissonBadge = hasBoisson ? `<span class="bil-p-boisson-badge">🍹 Boisson</span>` : '';
    return `<div class="bil-p-card">
      <div class="bil-p-avatar ${present ? 'scanned' : ''}">${initials}</div>
      <div class="bil-p-info">
        <div class="bil-p-name">${escapeHtml(r.prenom||'')} ${escapeHtml(r.nom||'')}</div>
        <div class="bil-p-sub">${escapeHtml(r.email||'')}${customLine ? ' · ' + escapeHtml(customLine) : ''}</div>
      </div>
      <div class="bil-p-right">
        <div class="bil-p-badges">${bilStatutChip(r.statut)}${scanBadge}${boissonBadge}</div>
        <div class="bil-p-actions">
          <button onclick="bilEnvoyerEmail('${r.id}', this)"
            style="padding:4px 8px;border-radius:20px;border:1px solid #bfdbfe;cursor:pointer;font-size:11px;font-weight:600;background:white;color:#6d28d9;transition:all .15s;"
            title="Renvoyer l'email billet">✉</button>
          <button onclick="bilToggleBoisson('${r.id}', ${hasBoisson})"
            style="padding:4px 8px;border-radius:20px;border:1px solid ${hasBoisson ? '#fed7aa' : '#e5e7eb'};cursor:pointer;font-size:11px;font-weight:600;background:white;color:${hasBoisson ? '#ea580c' : '#374151'};transition:all .15s;"
            title="${hasBoisson ? 'Retirer boisson' : 'Valider boisson'}">🍹</button>
          <button onclick="bilToggleRejoint('${r.id}', ${present})"
            style="padding:4px 8px;border-radius:20px;border:1px solid #e5e7eb;cursor:pointer;font-size:11px;font-weight:600;background:white;color:#374151;transition:all .15s;">
            ${present ? '↩' : '✓'}
          </button>
        </div>
      </div>
    </div>`;
  }).join('') : `<div style="padding:30px;text-align:center;color:#999;">Aucun résultat pour "${escapeHtml(q)}"</div>`;
}

async function bilEnvoyerEmail(inscriptionId, btn) {
  const orig = btn.textContent;
  btn.disabled = true; btn.textContent = '…';
  try {
    const res = await fetch('/api/billetterie-email-billet', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inscription_id: inscriptionId }),
    });
    if (res.ok) { btn.textContent = '✓'; btn.style.color = '#059669'; btn.style.borderColor = '#059669'; }
    else { btn.textContent = '✗'; btn.style.color = '#dc2626'; }
  } catch { btn.textContent = '✗'; btn.style.color = '#dc2626'; }
  btn.disabled = false;
  setTimeout(() => { btn.textContent = orig; btn.style.color = '#6d28d9'; btn.style.borderColor = '#bfdbfe'; }, 3000);
}

async function bilEnvoyerATous(btn) {
  if (!_bilParticipantsData.length) return;
  const total = _bilParticipantsData.length;
  if (!confirm(`Envoyer l'email billet à ${total} participant${total > 1 ? 's' : ''} ?`)) return;
  btn.disabled = true;
  let ok = 0, fail = 0;
  for (const r of _bilParticipantsData) {
    btn.textContent = `✉ ${ok + fail + 1}/${total}…`;
    try {
      const res = await fetch('/api/billetterie-email-billet', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inscription_id: r.id }),
      });
      res.ok ? ok++ : fail++;
    } catch { fail++; }
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  btn.disabled = false;
  btn.textContent = '✉ Envoyer à tous';
  showToast(`${ok} email${ok > 1 ? 's' : ''} envoyé${ok > 1 ? 's' : ''}${fail ? `, ${fail} erreur${fail > 1 ? 's' : ''}` : ''}`, fail ? 'error' : 'success');
}

async function bilToggleRejoint(inscriptionId, isPresent) {
  const action = isPresent ? 'unmark' : 'validate';
  try {
    const res = await fetch('/api/billetterie-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, billetterie_id: _bilParticipantsBilletterieId, inscription_id: inscriptionId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) { showToast('Erreur : ' + (data.error || res.status), 'error'); return; }
  } catch (e) { showToast('Erreur réseau', 'error'); return; }
  const idx = _bilParticipantsData.findIndex(r => r.id === inscriptionId);
  if (idx !== -1) {
    _bilParticipantsData[idx].scanne = !isPresent;
    _bilParticipantsData[idx].scanne_at = isPresent ? null : new Date().toISOString();
    if (isPresent && data.statut) _bilParticipantsData[idx].statut = data.statut;
  }
  bilRendreParticipants(_bilParticipantsData);
  showToast(isPresent ? 'Présence retirée' : 'Marqué comme présent !', 'success');
}

async function bilToggleBoisson(inscriptionId, hasBoisson) {
  const action = hasBoisson ? 'unboisson' : 'boisson';
  let data = {};
  try {
    const res = await fetch('/api/billetterie-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, billetterie_id: _bilParticipantsBilletterieId, inscription_id: inscriptionId }),
    });
    data = await res.json().catch(() => ({}));
    if (!res.ok && !data.deja_prise) { showToast('Erreur : ' + (data.error || res.status), 'error'); return; }
  } catch (e) { showToast('Erreur réseau', 'error'); return; }
  if (data.error && !data.deja_prise) { showToast(data.error, 'error'); return; }
  const idx = _bilParticipantsData.findIndex(r => r.id === inscriptionId);
  if (idx !== -1) {
    _bilParticipantsData[idx].boisson_scannee = !hasBoisson;
    _bilParticipantsData[idx].boisson_at = hasBoisson ? null : new Date().toISOString();
  }
  bilRendreParticipants(_bilParticipantsData);
  showToast(hasBoisson ? 'Boisson retirée' : '🍹 Boisson validée !', 'success');
}


function bilExportCsv() {
  if (!_bilParticipantsData.length) return;
  const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;

  // Collecter toutes les clés custom_answers présentes dans les données
  const customKeys = [];
  const customKeysSet = new Set();
  for (const r of _bilParticipantsData) {
    if (r.custom_answers && typeof r.custom_answers === 'object') {
      for (const k of Object.keys(r.custom_answers)) {
        if (!customKeysSet.has(k)) { customKeysSet.add(k); customKeys.push(k); }
      }
    }
  }

  const baseCols    = ['prenom','nom','email','tel','classe','suggestions','tarif_nom','quantite','statut','created_at'];
  const baseHeaders = ['Prénom','Nom','Email','Tél','Classe','Suggestions','Tarif','Qté','Statut','Date'];

  const headers = [...baseHeaders, ...customKeys];
  const rows = [headers.map(escape).join(',')];

  for (const r of _bilParticipantsData) {
    const d = r.created_at ? new Date(r.created_at).toLocaleString('fr-FR') : '';
    const baseVals = baseCols.map(c => c === 'created_at' ? escape(d) : escape(r[c] ?? ''));
    const customVals = customKeys.map(k => escape(r.custom_answers?.[k] ?? ''));
    rows.push([...baseVals, ...customVals].join(','));
  }

  const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `participants-${_bilParticipantsBilletterieId}.csv`;
  a.click();
}

function bilBackToList() {
  _bilCourante = null;
  document.getElementById('bil-view-list').style.display = '';
  document.getElementById('bil-view-edit').style.display = 'none';
  document.getElementById('bil-view-participants').style.display = 'none';
  bilChargerListe();
}

async function facTelechargerPdfExistant(id) {
  const f = _facListe.find(x => x.id === id);
  if (!f) return;
  // On régénère toujours le PDF à partir des données actuelles (garantit la fraîcheur et la netteté)
  _facCourante = {
    ...f,
    lignes: Array.isArray(f.lignes) ? f.lignes : (typeof f.lignes === 'string' ? JSON.parse(f.lignes) : []),
    emetteur: (f.emetteur && Object.keys(f.emetteur).length) ? f.emetteur : { ..._facEmetteur }
  };
  if (!_facCourante.lignes.length) _facCourante.lignes = [{ intitule: '', montant: 0 }];
  const editView = document.getElementById('fac-view-edit');
  const listView = document.getElementById('fac-view-list');
  const prevEdit = editView.style.display, prevList = listView.style.display;
  editView.style.visibility = 'hidden';
  editView.style.position = 'absolute';
  editView.style.left = '-99999px';
  editView.style.display = 'block';
  facRemplirEditor();
  try {
    const blob = await facGenererPdfBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Facture_${f.numero}.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    // Re-upload silencieux (met à jour le stockage)
    const path = `${f.annee_scolaire}/${f.numero}.pdf`;
    Auth.sb.storage.from('factures').upload(path, blob, { contentType: 'application/pdf', upsert: true })
      .then(({ error: upErr }) => { if (!upErr && !f.pdf_path) Auth.sb.from('factures').update({ pdf_path: path }).eq('id', f.id); });
  } catch (e) { showToast('Erreur PDF : ' + e.message, 'error'); }
  finally {
    editView.style.display = prevEdit || 'none';
    editView.style.visibility = '';
    editView.style.position = '';
    editView.style.left = '';
    listView.style.display = prevList || '';
    _facCourante = null;
  }
}
