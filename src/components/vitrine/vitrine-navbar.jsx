"use client"

import { useCallback, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Icon } from "@/components/design/icon"
import { useVitrineSession } from "@/hooks/use-vitrine-session"
import { SiteMenu } from "./site-menu"

const MENU_ID = "site-menu"

const DESKTOP_LINKS = [
  { label: "Missions", href: "/missions" },
  { label: "Comment ça marche", href: "/#etapes" },
  { label: "Pour les clients", href: "/clients" },
  { label: "Aide", href: "/aide" },
]

const MENU_LINKS = [...DESKTOP_LINKS, { label: "À propos", href: "/about" }, { label: "Contact", href: "/contact" }]

function isActivePath(pathname, href) {
  if (href.includes("?") || href.includes("#")) return false
  if (href === "/missions") return pathname === href || pathname.startsWith("/missions/")
  return pathname === href
}

// En-tête public de la vitrine (design system Direction A, maquettes V01 et V02).
// .ds ne porte que les styles de racine (police, encre, fond) : la racine le porte,
// car la navbar est aussi montée sur des pages encore en MUI. Les sélecteurs de
// composants sont globaux (couche components).
export function VitrineNavbar() {
  const pathname = usePathname()
  const session = useVitrineSession()
  const { user, role, fullName, avatarUrl, initials, spaceHref } = session
  const burgerRef = useRef(null)
  // Le menu est lié à la route où il a été ouvert : un changement de route le ferme.
  const [openedOn, setOpenedOn] = useState(null)
  const menuOpen = openedOn === pathname
  const closeMenu = useCallback(() => setOpenedOn(null), [])

  const isActive = (href) => isActivePath(pathname, href)
  const publishHref = role === "client" ? "/client/missions/new" : "/auth/register?role=client"
  const showPublish = !user || role === "client"
  const accountLabel = fullName ? `Mon espace, compte de ${fullName}` : "Mon espace"

  return (
    <header className="ds site-header">
      <Link href="/" aria-label="EduCash, accueil">
        <img className="logo" src="/logo-horizontal-bleu.svg" alt="EduCash" width={534} height={100} />
      </Link>
      <nav className="site-header__nav ds-desk-only" aria-label="Navigation principale">
        {DESKTOP_LINKS.map(({ label, href }) => {
          const active = isActive(href)
          return (
            <Link
              key={label}
              href={href}
              className={active ? "is-active" : undefined}
              aria-current={active ? "page" : undefined}
            >
              {label}
            </Link>
          )
        })}
      </nav>
      <div className="site-header__actions">
        {user ? (
          <>
            {showPublish ? (
              <Link className="btn btn--accent btn--sm ds-desk-only" href={publishHref}>
                Publier une mission
                <span className="btn__dot"><Icon name="i-arrow-right" /></span>
              </Link>
            ) : null}
            <Link className="btn btn--primary btn--sm ds-desk-only" href={spaceHref}>
              <Icon name="i-grid" />
              Mon espace
            </Link>
            <Link className="avatar-btn ds-desk-only" href={spaceHref} aria-label={accountLabel}>
              <span className="avatar">
                {avatarUrl ? (
                  <img className="rounded-full object-cover" src={avatarUrl} alt="" width={36} height={36} />
                ) : (
                  initials
                )}
              </span>
            </Link>
          </>
        ) : (
          <>
            <Link className="site-header__login ds-desk-only" href="/auth/login">Se connecter</Link>
            <Link className="btn btn--secondary btn--sm ds-desk-only" href="/auth/register?role=student">Créer un compte</Link>
            <Link className="btn btn--accent btn--sm ds-desk-only" href={publishHref}>
              Publier une mission
              <span className="btn__dot"><Icon name="i-arrow-right" /></span>
            </Link>
            <Link className="btn btn--primary btn--sm ds-mob-only" href="/auth/register?role=student">S&rsquo;inscrire</Link>
          </>
        )}
        <button
          ref={burgerRef}
          type="button"
          className="btn-icon btn-icon--sm site-header__burger"
          aria-label="Ouvrir le menu"
          aria-expanded={menuOpen}
          aria-controls={MENU_ID}
          onClick={() => setOpenedOn(pathname)}
        >
          <Icon name="i-menu" />
        </button>
      </div>
      {menuOpen ? (
        <SiteMenu
          id={MENU_ID}
          links={MENU_LINKS}
          isActive={isActive}
          session={session}
          onClose={closeMenu}
          returnFocusRef={burgerRef}
        />
      ) : null}
    </header>
  )
}
