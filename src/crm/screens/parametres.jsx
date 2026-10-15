// Paramètres (direction) : livraison des particuliers, conditions pro, visites, coordonnées de
// l'entreprise (reprises sur les factures). Chaque section s'enregistre séparément.
import { useEffect, useState } from 'preact/hooks';
import { crm, invalider, useCrm } from '../lib/data.js';
import { useSession } from '../lib/session.jsx';
import { Icon } from '../ui/icons.jsx';
import { Button, Card, Erreur, Notice, PageHead, Skeleton, useTitre } from '../ui/base.jsx';
import { Check, Input, ecrireNombre, erreurDe, lireNombre } from '../ui/form.jsx';
import { toast } from '../ui/overlay.jsx';
import { euros } from '../lib/format.js';

const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const ORDRE_JOURS = [1, 2, 3, 4, 5, 6, 0];

export function Parametres() {
  useTitre('Paramètres');
  const s = useSession();
  const r = useCrm('parametres', {});
  const p = r.data?.parametres || r.data;
  const peutModifier = s.peut('parametres', 'ecriture');

  const enregistrer = async (section, valeur, message) => {
    const d = await crm('parametres', { method: 'PATCH', body: { [section]: valeur } });
    r.mutate((x) => {
      const neuf = d?.parametres || d;
      if (neuf && neuf[section]) return x?.parametres ? { ...x, parametres: neuf } : neuf;
      return x?.parametres ? { ...x, parametres: { ...x.parametres, [section]: { ...x.parametres[section], ...valeur } } } : { ...x, [section]: { ...x[section], ...valeur } };
    });
    invalider('tableau', 'visites');
    toast(message);
  };

  return (
    <div class="page page--narrow">
      <PageHead titre="Paramètres" sous="Barèmes et réglages de la démo : ils s’appliquent aussitôt à la boutique, à l’espace pro et aux visites." />
      {r.error && !p && <Erreur erreur={r.error} onRetry={r.reload} />}
      {!p && !r.error && (
        <div class="stack">
          <Skeleton class="skel--block" style="height:260px" />
          <Skeleton class="skel--block" style="height:200px" />
        </div>
      )}
      {p && (
        <div class="stack">
          <nav class="ancres" aria-label="Sections">
            <a href="#livraison">Livraison</a>
            <a href="#pro">Professionnels</a>
            <a href="#visites">Visites</a>
            <a href="#entreprise">Entreprise</a>
          </nav>
          <Livraison v={p.livraison || {}} peutModifier={peutModifier} enregistrer={enregistrer} />
          <Pro v={p.pro || {}} peutModifier={peutModifier} enregistrer={enregistrer} />
          <Visites v={p.visites || {}} peutModifier={peutModifier} enregistrer={enregistrer} />
          <Entreprise v={p.entreprise || {}} peutModifier={peutModifier} enregistrer={enregistrer} />
        </div>
      )}
    </div>
  );
}

function Section({ id, titre, sous, icone, children, change, busy, onSave, onReset, err, peutModifier }) {
  return (
    <Card id={id} titre={titre} sous={sous} icone={icone} class="reglages" foot={peutModifier && (
      <>
        <span class="small muted">{change ? 'Modifications non enregistrées' : 'À jour'}</span>
        <div class="btn-row">
          {change && (
            <Button size="sm" variant="ghost" onClick={onReset}>
              Annuler
            </Button>
          )}
          <Button size="sm" variant="primary" disabled={!change} busy={busy} onClick={onSave}>
            Enregistrer
          </Button>
        </div>
      </>
    )}>
      <div class="form">
        {children}
        {err && <Notice ton="err">{err.message}</Notice>}
      </div>
    </Card>
  );
}

