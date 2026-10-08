import { VitrineNavbar } from "../vitrine-navbar"
import { VitrineFooter } from "../vitrine-footer"

// Cadre commun des pages publiques : lien d'évitement, en-tête, contenu, pied de page.
// `before` est rendu entre l'en-tête et <main> (hors du repère main).
// `navbar` remplace l'en-tête par défaut ; null le retire (l'accueil le pose dans son hero bleu).
export function VitrinePage({ children, mainId = "contenu", navbar = <VitrineNavbar />, before = null }) {
  return (
    <div className="ds">
      <a className="sr-only focus:not-sr-only btn btn--secondary" href={`#${mainId}`}>
        Aller au contenu
      </a>
      {navbar}
      {before}
      <main id={mainId}>{children}</main>
      <VitrineFooter />
    </div>
  )
}
