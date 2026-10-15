// Frais de livraison des particuliers, visibles dès la fiche et dans le panier (UX-4).
// La route de la démo (api/site, livraison : docs/crm-espace-pro.md, § 7) fait foi : elle suit le
// barème réglé dans le CRM de démonstration. En attendant sa réponse (ou si elle ne répond pas), le
// barème de démonstration par défaut (§ 5 ; PARAMETRES_DEFAUT de server/regles.js, comparé par
// test/livraison.test.js). Retrait à la distillerie gratuit, Colissimo à domicile ou en point relais,
// franco sur les articles TTC.
import { api } from './api.js';

export const BAREME = {
  colissimo: [
    { jusquA: 2, prixTTC: 9.9 },
    { jusquA: 6, prixTTC: 14.9 },
    { jusquA: 12, prixTTC: 19.9 },
    { jusquA: null, prixTTC: 24.9 },
  ],
  relais: [
    { jusquA: 2, prixTTC: 7.9 },
    { jusquA: 6, prixTTC: 12.9 },
    { jusquA: 12, prixTTC: 17.9 },
    { jusquA: null, prixTTC: 22.9 },
  ],
  francoTTC: 120,
};

const tranche = (bareme, n) => (bareme.find((t) => t.jusquA === null || n <= t.jusquA) || bareme[bareme.length - 1]).prixTTC;
const centimes = (x) => Math.round(x * 100);

// Devis calculé ici : { colissimo, relais, francoTTC, francoRestantTTC, bouteilles } (frais à 0 au-delà
// du franco).
export function devisLocal({ bouteilles, articlesTTC }) {
  const offert = articlesTTC >= BAREME.francoTTC;
  return {
    colissimo: offert ? 0 : tranche(BAREME.colissimo, bouteilles),
    relais: offert ? 0 : tranche(BAREME.relais, bouteilles),
    francoTTC: BAREME.francoTTC,
    francoRestantTTC: Math.max(0, centimes(BAREME.francoTTC) - centimes(articlesTTC)) / 100,
    bouteilles,
  };
}

// Devis du serveur pour des lignes { slug, varianteId, qte }, gardé pour la page ; le devis local si
// la route ne répond pas. Le franco se déduit de la réponse (articles + reste à atteindre).
const devisServeur = new Map();
export function devis(lignes, local) {
  const cle = JSON.stringify(lignes);
  if (!devisServeur.has(cle))
    devisServeur.set(
      cle,
      api('site', 'livraison', { method: 'POST', body: { lignes } }).then(
        (r) => {
          const prix = (mode) => r?.options?.find((o) => o.mode === mode && o.disponible !== false)?.prixTTC;
          if (prix('colissimo') === undefined || prix('relais') === undefined) return local;
          const reste = Number(r.francoRestantTTC) || 0;
          return {
            colissimo: prix('colissimo'),
            relais: prix('relais'),
            francoTTC: reste > 0 ? (centimes(r.articlesTTC) + centimes(reste)) / 100 : local.francoTTC,
            francoRestantTTC: reste,
            bouteilles: r.bouteilles ?? local.bouteilles,
            serveur: true,
          };
        },
        () => {
          devisServeur.delete(cle);
          return local;
        },
      ),
    );
  return devisServeur.get(cle);
}
