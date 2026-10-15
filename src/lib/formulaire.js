// Erreurs de formulaire, une par champ (A11Y-10) : le message s'écrit sous le champ, dans l'élément
// [data-err="<nom>"] relié au champ par aria-describedby ; le champ (ou chaque case du groupe) porte
// aria-invalid ; un résumé (role="alert") compte les champs à corriger et le focus va au premier.
//   erreurs : Map ou objet { nom du champ: message }.
export function erreursParChamp(form, erreurs, { resume = null, focus = true } = {}) {
  const map = erreurs instanceof Map ? erreurs : new Map(Object.entries(erreurs || {}));
  form.querySelectorAll('[data-err]').forEach((el) => (el.textContent = map.get(el.dataset.err) || ''));
  for (const el of form.elements) {
    if (!el.name || el.type === 'submit' || el.type === 'button') continue;
    const bad = map.has(el.name);
    // les cases (boutons radio, cases à cocher) n'ont pas de filet rouge : le message suffit
    if (el.type !== 'radio' && el.type !== 'checkbox') el.classList.toggle('is-invalid', bad);
    if (bad) el.setAttribute('aria-invalid', 'true');
    else el.removeAttribute('aria-invalid');
  }
  if (resume) {
    const n = map.size;
    resume.textContent = n ? (n === 1 ? 'Un champ est à corriger : voir le message sous le champ.' : `${n} champs sont à corriger : voir les messages sous les champs.`) : '';
  }
  if (focus && map.size) {
    const first = [...form.elements].find((el) => map.has(el.name) && !el.disabled && el.type !== 'hidden');
    first?.focus();
  }
  return map.size;
}
