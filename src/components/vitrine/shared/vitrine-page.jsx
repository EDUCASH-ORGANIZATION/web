import { VitrineNavbar } from "../vitrine-navbar"
import { VitrineFooter } from "../vitrine-footer"

// Cadre commun des pages publiques : lien d'évitement, en-tête, contenu, pied de page.
// `before` est rendu entre l'en-tête et <main> (hors du repère main).
// `navbar` remplace l'en-tête par défaut ; null le retire (l'accueil le pose dans son hero bleu).
// `audience` ("clients" par défaut, ou "etudiants") est transmise à l'en-tête par défaut et au pied de page.
export function VitrinePage({ children, mainId = "contenu", audience = "clients", navbar = <VitrineNavbar audience={audience} />, before = null }) {
  return (
    <div className="ds">
      <a className="ds-skip-link btn btn--secondary" href={`#${mainId}`}>
        Aller au contenu
      </a>
      {navbar}
      {before}
      <main id={mainId} tabIndex={-1}>{children}</main>
      <VitrineFooter audience={audience} />
    </div>
  )
}
