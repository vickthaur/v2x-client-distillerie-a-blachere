// Vérification de l'âge légal (spiritueux), par date de naissance.
// - majeur  : gardé dans le navigateur (localStorage), la question n'est plus reposée ;
// - mineur  : gardé pour la session (sessionStorage) : impossible de « réessayer » tout de suite ;
// - sirops  : la personne a préféré ne voir que les sirops (session), elle peut vérifier plus tard.
// Si le stockage est bloqué, la réponse vit seulement en mémoire (rechargement = nouvelle question).
const KEY = 'blachere-age';
let memory = null;

export function readAge() {
  try {
    if (localStorage.getItem(KEY) === 'majeur') return 'majeur';
    const s = sessionStorage.getItem(KEY);
    if (s === 'mineur' || s === 'sirops') return s;
  } catch {
    return memory;
  }
  return memory;
}

export function saveAge(value) {
  memory = value;
  try {
    if (value === 'majeur') {
      localStorage.setItem(KEY, 'majeur');
      sessionStorage.removeItem(KEY);
    } else {
      sessionStorage.setItem(KEY, value);
    }
  } catch {
    /* navigation privée stricte : mémoire seulement */
  }
}

export function resetAge() {
  memory = null;
  try {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
  } catch {
    /* rien */
  }
}

// Âge révolu à la date du jour, ou null si la date n'existe pas (31/02, année hors bornes…).
export function ageFrom(day, month, year, now = new Date()) {
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y)) return null;
  if (y < 1900 || y > now.getFullYear() || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const birth = new Date(y, m - 1, d);
  if (birth.getFullYear() !== y || birth.getMonth() !== m - 1 || birth.getDate() !== d) return null;
  if (birth > now) return null;
  let age = now.getFullYear() - y;
  if (now.getMonth() < m - 1 || (now.getMonth() === m - 1 && now.getDate() < d)) age -= 1;
  return age;
}
