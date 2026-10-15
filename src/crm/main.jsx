// CRM de la distillerie (Preact). Voir docs/crm-espace-pro.md, § 8.
import { render } from 'preact';
import '../styles/crm.css';
import { App } from './app.jsx';

render(<App />, document.getElementById('app'));
