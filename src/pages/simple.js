// Pages simples (mentions légales, 404) : éléments communs seulement, sans demander l'âge.
import '../styles/base.css';
import '../styles/editorial.css';
import '../styles/pages.css';
import '../styles/brand.css';
import { initSite } from '../app/site.js';

initSite({ askAge: false });
