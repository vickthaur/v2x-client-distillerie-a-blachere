// Documents : fiches techniques imprimables générées depuis le catalogue (ingrédients, valeurs
// nutritionnelles, degré, formats, colisage ; « EAN à fournir »), médiathèque (logos SVG de la
// distillerie et des marques, photos détourées des bouteilles à télécharger), conditions.
import { useMemo, useState } from 'preact/hooks';
import { useCatalogue, useDonnees } from '../donnees.js';
import { bySlug, GAMMES, EVIN, FAMILLES, surtitre } from '../../data/products.js';
import { infos } from '../../data/site.js';
import { fold } from '../../lib/dom.js';
import { eur, dateLongue, volume, pluriel, CONDITIONS, NB } from '../format.js';
import { Chargement, Erreur, Evin, Icone, NomProduit, Packshot, TitreVue, Vide } from '../ui.jsx';

const gammeNom = Object.fromEntries(GAMMES.map((g) => [g.id, g.nom]));
const familleNom = Object.fromEntries(FAMILLES.map((f) => [f.id, f.nom]));

// Fichiers de la médiathèque (servis par le site, dans public/).
const LOGOS = [
  { titre: 'Logo de la distillerie', detail: 'Encre, pour fonds clairs', url: '/logos/logo.svg', fond: 'clair' },
  { titre: 'Logo de la distillerie, blanc', detail: 'Pour fonds sombres et photos', url: '/logos/logo-blanc.svg', fond: 'sombre' },
  { titre: 'Blason', detail: 'Le sceau seul', url: '/logos/blason.svg', fond: 'clair' },
  { titre: 'Couleur Provence®', detail: 'Logo de la gamme', url: '/logos/logo-provence.svg', fond: 'clair' },
  { titre: 'Couleur Provence®, blanc', detail: 'Pour fonds sombres', url: '/logos/logo-provence-blanc.svg', fond: 'sombre' },
  { titre: 'Logotype PAC', detail: 'Version de l’étiquette, pour fonds colorés', url: '/marques/pac.svg', fond: 'pac', provisoire: true },
  { titre: 'Logotype PAC, fonds clairs', detail: 'Liseré renforcé, sans halo', url: '/marques/pac-clair.svg', fond: 'clair', provisoire: true },
  { titre: 'Logotype Fun Blue', detail: 'Version de l’étiquette', url: '/marques/fun-blue.svg', fond: 'fb', provisoire: true },
];

const ONGLETS = [
  { id: 'fiches', nom: 'Fiches techniques' },
  { id: 'mediatheque', nom: 'Médiathèque' },
  { id: 'conditions', nom: 'Conditions' },
];

export function Documents({ route, session }) {
  if (route.id) return <Fiche slug={route.id} />;
  const onglet = ONGLETS.some((o) => o.id === route.query.get('onglet')) ? route.query.get('onglet') : 'fiches';
  return (
    <>
      <TitreVue kicker="Ressources" titre="Documents" accent="et médiathèque">
        <p class="pro-lead">Fiches techniques à imprimer, logos et photos des bouteilles pour vos cartes, vos menus et vos vitrines, conditions de vente.</p>
      </TitreVue>
      <div class="cats pro-filters" role="tablist" aria-label="Documents">
        {ONGLETS.map((o) => (
          <a key={o.id} role="tab" class={`cat${onglet === o.id ? ' is-on' : ''}`} aria-selected={onglet === o.id} href={`/espace-pro/documents?onglet=${o.id}`}>
            {o.nom}
          </a>
        ))}
      </div>
      <div role="tabpanel" aria-label={ONGLETS.find((o) => o.id === onglet).nom}>
        {onglet === 'fiches' && <Fiches />}
        {onglet === 'mediatheque' && <Mediatheque />}
        {onglet === 'conditions' && <Conditions session={session} />}
      </div>
    </>
  );
}

