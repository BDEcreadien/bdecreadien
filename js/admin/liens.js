/* BDE Admin — module liens
   Extrait tel quel de admin.html (scripts classiques, portée globale partagée). */
// ============================================================
// LIENS (Linktree maison) + stats
// ============================================================
let _lnkList = [];
let _lnkStats = { views: 0, clicks: 0, byId: {} };

const LNK_EMOJIS_PRESETS = [
  '📷','💬','🎉','📅','🎵','▶️','🌐','📧','📱','💰',
  '🎓','🎨','🎭','🎬','🎮','⚽','🏃','🍕','🍺','☕',
  '🔗','📢','📸','🎥','📝','🎁','🛍','🚀','⭐','❤️',
  '💜','🔥','💡','🏆','🎯','🍽','🚌','🤝','💳','🛒'
];

async function initLiens() {
  document.getElementById('lnk-form').style.display = 'none';
  window._lnkIsBureau = true;
  lnkBuildEmojiPicker();
  await Promise.all([lnkLoad(), lnkLoadStats()]);
}

function lnkBuildEmojiPicker() {
  const pick = document.getElementById('lnk-emoji-picker');
  if (!pick || pick.dataset.built === '1') return;
  pick.dataset.built = '1';
  pick.innerHTML = LNK_EMOJIS_PRESETS.map(e =>
    `<button type="button" onclick="lnkSetEmoji('${e}')" style="width:36px;height:36px;border:1px solid var(--gris-border);background:white;border-radius:8px;cursor:pointer;font-size:18px;padding:0;transition:transform .15s,background .15s;" onmouseover="this.style.background='var(--gris-clair)';this.style.transform='scale(1.1)';" onmouseout="this.style.background='white';this.style.transform='scale(1)';">${e}</button>`
  ).join('');
}

function lnkSetEmoji(e) {
  const inp = document.getElementById('lnk-icone');
  inp.value = e;
  inp.focus();
}

async function lnkLoad() {
  const { data, error } = await Auth.sb.from('liens')
    .select('id, titre, url, icone, image_url, type, social_icon, ordre, actif, created_at')
    .order('type', { ascending: true }) // 'principal' avant 'social'
    .order('ordre', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) { showToast('Erreur chargement liens : ' + error.message, 'error'); return; }
  _lnkList = data || [];
  lnkRender();
  lnkRenderStatsCounts();
}

async function lnkLoadStats() {
  // 30 derniers jours
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  try {
    const [viewsRes, clicksRes] = await Promise.all([
      Auth.sb.from('analytics_events').select('id', { count: 'exact', head: true })
        .eq('event_type', 'pageview').in('path', ['/liens', '/menu']).gte('created_at', since),
      Auth.sb.from('analytics_events').select('label')
        .eq('event_type', 'click').like('label', 'lien:%').gte('created_at', since)
    ]);
    _lnkStats.views = viewsRes.count || 0;
    _lnkStats.clicks = (clicksRes.data || []).length;
    _lnkStats.byId = {};
    (clicksRes.data || []).forEach(r => {
      const id = (r.label || '').replace(/^lien:/, '');
      if (id) _lnkStats.byId[id] = (_lnkStats.byId[id] || 0) + 1;
    });
    lnkRenderStatsCounts();
    lnkRender();
  } catch (err) { console.warn('Stats liens:', err); }
}

function lnkRenderStatsCounts() {
  document.getElementById('lnk-stat-views').textContent = _lnkStats.views;
  document.getElementById('lnk-stat-clicks').textContent = _lnkStats.clicks;
  const ctr = _lnkStats.views > 0 ? Math.round((_lnkStats.clicks / _lnkStats.views) * 100) : 0;
  document.getElementById('lnk-stat-ctr').textContent = ctr + '%';
  const actifs = _lnkList.filter(l => l.actif).length;
  document.getElementById('lnk-stat-active').textContent = actifs;
  document.getElementById('lnk-stat-total-sub').textContent = 'sur ' + _lnkList.length + ' total';
}

