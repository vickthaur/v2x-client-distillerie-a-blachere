// Champs de formulaire : libellé relié, aide et erreur annoncées (aria-describedby), erreurs de
// l'API rattachées à leur champ (ApiError.champ).
import { useId } from 'preact/hooks';
import { Icon } from './icons.jsx';
import { cx } from './base.jsx';

// Erreur de l'API pour un champ donné (ou plusieurs noms possibles)
export function erreurDe(erreur, ...noms) {
  if (!erreur?.champ) return null;
  const c = String(erreur.champ);
  return noms.some((n) => c === n || c.endsWith(`.${n}`) || c.startsWith(`${n}.`) || c.startsWith(`${n}[`)) ? erreur.message : null;
}
// Erreur de l'API qui ne vise aucun des champs affichés
export function erreurGenerale(erreur, noms = []) {
  if (!erreur) return null;
  if (erreur.champ && noms.some((n) => erreurDe(erreur, n))) return null;
  return erreur.message;
}

export function Field({ label, opt, help, error, id, children, class: cls, aide }) {
  return (
    <div class={cx('field', cls)}>
      {label && (
        <label class="field__label" for={id}>
          <span>{label}</span>
          {opt && <span class="field__opt">{opt === true ? 'facultatif' : opt}</span>}
        </label>
      )}
      {children}
      {(help || aide) && !error && (
        <p class="field__help" id={id ? `${id}-aide` : undefined}>
          {help || aide}
        </p>
      )}
      {error && (
        <p class="field__err" id={id ? `${id}-err` : undefined}>
          <Icon name="alerte" />
          {error}
        </p>
      )}
    </div>
  );
}

const decrit = (id, help, error) => (error ? `${id}-err` : help ? `${id}-aide` : undefined);

export function Input({ label, opt, help, error, class: cls, champClass, suffixe, icone, ...props }) {
  const auto = useId();
  const id = props.id || auto;
  const input = <input class={cx('input', champClass)} id={id} aria-invalid={error ? 'true' : undefined} aria-describedby={decrit(id, help, error)} {...props} />;
  return (
    <Field label={label} opt={opt} help={help} error={error} id={id} class={cls}>
      {suffixe || icone ? (
        <div class="input-group" style={suffixe ? { '--suffixe': `${String(suffixe).length + 0.5}ch` } : undefined}>
          {icone && <Icon name={icone} size="s" />}
          {input}
          {suffixe && <span class="input-group__suffix">{suffixe}</span>}
        </div>
      ) : (
        input
      )}
    </Field>
  );
}

export function Select({ label, opt, help, error, class: cls, options = [], children, champClass, ...props }) {
  const auto = useId();
  const id = props.id || auto;
  return (
    <Field label={label} opt={opt} help={help} error={error} id={id} class={cls}>
      <select class={cx('select', champClass)} id={id} aria-invalid={error ? 'true' : undefined} aria-describedby={decrit(id, help, error)} {...props}>
        {options.map((o) =>
          typeof o === 'string' ? (
            <option key={o} value={o}>
              {o}
            </option>
          ) : (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ),
        )}
        {children}
      </select>
    </Field>
  );
}

export function Textarea({ label, opt, help, error, class: cls, ...props }) {
  const auto = useId();
  const id = props.id || auto;
  return (
    <Field label={label} opt={opt} help={help} error={error} id={id} class={cls}>
      <textarea class="textarea" id={id} aria-invalid={error ? 'true' : undefined} aria-describedby={decrit(id, help, error)} {...props} />
    </Field>
  );
}

export function Check({ label, class: cls, boite, ...props }) {
  return (
    <label class={cx('check', boite && 'check--box', cls)}>
      <input type="checkbox" {...props} />
      <span>{label}</span>
    </label>
  );
}

export function Switch({ label, class: cls, ...props }) {
  return (
    <label class={cx('switch', cls)}>
      <input type="checkbox" role="switch" {...props} />
      {label && <span>{label}</span>}
    </label>
  );
}

// Choix en cartes (boutons radio)
export function Choices({ name, value, onChange, items, label, class: cls }) {
  return (
    <fieldset class={cx('choices-set', cls)} style="border:0;padding:0;margin:0;min-width:0">
      {label && <legend class="field__label" style="margin-bottom:6px;padding:0">{label}</legend>}
      <div class="choices">
        {items.map((it) => (
          <label class={cx('choice', it.class)} key={it.value}>
            <input type="radio" name={name} value={it.value} checked={value === it.value} onChange={() => onChange(it.value)} />
            <span class="choice__title">
              {it.icone && <Icon name={it.icone} size="s" />}
              {it.titre}
            </span>
            {it.desc && <span class="choice__desc">{it.desc}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// Quantité (− n +)
export function Stepper({ value, onChange, min = 0, max = 999, label = 'Quantité', step = 1 }) {
  const v = Number(value) || 0;
  const borne = (n) => Math.max(min, Math.min(max, n));
  return (
    <div class="stepper" role="group" aria-label={label}>
      <button type="button" aria-label="Retirer" disabled={v <= min} onClick={() => onChange(borne(v - step))}>
        <Icon name="moins" size="s" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={v}
        aria-label={label}
        onChange={(e) => onChange(borne(parseInt(e.currentTarget.value, 10) || 0))}
      />
      <button type="button" aria-label="Ajouter" disabled={v >= max} onClick={() => onChange(borne(v + step))}>
        <Icon name="plus" size="s" />
      </button>
    </div>
  );
}

// Nombre saisi à la française (virgule) → nombre
export function lireNombre(s) {
  if (s === '' || s === null || s === undefined) return null;
  const n = Number(String(s).replace(/\s| | /g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}
export const ecrireNombre = (n, d = 2) => (n === null || n === undefined || Number.isNaN(n) ? '' : String(Number(n).toFixed(d)).replace('.', ','));
