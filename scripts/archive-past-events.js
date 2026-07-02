const fs = require('fs');
const path = require('path');

const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const TAGS = { soiree: 'Soirée', sport: 'Sport', bde: 'BDE', voyage: 'Voyage', culture: 'Culture', autre: 'Autre' };

const evPath  = path.join(__dirname, '../_data/evenements.json');
const arcPath = path.join(__dirname, '../_data/archives.json');

const today = new Date();
today.setHours(0, 0, 0, 0);

let evenements = JSON.parse(fs.readFileSync(evPath, 'utf8'));
let archives   = JSON.parse(fs.readFileSync(arcPath, 'utf8'));

const passes   = evenements.filter(e => e.date && new Date(e.date) < today);
const restants = evenements.filter(e => !e.date || new Date(e.date) >= today);

if (passes.length === 0) {
  console.log('Aucun événement passé à archiver.');
  process.exit(0);
}

const nouveaux = passes.map(e => {
  const d = new Date(e.date);
  return {
    titre: e.titre,
    day:   String(d.getDate()).padStart(2, '0'),
    month: MOIS[d.getMonth()],
    lieu:  e.lieu || '',
    tag:   TAGS[e.categorie] || TAGS[e.categorie?.toLowerCase()] || 'Autre',
  };
});

// Ajouter au début des archives (plus récent en premier)
archives = [...nouveaux, ...archives];

fs.writeFileSync(evPath,  JSON.stringify(restants, null, 2), 'utf8');
fs.writeFileSync(arcPath, JSON.stringify(archives, null, 2), 'utf8');

console.log(`${passes.length} événement(s) archivé(s) : ${passes.map(e => e.titre).join(', ')}`);
