// Produits et stocks : catalogue rangé par gamme ; pour chaque contenance, prix TTC, prix pro HT,
// stock et état, seuil, colisage, ventes des 30 derniers jours ; activation, modification en
// ligne, mouvements de stock (production, inventaire, casse, ajustement) et historique.
import { Fragment } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { crm, crmUrl, elements, invalider, useCrm } from '../lib/data.js';
import { useFil, useSession } from '../lib/session.jsx';
import { navigate, useQuery } from '../lib/router.jsx';
import { Icon } from '../ui/icons.jsx';
import { Button, Empty, Erreur, Notice, PageHead, Pill, SearchInput, SkeletonRows, Statut, cx, useTitre } from '../ui/base.jsx';
import { Choices, Input, Switch, Textarea, ecrireNombre, erreurDe, lireNombre } from '../ui/form.jsx';
import { Dialog, Drawer, toast } from '../ui/overlay.jsx';
import { Marque } from '../ui/marque.jsx';
import { Vignette } from './commande.jsx';
import { lireProduits } from './nouvelle-commande.jsx';
import { GAMMES, MOTIF_STOCK, STOCK } from '../lib/statuts.js';
import { dateHeure, euros, nombre, plier, pluriel, relatif } from '../lib/format.js';

export const etatStock = (v) => v.etat || (Number(v.stock) <= 0 ? 'rupture' : Number(v.stock) <= Number(v.seuil) ? 'stock-bas' : 'disponible');