const LNK_SOCIAL_LABELS = {
  instagram:'Instagram', tiktok:'TikTok', website:'Site web', youtube:'YouTube',
  discord:'Discord', twitter:'Twitter/X', facebook:'Facebook',
  linkedin:'LinkedIn', snapchat:'Snapchat', spotify:'Spotify'
};

function lnkRender() {
  const wrap = document.getElementById('lnk-list');
  if (!_lnkList.length) {
    wrap.innerHTML = '<div class="empty-state">Aucun lien créé.</div>';
    return;
  }
  const maxClicks = Math.max(1, ...Object.values(_lnkStats.byId));

  const socials = _lnkList.filter(l => l.type === 'social');
  const principaux = _lnkList.filter(l => l.type !== 'social');

  function cardHtml(l) {
    const clicks = _lnkStats.byId[l.id] || 0;
    const barPct = Math.round((clicks / maxClicks) * 100);
    const activeBadge = l.actif
      ? '<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;">actif</span>'
      : '<span style="background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;">inactif</span>';
    const typeBadge = l.type === 'social'
      ? `<span style="background:#e0e7ff;color:#3730a3;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;">${escapeHtml(LNK_SOCIAL_LABELS[l.social_icon] || l.social_icon || 'social')}</span>`
      : '';
    let thumb;
    if (l.image_url) {
      thumb = `<img src="${escapeHtml(l.image_url)}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;flex-shrink:0;">`;
    } else if (l.type === 'social') {
      thumb = `<div style="width:48px;height:48px;background:linear-gradient(135deg,var(--violet),var(--orange));color:white;display:flex;align-items:center;justify-content:center;border-radius:50%;font-weight:700;flex-shrink:0;">${(l.social_icon || 's').slice(0,2).toUpperCase()}</div>`;
    } else {
      thumb = `<div style="width:48px;height:48px;display:flex;align-items:center;justify-content:center;background:var(--gris-clair);border-radius:50%;font-size:22px;flex-shrink:0;">${escapeHtml(l.icone || '🔗')}</div>`;
    }
    return `
      <div class="form-card visible lnk-drag-card" draggable="true" data-id="${l.id}" data-type="${l.type}" style="margin-bottom:10px;cursor:grab;transition:opacity .15s,box-shadow .15s;">
        <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
          <div style="color:var(--gris-texte);font-size:16px;cursor:grab;padding:0 2px;flex-shrink:0;user-select:none;">⠿</div>
          ${thumb}
          <div style="flex:1;min-width:180px;">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              <strong>${escapeHtml(l.titre)}</strong>
              ${activeBadge}
              ${typeBadge}
            </div>
            <a href="${escapeHtml(l.url)}" target="_blank" rel="noopener" style="font-size:12px;color:var(--gris-texte);word-break:break-all;text-decoration:none;">${escapeHtml(l.url)}</a>
          </div>
          <div style="min-width:120px;text-align:right;">
            <div style="font-weight:700;color:var(--violet);font-size:18px;">${clicks}</div>
            <div style="font-size:11px;color:var(--gris-texte);">clics (30j)</div>
            <div style="height:4px;background:var(--gris-border);border-radius:99px;margin-top:4px;overflow:hidden;">
              <div style="height:100%;width:${barPct}%;background:var(--gradient);border-radius:99px;"></div>
            </div>
          </div>
          <div style="display:flex;gap:6px;">
            <button class="btn-edit" onclick="lnkToggleActif('${l.id}')" style="padding:6px 12px;font-size:12px;">${l.actif ? 'Désactiver' : 'Activer'}</button>
            <button class="btn-edit" onclick="lnkEdit('${l.id}')" style="padding:6px 12px;font-size:12px;">Modifier</button>
            <button class="btn-edit" onclick="lnkDelete('${l.id}')" style="padding:6px 12px;font-size:12px;background:rgba(220,50,50,0.08);color:#c0392b;">Supprimer</button>
          </div>
        </div>
      </div>
    `;
  }

  const html = [];
  if (socials.length) {
    html.push('<h4 style="margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:var(--gris-texte);">Réseaux sociaux (barre du haut)</h4>');
    html.push(socials.map(l => cardHtml(l)).join(''));
  }
  if (principaux.length) {
    html.push('<h4 style="margin:20px 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:var(--gris-texte);">Liens principaux (cartes)</h4>');
    html.push(principaux.map(l => cardHtml(l)).join(''));
  }
  wrap.innerHTML = html.join('');
  lnkInitDrag(wrap);
}

