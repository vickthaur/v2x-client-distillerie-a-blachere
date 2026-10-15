// Accueil : bienvenue, encours face au plafond, franco de la commande en cours, dernière commande à
// recommander en un geste, commandes en cours, factures à régler, commercial, suggestions.
import { useEffect, useState } from 'preact/hooks';
import { pro, useDonnees } from '../donnees.js';
import { panier, usePanier } from '../panier.js';
import { navigate } from '../router.js';
import { eur, dateLongue, dateJour, statut, pluriel, typo, volume, CONDITIONS, NB, NNB } from '../format.js';
import { Chargement, Erreur, Icone, Jauge, Montant, NomProduit, Packshot, Pastille, TitreVue, Vide } from '../ui.jsx';
import { totalHT, totalTTC, dateDe, enRetard, joursRetard, recommander, devisLignes } from '../commun.js';

export function Accueil({ session, site }) {
  const { data, error, loading, reload } = useDonnees('accueil');
  const u = session.utilisateur;
  const c = data?.compte || session.compte || {};
  const today = new Date();
  return (
    <>
      <TitreVue kicker={dateJour(today)} titre={c.enseigne ? `Bonjour ${u.prenom || ''},`.replace(' ,', ',') : `Bonjour ${u.prenom || ''}`.trim()} accent={c.enseigne || null}>
        <p class="pro-lead">Vos tarifs, vos commandes et vos documents, au même endroit. Livraison sous 48 à 72{NB}h ouvrées.</p>
      </TitreVue>
      {loading && !data ? <Chargement lignes={4} /> : error ? <Erreur erreur={error} reessayer={reload} /> : <Tableau data={data} site={site} />}
    </>
  );
}

