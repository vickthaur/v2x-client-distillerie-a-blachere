/* Calque « proposition V2X Studio », présent uniquement sur la maquette :
   - une pastille discrète en bas à gauche qui ouvre un petit panneau (qui a fait la maquette,
     lien vers le site actuel pour comparer, appel, demande de rappel) ;
   - un signal de consultation envoyé au CRM de V2X Studio, sans cookie ni donnée personnelle,
     une fois par session. Ouvrir la maquette une fois avec ?moi coupe le suivi sur cet appareil.
   À retirer à la mise en ligne réelle du site. */
(() => {
  const CONFIG = {
    slug: 'distillerie-a-blachere',
    client: 'la Distillerie A. Blachère',
    siteActuel: 'https://www.distillerieablachere.com/',
  };
  const API = 'https://v2x-studio.fr/api/prospection-signal';
  const TEL = '07 85 97 71 64';
  const TEL_LIEN = 'tel:+33785977164';

  const local = /^(localhost|127\.|192\.168\.|\[::1\])/.test(location.hostname) || location.protocol === 'file:';

  // Lien d'accès privé (?acces=…) : le serveur a posé le cookie d'accès ; le jeton quitte la barre
  // d'adresse pour ne se retrouver ni dans une capture d'écran ni dans un lien recopié.
  try {
    const u = new URL(location.href);
    if (u.searchParams.has('acces')) {
      u.searchParams.delete('acces');
      history.replaceState(history.state, '', u.pathname + u.search + u.hash);
    }
  } catch { /* rien */ }

  function signaler() {
    // Page préchargée au survol d'un lien : on attend qu'elle soit vraiment affichée
    if (document.prerendering) { document.addEventListener('prerenderingchange', signaler, { once: true }); return; }
    try {
      const qs = new URLSearchParams(location.search);
      if (qs.has('moi')) localStorage.setItem('v2x_moi', '1');
      if (localStorage.getItem('v2x_moi') === '1' || local) return;
      if (sessionStorage.getItem('v2x_vu_' + CONFIG.slug)) return;
      sessionStorage.setItem('v2x_vu_' + CONFIG.slug, '1');
    } catch { /* stockage bloqué : on signale quand même une fois */ }
    const corps = JSON.stringify({
      type: 'vu', slug: CONFIG.slug, page: location.pathname,
      ref: document.referrer ? new URL(document.referrer).hostname : '',
      src: new URLSearchParams(location.search).get('src') || '',
    });
    try { navigator.sendBeacon(API, new Blob([corps], { type: 'text/plain' })); } catch { /* rien */ }
  }

  function calque() {
    const racine = document.createElement('div');
    racine.className = 'v2x';
    racine.lang = 'fr'; // le calque reste en français, y compris sur les pages anglaises : il s'adresse au propriétaire
    racine.innerHTML = `
      <button class="v2x-pastille" type="button" aria-expanded="false" aria-controls="v2x-panneau">
        <span class="v2x-marque" aria-hidden="true">V2X</span><span class="v2x-pastille-txt">Maquette non officielle</span>
      </button>
      <div class="v2x-panneau" id="v2x-panneau" role="dialog" aria-label="À propos de cette maquette" hidden>
        <p class="v2x-k">Maquette non officielle · proposition pour ${CONFIG.client}</p>
        <p class="v2x-t">Ce site est une proposition de V2X Studio, studio web à Cavaillon, sans lien avec ${CONFIG.client} à ce stade. Vos textes, photos et marques y sont repris tels qu’ils sont publiés, uniquement pour vous présenter cette proposition&nbsp;: ils restent votre propriété et celle de leurs auteurs. Les bouteilles en 3D sont construites à partir de vos photos. Maquette non référencée par les moteurs de recherche, retirée sur simple demande. À voir&nbsp;: les deux univers (sirops pour tous, spiritueux après vérification de l’âge), la boutique, la réservation de visites et l’espace pro.</p>
        <div class="v2x-boutons">
          <a href="${CONFIG.siteActuel}" target="_blank" rel="noopener">Comparer avec le site actuel</a>
          <a class="v2x-plein" href="${TEL_LIEN}">Appeler Victor · ${TEL}</a>
        </div>
        <form class="v2x-form" novalidate>
          <p class="v2x-k">Ou être rappelé</p>
          <div class="v2x-ligne">
            <input name="prenom" placeholder="Prénom" autocomplete="given-name" maxlength="60" aria-label="Prénom">
            <input name="tel" placeholder="Téléphone" autocomplete="tel" inputmode="tel" maxlength="20" aria-label="Téléphone">
          </div>
          <select name="creneau" aria-label="Moment préféré">
            <option>Le matin</option><option>Entre midi et deux</option><option>L’après-midi</option><option>En fin de journée</option>
          </select>
          <label class="v2x-consent"><input type="checkbox" name="consent"> J’accepte que V2X Studio me rappelle à ce sujet.</label>
          <button type="submit">Être rappelé</button>
          <p class="v2x-etat" role="status"></p>
        </form>
        <p class="v2x-pied"><a href="https://v2x-studio.fr" target="_blank" rel="noopener">v2x-studio.fr</a> · Statistiques de consultation anonymes, sans cookie.</p>
        <button class="v2x-fermer" type="button" aria-label="Fermer">×</button>
      </div>`;
    document.body.appendChild(racine);

    const pastille = racine.querySelector('.v2x-pastille');
    const panneau = racine.querySelector('.v2x-panneau');
    const ouvrir = (o) => { panneau.hidden = !o; pastille.setAttribute('aria-expanded', String(o)); };
    pastille.addEventListener('click', () => ouvrir(panneau.hidden));
    racine.querySelector('.v2x-fermer').addEventListener('click', () => ouvrir(false));
    addEventListener('keydown', (e) => { if (e.key === 'Escape') ouvrir(false); });

    const form = racine.querySelector('.v2x-form');
    const etat = racine.querySelector('.v2x-etat');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(form));
      if (!d.prenom || !/^[+\d][\d .-]{8,}$/.test(d.tel || '') || !d.consent) {
        etat.textContent = 'Merci d’indiquer un prénom, un numéro valide et de cocher la case.';
        return;
      }
      etat.textContent = 'Envoi…';
      try {
        const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ type: 'rappel', slug: CONFIG.slug, prenom: d.prenom, tel: d.tel, creneau: d.creneau, consent: true }) });
        if (!r.ok) throw new Error();
        form.innerHTML = `<p class="v2x-t">Merci ${d.prenom.replace(/[<>&"]/g, '')}, Victor vous rappelle ${d.creneau.toLowerCase()}.</p>`;
      } catch {
        etat.innerHTML = `L’envoi n’a pas fonctionné. Le plus simple&nbsp;: <a href="${TEL_LIEN}">${TEL}</a>.`;
      }
    });
  }

  signaler();
  calque();
})();
