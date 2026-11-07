(() => {
  const CSS = `
#auth-modal-overlay {
  display:none;position:fixed;inset:0;z-index:9000;
  background:rgba(0,0,0,.55);backdrop-filter:blur(4px);
  align-items:center;justify-content:center;padding:20px;
}
#auth-modal-overlay.open { display:flex; }
#auth-modal-box {
  background:#fff;border-radius:20px;padding:40px 36px;
  width:100%;max-width:440px;
  box-shadow:0 8px 48px rgba(70,1,134,.18);
  position:relative;max-height:90vh;overflow-y:auto;
}
@media(max-width:480px){
  #auth-modal-box{padding:28px 20px;border-radius:14px;}
}
#auth-modal-close {
  position:absolute;top:14px;right:14px;
  background:none;border:none;cursor:pointer;
  font-size:20px;line-height:1;color:#999;padding:4px 8px;
  border-radius:8px;transition:background .15s;
}
#auth-modal-close:hover{background:#f0f0f0;}
`;

  const HTML = `
<div id="auth-modal-overlay">
  <div id="auth-modal-box" role="dialog" aria-modal="true" aria-label="Connexion">
    <button id="auth-modal-close" onclick="closeAuthModal()" aria-label="Fermer">✕</button>

    <div class="auth-logo" style="display:flex;align-items:center;gap:12px;margin-bottom:28px;">
      <img loading="lazy" src="/assets/Logo.png?v=5" alt="BDE CREAD" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">
      <span style="font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:1px;color:var(--violet);">BDE CREAD Lyon</span>
    </div>

    <div style="display:flex;border-bottom:2px solid var(--gris-clair);margin-bottom:28px;" id="am-tabs">
      <button class="auth-tab active" onclick="amShowTab('connexion')" style="flex:1;padding:10px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:14px;letter-spacing:.5px;color:var(--gris-texte);cursor:pointer;border:none;background:none;border-bottom:2px solid transparent;margin-bottom:-2px;transition:var(--transition);text-transform:uppercase;">Connexion</button>
      <button class="auth-tab" onclick="amShowTab('inscription')" style="flex:1;padding:10px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:14px;letter-spacing:.5px;color:var(--gris-texte);cursor:pointer;border:none;background:none;border-bottom:2px solid transparent;margin-bottom:-2px;transition:var(--transition);text-transform:uppercase;">Inscription</button>
    </div>

    <div id="am-panel-connexion" class="am-panel">
      <div style="margin-bottom:16px;">
        <label style="display:block;font-size:12px;font-family:'Barlow Condensed',sans-serif;text-transform:uppercase;letter-spacing:.5px;color:var(--gris-texte);margin-bottom:6px;">Email</label>
        <input type="email" id="am-login-email" placeholder="ton@email.com" autocomplete="email" style="width:100%;padding:10px 14px;border:1.5px solid var(--gris-moyen);border-radius:10px;font-family:'Barlow',sans-serif;font-size:16px;color:var(--noir);background:#fff;outline:none;box-sizing:border-box;">
      </div>
      <div style="margin-bottom:16px;">
        <label style="display:block;font-size:12px;font-family:'Barlow Condensed',sans-serif;text-transform:uppercase;letter-spacing:.5px;color:var(--gris-texte);margin-bottom:6px;">Mot de passe</label>
        <div style="position:relative;">
          <input type="password" id="am-login-pwd" placeholder="••••••••" autocomplete="current-password" style="width:100%;padding:10px 44px 10px 14px;border:1.5px solid var(--gris-moyen);border-radius:10px;font-family:'Barlow',sans-serif;font-size:16px;color:var(--noir);background:#fff;outline:none;box-sizing:border-box;">
          <button type="button" onclick="amTogglePwd('am-login-pwd',this)" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;padding:6px 10px;cursor:pointer;font-size:16px;opacity:.55;" aria-label="Afficher le mot de passe"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
        </div>
      </div>
      <button onclick="amDoLogin()" style="width:100%;padding:12px;background:var(--gradient);border:none;border-radius:12px;color:#fff;font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:600;letter-spacing:1px;text-transform:uppercase;cursor:pointer;" id="am-login-btn">Se connecter</button>
      <button onclick="amDoLoginGoogle()" style="display:flex;align-items:center;gap:10px;width:100%;padding:12px;border:1px solid #ddd;border-radius:8px;background:#fff;cursor:pointer;font-size:14px;font-weight:500;justify-content:center;margin-top:8px;color:#333;"><svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>Continuer avec Google</button>
      <div style="text-align:center;font-size:12px;color:var(--gris-moyen);margin:8px 0 0;">
        <button onclick="amShowTab('reset')" style="font-size:13px;color:var(--violet);cursor:pointer;background:none;border:none;text-decoration:underline;padding:0;">Mot de passe oublié ?</button>
      </div>
      <div id="am-login-msg" style="display:none;margin-top:14px;padding:12px 14px;border-radius:10px;font-size:13px;"></div>
    </div>

    <div id="am-panel-inscription" class="am-panel" style="display:none;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
        <div>
          <label style="display:block;font-size:12px;font-family:'Barlow Condensed',sans-serif;text-transform:uppercase;letter-spacing:.5px;color:var(--gris-texte);margin-bottom:6px;">Prénom *</label>
          <input type="text" id="am-reg-prenom" placeholder="Marie" autocomplete="given-name" style="width:100%;padding:10px 14px;border:1.5px solid var(--gris-moyen);border-radius:10px;font-family:'Barlow',sans-serif;font-size:16px;color:var(--noir);background:#fff;outline:none;box-sizing:border-box;">
        </div>
        <div>
          <label style="display:block;font-size:12px;font-family:'Barlow Condensed',sans-serif;text-transform:uppercase;letter-spacing:.5px;color:var(--gris-texte);margin-bottom:6px;">Nom *</label>
          <input type="text" id="am-reg-nom" placeholder="Dupont" autocomplete="family-name" style="width:100%;padding:10px 14px;border:1.5px solid var(--gris-moyen);border-radius:10px;font-family:'Barlow',sans-serif;font-size:16px;color:var(--noir);background:#fff;outline:none;box-sizing:border-box;">
        </div>
      </div>
      <div style="margin-bottom:16px;">
        <label style="display:block;font-size:12px;font-family:'Barlow Condensed',sans-serif;text-transform:uppercase;letter-spacing:.5px;color:var(--gris-texte);margin-bottom:6px;">Email *</label>
        <input type="email" id="am-reg-email" placeholder="ton@email.com" autocomplete="email" style="width:100%;padding:10px 14px;border:1.5px solid var(--gris-moyen);border-radius:10px;font-family:'Barlow',sans-serif;font-size:16px;color:var(--noir);background:#fff;outline:none;box-sizing:border-box;">
      </div>
      <div style="margin-bottom:16px;">
        <label style="display:block;font-size:12px;font-family:'Barlow Condensed',sans-serif;text-transform:uppercase;letter-spacing:.5px;color:var(--gris-texte);margin-bottom:6px;">Mot de passe * (min. 8 caractères)</label>
        <div style="position:relative;">
          <input type="password" id="am-reg-pwd" placeholder="••••••••" autocomplete="new-password" style="width:100%;padding:10px 44px 10px 14px;border:1.5px solid var(--gris-moyen);border-radius:10px;font-family:'Barlow',sans-serif;font-size:16px;color:var(--noir);background:#fff;outline:none;box-sizing:border-box;">
          <button type="button" onclick="amTogglePwd('am-reg-pwd',this)" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;padding:6px 10px;cursor:pointer;opacity:.55;" aria-label="Afficher"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
        <div>
          <label style="display:block;font-size:12px;font-family:'Barlow Condensed',sans-serif;text-transform:uppercase;letter-spacing:.5px;color:var(--gris-texte);margin-bottom:6px;">Année *</label>
          <select id="am-reg-annee" style="width:100%;padding:10px 14px;border:1.5px solid var(--gris-moyen);border-radius:10px;font-family:'Barlow',sans-serif;font-size:16px;color:var(--noir);background:#fff;outline:none;box-sizing:border-box;">
            <option value="1ère">1ère année</option>
            <option value="2ème">2ème année</option>
            <option value="3ème">3ème année</option>
            <option value="4ème">4ème année</option>
            <option value="5ème">5ème année</option>
            <option value="Admin/Prof">Admin / Prof</option>
          </select>
        </div>
        <div>
          <label style="display:block;font-size:12px;font-family:'Barlow Condensed',sans-serif;text-transform:uppercase;letter-spacing:.5px;color:var(--gris-texte);margin-bottom:6px;">Téléphone *</label>
          <input type="text" inputmode="numeric" id="am-reg-tel" placeholder="06 xx xx xx xx" autocomplete="tel" maxlength="14" oninput="amFormatTel(this)" style="width:100%;padding:10px 14px;border:1.5px solid var(--gris-moyen);border-radius:10px;font-family:'Barlow',sans-serif;font-size:16px;color:var(--noir);background:#fff;outline:none;box-sizing:border-box;">
        </div>
      </div>
      <label style="display:flex;align-items:flex-start;gap:10px;margin:0 0 16px;cursor:pointer;font-size:13px;color:var(--gris-texte);line-height:1.4;">
        <input type="checkbox" id="am-reg-newsletter" checked style="margin-top:2px;flex-shrink:0;accent-color:var(--violet);">
        <span>Je souhaite recevoir la <strong>newsletter du BDE</strong>.</span>
      </label>
      <button onclick="amDoSignup()" style="width:100%;padding:12px;background:var(--gradient);border:none;border-radius:12px;color:#fff;font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:600;letter-spacing:1px;text-transform:uppercase;cursor:pointer;" id="am-reg-btn">Créer mon compte</button>
      <div id="am-reg-msg" style="display:none;margin-top:14px;padding:12px 14px;border-radius:10px;font-size:13px;"></div>
    </div>

    <div id="am-panel-reset" class="am-panel" style="display:none;">
      <div style="margin-bottom:16px;">
        <label style="display:block;font-size:12px;font-family:'Barlow Condensed',sans-serif;text-transform:uppercase;letter-spacing:.5px;color:var(--gris-texte);margin-bottom:6px;">Ton email</label>
        <input type="email" id="am-reset-email" placeholder="ton@email.com" autocomplete="email" style="width:100%;padding:10px 14px;border:1.5px solid var(--gris-moyen);border-radius:10px;font-family:'Barlow',sans-serif;font-size:16px;color:var(--noir);background:#fff;outline:none;box-sizing:border-box;">
      </div>
      <button onclick="amDoReset()" style="width:100%;padding:12px;background:var(--gradient);border:none;border-radius:12px;color:#fff;font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:600;letter-spacing:1px;text-transform:uppercase;cursor:pointer;" id="am-reset-btn">Envoyer le lien</button>
      <div id="am-reset-msg" style="display:none;margin-top:14px;padding:12px 14px;border-radius:10px;font-size:13px;"></div>
      <div style="text-align:center;margin-top:12px;">
        <button onclick="amShowTab('connexion')" style="font-size:13px;color:var(--violet);cursor:pointer;background:none;border:none;text-decoration:underline;padding:0;">Retour</button>
      </div>
    </div>

    <div id="am-panel-success" class="am-panel" style="display:none;text-align:center;padding:20px 0;">
      <div style="font-size:48px;margin-bottom:12px;">✅</div>
      <h2 style="font-family:'Barlow Condensed',sans-serif;font-size:22px;color:var(--violet);margin:0 0 8px;">Compte créé !</h2>
      <p style="font-size:14px;color:var(--gris-texte);line-height:1.6;">Un email de confirmation a été envoyé à <strong id="am-reg-email-confirm"></strong>.<br>Clique sur le lien pour activer ton compte.</p>
      <button onclick="closeAuthModal()" style="display:inline-block;margin-top:24px;padding:12px 32px;background:var(--gradient);color:#fff;border:none;border-radius:12px;font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer;">Fermer</button>
    </div>
  </div>
</div>
`;

  let _next = '/';
  let _injected = false;

  function inject() {
    if (_injected) return;
    _injected = true;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    const wrap = document.createElement('div');
    wrap.innerHTML = HTML;
    document.body.appendChild(wrap.firstElementChild);
    // Close on backdrop click
    document.getElementById('auth-modal-overlay').addEventListener('click', e => {
      if (e.target === document.getElementById('auth-modal-overlay')) closeAuthModal();
    });
    // Close on Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeAuthModal();
    });
  }

  window.amFormatTel = function(input) {
    const pos = input.selectionStart;
    const digitsBeforeCursor = input.value.slice(0, pos).replace(/\D/g, '').length;
    const digits = input.value.replace(/\D/g, '').slice(0, 10);
    const formatted = digits.match(/.{1,2}/g)?.join(' ') ?? digits;
    input.value = formatted;
    let newPos = 0, count = 0;
    for (let i = 0; i < formatted.length; i++) {
      if (/\d/.test(formatted[i])) count++;
      if (count === digitsBeforeCursor) { newPos = i + 1; break; }
    }
    input.setSelectionRange(newPos, newPos);
  };

  window.openAuthModal = function(opts) {
    inject();
    _next = (opts && opts.next) || '/';
    const tab = (opts && opts.tab) || 'connexion';
    amShowTab(tab);
    document.getElementById('auth-modal-overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      const f = document.getElementById('am-login-email');
      if (f) f.focus();
    }, 100);
  };

  window.closeAuthModal = function() {
    const el = document.getElementById('auth-modal-overlay');
    if (el) el.classList.remove('open');
    document.body.style.overflow = '';
  };

  window.amShowTab = function(name) {
    ['connexion','inscription','reset','success'].forEach(t => {
      const p = document.getElementById('am-panel-' + t);
      if (p) p.style.display = 'none';
    });
    const tabs = document.querySelectorAll('#am-tabs .auth-tab');
    tabs.forEach((tab, i) => {
      tab.classList.remove('active');
      tab.style.color = 'var(--gris-texte)';
      tab.style.borderBottomColor = 'transparent';
      tab.style.fontWeight = '';
      if (['connexion','inscription'][i] === name) {
        tab.classList.add('active');
        tab.style.color = 'var(--violet)';
        tab.style.borderBottomColor = 'var(--violet)';
        tab.style.fontWeight = '600';
      }
    });
    const target = document.getElementById('am-panel-' + name);
    if (target) target.style.display = '';
  };

  window.amTogglePwd = function(id, btn) {
    const el = document.getElementById(id);
    if (!el) return;
    const isPwd = el.type === 'password';
    el.type = isPwd ? 'text' : 'password';
    btn.style.opacity = isPwd ? '1' : '.55';
  };

  function amShowMsg(id, text, type) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.style.display = 'block';
    el.style.background = type === 'error' ? '#FFF0F0' : '#F0FFF4';
    el.style.color = type === 'error' ? '#C0392B' : '#1A7A40';
    el.style.border = type === 'error' ? '1px solid #F5C0C0' : '1px solid #B0E8C4';
  }
  function amHideMsg(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  }

  window.amDoLoginGoogle = async function() {
    const sb = window._sb;
    if (!sb) return;
    const next = (_next.startsWith('/') && !_next.startsWith('//')) ? _next : '/';
    await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: 'https://bdecreadien.fr' + next } });
  };

  window.amDoLogin = async function() {
    amHideMsg('am-login-msg');
    const email = document.getElementById('am-login-email').value.trim();
    const pwd   = document.getElementById('am-login-pwd').value;
    if (!email || !pwd) { amShowMsg('am-login-msg', 'Remplis tous les champs.', 'error'); return; }
    const sb = window._sb;
    if (!sb) return;
    const btn = document.getElementById('am-login-btn');
    btn.disabled = true; btn.textContent = 'Connexion…';
    const { error } = await sb.auth.signInWithPassword({ email, password: pwd });
    btn.disabled = false; btn.textContent = 'Se connecter';
    if (error) {
      const msg = error.message === 'Invalid login credentials'
        ? 'Email ou mot de passe incorrect.'
        : error.message === 'Email not confirmed'
        ? 'Confirme ton email avant de te connecter (vérifie tes spams).'
        : (error.message === 'Load failed' || error.message === 'Failed to fetch' || error.message.includes('network'))
        ? 'Impossible de joindre le serveur. Réessaie.'
        : error.message;
      amShowMsg('am-login-msg', msg, 'error');
      return;
    }
    closeAuthModal();
    const next = (_next.startsWith('/') && !_next.startsWith('//')) ? _next : '/';
    if (next !== window.location.pathname) window.location.href = next;
    else window.location.reload();
  };

  window.amDoSignup = async function() {
    amHideMsg('am-reg-msg');
    const prenom = document.getElementById('am-reg-prenom').value.trim();
    const nom    = document.getElementById('am-reg-nom').value.trim();
    const email  = document.getElementById('am-reg-email').value.trim();
    const pwd    = document.getElementById('am-reg-pwd').value;
    const annee  = document.getElementById('am-reg-annee').value;
    const tel    = document.getElementById('am-reg-tel').value.trim();
    const newsletter = document.getElementById('am-reg-newsletter').checked;
    if (!prenom || !nom || !email || !pwd || !annee || !tel) {
      amShowMsg('am-reg-msg', 'Remplis tous les champs obligatoires (*).', 'error'); return;
    }
    const sb = window._sb;
    if (!sb) return;
    const btn = document.getElementById('am-reg-btn');
    btn.disabled = true; btn.textContent = 'Création…';
    const { error } = await sb.auth.signUp({ email, password: pwd, options: { data: { prenom, nom, annee, telephone: tel || null } } });
    btn.disabled = false; btn.textContent = 'Créer mon compte';
    if (error) {
      const msg = (error.message === 'Load failed' || error.message === 'Failed to fetch' || error.message.includes('network'))
        ? 'Impossible de joindre le serveur. Réessaie.'
        : error.message;
      amShowMsg('am-reg-msg', msg, 'error'); return;
    }
    document.getElementById('am-reg-email-confirm').textContent = email;
    amShowTab('success');
    if (newsletter) {
      sb.from('newsletter_subscribers').insert({ email, nom: (prenom + ' ' + nom).trim(), source: 'inscription' }).then(()=>{}, ()=>{});
    }
  };

  window.amDoReset = async function() {
    amHideMsg('am-reset-msg');
    const email = document.getElementById('am-reset-email').value.trim();
    if (!email) { amShowMsg('am-reset-msg', 'Saisis ton email.', 'error'); return; }
    const sb = window._sb;
    if (!sb) return;
    const btn = document.getElementById('am-reset-btn');
    btn.disabled = true; btn.textContent = 'Envoi…';
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: 'https://bdecreadien.fr/connexion.html' });
    btn.disabled = false; btn.textContent = 'Envoyer le lien';
    if (error) { amShowMsg('am-reset-msg', error.message, 'error'); return; }
    amShowMsg('am-reset-msg', 'Email envoyé ! Vérifie ta boîte de réception.', 'success');
  };

  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const overlay = document.getElementById('auth-modal-overlay');
    if (!overlay || !overlay.classList.contains('open')) return;
    const panels = ['connexion','inscription','reset'];
    for (const name of panels) {
      const p = document.getElementById('am-panel-' + name);
      if (p && p.style.display !== 'none') {
        if (name === 'connexion') amDoLogin();
        else if (name === 'inscription') amDoSignup();
        else if (name === 'reset') amDoReset();
        break;
      }
    }
  });
})();
