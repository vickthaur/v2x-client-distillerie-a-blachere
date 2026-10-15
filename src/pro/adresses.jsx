// Adresses de livraison du compte : affichage et formulaire (création, modification).
import { useRef, useState } from 'preact/hooks';
import { Icone } from './ui.jsx';

export function adresseLignes(a) {
  if (!a) return [];
  return [a.nom, a.ligne1, a.ligne2, [a.cp, a.ville].filter(Boolean).join(' '), a.pays && a.pays !== 'France' ? a.pays : null].filter(Boolean);
}

export function Adresse({ a, class: cls = '' }) {
  return (
    <address class={`pro-adr ${cls}`}>
      {adresseLignes(a).map((l, i) => (
        <span key={i}>{l}</span>
      ))}
      {a?.instructions && <span class="pro-adr__note">{a.instructions}</span>}
    </address>
  );
}

const CHAMPS = { nom: 'nom', ligne1: 'ligne1', ligne2: 'ligne2', cp: 'cp', ville: 'ville', instructions: 'instructions' };

// Formulaire d'adresse : onEnregistrer(valeurs) renvoie une promesse ; une erreur de l'API (champ)
// est affichée sur le champ concerné.
export function AdresseForm({ initiale = {}, onEnregistrer, onAnnuler, titre = 'Nouvelle adresse de livraison', bouton = 'Enregistrer l’adresse' }) {
  const ref = useRef(null);
  const [erreur, setErreur] = useState(null);
  const [champ, setChamp] = useState(null);
  const [occupe, setOccupe] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    const f = ref.current;
    const v = Object.fromEntries(new FormData(f));
    const val = { nom: v.nom.trim(), ligne1: v.ligne1.trim(), ligne2: v.ligne2.trim() || undefined, cp: v.cp.trim(), ville: v.ville.trim(), instructions: v.instructions.trim() || undefined, pays: 'France' };
    let bad = null;
    if (!val.ligne1) bad = ['ligne1', 'Indiquez l’adresse (numéro et voie).'];
    else if (!/^\d{5}$/.test(val.cp)) bad = ['cp', 'Indiquez un code postal à 5 chiffres.'];
    else if (!val.ville) bad = ['ville', 'Indiquez la ville.'];
    if (bad) {
      setChamp(bad[0]);
      setErreur(bad[1]);
      f.elements[bad[0]]?.focus();
      return;
    }
    setOccupe(true);
    setErreur(null);
    setChamp(null);
    try {
      await onEnregistrer(val);
    } catch (x) {
      const c = CHAMPS[String(x?.champ || '').split('.').pop()] || null;
      setChamp(c);
      setErreur(x?.message || 'L’adresse n’a pas pu être enregistrée.');
      if (c) f.elements[c]?.focus();
      setOccupe(false);
    }
  };
  const inv = (n) => (champ === n ? { 'aria-invalid': 'true', class: 'is-invalid' } : {});
  return (
    <form class="pro-form pro-adr-form" ref={ref} onSubmit={submit} onInput={() => erreur && setErreur(null)} noValidate>
      <p class="pro-form__t">{titre}</p>
      <div class="pro-grid">
        <label class="field pro-span2">
          <span>Nom du lieu (facultatif)</span>
          <input name="nom" defaultValue={initiale.nom || ''} placeholder="Ex. Terrasse, réserve, second établissement" maxLength={80} />
        </label>
        <label class="field pro-span2">
          <span>Adresse</span>
          <input name="ligne1" defaultValue={initiale.ligne1 || ''} autocomplete="address-line1" required maxLength={120} {...inv('ligne1')} />
        </label>
        <label class="field pro-span2">
          <span>Complément (facultatif)</span>
          <input name="ligne2" defaultValue={initiale.ligne2 || ''} autocomplete="address-line2" maxLength={120} />
        </label>
        <label class="field">
          <span>Code postal</span>
          <input name="cp" defaultValue={initiale.cp || ''} autocomplete="postal-code" inputmode="numeric" maxLength={5} required {...inv('cp')} />
        </label>
        <label class="field">
          <span>Ville</span>
          <input name="ville" defaultValue={initiale.ville || ''} autocomplete="address-level2" required maxLength={80} {...inv('ville')} />
        </label>
        <label class="field pro-span2">
          <span>Instructions de livraison (facultatif)</span>
          <input name="instructions" defaultValue={initiale.instructions || ''} placeholder="Ex. livraison avant 11 h, accès par la cour" maxLength={200} />
        </label>
      </div>
      {erreur && (
        <p class="form-msg is-error" role="alert">
          {erreur}
        </p>
      )}
      <div class="pro-form__actions">
        <button type="submit" class="btn btn--primary btn--sm" disabled={occupe}>
          <Icone n="check" />
          {occupe ? 'Enregistrement…' : bouton}
        </button>
        {onAnnuler && (
          <button type="button" class="btn btn--ghost btn--sm" onClick={onAnnuler} disabled={occupe}>
            Annuler
          </button>
        )}
      </div>
    </form>
  );
}
