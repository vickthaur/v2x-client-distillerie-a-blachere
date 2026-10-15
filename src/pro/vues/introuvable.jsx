// Adresse inconnue dans l'espace pro.
import { TitreVue, Vide } from '../ui.jsx';

export function Introuvable() {
  return (
    <>
      <TitreVue kicker="Espace professionnel" titre="Page introuvable" />
      <Vide
        titre="Cette page de l’espace pro n’existe pas."
        icone="search"
        action={
          <a class="btn btn--primary btn--sm" href="/espace-pro/accueil">
            Retour à l’accueil
          </a>
        }
      >
        Le lien est peut-être incomplet. Toutes les rubriques sont dans la barre ci-dessus.
      </Vide>
    </>
  );
}
