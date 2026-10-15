// Codes promo : liste (valeur, minimum, période, utilisation), création, modification,
// activation et désactivation.
import { useState } from 'preact/hooks';
import { crm, elements, invalider, mapElements, useCrm } from '../lib/data.js';
import { useSession } from '../lib/session.jsx';
import { Icon } from '../ui/icons.jsx';
import { Button, Empty, Erreur, Notice, PageHead, Pill, SkeletonRows, cx, useTitre } from '../ui/base.jsx';
import { Choices, Input, Switch, ecrireNombre, erreurDe, lireNombre } from '../ui/form.jsx';
import { Dialog, toast } from '../ui/overlay.jsx';
import { Jauge } from '../charts/charts.jsx';
import { PROMO_TYPE } from '../lib/statuts.js';
import { aujourdHui, date, euros, eurosSimple, nombre, pluriel } from '../lib/format.js';

export function valeurPromo(p) {
  if (p.type === 'pourcentage') return `−${String(p.valeur).replace('.', ',')} %`;
  if (p.type === 'montant') return `−${eurosSimple(p.valeur)}`;
  return 'Livraison offerte';
}
function etatPromo(p) {
  const j = aujourdHui();
  if (!p.actif) return { label: 'Désactivé', ton: 'mute' };
  if (p.fin && p.fin.slice(0, 10) < j) return { label: 'Expiré', ton: 'mute' };
  if (p.debut && p.debut.slice(0, 10) > j) return { label: 'Programmé', ton: 'info' };
  if (p.limite && p.utilisations >= p.limite) return { label: 'Épuisé', ton: 'warn' };
  return { label: 'Actif', ton: 'ok' };
}

