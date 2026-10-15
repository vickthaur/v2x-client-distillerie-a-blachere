// Catalogue professionnel : produits visibles pour ce compte (les spiritueux seulement si l'API les
// rend, toujours avec le message sanitaire), recherche, gammes, prix HT à l'unité et au carton, état
// du stock, quantités par carton ajoutées directement à la commande en cours.
import { useMemo, useState } from 'preact/hooks';
import { useCatalogue } from '../donnees.js';
import { panier, usePanier } from '../panier.js';
import { GAMMES, bySlug, surtitre } from '../../data/products.js';
import { fold } from '../../lib/dom.js';
import { eur, pluriel, ETATS, volume, NB } from '../format.js';
import { Chargement, Erreur, Evin, Icone, Jauge, Montant, NomProduit, Packshot, Pas, Pastille, TitreVue, Vide } from '../ui.jsx';

const SIROPS = ['pac', 'fun-blue', 'couleur-provence'];
const gammeNom = Object.fromEntries(GAMMES.map((g) => [g.id, g.nom]));

export function Catalogue({ site, route }) {
  const { data, error, loading, reload } = useCatalogue({ rafraichir: true });
  const [q, setQ] = useState(route.query.get('q') || '');
  const [filtre, setFiltre] = useState(route.query.get('gamme') || 'tout');
  const [dispo, setDispo] = useState(false);
  const conditions = data?.conditions || {};
  return (
    <>
      <TitreVue kicker="Tarifs de démonstration · prix hors taxes" titre="Catalogue" accent="professionnel">
        <p class="pro-lead">
          Commande par cartons, livraison sous 48 à 72{NB}h ouvrées.
          {conditions.francoHT ? (
            <>
              {' '}
              Franco de port dès <strong>{eur(conditions.francoHT)}{NB}HT</strong>
              {conditions.minimumHT ? <>, minimum de commande {eur(conditions.minimumHT)}{NB}HT</> : null}.
            </>
          ) : null}
        </p>
      </TitreVue>
      {loading && !data ? (
        <Chargement lignes={5} texte="Chargement du catalogue…" />
      ) : error ? (
        <Erreur erreur={error} reessayer={reload} titre="Le catalogue n’a pas pu être chargé." />
      ) : (
        <Liste data={data} q={q} setQ={setQ} filtre={filtre} setFiltre={setFiltre} dispo={dispo} setDispo={setDispo} site={site} />
      )}
    </>
  );
}

