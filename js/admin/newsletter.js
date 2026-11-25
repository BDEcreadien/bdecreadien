/* BDE Admin — module newsletter
   Extrait tel quel de admin.html (scripts classiques, portée globale partagée). */
// NEWSLETTER
// ============================================================
let _nlAbonnes = [];
let _nlHistorique = [];

async function initNewsletter() {
  adminRenderHero('step-newsletter', {
    icon: '<svg viewBox="0 0 24 24"><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
    title: 'Newsletter',
    sub: 'Abonnés actifs et historique des envois'
  });
  document.getElementById('nl-msg').style.display = 'none';
  document.getElementById('nl-count-badge').textContent = '… chargement';
  await Promise.all([loadAbonnes(), loadHistorique()]);
}

async function loadAbonnes() {
  const { data, error } = await Auth.sb
    .from('newsletter_subscribers')
    .select('id, email, nom, source, status, subscribed_at, unsubscribed_at')
    .order('subscribed_at', { ascending: false });
  if (error) { showToast('Erreur chargement abonnés : ' + error.message, 'error'); return; }
  _nlAbonnes = data || [];
  const active = _nlAbonnes.filter(a => a.status === 'active').length;
  document.getElementById('nl-count-badge').textContent = active + ' abonné' + (active > 1 ? 's' : '') + ' actif' + (active > 1 ? 's' : '');
  renderAbonnes();
}