export function Promos() {
  useTitre('Codes promo');
  const s = useSession();
  const r = useCrm('promos', {});
  const liste = elements(r.data, 'promos');
  const peutModifier = s.peut('newsletter', 'ecriture');
  const [edition, setEdition] = useState(null);

  const basculer = async (p, actif) => {
    r.mutate((d) => mapElements(d, (x) => (x.id === p.id ? { ...x, actif } : x), 'promos'));
    try {
      await crm('promo', { method: 'PATCH', query: { id: p.id }, body: { actif } });
      toast(actif ? `Code ${p.code} activé` : `Code ${p.code} désactivé`, { detail: actif ? 'Accepté par la boutique de la démo.' : 'Refusé par la boutique de la démo.' });
    } catch (e) {
      r.reload({ silencieux: true });
      toast.erreur(e);
    }
  };

  return (
    <div class="page">
      <PageHead
        titre="Codes promo"
        sous="Vérifiés par le serveur à chaque commande : actif, dates, minimum d’achat et limite d’utilisation."
        actions={
          peutModifier && (
            <Button variant="primary" icon="plus" onClick={() => setEdition({})}>
              Nouveau code
            </Button>
          )
        }
      />
      {r.error && !r.data && <Erreur erreur={r.error} onRetry={r.reload} />}
      {!r.data && !r.error && (
        <div class="card">
          <SkeletonRows n={4} cols={5} />
        </div>
      )}
      {r.data && liste.length === 0 && (
        <div class="card">
          <Empty icone="ticket" titre="Aucun code promo" texte="Créez un code pour une opération : pourcentage, montant ou livraison offerte." />
        </div>
      )}
      {liste.length > 0 && (
        <div class="promos">
          {liste.map((p) => {
            const e = etatPromo(p);
            return (
              <article key={p.id} class={cx('card promo', !p.actif && 'is-off')}>
                <div class="promo__top">
                  <span class="promo__code mono">{p.code}</span>
                  <Pill ton={e.ton}>{e.label}</Pill>
                </div>
                <p class="promo__valeur">{valeurPromo(p)}</p>
                <p class="promo__lib">{p.libelle}</p>
                <dl class="promo__dl">
                  <div>
                    <dt>Minimum</dt>
                    <dd>{p.minimumTTC ? `${eurosSimple(p.minimumTTC)} TTC` : 'Aucun'}</dd>
                  </div>
                  <div>
                    <dt>Période</dt>
                    <dd>{p.debut || p.fin ? `${p.debut ? date(p.debut) : '…'} → ${p.fin ? date(p.fin) : '…'}` : 'Sans limite'}</dd>
                  </div>
                </dl>
                <div class="promo__usage">
                  <div class="row row--between small">
                    <span class="muted">Utilisations</span>
                    <span class="tnum strong">
                      {nombre(p.utilisations || 0)}
                      {p.limite ? ` / ${nombre(p.limite)}` : ''}
                    </span>
                  </div>
                  {p.limite ? <Jauge valeur={p.utilisations || 0} max={p.limite} fin label={`Utilisations du code ${p.code}`} texte={`${p.utilisations || 0} sur ${p.limite}`} /> : <p class="small muted">Sans limite d’utilisation</p>}
                </div>
                {peutModifier && (
                  <div class="promo__pied">
                    <Switch label={p.actif ? 'Actif' : 'Inactif'} checked={!!p.actif} onChange={(ev) => basculer(p, ev.currentTarget.checked)} />
                    <Button size="sm" variant="ghost" icon="crayon" onClick={() => setEdition(p)}>
                      Modifier
                    </Button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
      {edition && (
        <DialogPromo
          promo={edition.id ? edition : null}
          onClose={() => setEdition(null)}
          onFait={() => {
            setEdition(null);
            r.reload({ silencieux: true });
            invalider('tableau');
          }}
        />
      )}
    </div>
  );
}

function DialogPromo({ promo, onClose, onFait }) {
  const [f, setF] = useState(() => ({
    code: promo?.code || '',
    libelle: promo?.libelle || '',
    type: promo?.type || 'pourcentage',
    valeur: promo ? ecrireNombre(promo.valeur, promo.type === 'pourcentage' ? 0 : 2) : '10',
    minimumTTC: promo?.minimumTTC ? ecrireNombre(promo.minimumTTC) : '',
    debut: promo?.debut?.slice(0, 10) || '',
    fin: promo?.fin?.slice(0, 10) || '',
    limite: promo?.limite ? String(promo.limite) : '',
    actif: promo ? !!promo.actif : true,
  }));
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const maj = (k) => (e) => setF({ ...f, [k]: e.currentTarget.type === 'checkbox' ? e.currentTarget.checked : e.currentTarget.value });
  const envoyer = async () => {
    const code = f.code.trim().toUpperCase().replace(/\s+/g, '');
    if (!/^[A-Z0-9-]{3,20}$/.test(code)) return setErr({ champ: 'code', message: '3 à 20 lettres, chiffres ou tirets.' });
    const valeur = f.type === 'livraison' ? 0 : lireNombre(f.valeur);
    if (f.type !== 'livraison' && (!valeur || Number.isNaN(valeur) || valeur <= 0 || (f.type === 'pourcentage' && valeur > 90))) return setErr({ champ: 'valeur', message: f.type === 'pourcentage' ? 'Entre 1 et 90 %.' : 'Montant positif.' });
    if (f.debut && f.fin && f.fin < f.debut) return setErr({ champ: 'fin', message: 'La fin doit suivre le début.' });
    setBusy(true);
    setErr(null);
    const body = {
      code,
      libelle: f.libelle.trim() || code,
      type: f.type,
      valeur,
      minimumTTC: lireNombre(f.minimumTTC) || 0,
      debut: f.debut || null,
      fin: f.fin || null,
      limite: f.limite ? parseInt(f.limite, 10) : null,
      actif: f.actif,
    };
    try {
      if (promo) await crm('promo', { method: 'PATCH', query: { id: promo.id }, body });
      else await crm('promo', { method: 'POST', body });
      toast(promo ? `Code ${code} modifié` : `Code ${code} créé`);
      onFait();
    } catch (e) {
      setErr(e);
      setBusy(false);
    }
  };
  return (
    <Dialog
      titre={promo ? `Modifier ${promo.code}` : 'Nouveau code promo'}
      icone="ticket"
      onClose={onClose}
      onSubmit={envoyer}
      pied={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="primary" busy={busy}>
            {promo ? 'Enregistrer' : 'Créer le code'}
          </Button>
        </>
      }
    >
      <div class="form">
        <div class="form-grid">
          <Input label="Code" value={f.code} onInput={(e) => setF({ ...f, code: e.currentTarget.value.toUpperCase() })} error={erreurDe(err, 'code')} champClass="mono" placeholder="AUTOMNE15" autoComplete="off" spellcheck={false} />
          <Input label="Libellé" value={f.libelle} onInput={maj('libelle')} error={erreurDe(err, 'libelle')} placeholder="Opération d’automne" />
        </div>
        <Choices
          name="type"
          label="Avantage"
          value={f.type}
          onChange={(t) => setF({ ...f, type: t })}
          items={[
            { value: 'pourcentage', titre: 'Pourcentage', icone: 'pourcent' },
            { value: 'montant', titre: 'Montant', icone: 'euro' },
            { value: 'livraison', titre: 'Livraison offerte', icone: 'camion' },
          ]}
        />
        <div class="form-grid">
          {f.type !== 'livraison' && <Input label="Valeur" inputMode="decimal" suffixe={f.type === 'pourcentage' ? '%' : '€'} value={f.valeur} onInput={maj('valeur')} error={erreurDe(err, 'valeur')} />}
          <Input label="Minimum d’achat" opt inputMode="decimal" suffixe="€ TTC" value={f.minimumTTC} onInput={maj('minimumTTC')} error={erreurDe(err, 'minimumTTC')} />
          <Input label="Début" opt type="date" value={f.debut} onInput={maj('debut')} error={erreurDe(err, 'debut')} />
          <Input label="Fin" opt type="date" value={f.fin} onInput={maj('fin')} error={erreurDe(err, 'fin')} />
          <Input label="Limite d’utilisations" opt inputMode="numeric" value={f.limite} onInput={maj('limite')} error={erreurDe(err, 'limite')} help="Vide : sans limite" />
        </div>
        <Switch label="Code actif" checked={f.actif} onChange={maj('actif')} />
        {err && !erreurDe(err, 'code', 'libelle', 'valeur', 'minimumTTC', 'debut', 'fin', 'limite') && <Notice ton="err">{err.message}</Notice>}
      </div>
    </Dialog>
  );
}

export { Icon };
