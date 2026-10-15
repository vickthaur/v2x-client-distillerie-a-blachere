// Espace professionnel connecté (Preact). Voir docs/crm-espace-pro.md.
import '../styles/base.css';
import '../styles/brand.css';
import { render } from 'preact';
import { initSite } from '../app/site.js';

initSite({ askAge: false });

function App() {
  return <p>Espace pro en construction.</p>;
}

render(<App />, document.getElementById('app'));
