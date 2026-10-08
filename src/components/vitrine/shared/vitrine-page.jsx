import { VitrineNavbar } from "../vitrine-navbar"
import { VitrineFooter } from "../vitrine-footer"

// Cadre commun des pages publiques : lien d'évitement, en-tête, contenu, pied de page.
export function VitrinePage({ children, mainId = "contenu" }) {
  return (
    <div className="ds">
      <a className="sr-only focus:not-sr-only btn btn--secondary" href={`#${mainId}`}>
        Aller au contenu
      </a>
      <VitrineNavbar />
      <main id={mainId}>{children}</main>
      <VitrineFooter />
    </div>
  )
}