function lnkInitDrag(wrap) {
  let dragEl = null, dragType = null;

  wrap.querySelectorAll('.lnk-drag-card').forEach(card => {
    card.addEventListener('dragstart', e => {
      dragEl = card;
      dragType = card.dataset.type;
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => card.style.opacity = '0.4', 0);
    });
    card.addEventListener('dragend', () => {
      dragEl = null;
      dragType = null;
      wrap.querySelectorAll('.lnk-drag-card').forEach(c => {
        c.style.opacity = '';
        c.style.boxShadow = '';
      });
      lnkPersistOrder();
    });
    card.addEventListener('dragover', e => {
      e.preventDefault();
      if (!dragEl || dragEl === card || card.dataset.type !== dragType) return;
      e.dataTransfer.dropEffect = 'move';
      card.style.boxShadow = '0 0 0 2px var(--violet)';
      const rect = card.getBoundingClientRect();
      const after = e.clientY > rect.top + rect.height / 2;
      card.parentNode.insertBefore(dragEl, after ? card.nextSibling : card);
    });
    card.addEventListener('dragleave', () => { card.style.boxShadow = ''; });
    card.addEventListener('drop', e => { e.preventDefault(); card.style.boxShadow = ''; });
  });
}

async function lnkPersistOrder() {
  const cards = document.querySelectorAll('#lnk-list .lnk-drag-card');
  const updates = [];
  cards.forEach((card, i) => {
    const id = card.dataset.id;
    const item = _lnkList.find(l => String(l.id) === id);
    if (item) { item.ordre = i; updates.push({ id, ordre: i }); }
  });
  for (const u of updates) {
    await Auth.sb.from('liens').update({ ordre: u.ordre }).eq('id', u.id);
  }
}

function lnkSetType(type) {
  document.getElementById('lnk-type').value = type;
  document.querySelectorAll('.lnk-type-btn').forEach(b => {
    const active = b.dataset.type === type;
    b.style.borderColor = active ? 'var(--violet)' : 'var(--gris-border)';
    b.style.background = active ? '#f1f5f9' : 'white';
  });
  document.getElementById('lnk-fields-principal').style.display = type === 'principal' ? '' : 'none';
  document.getElementById('lnk-fields-social').style.display = type === 'social' ? '' : 'none';
}

function lnkTogglerForm() {
  const form = document.getElementById('lnk-form');
  const visible = form.style.display !== 'none';
  form.style.display = visible ? 'none' : 'block';
  if (!visible) {
    document.getElementById('lnk-form-titre').textContent = 'Nouveau lien';
    document.getElementById('lnk-id').value = '';
    document.getElementById('lnk-titre').value = '';
    document.getElementById('lnk-url').value = '';
    document.getElementById('lnk-icone').value = '';
    document.getElementById('lnk-image-url').value = '';
    document.getElementById('lnk-image-file').value = '';
    document.getElementById('lnk-image-preview').style.display = 'none';
    document.getElementById('lnk-social-icon').value = '';
    document.getElementById('lnk-actif').checked = true;
    lnkSetType('principal');
  }
}