function Fiches() {
  const { data, error, loading, reload } = useCatalogue();
  const [q, setQ] = useState('');
  if (loading && !data) return <Chargement lignes={5} />;
  if (error) return <Erreur erreur={error} reessayer={reload} />;
  const words = fold(q).split(/\s+/).filter(Boolean);
  const list = data.produits.filter((p) => !words.length || words.every((w) => fold(`${p.nom} ${gammeNom[p.gamme] || ''} ${bySlug[p.slug]?.type || ''}`).includes(w)));
  return (
    <>
      <div class="pc-tools">
        <label class="shop-search pc-search">
          <span class="sr-only">Rechercher une fiche technique</span>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="M20 20l-4.2-4.2" />
          </svg>
          <input type="search" value={q} onInput={(e) => setQ(e.currentTarget.value)} placeholder="Rechercher un produit…" autocomplete="off" />
        </label>
        <p class="pro-muted">{pluriel(list.length, 'fiche')}</p>
      </div>
      <ul class="doc-grid">
        {list.map((p) => {
          const local = bySlug[p.slug];
          return (
            <li key={p.slug}>
              <a class="doc-card" href={`/espace-pro/documents/${p.slug}`}>
                <Packshot slug={p.slug} photo={p.photo} taille="m" />
                <span class="doc-card__txt">
                  <span class="doc-card__k">{local ? surtitre(local) : gammeNom[p.gamme]}</span>
                  <span class="doc-card__nom">
                    <NomProduit nom={p.nom} />
                  </span>
                  <span class="doc-card__meta">
                    {(p.variantes || []).map((v) => volume(v.id, v.volume)).join(' · ')}
                    {p.alcool && p.degre ? ` · ${String(p.degre).replace('.', ',')}${NB}% vol.` : ''}
                  </span>
                </span>
                <span class="doc-card__go">
                  <Icone n="doc" />
                  Fiche
                </span>
              </a>
            </li>
          );
        })}
      </ul>
      {data.produits.some((p) => p.alcool) && <Evin />}
    </>
  );
}

