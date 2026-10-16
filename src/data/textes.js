// Textes du site officiel (histoire, contact, conditions de vente, mentions légales, presse) :
// src/data/site/textes.json, écrit par scripts/import-site.mjs avec les textes tels qu'ils ont été
// relevés, puis corrigés ici au chargement (src/data/corrections.js : capitales, coquilles,
// typographie). Les pages du site importent ce module, jamais le JSON directement.
import brut from './site/textes.json';
import { corrigerTextes } from './corrections.js';

export default corrigerTextes(brut);