function lnkEdit(id) {
  const l = _lnkList.find(x => x.id === id);
  if (!l) return;
  document.getElementById('lnk-form').style.display = 'block';
  document.getElementById('lnk-form-titre').textContent = 'Modifier le lien';
  document.getElementById('lnk-id').value = l.id;
  document.getElementById('lnk-titre').value = l.titre;
  document.getElementById('lnk-url').value = l.url;
  document.getElementById('lnk-icone').value = l.icone || '';
  document.getElementById('lnk-social-icon').value = l.social_icon || '';
  document.getElementById('lnk-image-url').value = l.image_url || '';
  document.getElementById('lnk-actif').checked = l.actif;
  lnkSetType(l.type || 'principal');
  if (l.image_url) {
    document.getElementById('lnk-image-preview').style.display = 'block';
    document.getElementById('lnk-image-preview-img').src = l.image_url;
  } else {
    document.getElementById('lnk-image-preview').style.display = 'none';
  }
  document.getElementById('lnk-image-file').value = '';
  document.getElementById('lnk-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

let _lnkUploadInFlight = null;

async function lnkOnImageSelected(e) {
  const file = e.target.files[0];
  if (!file) return;
  _lnkUploadInFlight = (async () => {
    try {
      const { data: sessData } = await Auth.sb.auth.getSession();
      const userId = sessData?.session?.user?.id;
      if (!userId) { showToast('Session expirée, reconnecte-toi', 'error'); return null; }

      let uploadFile = file;
      let ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      if (window.imageToAvatarWebp) {
        try {
          const converted = await window.imageToAvatarWebp(file);
          if (converted && converted.size > 0) {
            uploadFile = converted;
            ext = converted.type === 'image/webp' ? 'webp' : ext;
          }
        } catch (convErr) { console.warn('[liens] conversion webp échouée, on garde original', convErr); }
      }

      console.log('[liens upload] file size:', uploadFile.size, 'type:', uploadFile.type, 'userId:', userId);

      const path = `${userId}/liens/lnk-${Date.now()}-${Math.random().toString(36).slice(2,7)}.${ext}`;
      showToast('Upload en cours…', 'info');

      const { data: upData, error: upErr } = await Auth.sb.storage
        .from('annonces')
        .upload(path, uploadFile, { contentType: uploadFile.type || 'image/jpeg', upsert: false });

      if (upErr) {
        console.error('[liens upload] FAILED', upErr, 'path:', path);
        showToast('Upload refusé : ' + (upErr.message || upErr.error || JSON.stringify(upErr)), 'error');
        return null;
      }
      console.log('[liens upload] OK', upData);

      const { data: pub } = Auth.sb.storage.from('annonces').getPublicUrl(path);
      const url = pub?.publicUrl;
      if (!url) { showToast('URL publique introuvable', 'error'); return null; }

      document.getElementById('lnk-image-url').value = url;
      document.getElementById('lnk-image-preview').style.display = 'block';
      document.getElementById('lnk-image-preview-img').src = url;
      showToast('Image ajoutée ✓', 'success');
      return url;
    } catch (err) {
      console.error('[liens upload] EXCEPTION', err);
      showToast('Erreur upload : ' + (err.message || 'inconnue'), 'error');
      return null;
    } finally {
      _lnkUploadInFlight = null;
    }
  })();
  await _lnkUploadInFlight;
}

function lnkClearImage() {
  document.getElementById('lnk-image-url').value = '';
  document.getElementById('lnk-image-file').value = '';
  document.getElementById('lnk-image-preview').style.display = 'none';
}

async function lnkSave() {
  // 0) Attendre la fin de l'upload image si en cours
  if (_lnkUploadInFlight) { try { await _lnkUploadInFlight; } catch(_) {} }

  // 1) Récupération + validation immédiate
  const id = document.getElementById('lnk-id').value;
  const type = document.getElementById('lnk-type').value || 'principal';
  const titre = document.getElementById('lnk-titre').value.trim();
  let url = document.getElementById('lnk-url').value.trim();
  const icone = document.getElementById('lnk-icone').value.trim() || null;
  const image_url = document.getElementById('lnk-image-url').value.trim() || null;
  const social_icon = document.getElementById('lnk-social-icon').value.trim() || null;
  const actif = document.getElementById('lnk-actif').checked;
  if (!titre) return showToast('Titre obligatoire', 'error');
  if (!url) return showToast('URL obligatoire', 'error');
  if (type === 'social' && !social_icon) return showToast('Choisis une icône de réseau', 'error');
  if (!/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(url)) url = 'https://' + url;
  const payload = { titre, url, icone, image_url, type, social_icon, actif };

  // 2) Ferme immédiatement le formulaire + reset
  document.getElementById('lnk-form').style.display = 'none';
  document.getElementById('lnk-id').value = '';
  document.getElementById('lnk-titre').value = '';
  document.getElementById('lnk-url').value = '';
  document.getElementById('lnk-icone').value = '';
  document.getElementById('lnk-image-url').value = '';
  document.getElementById('lnk-image-file').value = '';
  document.getElementById('lnk-image-preview').style.display = 'none';
  document.getElementById('lnk-social-icon').value = '';
  document.getElementById('lnk-actif').checked = true;
  lnkSetType('principal');

  // 3) Mise à jour optimiste de la liste (visible instantanément)
  if (id) {
    const idx = _lnkList.findIndex(l => l.id === id);
    if (idx >= 0) _lnkList[idx] = { ..._lnkList[idx], ...payload };
    lnkRender(); lnkRenderStatsCounts();
  } else {
    const maxOrdre = _lnkList.filter(l => l.type === type).reduce((m, l) => Math.max(m, l.ordre || 0), 0);
    _lnkList.push({ ...payload, id: 'tmp-' + Date.now(), ordre: maxOrdre + 1, created_at: new Date().toISOString() });
    lnkRender(); lnkRenderStatsCounts();
  }

  // 4) Persistance DB
  try {
    if (id) {
      const { error } = await Auth.sb.from('liens').update(payload).eq('id', id);
      if (error) { console.error('[liens] update failed', error, payload); showToast('Erreur : ' + (error.message || 'inconnue'), 'error'); await lnkLoad(); return; }
      showToast('Lien modifié', 'success');
    } else {
      const maxOrdre = _lnkList.filter(l => l.type === type && !String(l.id).startsWith('tmp-')).reduce((m, l) => Math.max(m, l.ordre || 0), 0);
      const insertPayload = { ...payload, ordre: maxOrdre + 1, created_by: window._monProfilId || null };
      const { error } = await Auth.sb.from('liens').insert(insertPayload);
      if (error) { console.error('[liens] insert failed', error, insertPayload); showToast('Erreur : ' + (error.message || 'inconnue'), 'error'); await lnkLoad(); return; }
      showToast('Lien créé', 'success');
    }
    await lnkLoad(); // resync
  } catch (err) {
    console.error(err);
    showToast('Erreur : ' + err.message, 'error');
    await lnkLoad();
  }
}

async function lnkToggleActif(id) {
  const l = _lnkList.find(x => x.id === id);
  if (!l) return;
  const newActif = !l.actif;
  l.actif = newActif; lnkRender(); lnkRenderStatsCounts(); // MAJ optimiste
  const { error } = await Auth.sb.from('liens').update({ actif: newActif }).eq('id', id);
  if (error) { l.actif = !newActif; lnkRender(); return showToast('Erreur : ' + error.message, 'error'); }
  showToast(newActif ? 'Lien activé' : 'Lien désactivé', 'success');
}

async function lnkDelete(id) {
  if (!confirm('Supprimer ce lien ?')) return;
  const idx = _lnkList.findIndex(l => l.id === id);
  const removed = idx >= 0 ? _lnkList.splice(idx, 1)[0] : null;
  lnkRender(); lnkRenderStatsCounts();
  const { error } = await Auth.sb.from('liens').delete().eq('id', id);
  if (error) {
    if (removed) _lnkList.splice(idx, 0, removed);
    lnkRender();
    return showToast('Erreur : ' + error.message, 'error');
  }
  // Supprimer l'image associée (Supabase Storage ou GitHub)
  if (removed?.image_url) {
    if (removed.image_url.includes('supabase')) {
      try { const m = new URL(removed.image_url).pathname.match(/\/object\/public\/annonces\/(.+)/); if (m?.[1]) Auth.sb.storage.from('annonces').remove([m[1]]).catch(() => {}); } catch (_) {}
    } else if (removed.image_url.includes('bdecreadien.fr/images/')) {
      btqaDeleteGhImage(removed.image_url).catch(() => {});
    }
  }
  showToast('Supprimé', 'success');
}


