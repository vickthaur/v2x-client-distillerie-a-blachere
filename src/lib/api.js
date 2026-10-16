// Client de l'API de la maquette (voir docs/crm-espace-pro.md, § 7) : /api/<fonction>?r=<ressource>.
// Même origine, cookies de session HttpOnly ; toute écriture porte l'en-tête X-Blachere exigé par
// le serveur (protection contre les requêtes d'un autre site).

export class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.champ = data?.champ ?? null;
    this.code = data?.code ?? null;
  }
}

const PAR_DEFAUT = {
  400: 'Vérifiez les informations saisies.',
  401: 'Votre session a expiré\u00a0: reconnectez-vous.',
  403: 'Votre profil ne permet pas cette action.',
  404: 'Élément introuvable.',
  409: 'L’opération n’a pas pu aboutir (données modifiées entre-temps).',
  423: 'Compte verrouillé quelques minutes après plusieurs essais.',
  429: 'Trop de tentatives\u00a0: réessayez dans un instant.',
};

// Adresse d'un appel (utile aussi pour les liens de téléchargement CSV).
export function apiUrl(fonction, ressource, query = {}) {
  const params = new URLSearchParams({ r: ressource });
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  }
  return `/api/${fonction}?${params}`;
}

export async function api(fonction, ressource, { method = 'GET', query, body, signal } = {}) {
  const headers = { Accept: 'application/json' };
  if (method !== 'GET' && method !== 'HEAD') {
    headers['Content-Type'] = 'application/json';
    headers['X-Blachere'] = '1';
  }
  let res;
  try {
    res = await fetch(apiUrl(fonction, ressource, query), {
      method,
      headers,
      credentials: 'same-origin',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (e) {
    if (e?.name === 'AbortError') throw e;
    throw new ApiError('Connexion impossible\u00a0: vérifiez votre réseau et réessayez.', 0);
  }
  if (res.status === 204) return null;
  const type = res.headers.get('content-type') || '';
  const data = type.includes('application/json') ? await res.json().catch(() => null) : null;
  if (!res.ok) throw new ApiError(data?.erreur || PAR_DEFAUT[res.status] || 'Une erreur est survenue. Réessayez.', res.status, data);
  return data;
}

// Une démo existe dans ce navigateur (cookie lisible posé par le serveur).
export function demoActive() {
  try {
    return document.cookie.split('; ').includes('bl_demo_actif=1');
  } catch {
    return false;
  }
}