function Tableau({ data, site }) {
  const compte = data.compte || {};
  const enCours = data.commandesEnCours || [];
  return (
    <div class="pro-dash">
      <div class="pro-dash__main">
        <CarteCommande compte={compte} />
        <CarteDerniere commande={data.derniereCommande} site={site} />
        <section class="pro-card" aria-labelledby="dash-encours">
          <div class="pro-card__head">
            <h2 class="pro-h2" id="dash-encours">
              Commandes en cours
            </h2>
            <a class="pro-more" href="/espace-pro/commandes">
              Toutes les commandes <Icone n="arrow" />
            </a>
          </div>
          {enCours.length ? (
            <ul class="pro-list">
              {enCours.map((o) => (
                <li key={o.id}>
                  <a class="pro-list__row" href={`/espace-pro/commandes/${o.id}`}>
                    <span class="pro-list__main">
                      <strong>{o.numero}</strong>
                      <span class="pro-list__sub">
                        Passée le {dateLongue(dateDe(o))}
                        {o.referenceClient ? ` · réf. ${o.referenceClient}` : ''}
                      </span>
                    </span>
                    <Pastille ton={statut(o.statut).ton}>{statut(o.statut).libelle}</Pastille>
                    <span class="pro-list__amount">
                      <Montant v={totalHT(o)} /> <small>HT</small>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p class="pro-muted">Aucune commande en cours de préparation ou de livraison.</p>
          )}
        </section>
        <CarteFactures resume={data.facturesARegler} />
      </div>
      <aside class="pro-dash__side" aria-label="Votre compte">
        <CarteEncours data={data} compte={compte} />
        <CarteCommercial commercial={data.commercial} />
        <Suggestions items={data.suggestions} site={site} />
      </aside>
    </div>
  );
}

// Commande en cours : lignes, total et progression vers le franco (devis du serveur).
function CarteCommande({ compte }) {
  const { lignes } = usePanier();
  const [devis, setDevis] = useState(null);
  useEffect(() => {
    if (!lignes.length) return setDevis(null);
    let on = true;
    pro('devis', { method: 'POST', body: { lignes: devisLignes(lignes) } }).then(
      (d) => on && setDevis(d),
      () => on && setDevis(null),
    );
    return () => {
      on = false;
    };
  }, [JSON.stringify(lignes)]);
  const franco = devis?.francoHT ?? devis?.conditions?.francoHT ?? compte.francoHT;
  const reste = devis?.francoRestantHT ?? (franco && devis ? Math.max(0, franco - (devis.totaux?.articlesHT ?? 0)) : null);
  const articles = devis?.totaux?.articlesHT ?? null;
  return (
    <section class="pro-card pro-card--hero" aria-labelledby="dash-commande">
      <div class="pro-card__head">
        <h2 class="pro-h2" id="dash-commande">
          Votre commande en cours
        </h2>
        {lignes.length > 0 && <span class="pro-muted">{pluriel(lignes.length, 'ligne')}</span>}
      </div>
      {!lignes.length ? (
        <div class="pro-hero-empty">
          <p>Votre prochaine commande est vide. Composez-la depuis le catalogue, par cartons, ou recommandez votre dernière commande en un geste.</p>
          <a class="btn btn--primary btn--sm" href="/espace-pro/catalogue">
            Ouvrir le catalogue
          </a>
        </div>
      ) : (
        <div class="pro-hero-cart">
          <p class="pro-hero-cart__total">
            {articles != null ? <Montant v={articles} /> : '…'} <small>HT d’articles</small>
          </p>
          {franco > 0 && articles != null && (
            <div class="pro-franco">
              <Jauge valeur={articles} max={franco} ton={reste > 0 ? 'ink' : 'ok'} libelle="Progression vers la livraison offerte" texte={reste > 0 ? `Plus que ${eur(reste)} HT pour la livraison offerte` : 'Livraison offerte'} />
              <p class="pro-franco__t">{reste > 0 ? <>Plus que <strong>{eur(reste)}{NB}HT</strong> pour la livraison offerte</> : <strong>Livraison offerte</strong>}</p>
            </div>
          )}
          <a class="btn btn--primary btn--sm" href="/espace-pro/commande">
            Voir la commande
          </a>
        </div>
      )}
    </section>
  );
}

function CarteDerniere({ commande, site }) {
  const [occupe, setOccupe] = useState(false);
  if (!commande) return null;
  // Détail : nombre de lignes ; résumé de l'API : nombre de bouteilles (« articles »).
  const quantite = commande.lignes?.length ? pluriel(commande.lignes.length, 'ligne') : commande.articles ? pluriel(commande.articles, 'bouteille') : '';
  const go = async () => {
    setOccupe(true);
    try {
      const r = await recommander(commande.id);
      site?.toast(r.message);
      navigate('/espace-pro/commande');
    } catch (e) {
      setOccupe(false);
      site?.toast(e?.message || 'La commande n’a pas pu être reprise.');
    }
  };
  return (
    <section class="pro-card pro-card--again" aria-labelledby="dash-derniere">
      <div class="pro-again">
        <div class="pro-again__txt">
          <p class="pro-k">Dernière commande</p>
          <h2 class="pro-h2" id="dash-derniere">
            {commande.numero}
          </h2>
          <p class="pro-muted">
            {dateLongue(dateDe(commande))}
            {quantite ? ` · ${quantite}` : ''} · <Montant v={totalHT(commande)} />{NB}HT · <span>{statut(commande.statut).libelle.toLowerCase()}</span>
          </p>
        </div>
        <div class="pro-again__actions">
          <button type="button" class="btn btn--ink btn--sm" onClick={go} disabled={occupe}>
            <Icone n="repeat" />
            {occupe ? 'Un instant…' : 'Recommander'}
          </button>
          <a class="btn btn--ghost btn--sm" href={`/espace-pro/commandes/${commande.id}`}>
            Détail
          </a>
        </div>
      </div>
    </section>
  );
}

// Factures à régler : résumé de l'accueil ({ nombre, totalTTC, enRetard, prochaineEcheance }), puis
// les factures elles-mêmes (GET pro?r=factures) quand il y en a.
function CarteFactures({ resume }) {
  const liste = Array.isArray(resume) ? resume : null;
  const nombre = liste ? liste.length : resume?.nombre || 0;
  const fac = useDonnees('factures', null, { skip: !nombre || !!liste });
  const items = liste || (fac.data?.factures || []).filter((f) => f.statut !== 'payee').slice(0, 4);
  return (
    <section class="pro-card" aria-labelledby="dash-factures">
      <div class="pro-card__head">
        <h2 class="pro-h2" id="dash-factures">
          Factures à régler
        </h2>
        <a class="pro-more" href="/espace-pro/factures">
          Toutes les factures <Icone n="arrow" />
        </a>
      </div>
      {!nombre ? (
        <p class="pro-muted">Aucune facture à régler. Merci{NNB}!</p>
      ) : (
        <>
          {!liste && (
            <p class="pro-muted">
              {pluriel(nombre, 'facture')} · <Montant v={resume.totalTTC} />
              {NB}TTC
              {resume.enRetard ? (
                <>
                  {' · '}
                  <strong class="pro-late">dont {pluriel(resume.enRetard, 'en retard', 'en retard')}</strong>
                </>
              ) : null}
              {resume.prochaineEcheance ? ` · prochaine échéance le ${dateLongue(resume.prochaineEcheance)}` : ''}
            </p>
          )}
          {fac.loading && !fac.data && !liste ? (
            <Chargement lignes={2} />
          ) : fac.error ? (
            <Erreur erreur={fac.error} reessayer={fac.reload} />
          ) : (
            <ul class="pro-list">
              {items.map((f) => {
                const retard = enRetard(f);
                return (
                  <li key={f.numero}>
                    <a class={`pro-list__row${retard ? ' is-late' : ''}`} href={`/espace-pro/factures/${f.commandeId || f.id}`}>
                      <span class="pro-list__main">
                        <strong>{f.numero}</strong>
                        <span class="pro-list__sub">
                          Échéance le {dateLongue(f.echeance)}
                          {retard ? ` · en retard de ${pluriel(joursRetard(f), 'jour')}` : ''}
                          {f.commandeNumero ? ` · commande ${f.commandeNumero}` : ''}
                        </span>
                      </span>
                      <Pastille ton={retard ? 'err' : 'warn'}>{retard ? 'En retard' : 'À régler'}</Pastille>
                      <span class="pro-list__amount">
                        <Montant v={f.montantTTC ?? f.totalTTC ?? totalTTC(f)} /> <small>TTC</small>
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function CarteEncours({ data, compte }) {
  const encours = data.encours ?? 0;
  const max = data.encoursMax ?? compte.encoursMax ?? 0;
  const pct = max ? encours / max : 0;
  const ton = pct >= 1 ? 'err' : pct >= 0.8 ? 'warn' : 'ok';
  return (
    <section class="pro-card" aria-labelledby="dash-solde">
      <h2 class="pro-h2" id="dash-solde">
        Encours
      </h2>
      <p class="pro-big">
        <Montant v={encours} /> <small>TTC</small>
      </p>
      {max > 0 && (
        <>
          <Jauge valeur={encours} max={max} ton={ton} libelle="Encours par rapport au plafond autorisé" texte={`${eur(encours)} sur ${eur(max)}`} />
          <p class="pro-muted">
            sur <Montant v={max} /> autorisés · disponible{NB}: <strong><Montant v={Math.max(0, max - encours)} /></strong>
          </p>
        </>
      )}
      {compte.conditions && <p class="pro-muted">Règlement{NB}: {CONDITIONS[compte.conditions] || compte.conditions}</p>}
    </section>
  );
}

function CarteCommercial({ commercial }) {
  if (!commercial) return null;
  const initiales = String(commercial.nom || '')
    .split(/\s+/)
    .map((x) => x[0])
    .join('')
    .slice(0, 2);
  return (
    <section class="pro-card" aria-labelledby="dash-commercial">
      <h2 class="pro-h2" id="dash-commercial">
        Votre commercial
      </h2>
      <div class="pro-rep">
        <span class="pro-rep__av" aria-hidden="true">
          {initiales}
        </span>
        <div>
          <p class="pro-rep__nom">{commercial.nom}</p>
          {(commercial.poste || commercial.zone) && <p class="pro-muted">{commercial.poste || commercial.zone}</p>}
        </div>
      </div>
      <div class="pro-rep__actions">
        {commercial.telephone && (
          <a class="btn btn--ghost btn--sm" href={`tel:${String(commercial.telephone).replace(/[^\d+]/g, '')}`}>
            <Icone n="phone" />
            {commercial.telephone}
          </a>
        )}
        <a class="btn btn--ghost btn--sm" href="/espace-pro/messages?nouveau=1">
          <Icone n="chat" />
          Écrire
        </a>
      </div>
      {commercial.email && (
        <p class="pro-muted pro-rep__mail">
          <a class="link" href={`mailto:${commercial.email}`}>
            {commercial.email}
          </a>
        </p>
      )}
    </section>
  );
}

// Suggestions de l'API ({ slug, varianteId, nom, volume, photo, colisage, prixHT, raison }) : produits à
// recommander, ajoutés par carton.
function Suggestions({ items, site }) {
  const list = (items || []).filter((s) => s && s.slug).slice(0, 4);
  if (!list.length) return null;
  return (
    <section class="pro-card" aria-labelledby="dash-sugg">
      <h2 class="pro-h2" id="dash-sugg">
        À essayer
      </h2>
      <ul class="pro-sugg">
        {list.map((s) => {
          const v = s.varianteId != null ? { id: s.varianteId, volume: s.volume, colisage: s.colisage, prixHT: s.prixHT } : s.variante || s.variantes?.[0] || {};
          const colisage = v.colisage || 1;
          return (
            <li key={`${s.slug}|${v.id}`} class="pro-sugg__item">
              <Packshot slug={s.slug} photo={s.photo} taille="s" />
              <div class="pro-sugg__txt">
                <p class="pro-sugg__nom">
                  <NomProduit nom={s.nom} />
                </p>
                <p class="pro-muted">
                  {[v.volume ? volume(v.id, v.volume) : null, v.prixHT != null ? `${eur(v.prixHT)}${NB}HT` : null, colisage > 1 ? `carton de ${colisage}` : null].filter(Boolean).join(' · ')}
                </p>
                {s.raison && <p class="pro-sugg__why">{s.raison}</p>}
              </div>
              {v.id != null && (
                <button
                  type="button"
                  class="pro-iconbtn"
                  aria-label={`Ajouter ${colisage > 1 ? `un carton de ${colisage}` : 'une unité'} de ${typo(s.nom)} à la commande`}
                  onClick={() => {
                    panier.set(s.slug, v.id, panier.qte(s.slug, v.id) + colisage);
                    site?.toast(`${typo(s.nom)} ajouté à la commande`);
                  }}
                >
                  <Icone n="plus" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <a class="pro-more" href="/espace-pro/catalogue">
        Tout le catalogue <Icone n="arrow" />
      </a>
    </section>
  );
}
