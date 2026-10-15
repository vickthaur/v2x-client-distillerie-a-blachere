// Espace professionnel connecté (Preact) : /espace-pro/<vue>. Voir docs/crm-espace-pro.md, § 8.
// En-tête et pied de page du site, barre de l'espace pro, vues chargées depuis api/pro.
import '../styles/base.css';
import '../styles/pro.css';
import { render } from 'preact';
import { initSite } from '../app/site.js';
import { interceptLinks } from './router.js';
import { App } from './app.jsx';

const site = initSite({ askAge: false });
const root = document.getElementById('app');
interceptLinks(document);
render(<App site={site} />, root);
