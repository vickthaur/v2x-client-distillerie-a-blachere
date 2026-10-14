// Stockage navigateur protégé : en navigation privée stricte (ou stockage bloqué), les accès
// échouent sans casser la page ; la valeur vit alors seulement en mémoire.
const memory = new Map();

function storage(kind) {
  try {
    return kind === 'session' ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

export function readJSON(key, fallback = null, kind = 'local') {
  try {
    const raw = storage(kind)?.getItem(key);
    if (raw == null) return memory.has(`${kind}:${key}`) ? memory.get(`${kind}:${key}`) : fallback;
    return JSON.parse(raw);
  } catch {
    return memory.has(`${kind}:${key}`) ? memory.get(`${kind}:${key}`) : fallback;
  }
}

export function writeJSON(key, value, kind = 'local') {
  memory.set(`${kind}:${key}`, value);
  try {
    storage(kind)?.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function remove(key, kind = 'local') {
  memory.delete(`${kind}:${key}`);
  try {
    storage(kind)?.removeItem(key);
  } catch {
    /* rien */
  }
}