function Liste({ data, q, setQ, filtre, setFiltre, dispo, setDispo, site }) {
  const { lignes } = usePanier();
  const produits = data.produits;
  const spiritueux = produits.some((p) => p.alcool);
  // Onglets : les gammes de sirops présentes, puis les spiritueux réunis.
  const onglets = useMemo(() => {
    const t = [{ id: 'tout', nom: 'Tout', n: produits.length }];
    for (const g of SIROPS) {
      const n = produits.filter((p) => p.gamme === g).length;
      if (n) t.push({ id: g, nom: g === 'couleur-provence' ? 'Couleur Provence®' : gammeNom[g], n });
    }
    if (spiritueux) t.push({ id: 'spiritueux', nom: 'Spiritueux', n: produits.filter((p) => p.alcool).length });
    return t;
  }, [produits]);
  const words = fold(q.trim()).split(/\s+/).filter(Boolean);
  const visibles = produits.filter((p) => {
    if (filtre === 'spiritueux' ? !p.alcool : filtre !== 'tout' && p.gamme !== filtre) return false;
    if (dispo && !(p.variantes || []).some((v) => v.etat !== 'rupture')) return false;
    if (!words.length) return true;
    const local = bySlug[p.slug];
    const hay = fold([p.nom, p.slug, gammeNom[p.gamme], local?.type, local?.nomOfficiel, ...(p.variantes || []).map((v) => v.volume)].join(' '));
    return words.every((w) => hay.includes(w));
  });
  // Rayons : l'ordre des gammes de la boutique officielle.
  const groupes = GAMMES.map((g) => ({ ...g, produits: visibles.filter((p) => p.gamme === g.id) })).filter((g) => g.produits.length);
  const autres = visibles.filter((p) => !GAMMES.some((g) => g.id === p.gamme));
  if (autres.length) groupes.push({ id: 'autres', nom: 'Autres produits', produits: autres });
  return (
    <div class="pc-layout">
      <div class="pc-main">
        <div class="pc-tools">
          <label class="shop-search pc-search">
            <span class="sr-only">Rechercher dans le catalogue</span>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" />
              <path d="M20 20l-4.2-4.2" />
            </svg>
            <input type="search" value={q} onInput={(e) => setQ(e.currentTarget.value)} placeholder="Un produit, un parfum, une contenance…" autocomplete="off" enterkeyhint="search" />
          </label>
          <label class="pro-check">
            <input type="checkbox" checked={dispo} onChange={(e) => setDispo(e.currentTarget.checked)} />
            <span>Disponibles seulement</span>
          </label>
        </div>
        <div class="cats pc-cats" role="group" aria-label="Gammes">
          {onglets.map((o) => (
            <button type="button" key={o.id} class={`cat${filtre === o.id ? ' is-on' : ''}`} aria-pressed={filtre === o.id} onClick={() => setFiltre(o.id)}>
              <Nom nom={o.nom} />
              <span class="cat__n">{o.n}</span>
            </button>
          ))}
        </div>
        <Resume data={data} lignes={lignes} compact />
        <p class="pc-count" role="status">
          {visibles.length ? pluriel(visibles.length, 'produit') : 'Aucun produit'}
          {words.length ? ` pour «${NB}${q.trim()}${NB}»` : ''}
        </p>
        {!visibles.length ? (
          <Vide titre="Aucun produit ne correspond." icone="search" action={<button type="button" class="btn btn--ghost btn--sm" onClick={() => (setQ(''), setFiltre('tout'), setDispo(false))}>Tout afficher</button>}>
            Essayez un autre mot, ou une autre gamme.
          </Vide>
        ) : (
          groupes.map((g) => (
            <section class="pc-group" key={g.id} aria-labelledby={`pc-g-${g.id}`}>
              <div class="pc-group__head">
                <h2 class="pc-group__t" id={`pc-g-${g.id}`}>
                  <Nom nom={g.nom} />
                  <span>{pluriel(g.produits.length, 'produit')}</span>
                </h2>
                {g.univers === 'spiritueux' && <Evin />}
              </div>
              <div class="pc-cols" aria-hidden="true">
                <span>Produit</span>
                <span class="pc-cols__v">
                  <span>Format</span>
                  <span>Prix HT</span>
                  <span>Stock</span>
                  <span>Quantité</span>
                </span>
              </div>
              <ul class="pc-rows">
                {g.produits.map((p) => (
                  <Produit key={p.slug} p={p} lignes={lignes} site={site} />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
      <aside class="pc-side" aria-label="Votre commande en cours">
        <Resume data={data} lignes={lignes} />
      </aside>
    </div>
  );
}

const Nom = ({ nom }) => <NomProduit nom={nom} />;

function Produit({ p, lignes, site }) {
  const local = bySlug[p.slug];
  const sur = local ? surtitre(local) : gammeNom[p.gamme] || '';
  return (
    <li class={`pc-row${p.alcool ? ' pc-row--alcool' : ''}`}>
      <div class="pc-prod">
        <a class="pc-shot" href={`/espace-pro/documents/${p.slug}`} tabindex="-1" aria-hidden="true">
          <Packshot slug={p.slug} photo={p.photo} taille="m" />
        </a>
        <div class="pc-info">
          <p class="pc-gamme">{sur}</p>
          <h3 class="pc-nom">
            <NomProduit nom={p.nom} />
          </h3>
          {p.alcool && <p class="pc-meta">{p.degre ? `${String(p.degre).replace('.', ',')}${NB}% vol.` : 'Degré à confirmer'}</p>}
          <a class="pc-fiche" href={`/espace-pro/documents/${p.slug}`}>
            Fiche technique<span class="sr-only"> de {p.nom}</span>
          </a>
          {p.alcool && <Evin class="pc-evin" />}
        </div>
      </div>
      <ul class="pc-vars">
        {(p.variantes || []).map((v) => (
          <Variante key={v.id} p={p} v={v} qte={lignes.find((l) => l.slug === p.slug && String(l.varianteId) === String(v.id))?.qte || 0} site={site} />
        ))}
      </ul>
    </li>
  );
}

function Variante({ p, v, qte, site }) {
  const colisage = Math.max(1, v.colisage || 1);
  const etat = ETATS[v.etat] || ETATS.disponible;
  const rupture = v.etat === 'rupture';
  const vol = volume(v.id, v.volume);
  const nomComplet = `${p.nom} ${vol}`;
  const ajouter = () => {
    panier.set(p.slug, v.id, colisage);
    site?.toast(`${colisage > 1 ? `1 carton de ${colisage}` : '1 unité'} · ${p.nom} ${vol} ajouté à la commande`);
  };
  return (
    <li class={`pc-var${qte ? ' is-in' : ''}${rupture ? ' is-out' : ''}`}>
      <div class="pc-var__fmt">
        <strong>{vol}</strong>
        <span>{colisage > 1 ? `Carton de ${colisage}` : 'À l’unité'}</span>
      </div>
      <div class="pc-var__prix">
        <strong>
          {v.prixHT != null ? eur(v.prixHT) : '—'}
          <small>{NB}HT</small>
        </strong>
        <span>
          {colisage > 1 && v.prixCartonHT != null ? `${eur(v.prixCartonHT)} le carton` : v.tva ? `TVA ${String(v.tva).replace('.', ',')}${NB}%` : ''}
        </span>
      </div>
      <div class="pc-var__stock">
        <Pastille ton={etat.ton} petit>
          {etat.libelle}
        </Pastille>
      </div>
      <div class="pc-var__qte">
        {qte > 0 ? (
          <Pas qte={qte} colisage={colisage} nom={nomComplet} onChange={(n) => panier.set(p.slug, v.id, n)} />
        ) : (
          <button type="button" class="btn btn--ghost btn--sm pc-add" onClick={ajouter} disabled={rupture} aria-label={rupture ? `${nomComplet} : en rupture` : `Ajouter ${colisage > 1 ? `un carton de ${colisage}` : 'une unité'} de ${nomComplet} à la commande`}>
            {rupture ? (
              'Indisponible'
            ) : (
              <>
                <Icone n="plus" />
                Ajouter
              </>
            )}
          </button>
        )}
      </div>
    </li>
  );
}

// Résumé de la commande en cours (calcul local depuis les prix du catalogue ; le devis du serveur
// fait foi sur l'écran Commande).
function Resume({ data, lignes, compact = false }) {
  const c = data.conditions || {};
  let ht = 0;
  let unites = 0;
  for (const l of lignes) {
    const x = data.index[`${l.slug}|${l.varianteId}`];
    if (x?.variante?.prixHT != null) ht += Math.round(x.variante.prixHT * l.qte * 100) / 100;
    unites += l.qte;
  }
  ht = Math.round(ht * 100) / 100;
  const reste = c.francoHT ? Math.max(0, c.francoHT - ht) : 0;
  if (compact)
    return lignes.length ? (
      <a class="pc-sum-top" href="/espace-pro/commande">
        <span>
          <strong>{pluriel(lignes.length, 'ligne')}</strong> · {eur(ht)}
          {NB}HT
        </span>
        <span class="pc-sum-top__go">
          Voir la commande <Icone n="arrow" />
        </span>
      </a>
    ) : null;
  return (
    <div class="pro-card pc-sum">
      <h2 class="pro-h2">Votre commande</h2>
      {lignes.length ? (
        <>
          <p class="pro-muted">
            {pluriel(lignes.length, 'ligne')} · {pluriel(unites, 'article')}
          </p>
          <p class="pro-big">
            <Montant v={ht} /> <small>HT d’articles</small>
          </p>
          {c.francoHT > 0 && (
            <div class="pro-franco">
              <Jauge valeur={ht} max={c.francoHT} ton={reste > 0 ? 'ink' : 'ok'} libelle="Progression vers la livraison offerte" texte={reste > 0 ? `Plus que ${eur(reste)} HT pour la livraison offerte` : 'Livraison offerte'} />
              <p class="pro-franco__t">
                {reste > 0 ? (
                  <>
                    Plus que <strong>{eur(reste)}{NB}HT</strong> pour la livraison offerte
                  </>
                ) : (
                  <strong>Livraison offerte</strong>
                )}
              </p>
            </div>
          )}
          {c.minimumHT > 0 && ht < c.minimumHT && (
            <p class="pro-muted">
              Minimum de commande{NB}: {eur(c.minimumHT)}
              {NB}HT
            </p>
          )}
          <a class="btn btn--primary btn--block" href="/espace-pro/commande">
            Voir la commande
          </a>
        </>
      ) : (
        <p class="pro-muted">Choisissez des cartons dans la liste&nbsp;: ils s’ajoutent à votre commande en cours, gardée sur cet appareil.</p>
      )}
      <p class="pc-sum__fine">
        Tarifs de démonstration, hors taxes{c.fraisPortHT ? <>, port {eur(c.fraisPortHT)}{NB}HT sous le franco</> : null}. Les montants définitifs sont calculés à la validation.
      </p>
    </div>
  );
}