function useSection(initial, enregistrer, section, message, convertir) {
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const base = JSON.stringify(initial);
  useEffect(() => setF(initial), [base]);
  const change = JSON.stringify(f) !== base;
  const sauver = async () => {
    setBusy(true);
    setErr(null);
    try {
      await enregistrer(section, convertir(f), message);
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };
  return { f, setF, busy, err, change, sauver, reset: () => setF(initial) };
}

function Bareme({ lignes, onChange, disabled, label }) {
  return (
    <div class="bareme">
      <div class="bareme__head" aria-hidden="true">
        <span>Jusqu’à</span>
        <span>Prix TTC</span>
        <span />
      </div>
      {lignes.map((l, i) => (
        <div class="bareme__ligne" key={i}>
          <div class="input-group" style="--suffixe:5.5ch">
            <input class="input input--sm" inputMode="numeric" value={l.jusquA} disabled={disabled} aria-label={`${label}, tranche ${i + 1} : nombre de bouteilles`} onInput={(e) => onChange(lignes.map((x, k) => (k === i ? { ...x, jusquA: e.currentTarget.value } : x)))} />
            <span class="input-group__suffix">bout.</span>
          </div>
          <div class="input-group" style="--suffixe:1.5ch">
            <input class="input input--sm" inputMode="decimal" value={l.prixTTC} disabled={disabled} aria-label={`${label}, tranche ${i + 1} : prix TTC`} onInput={(e) => onChange(lignes.map((x, k) => (k === i ? { ...x, prixTTC: e.currentTarget.value } : x)))} />
            <span class="input-group__suffix">€</span>
          </div>
          {!disabled && lignes.length > 1 ? (
            <Button size="sm" variant="ghost" icon="corbeille" aria-label={`Retirer la tranche ${i + 1}`} onClick={() => onChange(lignes.filter((_, k) => k !== i))} />
          ) : (
            <span />
          )}
        </div>
      ))}
      {!disabled && (
        <Button size="sm" variant="ghost" icon="plus" onClick={() => onChange([...lignes, { jusquA: '', prixTTC: '' }])}>
          Ajouter une tranche
        </Button>
      )}
    </div>
  );
}

const versBareme = (l) => (l || []).map((x) => ({ jusquA: x.jusquA === null || x.jusquA === undefined || x.jusquA === Infinity ? '' : String(x.jusquA), prixTTC: ecrireNombre(x.prixTTC) }));
const depuisBareme = (l) => l.filter((x) => x.prixTTC !== '').map((x) => ({ jusquA: x.jusquA === '' ? null : parseInt(x.jusquA, 10), prixTTC: lireNombre(x.prixTTC) }));

function Livraison({ v, peutModifier, enregistrer }) {
  const sct = useSection(
    { colissimo: versBareme(v.colissimo), relais: versBareme(v.relais), francoTTC: ecrireNombre(v.francoTTC) },
    enregistrer,
    'livraison',
    'Barème de livraison enregistré',
    (f) => ({ colissimo: depuisBareme(f.colissimo), relais: depuisBareme(f.relais), francoTTC: lireNombre(f.francoTTC) || 0, retraitGratuit: true }),
  );
  return (
    <Section id="livraison" titre="Livraison des particuliers" sous="Barème de démonstration, par nombre de bouteilles. Une tranche vide « jusqu’à » vaut « au-delà »." icone="camion" change={sct.change} busy={sct.busy} onSave={sct.sauver} onReset={sct.reset} err={sct.err} peutModifier={peutModifier}>
      <div class="cols cols--2">
        <div class="stack stack--s">
          <h3 class="form-section__title">Colissimo à domicile</h3>
          <Bareme lignes={sct.f.colissimo} onChange={(l) => sct.setF((prec) => ({ ...prec, colissimo: l }))} disabled={!peutModifier} label="Colissimo" />
        </div>
        <div class="stack stack--s">
          <h3 class="form-section__title">Point relais</h3>
          <Bareme lignes={sct.f.relais} onChange={(l) => sct.setF((prec) => ({ ...prec, relais: l }))} disabled={!peutModifier} label="Point relais" />
        </div>
      </div>
      <div class="form-grid">
        <Input label="Livraison offerte dès" suffixe="€ TTC" inputMode="decimal" value={sct.f.francoTTC} disabled={!peutModifier} onInput={(e) => { const v = e.currentTarget.value; sct.setF((prec) => ({ ...prec, francoTTC: v })); }} help="Montant des articles, hors port" />
        <div class="field">
          <span class="field__label">Retrait à la distillerie</span>
          <p class="small muted" style="padding-top:8px">
            <Icon name="check" size="xs" style="display:inline;vertical-align:-2px;color:var(--ok)" /> Toujours gratuit, du lundi au samedi.
          </p>
        </div>
      </div>
    </Section>
  );
}

function Pro({ v, peutModifier, enregistrer }) {
  const sct = useSection(
    { minimumHT: ecrireNombre(v.minimumHT), francoHT: ecrireNombre(v.francoHT), fraisPortHT: ecrireNombre(v.fraisPortHT), delai: v.delai || '' },
    enregistrer,
    'pro',
    'Conditions pro enregistrées',
    (f) => ({ minimumHT: lireNombre(f.minimumHT) || 0, francoHT: lireNombre(f.francoHT) || 0, fraisPortHT: lireNombre(f.fraisPortHT) || 0, delai: f.delai.trim() }),
  );
  const m = (k) => (e) => { const v = e.currentTarget.value; sct.setF((prec) => ({ ...prec, [k]: v })); };
  return (
    <Section id="pro" titre="Professionnels" sous="Conditions générales de l’espace pro ; chaque compte peut avoir son propre franco." icone="store" change={sct.change} busy={sct.busy} onSave={sct.sauver} onReset={sct.reset} err={sct.err} peutModifier={peutModifier}>
      <div class="form-grid">
        <Input label="Minimum de commande" suffixe="€ HT" inputMode="decimal" value={sct.f.minimumHT} disabled={!peutModifier} onInput={m('minimumHT')} />
        <Input label="Franco de port" suffixe="€ HT" inputMode="decimal" value={sct.f.francoHT} disabled={!peutModifier} onInput={m('francoHT')} />
        <Input label="Frais de port sous le franco" suffixe="€ HT" inputMode="decimal" value={sct.f.fraisPortHT} disabled={!peutModifier} onInput={m('fraisPortHT')} />
        <Input label="Délai de livraison annoncé" value={sct.f.delai} disabled={!peutModifier} onInput={m('delai')} placeholder="48 à 72 h ouvrées" />
      </div>
    </Section>
  );
}

function Visites({ v, peutModifier, enregistrer }) {
  const sct = useSection(
    { capacite: String(v.capacite ?? 25), matin: v.horaires?.matin || '10:30', apresMidi: v.horaires?.['apres-midi'] || '15:00', debut: v.saison?.debut || '02-12', fin: v.saison?.fin || '12-31', fermeLe: v.fermeLe || [0] },
    enregistrer,
    'visites',
    'Réglages des visites enregistrés',
    (f) => ({ capacite: parseInt(f.capacite, 10) || 25, horaires: { matin: f.matin, 'apres-midi': f.apresMidi }, saison: { debut: f.debut, fin: f.fin }, fermeLe: f.fermeLe }),
  );
  const m = (k) => (e) => { const v = e.currentTarget.value; sct.setF((prec) => ({ ...prec, [k]: v })); };
  const basculer = (j) => sct.setF((prec) => ({ ...prec, fermeLe: prec.fermeLe.includes(j) ? prec.fermeLe.filter((x) => x !== j) : [...prec.fermeLe, j].sort() }));
  return (
    <Section id="visites" titre="Visites" sous="Capacité et horaires des nouvelles séances ; les séances existantes se règlent dans l’agenda." icone="calendrier" change={sct.change} busy={sct.busy} onSave={sct.sauver} onReset={sct.reset} err={sct.err} peutModifier={peutModifier}>
      <div class="form-grid form-grid--3">
        <Input label="Personnes par séance" inputMode="numeric" value={sct.f.capacite} disabled={!peutModifier} onInput={m('capacite')} />
        <Input label="Séance du matin" type="time" value={sct.f.matin} disabled={!peutModifier} onInput={m('matin')} />
        <Input label="Séance de l’après-midi" type="time" value={sct.f.apresMidi} disabled={!peutModifier} onInput={m('apresMidi')} />
        <Input label="Début de saison" value={sct.f.debut} disabled={!peutModifier} onInput={m('debut')} help="MM-JJ, ex. 02-12" />
        <Input label="Fin de saison" value={sct.f.fin} disabled={!peutModifier} onInput={m('fin')} help="MM-JJ, ex. 12-31" />
      </div>
      <fieldset class="jours-fermes">
        <legend class="field__label">Jours de fermeture</legend>
        <div class="row row--wrap" style="gap:8px">
          {ORDRE_JOURS.map((j) => (
            <Check key={j} label={JOURS[j]} checked={sct.f.fermeLe.includes(j)} disabled={!peutModifier} onChange={() => basculer(j)} boite />
          ))}
        </div>
      </fieldset>
    </Section>
  );
}

function Entreprise({ v, peutModifier, enregistrer }) {
  const sct = useSection(
    { nom: v.nom || '', adresse: Array.isArray(v.adresse) ? v.adresse.join(', ') : v.adresse || '', telephone: v.telephone || '', email: v.email || '', siret: v.siret || '', tvaIntra: v.tvaIntra || '', rcs: v.rcs || '' },
    enregistrer,
    'entreprise',
    'Coordonnées de l’entreprise enregistrées',
    (f) => ({ nom: f.nom.trim(), adresse: f.adresse.replace(/\s*\n\s*/g, ', ').trim(), telephone: f.telephone.trim(), email: f.email.trim(), siret: f.siret.replace(/\s/g, '') || undefined, tvaIntra: f.tvaIntra.replace(/\s/g, '') || undefined, rcs: f.rcs.trim() || undefined }),
  );
  const m = (k) => (e) => { const v = e.currentTarget.value; sct.setF((prec) => ({ ...prec, [k]: v })); };
  return (
    <Section id="entreprise" titre="Entreprise" sous="Reprises en tête des factures. Les numéros légaux inconnus restent « à compléter »." icone="facture" change={sct.change} busy={sct.busy} onSave={sct.sauver} onReset={sct.reset} err={sct.err} peutModifier={peutModifier}>
      <div class="form-grid">
        <Input class="span-2" label="Raison sociale" value={sct.f.nom} disabled={!peutModifier} onInput={m('nom')} />
        <Input class="span-2" label="Adresse" value={sct.f.adresse} disabled={!peutModifier} onInput={m('adresse')} maxLength={200} help="Sur une ligne, telle qu’elle figure en tête des factures." />
        <Input label="Téléphone" type="tel" value={sct.f.telephone} disabled={!peutModifier} onInput={m('telephone')} />
        <Input label="E-mail" type="email" value={sct.f.email} disabled={!peutModifier} onInput={m('email')} />
        <Input label="SIRET" value={sct.f.siret} disabled={!peutModifier} onInput={m('siret')} placeholder="À compléter" />
        <Input label="TVA intracommunautaire" value={sct.f.tvaIntra} disabled={!peutModifier} onInput={m('tvaIntra')} placeholder="À compléter" />
        <Input class="span-2" label="RCS" value={sct.f.rcs} disabled={!peutModifier} onInput={m('rcs')} placeholder="À compléter" />
      </div>
      {!v.siret && <Notice ton="warn">SIRET, TVA et RCS de la distillerie à confirmer avec elle avant toute facture réelle.</Notice>}
    </Section>
  );
}

export { euros };
