import { VitrineNavbar } from "../vitrine-navbar"
import { VitrineFooter } from "../vitrine-footer"

// Cadre commun des pages publiques : lien d'évitement, en-tête, contenu, pied de page.
// `navbar` remplace l'en-tête par défaut ; null le retire (l'accueil le pose dans son hero bleu).
export function VitrinePage({ children, mainId = "contenu", navbar = <VitrineNavbar /> }) {
  return (
    <div className="ds">
      <a className="sr-only focus:not-sr-only btn btn--secondary" href={`#${mainId}`}>
        Aller au contenu
      </a>
      {navbar}
      <main id={mainId}>{children}</main>
      <VitrineFooter />
    </div>
  )
}
