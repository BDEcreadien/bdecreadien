// ============================================================
// FORMULAIRES HTML
// ============================================================
function formEvenement() {
  return `<div class="form-card" id="the-form">
    <h3 id="form-title">Nouvel événement</h3>
    <div class="form-row"><label>Titre *</label><input type="text" id="ev-titre" placeholder="Ex: Soirée"></div>
    <div class="form-grid">
      <div class="form-row"><label>Date *</label><input type="date" id="ev-date" oninput="autoDateAffichage()"></div>
      <div class="form-row"><label>Date affichée</label><input type="text" id="ev-dateAffichage" readonly style="background:#f5f5f7;color:var(--gris-texte);"></div>
    </div>
    <div class="form-grid">
      <div class="form-row">
        <label>Horaire *</label>
        <div style="display:flex;align-items:center;gap:0.5rem;">
          <input type="time" id="ev-horaire-debut" style="flex:1;">
          <span style="color:var(--gris-texte);font-size:13px;">→</span>
          <input type="time" id="ev-horaire-fin" style="flex:1;">
        </div>
      </div>
      <div class="form-row">
        <label>Prix *</label>
        <select id="ev-prix-select" onchange="onPrixChange()">
          <option value="">— Choisir —</option>
          <option value="Gratuit">Gratuit</option>
          <option value="5€">5€</option>
          <option value="8€">8€</option>
          <option value="10€">10€</option>
          <option value="12€">12€</option>
          <option value="15€">15€</option>
          <option value="20€">20€</option>
          <option value="autre">Autre…</option>
        </select>
        <input type="text" id="ev-prix-autre" placeholder="Ex: 7€50" style="display:none;margin-top:0.5rem;">
        <input type="hidden" id="ev-prix">
      </div>
    </div>
    <div class="form-row">
      <label>Lieu * <span style="font-weight:400;color:var(--gris-texte);font-size:12px;">(nom affiché librement — ex: Six Brotteaux)</span></label>
      <input type="text" id="ev-lieu" placeholder="Ex: Six Brotteaux">
    </div>
    <div class="form-row">
      <label>Adresse <span style="font-weight:400;color:var(--gris-texte);font-size:12px;">(tape la rue pour chercher)</span></label>
      <div class="autocomplete-wrap">
        <input type="text" id="ev-adresse" placeholder="Ex: Rue Juliette Récamier Lyon…" autocomplete="off">
        <div class="autocomplete-list" id="lieu-suggestions" style="display:none;"></div>
      </div>
    </div>
    <div class="form-row"><label>Description *</label><textarea id="ev-description" placeholder="Décris l'événement…"></textarea></div>
    <div class="form-grid">
      <div class="form-row">
        <label>Catégorie</label>
        <select id="ev-categorie">
          <option value="soiree">Soirée</option>
          <option value="sortie">Sortie</option>
          <option value="atelier">Atelier</option>
          <option value="autre">Autre</option>
        </select>
      </div>
      <div class="form-row">
        <label style="display:flex;align-items:center;gap:0.6rem;cursor:pointer;margin-top:1.5rem;">
          <input type="checkbox" id="ev-phare" style="width:18px;height:18px;accent-color:var(--orange);cursor:pointer;">
          <span style="display:flex;align-items:center;gap:0.4rem;"><svg viewBox="0 0 24 24" width="16" height="16" stroke="var(--orange)" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Événement phare</span>
        </label>
      </div>
    </div>
    <div class="form-row">
      <label>Photo de couverture <span style="font-weight:400;color:var(--gris-texte);font-size:12px;">(optionnel — s'affiche sur la carte phare de l'accueil)</span></label>
      <input type="file" id="ev-cover" accept="image/*" onchange="previewEvCover(this)">
      <div id="ev-cover-preview-wrap" style="display:none;margin-top:8px;">
        <img id="ev-cover-preview-img" src="" alt="Aperçu" style="max-width:100%;max-height:140px;border-radius:8px;object-fit:cover;">
        <button type="button" onclick="removeEvCover()" style="display:block;margin-top:6px;font-size:12px;color:var(--rouge,#c0392b);background:none;border:none;cursor:pointer;">Supprimer la photo</button>
      </div>
    </div>
    <div class="form-grid">
      <div class="form-row"><label>Lien billetterie (optionnel)</label><input type="url" id="ev-lien" placeholder="https://shotgun.live/…"></div>
      <div class="form-row">
        <label>Type de lien</label>
        <select id="ev-typeLien">
          <option value="">Aucun</option>
          <option value="shotgun">Shotgun</option>
          <option value="helloasso">HelloAsso</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <label>Nombre d'inscrits (optionnel)</label>
      <input type="number" id="ev-inscrits" placeholder="Ex: 42" min="0">
    </div>
    <div class="form-actions">
      <button class="btn-cancel" onclick="cancelForm()">Annuler</button>
      <button class="btn-save" onclick="saveEvenement()">Publier</button>
    </div>
  </div>`;
}