export function Produits({ slug }) {
  useTitre('Produits et stocks');
  const s = useSession();
  const [q, setQ] = useQuery();
  const recherche = q.get('q') || '';
  const gamme = q.get('gamme') || '';
  const stock = q.get('stock') || '';
  const r = useCrm('produits', {}, { garder: true });
  const tous = useMemo(() => lireProduits(r.data), [r.data]);
  const peutPrix = s.peut('produits', 'ecriture');
  const peutStock = s.peut('stocks', 'ecriture');
  const [mouvement, setMouvement] = useState(null);
  const [historique, setHistorique] = useState(false);
  const [edition, setEdition] = useState(null);

  const filtres = useMemo(() => {
    const t = plier(recherche.trim());
    return tous
      .map((p) => {
        const variantes = p.variantes.filter((v) => !stock || (stock === 'bas' ? etatStock(v) !== 'disponible' : etatStock(v) === 'rupture'));
        return { ...p, variantes };
      })
      .filter((p) => p.variantes.length && (!gamme || p.gamme === gamme) && (!t || plier(`${p.nom} ${p.slug} ${GAMMES[p.gamme]?.nom || ''}`).includes(t)));
  }, [tous, recherche, gamme, stock]);

  const groupes = useMemo(() => {
    const g = new Map();
    for (const p of filtres) {
      if (!g.has(p.gamme)) g.set(p.gamme, []);
      g.get(p.gamme).push(p);
    }
    return [...g.entries()].sort((a, b) => (GAMMES[a[0]]?.ordre || 99) - (GAMMES[b[0]]?.ordre || 99));
  }, [filtres]);

  const nbVariantes = tous.reduce((t, p) => t + p.variantes.length, 0);
  const nbBas = tous.reduce((t, p) => t + p.variantes.filter((v) => etatStock(v) !== 'disponible').length, 0);
  const produitOuvert = slug ? tous.find((p) => p.slug === slug) : null;
  useFil(produitOuvert?.nom);

  // Mise à jour locale d'une contenance (réponse de l'API ou valeurs envoyées)
  const majVariante = (pslug, vid, patch) =>
    r.mutate((d) => {
      if (!d) return d;
      const maj = (p) => {
        if (p.slug !== pslug) return p;
        if (Array.isArray(p.variantes)) return { ...p, variantes: p.variantes.map((v) => (v.id === vid ? { ...v, ...patch } : v)) };
        return { ...p, variantes: { ...p.variantes, [vid]: { ...p.variantes[vid], ...patch } } };
      };
      if (Array.isArray(d)) return d.map(maj);
      if (Array.isArray(d.elements)) return { ...d, elements: d.elements.map(maj) };
      if (Array.isArray(d.produits)) return { ...d, produits: d.produits.map(maj) };
      return d;
    });
  const majProduit = (pslug, patch) =>
    r.mutate((d) => {
      if (!d) return d;
      const maj = (p) => (p.slug === pslug ? { ...p, ...patch } : p);
      if (Array.isArray(d)) return d.map(maj);
      if (Array.isArray(d.elements)) return { ...d, elements: d.elements.map(maj) };
      if (Array.isArray(d.produits)) return { ...d, produits: d.produits.map(maj) };
      return d;
    });

  const basculerActif = async (p, actif) => {
    majProduit(p.slug, { actif });
    try {
      await crm('produit', { method: 'PATCH', query: { slug: p.slug }, body: { actif } });
      toast(actif ? `${p.nom} remis en vente` : `${p.nom} retiré de la vente`, { detail: actif ? 'Visible dans la boutique et l’espace pro de la démo.' : 'Masqué de la boutique et de l’espace pro de la démo.' });
      invalider('tableau');
    } catch (e) {
      majProduit(p.slug, { actif: !actif });
      toast.erreur(e);
    }
  };

  const enregistrer = async (p, v, valeurs) => {
    const avant = { ...v };
    majVariante(p.slug, v.id, valeurs);
    try {
      const d = await crm('produit', { method: 'PATCH', query: { slug: p.slug }, body: { variantes: { [v.id]: valeurs } } });
      const maj = lireProduits(d ? { produits: [d.produit || d] } : null)[0]?.variantes?.find((x) => x.id === v.id);
      if (maj) majVariante(p.slug, v.id, maj);
      toast(`${p.nom} ${v.volume} mis à jour`);
      setEdition(null);
      invalider('tableau');
    } catch (e) {
      majVariante(p.slug, v.id, avant);
      throw e;
    }
  };

  return (
    <div class="page">
      <PageHead
        titre="Produits et stocks"
        sous={r.data ? `${pluriel(tous.length, 'produit', 'produits')} · ${pluriel(nbVariantes, 'contenance', 'contenances')}${nbBas ? ` · ${pluriel(nbBas, 'stock à surveiller', 'stocks à surveiller')}` : ''}` : 'Catalogue officiel, prix et stocks de démonstration'}
        actions={
          <>
            <Button icon="mouvements" onClick={() => setHistorique(true)}>
              <span class="hide-s">Mouvements</span>
            </Button>
            {s.peut('exports') && (
              <Button href={crmUrl('export', { type: 'produits' })} target="_blank" download="" icon="telecharger">
                <span class="hide-s">Exporter</span>
              </Button>
            )}
          </>
        }
      />
      <div class="toolbar">
        <SearchInput class="toolbar__search" value={recherche} onChange={(v) => setQ({ q: v })} placeholder="Produit, parfum, gamme…" label="Rechercher un produit" delai={140} />
        <select class="select select--sm" style="width:auto" aria-label="Gamme" value={gamme} onChange={(e) => setQ({ gamme: e.currentTarget.value })}>
          <option value="">Toutes les gammes</option>
          {Object.entries(GAMMES).map(([k, g]) => (
            <option key={k} value={k}>
              {g.nom}
            </option>
          ))}
        </select>
        <div class="seg" role="group" aria-label="Stock">
          {[['', 'Tous'], ['bas', 'Stock bas'], ['rupture', 'Rupture']].map(([id, l]) => (
            <button key={id} type="button" aria-pressed={stock === id ? 'true' : 'false'} onClick={() => setQ({ stock: id })}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <p class="small muted mb">Prix publics TTC du catalogue officiel ; prix pro, stocks, seuils et colisages fictifs (démonstration).</p>

      {r.error && !r.data && <Erreur erreur={r.error} onRetry={r.reload} />}
      {!r.data && !r.error && (
        <div class="card">
          <SkeletonRows n={10} cols={6} />
        </div>
      )}
      {r.data && groupes.length === 0 && (
        <div class="card">
          <Empty icone="bouteille" titre="Aucun produit" texte="Aucun produit ne correspond à ces filtres." action={<Button onClick={() => setQ({ q: '', gamme: '', stock: '' })}>Effacer les filtres</Button>} />
        </div>
      )}
      {groupes.length > 0 && (
        <div class={cx('card', r.refreshing && 'refreshing')}>
          <div class="tbl-wrap only-desk">
            <table class="tbl tbl--produits">
              <caption class="sr-only">Produits et stocks par gamme</caption>
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Contenance</th>
                  <th class="num">Prix TTC</th>
                  <th class="num">Pro HT</th>
                  <th class="num">Stock</th>
                  <th class="num">Seuil</th>
                  <th class="num">Colis</th>
                  <th class="num">Vendus 30 j</th>
                  <th class="w-actions">
                    <span class="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              {groupes.map(([g, produits]) => (
                <tbody key={g}>
                  <tr class="grp">
                    <th colSpan={9} scope="colgroup" id={`gamme-${g}`}>
                      <span class="grp__nom">
                        <Marque texte={GAMMES[g]?.nom || g} logo />
                      </span>
                      <span class="grp__n">
                        {pluriel(produits.length, 'produit', 'produits')}
                        {produits.some((p) => p.alcool) && <span class="age18" style="margin-left:8px">18+</span>}
                      </span>
                    </th>
                  </tr>
                  {produits.map((p) => (
                    <Fragment key={p.slug}>
                      {p.variantes.map((v, i) => (
                        <LigneVariante
                          key={v.id}
                          p={p}
                          v={v}
                          premiere={i === 0}
                          n={p.variantes.length}
                          edition={edition === `${p.slug}/${v.id}`}
                          onEditer={() => setEdition(`${p.slug}/${v.id}`)}
                          onAnnuler={() => setEdition(null)}
                          onEnregistrer={(val) => enregistrer(p, v, val)}
                          onMouvement={() => setMouvement({ p, v })}
                          onActif={(a) => basculerActif(p, a)}
                          peutPrix={peutPrix}
                          peutStock={peutStock}
                        />
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
          <div class="only-mob">
            {groupes.map(([g, produits]) => (
              <section key={g} aria-labelledby={`gm-${g}`}>
                <h2 class="grp-mob" id={`gm-${g}`}>
                  <Marque texte={GAMMES[g]?.nom || g} logo />
                  <span class="grp__n">{pluriel(produits.length, 'produit', 'produits')}</span>
                </h2>
                <div class="prod-cards">
                  {produits.map((p) => (
                    <CarteProduit key={p.slug} p={p} peutPrix={peutPrix} peutStock={peutStock} onActif={(a) => basculerActif(p, a)} onMouvement={(v) => setMouvement({ p, v })} onEditer={(v) => setEdition(`m:${p.slug}/${v.id}`)} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}

      {edition?.startsWith('m:') &&
        (() => {
          const [ps, vid] = edition.slice(2).split('/');
          const p = tous.find((x) => x.slug === ps);
          const v = p?.variantes.find((x) => x.id === vid);
          return p && v ? <DialogVariante p={p} v={v} peutPrix={peutPrix} peutStock={peutStock} onClose={() => setEdition(null)} onEnregistrer={(val) => enregistrer(p, v, val)} /> : null;
        })()}
      {mouvement && (
        <DialogMouvement
          p={mouvement.p}
          v={mouvement.v}
          onClose={() => setMouvement(null)}
          onFait={(stockNouveau) => {
            if (stockNouveau !== undefined) majVariante(mouvement.p.slug, mouvement.v.id, { stock: stockNouveau, etat: undefined });
            r.reload({ silencieux: true });
            invalider('mouvements', 'tableau');
          }}
        />
      )}
      {historique && <DrawerMouvements onClose={() => setHistorique(false)} />}
      {slug && (
        <DrawerMouvements
          slug={slug}
          produit={produitOuvert}
          onClose={() => navigate(`/crm/produits${location.search}`, { replace: true })}
          onMouvement={peutStock && produitOuvert ? (v) => setMouvement({ p: produitOuvert, v }) : null}
        />
      )}
    </div>
  );
}

function LigneVariante({ p, v, premiere, n, edition, onEditer, onAnnuler, onEnregistrer, onMouvement, onActif, peutPrix, peutStock }) {
  const etat = etatStock(v);
  const [f, setF] = useState({});
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (edition) {
      setF({ prixTTC: ecrireNombre(v.prixTTC), prixProHT: ecrireNombre(v.prixProHT), seuil: String(v.seuil ?? ''), colisage: String(v.colisage ?? '') });
      setErr(null);
      requestAnimationFrame(() => ref.current?.querySelector('input')?.focus());
    }
  }, [edition]);
  const valider = async () => {
    const val = {};
    if (peutPrix) {
      val.prixTTC = lireNombre(f.prixTTC);
      val.prixProHT = lireNombre(f.prixProHT);
      val.colisage = lireNombre(f.colisage);
    }
    if (peutPrix || peutStock) val.seuil = lireNombre(f.seuil);
    for (const [k, x] of Object.entries(val)) {
      if (x === null || Number.isNaN(x) || x < 0) return setErr(`Valeur invalide : ${{ prixTTC: 'prix TTC', prixProHT: 'prix pro HT', seuil: 'seuil', colisage: 'colisage' }[k]}.`);
    }
    setBusy(true);
    try {
      await onEnregistrer(val);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  const touches = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      valider();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onAnnuler();
    }
  };
  const champ = (k, lab, suffixe, desactive) => (
    <input class="input input--sm input--num" aria-label={`${lab} de ${p.nom} ${v.volume}`} inputMode="decimal" value={f[k]} disabled={desactive} onInput={(e) => setF({ ...f, [k]: e.currentTarget.value })} onKeyDown={touches} />
  );
  return (
    <tr class={cx(!premiere && 'tbl__suite', p.actif === false && 'is-inactif', edition && 'is-edition')} ref={ref}>
      {premiere && (
        <td rowSpan={n} class="prod-cell">
          <div class="ligne-prod">
            <Vignette slug={p.slug} />
            <div style="min-width:0">
              <div class="strong prod-cell__nom">
                <Marque texte={p.nom} logo />
                {p.alcool && <span class="age18" style="margin-left:6px">18+</span>}
              </div>
              <Switch label={p.actif === false ? 'Hors vente' : 'En vente'} checked={p.actif !== false} disabled={!peutPrix} onChange={(e) => onActif(e.currentTarget.checked)} class="switch--s" />
            </div>
          </div>
        </td>
      )}
      <td class="nowrap">{v.volume}</td>
      <td class="num">{edition ? champ('prixTTC', 'Prix TTC', '€', !peutPrix) : euros(v.prixTTC)}</td>
      <td class="num">{edition ? champ('prixProHT', 'Prix pro HT', '€', !peutPrix) : euros(v.prixProHT)}</td>
      <td class="num">
        <span class="stock">
          <span class="strong">{nombre(v.stock)}</span>
          {etat !== 'disponible' && <Statut table={STOCK} valeur={etat} />}
        </span>
      </td>
      <td class="num">{edition ? champ('seuil', 'Seuil', '', !(peutPrix || peutStock)) : nombre(v.seuil)}</td>
      <td class="num">{edition ? champ('colisage', 'Colisage', '', !peutPrix) : nombre(v.colisage)}</td>
      <td class="num">{nombre(v.vendus30 ?? v.vendus ?? 0)}</td>
      <td class="w-actions">
        {edition ? (
          <div class="row" style="gap:4px;justify-content:flex-end">
            {err && (
              <span class="field__err" role="alert" style="max-width:180px">
                {err}
              </span>
            )}
            <Button size="sm" variant="ghost" onClick={onAnnuler}>
              Annuler
            </Button>
            <Button size="sm" variant="primary" busy={busy} onClick={valider}>
              Enregistrer
            </Button>
          </div>
        ) : (
          <div class="row" style="gap:2px;justify-content:flex-end">
            {peutStock && (
              <Button size="sm" variant="ghost" icon="mouvements" onClick={onMouvement} aria-label={`Mouvement de stock : ${p.nom} ${v.volume}`} title="Mouvement de stock" />
            )}
            {(peutPrix || peutStock) && <Button size="sm" variant="ghost" icon="crayon" onClick={onEditer} aria-label={`Modifier ${p.nom} ${v.volume}`} title="Modifier" />}
          </div>
        )}
      </td>
    </tr>
  );
}

function CarteProduit({ p, peutPrix, peutStock, onActif, onMouvement, onEditer }) {
  return (
    <div class={cx('prod-card', p.actif === false && 'is-inactif')}>
      <div class="prod-card__head">
        <Vignette slug={p.slug} />
        <div class="grow" style="min-width:0">
          <div class="strong">
            <Marque texte={p.nom} logo />
            {p.alcool && <span class="age18" style="margin-left:6px">18+</span>}
          </div>
          <Switch label={p.actif === false ? 'Hors vente' : 'En vente'} checked={p.actif !== false} disabled={!peutPrix} onChange={(e) => onActif(e.currentTarget.checked)} class="switch--s" />
        </div>
      </div>
      {p.variantes.map((v) => {
        const etat = etatStock(v);
        return (
          <div class="prod-card__var" key={v.id}>
            <div class="prod-card__row">
              <span class="strong">{v.volume}</span>
              <span class="stock">
                <span class="strong tnum">{nombre(v.stock)}</span>
                <Statut table={STOCK} valeur={etat} />
              </span>
            </div>
            <div class="prod-card__row small muted tnum">
              <span>
                {euros(v.prixTTC)} TTC · pro {euros(v.prixProHT)} HT
              </span>
              <span>
                seuil {nombre(v.seuil)} · {nombre(v.vendus30 ?? 0)} vendus
              </span>
            </div>
            {(peutStock || peutPrix) && (
              <div class="btn-row">
                {peutStock && (
                  <Button size="sm" icon="mouvements" onClick={() => onMouvement(v)}>
                    Mouvement
                  </Button>
                )}
                <Button size="sm" variant="ghost" icon="crayon" onClick={() => onEditer(v)}>
                  Modifier
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DialogVariante({ p, v, peutPrix, peutStock, onClose, onEnregistrer }) {
  const [f, setF] = useState({ prixTTC: ecrireNombre(v.prixTTC), prixProHT: ecrireNombre(v.prixProHT), seuil: String(v.seuil ?? ''), colisage: String(v.colisage ?? '') });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const maj = (k) => (e) => setF({ ...f, [k]: e.currentTarget.value });
  const envoyer = async () => {
    const val = {};
    if (peutPrix) {
      val.prixTTC = lireNombre(f.prixTTC);
      val.prixProHT = lireNombre(f.prixProHT);
      val.colisage = lireNombre(f.colisage);
    }
    val.seuil = lireNombre(f.seuil);
    if (Object.values(val).some((x) => x === null || Number.isNaN(x) || x < 0)) return setErr({ message: 'Vérifiez les valeurs saisies (nombres positifs).' });
    setBusy(true);
    try {
      await onEnregistrer(val);
      onClose();
    } catch (e) {
      setErr(e);
      setBusy(false);
    }
  };
  return (
    <Dialog
      titre={`${p.nom} · ${v.volume}`}
      icone="crayon"
      onClose={onClose}
      onSubmit={envoyer}
      pied={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="primary" busy={busy}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div class="form">
        <div class="form-grid">
          <Input label="Prix public" suffixe="€ TTC" inputMode="decimal" value={f.prixTTC} onInput={maj('prixTTC')} disabled={!peutPrix} error={erreurDe(err, 'prixTTC')} />
          <Input label="Prix pro de base" suffixe="€ HT" inputMode="decimal" value={f.prixProHT} onInput={maj('prixProHT')} disabled={!peutPrix} error={erreurDe(err, 'prixProHT')} />
          <Input label="Seuil d’alerte" inputMode="numeric" value={f.seuil} onInput={maj('seuil')} disabled={!(peutPrix || peutStock)} error={erreurDe(err, 'seuil')} />
          <Input label="Colisage (bouteilles par carton)" inputMode="numeric" value={f.colisage} onInput={maj('colisage')} disabled={!peutPrix} error={erreurDe(err, 'colisage')} />
        </div>
        {err && !erreurDe(err, 'prixTTC', 'prixProHT', 'seuil', 'colisage') && <Notice ton="err">{err.message}</Notice>}
      </div>
    </Dialog>
  );
}

function DialogMouvement({ p, v, onClose, onFait }) {
  const [motif, setMotif] = useState('production');
  const [qte, setQte] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const actuel = Number(v.stock) || 0;
  const n = parseInt(String(qte).replace(/\s/g, ''), 10);
  let delta = null;
  if (Number.isFinite(n)) {
    if (motif === 'production') delta = Math.abs(n);
    else if (motif === 'casse') delta = -Math.abs(n);
    else if (motif === 'inventaire') delta = n - actuel;
    else delta = n;
  }
  const apres = delta === null ? null : actuel + delta;
  const envoyer = async () => {
    if (delta === null || (motif !== 'inventaire' && delta === 0)) return setErr({ champ: 'delta', message: motif === 'inventaire' ? 'Saisissez la quantité comptée.' : 'Saisissez une quantité.' });
    if (apres < 0) return setErr({ champ: 'delta', message: 'Le stock ne peut pas devenir négatif.' });
    if (motif === 'inventaire' && delta === 0) {
      toast('Inventaire conforme', { detail: `${nombre(actuel)} bouteilles, aucun écart.` });
    }
    setBusy(true);
    setErr(null);
    try {
      const d = await crm('stock', { method: 'POST', body: { slug: p.slug, varianteId: v.id, delta, motif, note: note.trim() || undefined } });
      const stockNouveau = d?.stock ?? d?.variante?.stock ?? apres;
      toast(`${p.nom} ${v.volume} : ${MOTIF_STOCK[motif].label.toLowerCase()} enregistrée`, { detail: `Stock ${nombre(actuel)} → ${nombre(stockNouveau)}` });
      onFait(stockNouveau);
      onClose();
    } catch (e) {
      setErr(e);
      setBusy(false);
    }
  };
  const labels = { production: 'Bouteilles produites', inventaire: 'Quantité comptée', casse: 'Bouteilles cassées', ajustement: 'Correction (+ ou −)' };
  return (
    <Dialog
      titre="Mouvement de stock"
      sous={
        <>
          <Marque texte={p.nom} /> · {v.volume} · stock actuel : <strong>{nombre(actuel)}</strong>
        </>
      }
      icone="mouvements"
      onClose={onClose}
      onSubmit={envoyer}
      pied={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="primary" busy={busy}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div class="form">
        <Choices
          name="motif"
          label="Motif"
          value={motif}
          onChange={(m) => {
            setMotif(m);
            setErr(null);
          }}
          items={['production', 'inventaire', 'casse', 'ajustement'].map((m) => ({ value: m, titre: MOTIF_STOCK[m].label, desc: MOTIF_STOCK[m].desc, icone: { production: 'plus', inventaire: 'liste', casse: 'alerte', ajustement: 'mouvements' }[m] }))}
        />
        <div class="form-grid">
          <Input label={labels[motif]} inputMode={motif === 'ajustement' ? 'text' : 'numeric'} value={qte} onInput={(e) => setQte(e.currentTarget.value)} error={erreurDe(err, 'delta', 'qte')} placeholder={motif === 'ajustement' ? '−3 ou 5' : motif === 'inventaire' ? String(actuel) : '12'} autoComplete="off" />
          <div class="field">
            <span class="field__label">Résultat</span>
            <div class="mvt-preview" aria-live="polite">
              <span class="tnum">{nombre(actuel)}</span>
              <Icon name="fleche-d" size="s" />
              <span class={cx('tnum strong', apres !== null && apres < actuel && 'is-moins', apres !== null && apres > actuel && 'is-plus')}>{apres === null ? '…' : nombre(apres)}</span>
              {delta !== null && delta !== 0 && <span class={cx('mvt-delta', delta > 0 ? 'is-plus' : 'is-moins')}>{delta > 0 ? `+${nombre(delta)}` : `−${nombre(-delta)}`}</span>}
            </div>
          </div>
        </div>
        <Textarea label="Note" opt value={note} onInput={(e) => setNote(e.currentTarget.value)} rows={2} placeholder="Ex. : lot 2026-10, palette abîmée…" style="min-height:64px" />
        {err && !erreurDe(err, 'delta', 'qte') && <Notice ton="err">{err.message}</Notice>}
      </div>
    </Dialog>
  );
}

function DrawerMouvements({ slug, produit, onClose, onMouvement }) {
  const r = useCrm('mouvements', slug ? { slug } : {});
  const liste = elements(r.data, 'mouvements');
  return (
    <Drawer
      onClose={onClose}
      titre={produit ? <Marque texte={produit.nom} logo /> : 'Mouvements de stock'}
      sous={produit ? 'Stocks et derniers mouvements' : 'Les plus récents, toutes contenances'}
      pied={<Button onClick={onClose}>Fermer</Button>}
    >
      {produit && (
        <div class="stack stack--s mb">
          {produit.variantes.map((v) => (
            <div class="card card--inset" key={v.id}>
              <div class="card__body--tight row row--between">
                <span>
                  <span class="strong">{v.volume}</span>
                  <span class="small muted"> · seuil {nombre(v.seuil)}</span>
                </span>
                <span class="row" style="gap:8px">
                  <span class="strong tnum">{nombre(v.stock)}</span>
                  <Statut table={STOCK} valeur={etatStock(v)} />
                  {onMouvement && <Button size="sm" icon="mouvements" onClick={() => onMouvement(v)} aria-label={`Mouvement de stock ${v.volume}`} />}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      {r.error && <Erreur erreur={r.error} onRetry={r.reload} />}
      {!r.data && !r.error && <SkeletonRows n={6} cols={3} />}
      {r.data && liste.length === 0 && <Empty petit icone="mouvements" titre="Aucun mouvement" texte="Productions, inventaires, ventes et casses apparaîtront ici." />}
      {liste.length > 0 && (
        <ol class="mvts">
          {liste.map((m) => (
            <li key={m.id} class="mvt">
              <span class={cx('mvt-delta', m.delta > 0 ? 'is-plus' : 'is-moins')}>{m.delta > 0 ? `+${nombre(m.delta)}` : `−${nombre(-m.delta)}`}</span>
              <div class="grow" style="min-width:0">
                <div class="strong ellipsis">
                  {!slug && (
                    <>
                      <Marque texte={m.nom || m.slug} /> ·{' '}
                    </>
                  )}
                  {m.volume || m.varianteId}
                  <span class="muted" style="font-weight:500">
                    {' '}
                    · {MOTIF_STOCK[m.motif]?.label || m.motif}
                  </span>
                </div>
                <div class="small muted">
                  {m.par?.nom || m.par || 'Système'} · <time dateTime={m.date} title={dateHeure(m.date)}>{relatif(m.date)}</time>
                  {m.commandeId && (
                    <>
                      {' '}
                      ·{' '}
                      <a class="link" href={`/crm/commandes/${m.commandeId}`} onClick={(e) => { e.preventDefault(); onClose(); navigate(`/crm/commandes/${m.commandeId}`); }}>
                        {m.commandeNumero || 'commande'}
                      </a>
                    </>
                  )}
                  {m.note && <> · « {m.note} »</>}
                </div>
              </div>
              {m.stockApres !== undefined && <span class="small muted tnum">→ {nombre(m.stockApres)}</span>}
            </li>
          ))}
        </ol>
      )}
    </Drawer>
  );
}

export { Pill };
