#!/usr/bin/env node
/**
 * Build script — injecte les partials de _includes/ dans les fichiers .html
 *
 * Usage : `node build.js` ou `npm run build`
 *
 * Pour ajouter un partial dans une page HTML, mets :
 *   <!-- @include nom @start -->
 *   <!-- @include nom @end -->
 *
 * Le contenu entre les 2 marqueurs sera remplacé par le fichier _includes/nom.html.
 * Le script est idempotent — tu peux le relancer sans souci.
 */

const fs = require('fs');
const path = require('path');

const INCLUDES_DIR = '_includes';

if (!fs.existsSync(INCLUDES_DIR)) {
  console.error(`❌ Dossier ${INCLUDES_DIR}/ introuvable.`);
  process.exit(1);
}

// Charger tous les partials
const partials = {};
for (const f of fs.readdirSync(INCLUDES_DIR)) {
  if (f.endsWith('.html')) {
    partials[f.replace(/\.html$/, '')] = fs.readFileSync(path.join(INCLUDES_DIR, f), 'utf8').trim();
  }
}
console.log(`📦 ${Object.keys(partials).length} partials chargés : ${Object.keys(partials).join(', ')}`);

// Lister les .html à la racine (skip _includes/ et node_modules/)
const files = fs.readdirSync('.').filter(f => f.endsWith('.html'));

// Regex : capture le nom entre @start/@end et remplace le contenu
const re = /(<!--\s*@include\s+([a-z0-9-]+)\s+@start\s*-->)[\s\S]*?(<!--\s*@include\s+\2\s+@end\s*-->)/g;

let updated = 0;
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const out = src.replace(re, (m, startTag, name, endTag) => {
    if (!(name in partials)) {
      console.warn(`⚠ Partial introuvable : "${name}" dans ${file}`);
      return m;
    }
    return `${startTag}\n${partials[name]}\n${endTag}`;
  });
  if (out !== src) {
    fs.writeFileSync(file, out);
    updated++;
    console.log(`✓ ${file}`);
  }
}
console.log(`\nDone. ${updated} fichiers mis à jour.`);