function Mediatheque() {
  const { data, error, loading, reload } = useCatalogue();
  return (
    <>
      <section class="doc-sec" aria-labelledby="doc-logos">
        <div class="doc-sec__head">
          <h2 class="pro-h2" id="doc-logos">
            Logos
          </h2>
          <p class="pro-muted">Fichiers vectoriels SVG, à toutes les tailles sans perte.</p>
        </div>
        <ul class="media-grid">
          {LOGOS.map((l) => (
            <li class="media" key={l.url}>
              <span class={`media__view media__view--${l.fond}`}>
                <img src={l.url} alt="" loading="lazy" />
              </span>
              <span class="media__txt">
                <strong>{l.titre}</strong>
                <span>
                  {l.detail}
                  {l.provisoire ? ' · version de travail' : ''}
                </span>
              </span>
              <a class="btn btn--ghost btn--sm" href={l.url} download>
                <Icone n="download" />
                SVG<span class="sr-only"> : {l.titre}</span>
              </a>
            </li>
          ))}
        </ul>
        <p class="pro-fine">Les logotypes PAC et Fun Blue sont vectorisés depuis les étiquettes, en attendant les fichiers de la marque. Respectez les zones de protection et les couleurs d’origine.</p>
      </section>
      <section class="doc-sec" aria-labelledby="doc-photos">
        <div class="doc-sec__head">
          <h2 class="pro-h2" id="doc-photos">
            Photos des bouteilles
          </h2>
          <p class="pro-muted">Bouteilles détourées sur fond transparent (WebP, 1024{NB}px de haut).</p>
        </div>
        {loading && !data ? (
          <Chargement lignes={3} />
        ) : error ? (
          <Erreur erreur={error} reessayer={reload} />
        ) : (
          <ul class="media-grid media-grid--photos">
            {data.produits.map((p) => (
              <li class="media media--photo" key={p.slug}>
                <span class="media__view media__view--photo">
                  <Packshot slug={p.slug} photo={p.photo} taille="l" />
                </span>
                <span class="media__txt">
                  <strong>
                    <NomProduit nom={p.nom} />
                  </strong>
                </span>
                <a class="btn btn--ghost btn--sm" href={`/bouteilles/${p.slug}/face.webp`} download={`${p.slug}.webp`}>
                  <Icone n="download" />
                  Photo<span class="sr-only"> : {p.nom}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
        <p class="pro-fine">Photos des produits du site de la distillerie. Éléments de PLV (affiches, chevalets, ardoises) à fournir par la distillerie.</p>
      </section>
    </>
  );
}

function Conditions({ session }) {
  const { data, error, loading, reload } = useDonnees('compte');
  const cat = useCatalogue();
  const c = data?.compte || data || {};
  const cond = cat.data?.conditions || {};
  return (
    <div class="doc-cond">
      <section class="pro-card" aria-labelledby="doc-cond-pro">
        <h2 class="pro-h2" id="doc-cond-pro">
          Vos conditions professionnelles
        </h2>
        {loading && !data ? (
          <Chargement lignes={3} />
        ) : error ? (
          <Erreur erreur={error} reessayer={reload} />
        ) : (
          <dl class="pro-dl">
            {c.grille && (
              <div>
                <dt>Grille tarifaire</dt>
                <dd>{{ chr: 'Cafés, hôtels, restaurants', caviste: 'Cavistes et épiceries fines', distributeur: 'Distributeurs' }[c.grille] || c.grille}</dd>
              </div>
            )}
            {c.remise > 0 && (
              <div>
                <dt>Remise du compte</dt>
                <dd>
                  {String(c.remise).replace('.', ',')}
                  {NB}% en plus de la grille
                </dd>
              </div>
            )}
            <div>
              <dt>Règlement</dt>
              <dd>{CONDITIONS[c.conditions] || c.conditions || '—'}</dd>
            </div>
            {(c.francoHT || cond.francoHT) && (
              <div>
                <dt>Franco de port</dt>
                <dd>
                  {eur(c.francoHT || cond.francoHT)}
                  {NB}HT{cond.fraisPortHT ? `, sinon ${eur(cond.fraisPortHT)} HT de port` : ''}
                </dd>
              </div>
            )}
            {cond.minimumHT && (
              <div>
                <dt>Minimum de commande</dt>
                <dd>
                  {eur(cond.minimumHT)}
                  {NB}HT
                </dd>
              </div>
            )}
            {c.encoursMax > 0 && (
              <div>
                <dt>Encours autorisé</dt>
                <dd>{eur(c.encoursMax)}</dd>
              </div>
            )}
            <div>
              <dt>Délai de livraison</dt>
              <dd>48 à 72{NB}h ouvrées</dd>
            </div>
          </dl>
        )}
        <p class="pro-fine">Tarifs et conditions de démonstration&nbsp;: fictifs, à remplacer par les conditions générales de vente professionnelles de la distillerie.</p>
      </section>
      <section class="pro-card" aria-labelledby="doc-cgv">
        <h2 class="pro-h2" id="doc-cgv">
          Conditions générales de vente
        </h2>
        <p class="pro-muted">Les conditions de la boutique en ligne de la distillerie, reprises de son site.</p>
        <a class="btn btn--ghost btn--sm" href="/conditions-de-vente" target="_blank" rel="noopener">
          <Icone n="external" />
          Lire les conditions<span class="sr-only"> (nouvel onglet)</span>
        </a>
        <p class="pro-muted">
          Une question sur vos conditions{NB}? <a class="link" href="/espace-pro/messages?nouveau=1&sujet=pro">Écrivez à votre commercial</a>.
        </p>
      </section>
    </div>
  );
}

// ---------- Fiche technique A4 ----------
// Valeurs nutritionnelles du site : « - Kcal : 354 / kJ : 1506 », « - Protéines : 0,1 g »…
function nutrition(text) {
  const rows = [];
  let allergenes = null;
  for (const raw of String(text || '').split('\n')) {
    const l = raw.replace(/^\s*-\s*/, '').trim();
    if (!l || /^valeurs/i.test(l)) continue;
    const m = /^([^:]+?)\s*:\s*(.+)$/.exec(l);
    if (!m) continue;
    if (/allerg/i.test(m[1])) allergenes = m[2];
    else rows.push([m[1].trim(), m[2].trim()]);
  }
  return { rows, allergenes, titre: /pour 100 ?ml[^:]*/i.exec(text || '')?.[0] || null };
}
function dilution(p) {
  const all = `${p.description || ''}\n${p.application || ''}`;
  return /dilution\s*:\s*([^\n]+)/i.exec(all)?.[1]?.trim() || null;
}

function Fiche({ slug }) {
  const cat = useCatalogue();
  const local = bySlug[slug];
  const p = cat.data?.produits.find((x) => x.slug === slug);
  const nut = useMemo(() => nutrition(local?.nutrition), [slug]);
  if (cat.loading && !cat.data)
    return (
      <>
        <Retour />
        <Chargement lignes={6} texte="Chargement de la fiche…" />
      </>
    );
  if (cat.error) return <Erreur erreur={cat.error} reessayer={cat.reload} />;
  if (!p || !local)
    return (
      <>
        <Retour />
        <TitreVue kicker="Fiche technique" titre="Fiche introuvable" />
        <Vide titre="Ce produit n’est pas au catalogue de votre compte." icone="search" action={<a class="btn btn--primary btn--sm" href="/espace-pro/documents">Toutes les fiches</a>} />
      </>
    );
  const desc = String(local.description || '')
    .split('\n')
    .map((x) => x.trim())
    .filter((x) => x && x !== x.toUpperCase() && !/^dilution/i.test(x));
  const dil = dilution(local);
  return (
    <>
      <div class="inv-tools no-print">
        <Retour />
        <button type="button" class="btn btn--primary btn--sm" onClick={() => print()}>
          <Icone n="print" />
          Imprimer ou enregistrer en PDF
        </button>
      </div>
      <h1 class="sr-only" id="pro-titre" tabindex="-1">
        Fiche technique {p.nom}
      </h1>
      <article class="sheet fiche" aria-label={`Fiche technique ${p.nom}`}>
        <header class="fiche__head">
          <img class="sheet__logo" src="/logos/logo.svg" alt="Distillerie A. Blachère" width="200" height="49" />
          <div class="fiche__meta">
            <p class="inv__title">Fiche technique</p>
            <p>Édition du {dateLongue(new Date())}</p>
          </div>
        </header>
        <div class="fiche__id">
          <div class="fiche__shot">
            <Packshot slug={p.slug} photo={p.photo} taille="xl" alt={p.nom} />
          </div>
          <div class="fiche__name">
            <p class="inv__k">{surtitre(local)}</p>
            <h2 class="fiche__nom">
              <NomProduit nom={p.nom} imprimable />
            </h2>
            {desc[0] && <p class="fiche__lead">{desc[0]}</p>}
            <dl class="fiche__facts">
              <div>
                <dt>Catégorie</dt>
                <dd>{p.alcool ? `Boisson spiritueuse · ${local.type}` : 'Sirop sans alcool'}</dd>
              </div>
              <div>
                <dt>Gamme</dt>
                <dd>{gammeNom[p.gamme] || local.gammeNom}</dd>
              </div>
              {local.famille && (
                <div>
                  <dt>Arôme</dt>
                  <dd>{familleNom[local.famille]}</dd>
                </div>
              )}
              {p.alcool && (
                <div>
                  <dt>Degré</dt>
                  <dd>{p.degre ? `${String(p.degre).replace('.', ',')}${NB}% vol.` : 'À confirmer'}</dd>
                </div>
              )}
              {local.reference && (
                <div>
                  <dt>Référence</dt>
                  <dd>{local.reference}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
        <section class="fiche__sec">
          <h3>Formats et conditionnement</h3>
          <table class="inv__table">
            <thead>
              <tr>
                <th scope="col">Contenance</th>
                <th scope="col">Colisage</th>
                <th scope="col">Code EAN</th>
              </tr>
            </thead>
            <tbody>
              {(p.variantes || []).map((v) => (
                <tr key={v.id}>
                  <td>{volume(v.id, v.volume)}</td>
                  <td>{v.colisage > 1 ? `Carton de ${v.colisage}` : 'À l’unité'}</td>
                  <td>
                    <span class="sheet__tbc">EAN à fournir</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p class="inv__fine">Colisage de démonstration, à confirmer. Dimensions, poids et palettisation à fournir par la distillerie.</p>
        </section>
        <div class="fiche__cols">
          <section class="fiche__sec">
            <h3>Ingrédients</h3>
            <p>{local.ingredients || <span class="sheet__tbc">À fournir</span>}</p>
            {nut.allergenes && (
              <>
                <h3>Allergènes et OGM</h3>
                <p>{nut.allergenes}</p>
              </>
            )}
            {dil && (
              <>
                <h3>Conseil de dilution</h3>
                <p>{dil}</p>
              </>
            )}
            <h3>Conservation</h3>
            <p>
              <span class="sheet__tbc">À compléter</span>
            </p>
          </section>
          <section class="fiche__sec">
            <h3>{nut.rows.length ? `Valeurs nutritionnelles ${nut.titre ? `(${nut.titre.replace(/^pour/i, 'pour')})` : ''}` : 'Valeurs nutritionnelles'}</h3>
            {nut.rows.length ? (
              <table class="fiche__nut">
                <tbody>
                  {nut.rows.map(([k, v]) => (
                    <tr key={k}>
                      <th scope="row">{k}</th>
                      <td>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>{p.alcool ? 'Non communiquées pour les boissons spiritueuses.' : <span class="sheet__tbc">À fournir</span>}</p>
            )}
          </section>
        </div>
        <footer class="fiche__foot">
          {p.alcool && <p class="inv__evin">{EVIN}</p>}
          <p>
            Distillerie A. Blachère · {infos.adresseLigne} · {infos.bureaux.tel} · {infos.bureaux.email}
          </p>
          <p>Fiche établie d’après le catalogue officiel de la distillerie (relevé du 14 octobre 2026). Document de démonstration.</p>
        </footer>
      </article>
    </>
  );
}

const Retour = () => (
  <p class="pro-back">
    <a href="/espace-pro/documents">
      <Icone n="back" /> Tous les documents
    </a>
  </p>
);
