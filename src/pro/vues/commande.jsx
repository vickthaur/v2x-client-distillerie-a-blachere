// Commande en cours : lignes par carton, devis du serveur (totaux HT, TVA par taux, TTC, port,
// franco, minimum, alertes de stock et d'encours), adresse de livraison (choix ou création), date
// souhaitée, référence de commande, commentaire, validation → numéro de commande.
import { useEffect, useRef, useState } from 'preact/hooks';
import { pro, useCatalogue, useDonnees, chargerCatalogue } from '../donnees.js';
import { panier, usePanier } from '../panier.js';
import { devisLignes } from '../commun.js';
import { Adresse, AdresseForm } from '../adresses.jsx';
import { eur, dateJour, isoJour, joursOuvres, pluriel, volume, typo, CONDITIONS, NB, pourcent } from '../format.js';
import { Chargement, Erreur, Evin, Icone, Jauge, Montant, NomProduit, Note, Packshot, Pas, TitreVue, Vide } from '../ui.jsx';

export function Commande({ site, session }) {
  const cat = useCatalogue();
  const p = usePanier();
  const [faite, setFaite] = useState(null);
  if (faite) return <Confirmation commande={faite} />;
  return (
    <>
      <TitreVue kicker="Tarifs de démonstration · prix hors taxes" titre="Votre" accent="commande">
        <p class="pro-lead">Vérifiez les quantités, choisissez l’adresse de livraison et validez. La distillerie prépare votre commande sous 48 à 72{NB}h ouvrées.</p>
      </TitreVue>
      {!p.lignes.length ? (
        <Vide
          titre="Votre commande est vide."
          icone="bag"
          action={
            <div class="pro-actions">
              <a class="btn btn--primary btn--sm" href="/espace-pro/catalogue">
                Ouvrir le catalogue
              </a>
              <a class="btn btn--ghost btn--sm" href="/espace-pro/commandes">
                Recommander une commande passée
              </a>
            </div>
          }
        >
          Ajoutez des cartons depuis le catalogue, ou reprenez une commande passée en un geste.
        </Vide>
      ) : cat.loading && !cat.data ? (
        <Chargement lignes={4} />
      ) : cat.error && !cat.data ? (
        <Erreur erreur={cat.error} reessayer={cat.reload} />
      ) : (
        <Formulaire cat={cat.data} p={p} site={site} session={session} onFaite={setFaite} />
      )}
    </>
  );
}

