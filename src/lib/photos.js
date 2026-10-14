// Index des photos traitées par scripts/photos.mjs (public/bouteilles/index.json et
// public/lieux/index.json). Sans photo, les index sont vides : le site garde ses bouteilles
// dessinées en code et ses illustrations.
let bottles = null;
let places = null;
let labels = null;

async function fetchJSON(url) {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok || !(res.headers.get('content-type') || '').includes('json')) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function photoIndex() {
  bottles ||= fetchJSON('/bouteilles/index.json').then((d) => d?.produits || {});
  return bottles;
}

export function placeIndex() {
  places ||= fetchJSON('/lieux/index.json').then((d) => d?.lieux || {});
  return places;
}

// Étiquettes déroulées depuis une photo (public/etiquettes/index.json).
export function labelIndex() {
  labels ||= fetchJSON('/etiquettes/index.json').then((d) => d?.etiquettes || {});
  return labels;
}

export async function photoOf(slug) {
  return (await photoIndex())[slug] || null;
}