function renderAbonnes() {
  const q = (document.getElementById('nl-search').value || '').toLowerCase();
  const rows = _nlAbonnes.filter(a =>
    !q || a.email.toLowerCase().includes(q) || (a.nom || '').toLowerCase().includes(q)
  );
  const el = document.getElementById('nl-abonnes');
  if (!rows.length) {
    el.innerHTML = '<p style="text-align:center;padding:24px;color:var(--gris-texte);font-size:13px;">Aucun abonné.</p>';
    return;
  }
  el.innerHTML = rows.map(a => {
    const date = new Date(a.subscribed_at).toLocaleDateString('fr-FR');
    const badge = a.status === 'active'
      ? '<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;">actif</span>'
      : '<span style="background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;">désinscrit</span>';
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border-bottom:1px solid var(--gris-border);">
        <div style="min-width:0;flex:1;">
          <div style="font-size:14px;font-weight:600;color:var(--texte);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtmlNl(a.email)}</div>
          <div style="font-size:12px;color:var(--gris-texte);">${escapeHtmlNl(a.nom || '')} · ${escapeHtmlNl(a.source || '')} · ${date}</div>
        </div>
        ${badge}
        <button onclick="deleteAbonne('${a.id}', '${escapeAttrNl(a.email)}')" title="Supprimer" style="background:none;border:none;color:#dc2626;cursor:pointer;padding:6px;font-size:16px;">🗑</button>
      </div>
    `;
  }).join('');
}

async function deleteAbonne(id, email) {
  if (!confirm('Supprimer définitivement ' + email + ' de la liste ?')) return;
  const { error } = await Auth.sb.from('newsletter_subscribers').delete().eq('id', id);
  if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
  showToast('Abonné supprimé', 'success');
  await loadAbonnes();
}

async function loadHistorique() {
  const { data, error } = await Auth.sb
    .from('newsletter_envois')
    .select('id, sujet, envoye_le, nb_destinataires, nb_erreurs')
    .order('envoye_le', { ascending: false })
    .limit(20);
  if (error) { console.warn(error); return; }
  _nlHistorique = data || [];
  const el = document.getElementById('nl-historique');
  if (!_nlHistorique.length) {
    el.innerHTML = '<p style="text-align:center;padding:24px;color:var(--gris-texte);font-size:13px;">Aucun envoi pour l\'instant.</p>';
    return;
  }
  el.innerHTML = _nlHistorique.map(e => {
    const date = new Date(e.envoye_le).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
    const err = e.nb_erreurs > 0 ? ` · <span style="color:#dc2626;">${e.nb_erreurs} erreur${e.nb_erreurs > 1 ? 's' : ''}</span>` : '';
    return `
      <div style="padding:10px 12px;border-bottom:1px solid var(--gris-border);">
        <div style="font-size:14px;font-weight:600;color:var(--texte);">${escapeHtmlNl(e.sujet)}</div>
        <div style="font-size:12px;color:var(--gris-texte);margin-top:2px;">${date} · ${e.nb_destinataires} destinataire${e.nb_destinataires > 1 ? 's' : ''}${err}</div>
      </div>
    `;
  }).join('');
}

// Barre d'outils - insertion dans le textarea
function nlWrap(before, after, placeholder) {
  const ta = document.getElementById('nl-contenu');
  const start = ta.selectionStart, end = ta.selectionEnd;
  const sel = ta.value.slice(start, end) || placeholder;
  const insert = before + sel + after;
  ta.value = ta.value.slice(0, start) + insert + ta.value.slice(end);
  ta.focus();
  ta.setSelectionRange(start + before.length, start + before.length + sel.length);
}
let _nlInlineMode = null; // 'link' | 'button'

function nlOpenInline(mode) {
  _nlInlineMode = mode;
  const p = document.getElementById('nl-inline-panel');
  document.getElementById('nl-inline-title').textContent = mode === 'button' ? 'Insérer un bouton' : 'Insérer un lien';
  document.getElementById('nl-inline-label').value = '';
  document.getElementById('nl-inline-url').value = 'https://';
  document.getElementById('nl-inline-label').placeholder = mode === 'button' ? 'ex : Je m\'inscris' : 'ex : notre site';
  p.style.display = 'block';
  setTimeout(() => document.getElementById('nl-inline-label').focus(), 50);
}
function nlInlineCancel() {
  document.getElementById('nl-inline-panel').style.display = 'none';
  _nlInlineMode = null;
}
function nlInlineConfirm() {
  const label = document.getElementById('nl-inline-label').value.trim();
  const url = document.getElementById('nl-inline-url').value.trim();
  if (!label || !url) { alert('Renseigne le texte et l\'URL.'); return; }
  if (!/^https?:\/\//i.test(url) && !/^mailto:/i.test(url)) { alert('L\'URL doit commencer par https:// ou http://'); return; }
  const insert = _nlInlineMode === 'button'
    ? '\n[[BTN:' + label + '|' + url + ']]\n'
    : '[' + label + '](' + url + ')';
  nlInsertAt(insert);
  nlInlineCancel();
}
function nlInsertLink() { nlOpenInline('link'); }
function nlInsertButton() { nlOpenInline('button'); }
function nlInsertImage() { document.getElementById('nl-img-upload').click(); }

async function nlUploadImage(files) {
  if (!files || !files.length) return;
  const file = files[0];
  if (file.size > 5 * 1024 * 1024) { alert('Image trop lourde (max 5 Mo).'); return; }
  showNlMsg('Compression de l\'image…', 'info');
  const webp = window.imageToWebp ? await window.imageToWebp(file, { maxWidth: 1600, quality: 0.82 }) : file;
  const ext = webp.type === 'image/webp' ? 'webp' : (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = 'newsletter/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
  showNlMsg('Upload de l\'image en cours…', 'info');
  const { error: upErr } = await Auth.sb.storage.from('annonces').upload(path, webp, { contentType: webp.type });
  if (upErr) { showNlMsg('Erreur upload : ' + upErr.message, 'error'); return; }
  const url = Auth.sb.storage.from('annonces').getPublicUrl(path).data.publicUrl;
  nlInsertAt('\n![image](' + url + ')\n');
  showNlMsg('✓ Image insérée', 'success');
  setTimeout(() => { document.getElementById('nl-msg').style.display = 'none'; }, 2000);
  document.getElementById('nl-img-upload').value = '';
}
function nlInsertAt(text) {
  const ta = document.getElementById('nl-contenu');
  const start = ta.selectionStart;
  ta.value = ta.value.slice(0, start) + text + ta.value.slice(ta.selectionEnd);
  ta.focus();
  ta.setSelectionRange(start + text.length, start + text.length);
}

// Convertit le texte "simple" (markdown-lite) en HTML propre pour l'email
function nlTextToHtml(txt) {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const isSafeUrl = u => /^https?:\/\//i.test(u) || /^mailto:/i.test(u);
  // Découpe en paragraphes (double saut de ligne)
  const blocks = txt.replace(/\r\n/g, '\n').split(/\n{2,}/);
  return blocks.map(block => {
    block = block.trim();
    if (!block) return '';
    // Bouton call-to-action : [[BTN:label|url]]
    const btn = block.match(/^\[\[BTN:([^|]+)\|([^\]]+)\]\]$/);
    if (btn && isSafeUrl(btn[2])) {
      return `<p style="text-align:center;margin:20px 0;"><a href="${esc(btn[2])}" style="display:inline-block;background:linear-gradient(135deg, var(--accent) 0%, var(--accent) 18%, var(--accent-h) 38%, var(--accent-h) 58%, var(--accent-h) 80%, var(--accent-2) 100%);color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:700;font-size:14px;">${esc(btn[1])}</a></p>`;
    }
    // Image seule : ![alt](url)
    const img = block.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (img && isSafeUrl(img[2])) {
      return `<p style="text-align:center;margin:16px 0;"><img loading="lazy" decoding="async" src="${esc(img[2])}" alt="${esc(img[1])}" style="max-width:100%;height:auto;border-radius:8px;"></p>`;
    }
    // Titre H2 : ## Titre
    if (/^##\s+/.test(block)) {
      return `<h2 style="font-size:20px;color:var(--accent);margin:16px 0 8px;">${nlInline(esc(block.replace(/^##\s+/, '')))}</h2>`;
    }
    // Paragraphe normal - un simple saut de ligne devient <br>
    const inner = block.split('\n').map(l => nlInline(esc(l))).join('<br>');
    return `<p style="margin:0 0 14px;">${inner}</p>`;
  }).filter(Boolean).join('\n');
}
function nlInline(s) {
  // **gras**
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // *italique* (mais pas si collé à un autre *)
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  // [label](url) - validation URL basique
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g,
    '<a href="$2" style="color:var(--accent);">$1</a>');
  return s;
}

function previewNewsletter() {
  const sujet = document.getElementById('nl-sujet').value.trim();
  const contenu = document.getElementById('nl-contenu').value.trim();
  if (!contenu) { showNlMsg('Écris d\'abord un contenu.', 'error'); return; }
  const html = buildNewsletterHtml(sujet || '(sans sujet)', nlTextToHtml(contenu));
  const w = window.open('', '_blank', 'width=700,height=800');
  w.document.write(html);
  w.document.close();
}

function buildNewsletterHtml(sujet, contenu) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtmlNl(sujet)}</title></head>
<body style="margin:0;padding:0;background:#F0EFF8;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0EFF8;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:20px;overflow:hidden;background:#fff;box-shadow:0 8px 40px rgba(70,1,134,0.12);">
        <tr><td style="background:linear-gradient(135deg, #460186 0%, #6A0F9E 18%, #9B1889 38%, #D2396D 58%, #F04A34 80%, #FF741F 100%);padding:32px 40px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:4px;text-transform:uppercase;color:rgba(255,255,255,0.6);">BDE CREAD LYON</p>
          <h1 style="margin:0;font-size:26px;font-weight:700;color:#ffffff;letter-spacing:1px;">${escapeHtmlNl(sujet)}</h1>
        </td></tr>
        <tr><td style="padding:32px 40px;font-size:15px;color:#333;line-height:1.7;">${contenu}</td></tr>
        <tr><td style="background:#F5F4FF;padding:20px 40px;text-align:center;font-size:12px;color:#888;">
          BDE CREAD Lyon &bull; <a href="https://bdecreadien.fr" style="color:#460186;text-decoration:none;">bdecreadien.fr</a><br>
          <a href="{{UNSUBSCRIBE_URL}}" style="color:#888;text-decoration:underline;font-size:11px;">Se désinscrire</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function sendNewsletter() {
  const sujet = document.getElementById('nl-sujet').value.trim();
  const contenu = document.getElementById('nl-contenu').value.trim();
  const testOnly = false;

  if (!sujet) { showNlMsg('Ajoute un sujet.', 'error'); return; }
  if (!contenu) { showNlMsg('Écris un contenu.', 'error'); return; }

  const active = _nlAbonnes.filter(a => a.status === 'active').length;
  if (!confirm('Envoyer cette newsletter à ' + active + ' abonné' + (active > 1 ? 's' : '') + ' ?')) return;

  const btn = event.target;
  btn.disabled = true; const oldText = btn.textContent; btn.textContent = 'Envoi…';
  showNlMsg('Envoi en cours…', 'info');

  try {
    const { data: sessionData } = await Auth.sb.auth.getSession();
    const token = sessionData.session && sessionData.session.access_token;
    if (!token) throw new Error('Session expirée, reconnecte-toi');

    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-newsletter`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON
      },
      body: JSON.stringify({
        sujet,
        contenu_html: buildNewsletterHtml(sujet, nlTextToHtml(contenu)),
        test_only: testOnly
      })
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Erreur inconnue');

    showNlMsg('✓ Envoyé à ' + json.sent + ' destinataire' + (json.sent > 1 ? 's' : '') + (json.errors ? ' - ' + json.errors + ' erreur(s)' : ''), 'success');
    if (!testOnly) {
      document.getElementById('nl-sujet').value = '';
      document.getElementById('nl-contenu').value = '';
      await loadHistorique();
    }
  } catch (e) {
    showNlMsg('Erreur : ' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = oldText;
  }
}

function showNlMsg(text, type) {
  const el = document.getElementById('nl-msg');
  el.style.display = 'block';
  el.textContent = text;
  const colors = {
    success: 'background:#dcfce7;color:#166534;',
    error: 'background:#fee2e2;color:#991b1b;',
    info: 'background:color-mix(in srgb,var(--accent) 16%,white);color:#1e40af;'
  };
  el.setAttribute('style', 'margin-top:12px;padding:10px 14px;border-radius:8px;font-size:13px;display:block;' + (colors[type] || ''));
}

function exportNewsletterCsv() {
  const rows = [['email', 'nom', 'source', 'status', 'subscribed_at']];
  _nlAbonnes.forEach(a => rows.push([a.email, a.nom || '', a.source || '', a.status, a.subscribed_at]));
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'newsletter-abonnes-' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtmlNl(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function escapeAttrNl(s) { return escapeHtmlNl(s).replace(/'/g, '\\\''); }

function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = `show ${type}`;
  setTimeout(() => t.className = '', 3500);
}