function Formulaire({ cat, p, site, session, onFaite }) {
  const compte = useDonnees('compte');
  const [devis, setDevis] = useState(null);
  const [devisErr, setDevisErr] = useState(null);
  const [calcul, setCalcul] = useState(false);
  const [nouvelle, setNouvelle] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [tour, setTour] = useState(0);
  const errRef = useRef(null);
  const lignesKey = JSON.stringify(p.lignes);

  // Devis du serveur à chaque changement de quantité (un instant après le dernier clic).
  useEffect(() => {
    let on = true;
    setCalcul(true);
    const t = setTimeout(() => {
      pro('devis', { method: 'POST', body: { lignes: devisLignes(p.lignes) } }).then(
        (d) => {
          if (!on) return;
          setDevis(d);
          setDevisErr(null);
          setCalcul(false);
        },
        (e) => {
          if (!on) return;
          setDevisErr(e);
          setCalcul(false);
        },
      );
    }, 250);
    return () => {
      on = false;
      clearTimeout(t);
    };
  }, [lignesKey, tour]);

  const c = compte.data?.compte || compte.data || {};
  const adresses = c.adressesLivraison || [];
  // Adresse par défaut : la dernière choisie, sinon la première du compte.
  useEffect(() => {
    if (!adresses.length) return;
    if (!p.adresseId || !adresses.some((a) => a.id === p.adresseId)) panier.meta({ adresseId: adresses[0].id });
  }, [adresses.map((a) => a.id).join()]);

  const conditions = { ...(cat.conditions || {}), ...(devis?.conditions || {}) };
  const t = devis?.totaux || {};
  const minimum = devis?.minimumHT ?? conditions.minimumHT ?? 0;
  const articlesHT = t.articlesHT ?? null;
  const manque = minimum && articlesHT != null ? Math.max(0, Math.round((minimum - articlesHT) * 100) / 100) : 0;
  const franco = devis?.francoHT ?? conditions.francoHT ?? 0;
  const reste = devis?.francoRestantHT ?? (franco && articlesHT != null ? Math.max(0, franco - articlesHT) : null);
  const alertes = (devis?.alertes || []).map((a) => (typeof a === 'string' ? { message: a } : a));
  const bloquantes = alertes.filter((a) => a.bloquant || ['stock', 'encours', 'rupture', 'licence'].includes(a.type));
  const alcool = p.lignes.some((l) => cat.index[`${l.slug}|${l.varianteId}`]?.produit?.alcool);
  const minDate = isoJour(joursOuvres(2));

  const envoyer = async (e) => {
    e.preventDefault();
    setErreur(null);
    if (!p.adresseId) {
      setErreur({ message: 'Choisissez l’adresse de livraison.', champ: 'adresse' });
      return requestAnimationFrame(() => document.querySelector('[name="adresse"]')?.focus());
    }
    if (p.dateSouhaitee && p.dateSouhaitee < minDate) {
      setErreur({ message: `La date souhaitée doit laisser 48 à 72${NB}h ouvrées : à partir du ${dateJour(minDate)}.`, champ: 'dateSouhaitee' });
      return requestAnimationFrame(() => document.getElementById('cmd-date')?.focus());
    }
    setEnvoi(true);
    try {
      const r = await pro('commande', {
        method: 'POST',
        body: {
          lignes: devisLignes(p.lignes),
          adresseId: p.adresseId,
          dateSouhaitee: p.dateSouhaitee || undefined,
          referenceClient: p.referenceClient.trim() || undefined,
          commentaire: p.commentaire.trim() || undefined,
        },
      });
      const adresse = adresses.find((a) => a.id === p.adresseId);
      const recap = { ...r, adresse, dateSouhaitee: p.dateSouhaitee, referenceClient: p.referenceClient.trim(), totaux: r?.totaux || r?.commande?.totaux || devis?.totaux };
      panier.vider();
      chargerCatalogue({ force: true }).catch(() => {});
      onFaite(recap);
    } catch (x) {
      setEnvoi(false);
      setErreur(x);
      // Le devis est peut-être devenu faux (stock, encours) : on le refait.
      pro('devis', { method: 'POST', body: { lignes: devisLignes(p.lignes) } }).then(setDevis, () => {});
      requestAnimationFrame(() => {
        const champ = String(x?.champ || '').split('.').pop();
        const el = champ === 'dateSouhaitee' ? document.getElementById('cmd-date') : champ === 'referenceClient' ? document.getElementById('cmd-ref') : champ === 'adresseId' ? document.querySelector('[name="adresse"]') : null;
        (el || errRef.current)?.focus();
      });
    }
  };

  return (
    <form class="cmd" onSubmit={envoyer} noValidate>
      <div class="cmd__main">
        <section class="pro-card cmd-lines" aria-labelledby="cmd-lignes">
          <div class="pro-card__head">
            <h2 class="pro-h2" id="cmd-lignes">
              Articles <span class="pro-muted">· {pluriel(p.lignes.length, 'ligne')}</span>
            </h2>
            <a class="pro-more" href="/espace-pro/catalogue">
              <Icone n="plus" /> Ajouter des produits
            </a>
          </div>
          <ul class="cmd-list">
            {p.lignes.map((l) => (
              <Ligne key={`${l.slug}|${l.varianteId}`} l={l} cat={cat} devis={devis} />
            ))}
          </ul>
          {alcool && <Evin />}
        </section>

        <section class="pro-card" aria-labelledby="cmd-livraison">
          <h2 class="pro-h2" id="cmd-livraison">
            Livraison
          </h2>
          {compte.loading && !compte.data ? (
            <Chargement lignes={2} texte="Chargement des adresses…" />
          ) : compte.error ? (
            <Erreur erreur={compte.error} reessayer={compte.reload} titre="Les adresses n’ont pas pu être chargées." />
          ) : (
            <fieldset class="cmd-adr" aria-describedby={erreur?.champ === 'adresse' ? 'cmd-err' : undefined}>
              <legend class="pro-label">Adresse de livraison</legend>
              <div class="cmd-adr__list">
                {adresses.map((a) => (
                  <label class={`pro-choice${p.adresseId === a.id ? ' is-on' : ''}`} key={a.id}>
                    <input type="radio" name="adresse" value={a.id} checked={p.adresseId === a.id} onChange={() => panier.meta({ adresseId: a.id })} />
                    <span class="pro-choice__card">
                      <Adresse a={a} />
                    </span>
                  </label>
                ))}
              </div>
              {nouvelle ? (
                <AdresseForm
                  onAnnuler={() => setNouvelle(false)}
                  onEnregistrer={async (val) => {
                    const r = await pro('adresse', { method: 'POST', body: val });
                    const id = r?.id || r?.adresse?.id || r?.adressesLivraison?.at?.(-1)?.id;
                    compte.reload();
                    if (id) panier.meta({ adresseId: id });
                    setNouvelle(false);
                    site?.toast('Adresse ajoutée au compte');
                  }}
                />
              ) : (
                <button type="button" class="link pro-linkbtn cmd-adr__add" onClick={() => setNouvelle(true)}>
                  <Icone n="plus" /> Livrer à une autre adresse
                </button>
              )}
            </fieldset>
          )}
          <div class="pro-grid cmd-fields">
            <label class="field">
              <span>Date de livraison souhaitée (facultatif)</span>
              <input
                type="date"
                id="cmd-date"
                min={minDate}
                value={p.dateSouhaitee}
                onChange={(e) => panier.meta({ dateSouhaitee: e.currentTarget.value })}
                aria-invalid={erreur?.champ === 'dateSouhaitee' ? 'true' : undefined}
                class={erreur?.champ === 'dateSouhaitee' ? 'is-invalid' : ''}
              />
              <small>À partir du {dateJour(minDate)}, du lundi au vendredi.</small>
            </label>
            <label class="field">
              <span>Votre référence de commande (facultatif)</span>
              <input type="text" id="cmd-ref" maxLength={40} value={p.referenceClient} onInput={(e) => panier.meta({ referenceClient: e.currentTarget.value })} placeholder="Ex. BC-2026-118" />
              <small>Reprise sur le bon de livraison et la facture.</small>
            </label>
            <label class="field pro-span2">
              <span>Commentaire pour la distillerie (facultatif)</span>
              <textarea rows={3} maxLength={1000} value={p.commentaire} onInput={(e) => panier.meta({ commentaire: e.currentTarget.value })} placeholder="Créneau de livraison, accès, demande particulière…" />
            </label>
          </div>
        </section>
      </div>

      <aside class="cmd__side" aria-label="Récapitulatif de la commande">
        <section class="pro-card cmd-sum" aria-labelledby="cmd-recap" aria-busy={calcul ? 'true' : 'false'}>
          <h2 class="pro-h2" id="cmd-recap">
            Récapitulatif
          </h2>
          {devisErr && !devis ? (
            <Erreur erreur={devisErr} titre="Le calcul de la commande a échoué." reessayer={() => setTour((n) => n + 1)} />
          ) : !devis ? (
            <Chargement lignes={3} texte="Calcul de la commande…" />
          ) : (
            <Totaux t={t} devis={devis} />
          )}
          {devis && franco > 0 && (
            <div class="pro-franco">
              <Jauge valeur={articlesHT || 0} max={franco} ton={reste > 0 ? 'ink' : 'ok'} libelle="Progression vers la livraison offerte" texte={reste > 0 ? `Plus que ${eur(reste)} HT pour la livraison offerte` : 'Livraison offerte'} />
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
          {devis && manque > 0 && (
            <Note ton="warn" titre={`Minimum de commande${NB}: ${eur(minimum)}${NB}HT`}>
              Il manque {eur(manque)}
              {NB}HT d’articles pour valider.
            </Note>
          )}
          {alertes
            .filter((a) => a.type !== 'minimum')
            .map((a, i) => (
              <Note key={i} ton={bloquantes.includes(a) ? 'err' : 'warn'}>
                {a.message}
              </Note>
            ))}
          {erreur && (
            <div ref={errRef} tabindex="-1" id="cmd-err">
              <Note ton="err" role="alert" titre="La commande n’a pas été validée.">
                {erreur.message}
              </Note>
            </div>
          )}
          <button type="submit" class="btn btn--primary btn--block" disabled={envoi || calcul || !devis || manque > 0}>
            {envoi ? 'Validation…' : devis ? `Valider la commande · ${eur(t.totalHT ?? 0)} HT` : 'Valider la commande'}
          </button>
          <ul class="cmd-terms">
            <li>
              <Icone n="truck" />
              <span>Livraison sous 48 à 72{NB}h ouvrées{conditions.fraisPortHT ? `, port ${eur(conditions.fraisPortHT)} HT sous le franco` : ''}.</span>
            </li>
            <li>
              <Icone n="euro" />
              <span>Règlement{NB}: {CONDITIONS[session.compte?.conditions || compte.data?.compte?.conditions] || 'selon les conditions de votre compte'}, facture à l’expédition.</span>
            </li>
          </ul>
        </section>
      </aside>
    </form>
  );
}

function Ligne({ l, cat, devis }) {
  const x = cat.index[`${l.slug}|${l.varianteId}`];
  const p = x?.produit;
  const v = x?.variante;
  const d = (devis?.lignes || []).find((y) => y.slug === l.slug && String(y.varianteId) === String(l.varianteId));
  const colisage = Math.max(1, v?.colisage || d?.colisage || 1);
  const nom = typo(p?.nom || d?.nom || l.slug);
  const vol = volume(l.varianteId, v?.volume || d?.volume);
  const pu = d?.prixUnitaireHT ?? v?.prixHT ?? null;
  const total = d?.totalHT ?? (pu != null ? Math.round(pu * l.qte * 100) / 100 : null);
  const indispo = !x;
  return (
    <li class={`cmd-line${indispo ? ' is-out' : ''}`}>
      <Packshot slug={l.slug} photo={p?.photo} taille="s" />
      <div class="cmd-line__info">
        <p class="cmd-line__nom">
          <NomProduit nom={nom} />
        </p>
        <p class="pro-muted">
          {vol} · {colisage > 1 ? `carton de ${colisage}` : 'à l’unité'}
          {pu != null ? ` · ${eur(pu)} HT l’unité` : ''}
        </p>
        {indispo && <p class="cmd-line__warn">Ce produit n’est plus proposé à votre compte&nbsp;: retirez-le pour valider.</p>}
        {v?.etat === 'rupture' && <p class="cmd-line__warn">En rupture de stock.</p>}
        {v?.etat === 'stock-bas' && <p class="cmd-line__low">Stock bas&nbsp;: la distillerie vous confirme les quantités.</p>}
      </div>
      <div class="cmd-line__qte">
        <Pas qte={l.qte} colisage={colisage} nom={`${nom} ${vol}`} onChange={(n) => panier.set(l.slug, l.varianteId, n)} />
      </div>
      <p class="cmd-line__total">{total != null ? <Montant v={total} /> : '—'}</p>
      <button type="button" class="pro-iconbtn cmd-line__del" onClick={() => panier.set(l.slug, l.varianteId, 0)} aria-label={`Retirer ${nom} ${vol} de la commande`}>
        <Icone n="trash" />
      </button>
    </li>
  );
}

function Totaux({ t, devis }) {
  const port = t.fraisPortHT ?? t.livraisonHT ?? devis?.fraisPortHT ?? null;
  const tva = Array.isArray(t.tva) ? t.tva : [];
  return (
    <dl class="pro-totals">
      <div>
        <dt>Articles</dt>
        <dd>
          <Montant v={t.articlesHT} />
        </dd>
      </div>
      {t.remiseHT > 0 && (
        <div>
          <dt>Remise</dt>
          <dd>
            −<Montant v={t.remiseHT} />
          </dd>
        </div>
      )}
      <div>
        <dt>Frais de port</dt>
        <dd>{port ? <Montant v={port} /> : <span class="pro-ok">Offerts</span>}</dd>
      </div>
      <div class="pro-totals__sub">
        <dt>Total HT</dt>
        <dd>
          <Montant v={t.totalHT} />
        </dd>
      </div>
      {tva.map((x) => (
        <div key={x.taux} class="pro-totals__tva">
          <dt>
            TVA {pourcent(x.taux)} <small>sur {eur(x.baseHT)}</small>
          </dt>
          <dd>
            <Montant v={x.montant} />
          </dd>
        </div>
      ))}
      <div class="pro-totals__grand">
        <dt>Total TTC</dt>
        <dd>
          <Montant v={t.totalTTC} />
        </dd>
      </div>
    </dl>
  );
}

function Confirmation({ commande }) {
  useEffect(() => {
    scrollTo({ top: 0 });
    document.getElementById('pro-titre')?.focus({ preventScroll: true });
  }, []);
  const t = commande.totaux || {};
  const id = commande.id || commande.commande?.id;
  const crm = commande.liens?.crm;
  return (
    <div class="pro-done">
      <span class="pro-done__seal" aria-hidden="true">
        <Icone n="check" />
      </span>
      <p class="kicker">Merci{NB}!</p>
      <h1 class="pro-h1" id="pro-titre" tabindex="-1">
        Commande <span class="accent pro-nowrap">{commande.numero}</span> enregistrée
      </h1>
      <p class="pro-lead">La distillerie la prépare sous 48 à 72{NB}h ouvrées. Vous suivez sa préparation et son expédition dans vos commandes&nbsp;; la facture est émise à l’expédition.</p>
      <dl class="pro-recap">
        {t.totalHT != null && (
          <div>
            <dt>Montant</dt>
            <dd>
              <Montant v={t.totalHT} />
              {NB}HT · <Montant v={t.totalTTC} />
              {NB}TTC
            </dd>
          </div>
        )}
        {commande.adresse && (
          <div>
            <dt>Livraison</dt>
            <dd>
              <Adresse a={commande.adresse} />
            </dd>
          </div>
        )}
        {commande.dateSouhaitee && (
          <div>
            <dt>Date souhaitée</dt>
            <dd>{dateJour(commande.dateSouhaitee)}</dd>
          </div>
        )}
        {commande.referenceClient && (
          <div>
            <dt>Votre référence</dt>
            <dd>{commande.referenceClient}</dd>
          </div>
        )}
      </dl>
      <div class="pro-actions">
        {id && (
          <a class="btn btn--primary" href={`/espace-pro/commandes/${id}`}>
            Suivre la commande
          </a>
        )}
        <a class="btn btn--ghost" href="/espace-pro/accueil">
          Retour à l’accueil
        </a>
        {crm && (
          <a class="btn btn--ghost" href={crm} data-reload>
            Voir la commande dans le CRM (démo)
          </a>
        )}
      </div>
      <p class="pro-fine">Démonstration&nbsp;: la commande est enregistrée dans l’espace de démonstration de ce navigateur et apparaît dans le CRM de démonstration&#8239;; rien n’est transmis à la distillerie.</p>
    </div>
  );
}

