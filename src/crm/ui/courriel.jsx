// Aperçu fidèle d'un courriel de la distillerie à partir de son contenu structuré
// ({ titre, paragraphes, tableau, bouton }) : cadre de messagerie (de, à, objet, date), logo,
// filet doré, typographie de la marque, pied de page avec l'adresse. Rien n'est envoyé.
import { Fragment } from 'preact';
import { Marque } from './marque.jsx';
import { dateHeure } from '../lib/format.js';
import { COURRIEL_TYPE } from '../lib/statuts.js';

export const EXPEDITEUR = 'Distillerie A. Blachère <bonjour@blachere.example>';

export function ApercuCourriel({ courriel, campagne = false, cadre = true, compact = false }) {
  const c = courriel?.contenu || {};
  const paragraphes = Array.isArray(c.paragraphes) ? c.paragraphes : c.paragraphes ? [c.paragraphes] : [];
  const estCampagne = campagne || courriel?.type === 'campagne';
  const corps = (
    <div class="mail__canvas">
      <article class="mail__doc" aria-label={`Courriel : ${courriel?.objet || c.titre || ''}`}>
        <header class="mail__brand">
          <img src="/logos/logo.svg" alt="Distillerie A. Blachère" width="190" height="47" />
        </header>
        <div class="mail__body">
          {c.titre && (
            <h1 class="mail__titre">
              <Marque texte={c.titre} logo />
            </h1>
          )}
          {paragraphes.map((p, i) => (
            <p key={i} class="mail__p">
              {String(p)
                .split('\n')
                .map((ligne, j, t) => (
                  <Fragment key={j}>
                    <Marque texte={ligne} />
                    {j < t.length - 1 && <br />}
                  </Fragment>
                ))}
            </p>
          ))}
          {Array.isArray(c.tableau) && c.tableau.length > 0 && (
            <table class="mail__table">
              <tbody>
                {c.tableau.map((l, i) => (
                  <tr key={i}>
                    <th scope="row">
                      <Marque texte={String(l.libelle ?? '')} />
                    </th>
                    <td>{String(l.valeur ?? '')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {c.bouton?.libelle && (
            <p class="mail__cta">
              <a class="mail__btn" href={c.bouton.url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => !/^https?:|^\//.test(c.bouton.url || '') && e.preventDefault()}>
                {c.bouton.libelle}
              </a>
            </p>
          )}
          {c.signature !== false && (
            <p class="mail__sign">
              L’équipe de la distillerie
              <br />
              <span>Avignon 1835 · Châteauneuf-du-Pape</span>
            </p>
          )}
        </div>
        <footer class="mail__foot">
          <p>Distillerie A. Blachère · 1695 route de Sorgues, quartier Cansaud · 84230 Châteauneuf-du-Pape</p>
          <p>04 90 83 55 65 · distillerieablachere.com</p>
          {estCampagne && (
            <p>
              Vous recevez cette lettre parce que vous vous êtes inscrit sur notre site ou à la distillerie.{' '}
              <a href="#" onClick={(e) => e.preventDefault()}>
                Se désinscrire
              </a>
            </p>
          )}
          <p class="mail__demo">Démonstration : ce courriel n’a pas été envoyé, il est conservé dans le CRM.</p>
        </footer>
      </article>
    </div>
  );
  if (!cadre) return corps;
  return (
    <div class={`mail${compact ? ' mail--compact' : ''}`}>
      <dl class="mail__meta">
        <div>
          <dt>De</dt>
          <dd>{courriel?.de || EXPEDITEUR}</dd>
        </div>
        <div>
          <dt>À</dt>
          <dd>{courriel?.a || '—'}</dd>
        </div>
        <div>
          <dt>Objet</dt>
          <dd class="mail__objet">
            <Marque texte={courriel?.objet || c.titre || '(sans objet)'} />
          </dd>
        </div>
        {courriel?.date && (
          <div>
            <dt>Date</dt>
            <dd>
              {dateHeure(courriel.date)}
              {courriel.type && <span class="tag tag--soft" style="margin-left:8px">{COURRIEL_TYPE[courriel.type] || courriel.type}</span>}
            </dd>
          </div>
        )}
      </dl>
      {corps}
    </div>
  );
}