function formAnnonce() {
  return `<div class="form-card" id="the-form">
    <h3 id="form-title">Nouvelle annonce</h3>
    <div class="form-row"><label>Titre *</label><input type="text" id="an-titre" placeholder="Ex: Table à dessin A1"></div>
    <div class="form-grid">
      <div class="form-row">
        <label>Catégorie *</label>
        <select id="an-categorie">
          ${(data['annonces-categories'] || [{ key:'materiel', label:'Matériel' }, { key:'place', label:'Places' }, { key:'logement', label:'Logement' }, { key:'autre', label:'Autre' }]).map(c => `<option value="${c.key}">${c.label}</option>`).join('')}
        </select>
      </div>
      <div class="form-row"><label>Prix *</label><input type="text" id="an-prix" placeholder="Ex: 80€ ou Gratuit"></div>
    </div>
    <div class="form-row"><label>Description *</label><textarea id="an-description" placeholder="Décris ce que tu vends ou proposes…"></textarea></div>
    <div class="form-row">
      <label>Photo <span style="font-weight:400;color:var(--gris-texte);font-size:12px;">(optionnel)</span></label>
      <input type="file" id="an-photo" accept="image/*" onchange="previewAnPhoto(this)">
      <div id="an-preview-wrap" style="display:none;margin-top:8px;">
        <img id="an-preview-img" src="" alt="Aperçu" style="max-width:100%;max-height:180px;border-radius:8px;object-fit:cover;">
        <button type="button" onclick="removeAnPhoto()" style="display:block;margin-top:6px;font-size:12px;color:var(--rouge,#c0392b);background:none;border:none;cursor:pointer;">Supprimer la photo</button>
      </div>
    </div>
    <div class="form-grid">
      <div class="form-row"><label>Ton prénom + initiale *</label><input type="text" id="an-auteur" placeholder="Ex: Léa M."></div>
      <div class="form-row"><label>Ton email de contact *</label><input type="email" id="an-contact" placeholder="prenom@cread.fr"></div>
    </div>
    <div class="form-actions">
      <button class="btn-cancel" onclick="cancelForm()">Annuler</button>
      <button class="btn-save" id="btn-save-annonce" onclick="saveAnnonce()">Publier</button>
    </div>
  </div>`;
}

