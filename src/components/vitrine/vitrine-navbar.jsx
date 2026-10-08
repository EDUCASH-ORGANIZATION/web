import Link from "next/link"
import { Icon } from "@/components/design/icon"

// En-tête public de la vitrine (design system Direction A, maquette V01).
// Sert de coquille a toutes les pages vitrine.
export function VitrineNavbar() {
  return (
    <header className="site-header">
      <Link href="/" aria-label="EduCash, accueil">
        <img className="logo" src="/logo-horizontal-encre.svg" alt="EduCash" />
      </Link>
      <nav className="site-header__nav" aria-label="Navigation principale">
        <Link href="/missions">Missions</Link>
        <Link href="/#etapes">Comment ça marche</Link>
        <Link href="/clients">Pour les clients</Link>
        <Link href="/aide">Aide</Link>
      </nav>
      <div className="site-header__actions">
        <Link className="site-header__login" href="/auth/login">Se connecter</Link>
        <Link className="btn btn--secondary btn--sm" href="/auth/register?role=student">Créer un compte</Link>
        <Link className="btn btn--accent btn--sm" href="/clients">
          Publier une mission
          <span className="btn__dot"><Icon name="i-arrow-right" className="ic" /></span>
        </Link>
      </div>
    </header>
  )
}