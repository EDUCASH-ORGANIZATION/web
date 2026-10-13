import Link from "next/link"
import { initialsOf } from "./nav-model"

// En-tête mobile (sous 1024) : logo symbole, libellé d'espace, avatar vers le profil.
export function MobileTop({ nav, fullName }) {
  return (
    <header className="mtop2">
      <Link href={nav.homeHref}>
        <img className="logo-sym" src="/logo-symbole-bleu.svg" alt="EduCash" width={34} height={32} />
      </Link>
      <span className="mtop2__space">{nav.space}</span>
      <Link className="av2 av2--sm" href={nav.profileHref} aria-label="Mon profil">
        {initialsOf(fullName)}
      </Link>
    </header>
  )
}