function formMembre() {
  return `<div class="form-card" id="the-form">
    <h3 id="form-title">Nouveau membre</h3>
    <div class="form-grid">
      <div class="form-row"><label>Nom complet *</label><input type="text" id="mb-nom" placeholder="Ex: Léa Martin"></div>
      <div class="form-row"><label>Initiales *</label><input type="text" id="mb-initiales" placeholder="Ex: LM" maxlength="3"></div>
    </div>
    <div class="form-grid">
      <div class="form-row"><label>Rôle *</label><input type="text" id="mb-role" placeholder="Ex: Responsable comm."></div>
      <div class="form-row">
        <label>Pôle *</label>
        <select id="mb-pole">
          ${(data.config?.poles || [{key:'bureau',label:'Bureau exécutif'},{key:'evenements',label:'Pôle Événements'},{key:'communication',label:'Pôle Communication'}]).map(p => `<option value="${p.key}">${p.label}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <label>Photo (depuis l'ordi)</label>
      <input type="file" id="mb-photo" accept="image/*" onchange="onMembrePhotoSelected()">
    </div>
    <div class="media-preview-wrap" id="mb-preview-wrap">
      <img id="mb-preview-img" style="width:80px;height:80px;border-radius:50%;object-fit:cover;">
    </div>
    <div class="form-actions">
      <button class="btn-cancel" onclick="cancelForm()">Annuler</button>
      <button class="btn-save" id="btn-save-membre" onclick="saveMembre()">Publier</button>
    </div>
  </div>`;
}

function formArchive() {
  return `<div class="form-card" id="the-form">
    <h3 id="form-title">Nouvel événement passé</h3>
    <div class="form-row"><label>Titre *</label><input type="text" id="ar-titre" placeholder="Ex: Soirée Intégration L1"></div>
    <div class="form-grid">
      <div class="form-row"><label>Jour *</label><input type="text" id="ar-day" placeholder="Ex: 15" maxlength="2"></div>
      <div class="form-row"><label>Mois *</label><input type="text" id="ar-month" placeholder="Ex: Mar"></div>
    </div>
    <div class="form-row"><label>Lieu / description</label><input type="text" id="ar-lieu" placeholder="Ex: Ninkasi Gerland · ~120 participants"></div>
    <div class="form-row">
      <label>Catégorie *</label>
      <select id="ar-tag">
        <option value="Soirée">Soirée</option>
        <option value="Afterwork">Afterwork</option>
        <option value="Culturel">Culturel</option>
        <option value="BDE">BDE</option>
        <option value="Sport">Sport</option>
        <option value="Autre">Autre</option>
      </select>
    </div>
    <div class="form-actions">
      <button class="btn-cancel" onclick="cancelForm()">Annuler</button>
      <button class="btn-save" onclick="saveArchive()">Publier</button>
    </div>
  </div>`;
}

function formGalerie() {
  return `<div class="form-card" id="the-form">
    <h3 id="form-title">Nouvelle photo</h3>
    <div class="form-row">
      <label>Photo(s) * — sélectionne-en plusieurs d'un coup</label>
      <input type="file" id="gl-file" accept="image/*" multiple onchange="onGalerieSelected()">
    </div>
    <div id="gl-preview-wrap" style="display:none;display:flex;flex-wrap:wrap;gap:8px;margin-top:0.75rem;"></div>
    <div class="form-row" style="margin-top:0.75rem;" id="gl-titre-row">
      <label>Légende commune (optionnelle)</label>
      <input type="text" id="gl-titre" placeholder="Ex: Soirée de rentrée 2025">
    </div>
    <div class="form-actions">
      <button class="btn-cancel" onclick="cancelForm()">Annuler</button>
      <button class="btn-save" id="btn-save-galerie" onclick="saveGalerie()">Ajouter</button>
    </div>
  </div>`;
}

function formPartenaire() {
  return `<div class="form-card" id="the-form">
    <h3 id="form-title">Nouveau partenaire</h3>
    <div class="form-row"><label>Nom *</label><input type="text" id="pt-nom" placeholder="Ex: Ninkasi"></div>
    <div class="form-row"><label>Description</label><input type="text" id="pt-desc" placeholder="Ex: Bar partenaire des soirées BDE"></div>
    <div class="form-row"><label>Lien du site</label><input type="url" id="pt-lien" placeholder="https://…"></div>
    <div class="form-row">
      <label>Logo (optionnel)</label>
      <input type="file" id="pt-logo" accept="image/*" onchange="onPartenaireLogoSelected()">
    </div>
    <div class="media-preview-wrap" id="pt-preview-wrap">
      <img id="pt-preview-img" style="display:none;max-height:80px;object-fit:contain;">
    </div>
    <div class="form-actions">
      <button class="btn-cancel" onclick="cancelForm()">Annuler</button>
      <button class="btn-save" id="btn-save-partenaire" onclick="savePartenaire()">Ajouter</button>
    </div>
  </div>`;
}

function formMedia() {
  return `<div class="form-card" id="the-form">
    <h3 id="form-title">Nouveau média</h3>
    <div class="form-row">
      <label>Fichier(s) * — sélectionne-en plusieurs d'un coup</label>
      <input type="file" id="vi-file" accept="image/*,video/*" multiple onchange="onMediaSelected()">
      <p id="vi-size-warn" style="margin-top:0.5rem;font-size:12px;color:#c0392b;line-height:1.5;"></p>
      <p style="margin-top:0.4rem;font-size:11px;color:var(--gris-texte);">Photos OK · Vidéos MP4 max 25 Mo.</p>
    </div>
    <div id="vi-preview-wrap" style="display:none;flex-wrap:wrap;gap:8px;margin-top:0.75rem;"></div>
    <div class="form-row" style="margin-top:0.75rem;">
      <label>Titre commun (optionnel)</label>
      <input type="text" id="vi-titre" placeholder="Ex: Soirée de rentrée 2025">
    </div>
    <div class="form-actions">
      <button class="btn-cancel" onclick="cancelForm()">Annuler</button>
      <button class="btn-save" id="btn-save-media" onclick="saveMedia()">Ajouter</button>
    </div>
  </div>`;
}
