"use client"

import { useCallback, useRef, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Icon } from "@/components/design/icon"
import { useVitrineSession } from "@/hooks/use-vitrine-session"
import { SiteMenu } from "./site-menu"
import { AnchorLink } from "./shared/hash-scroll"

const MENU_ID = "site-menu"

const DESKTOP_LINKS = [
  { label: "Missions", href: "/missions" },
  { label: "Comment ça marche", href: "/#etapes" },
  { label: "Pour les clients", href: "/clients" },
  { label: "Aide", href: "/aide" },
]

const MENU_LINKS = [...DESKTOP_LINKS, { label: "À propos", href: "/about" }, { label: "Contact", href: "/contact" }]

// Seuil de défilement (px) au-delà duquel l'en-tête passe en compact.
const COMPACT_SCROLL_Y = 16

function subscribeScroll(onChange) {
  window.addEventListener("scroll", onChange, { passive: true })
  return () => window.removeEventListener("scroll", onChange)
}
const getScrolled = () => window.scrollY > COMPACT_SCROLL_Y
const getScrolledOnServer = () => false

function isActivePath(pathname, href) {
  if (href.includes("?") || href.includes("#")) return false
  if (href === "/missions") return pathname === href || pathname.startsWith("/missions/")
  return pathname === href
}

// En-tête public de la vitrine (design system Direction A, maquettes V01 et V02).
// .ds ne porte que les styles de racine (police, encre, fond) : la racine le porte,
// car la navbar est aussi montée sur des pages encore en MUI. Les sélecteurs de
// composants sont globaux (couche components).
// En-tête fixe : l'emplacement (.site-header-slot) réserve la hauteur pour éviter tout décalage,
// l'en-tête passe en compact dès que la page a défilé.
// tone="bleu" : en-tête transparent posé sur un hero bleu (accueil, maquette V01), logo blanc et
// actions on-bleu. Une fois la page défilée, il devient l'en-tête compact blanc standard.
// Seuil propre à l'en-tête (layouts.css) : sous 1360 px, la navigation passe dans le menu burger et
// les actions restent visibles ; sous 1024 px, les actions bureau (ds-desk-only) cèdent la place à « S'inscrire ».
export function VitrineNavbar({ tone = "blanc" }) {
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
  const scrolled = useSyncExternalStore(subscribeScroll, getScrolled, getScrolledOnServer)
  const bleu = tone === "bleu" && !scrolled
  const accountLabel = fullName ? `Mon espace, compte de ${fullName}` : "Mon espace"

  const headerClass = ["ds site-header", bleu ? "site-header--bleu" : "", scrolled ? "is-compact" : ""]
    .filter(Boolean)
    .join(" ")

  return (
    <>
      <div className={tone === "bleu" ? "site-header-slot site-header-slot--bleu" : "site-header-slot"}>
        <header className={headerClass}>
          <Link className="site-header__brand" href="/" aria-label="EduCash, accueil">
            <img
              className="logo"
              src={bleu ? "/logo-horizontal-blanc.svg" : "/logo-horizontal-bleu.svg"}
              alt="EduCash"
              width={534}
              height={100}
            />
          </Link>
          <nav className="site-header__nav ds-desk-only" aria-label="Navigation principale">
            {DESKTOP_LINKS.map(({ label, href }) => {
              const active = isActive(href)
              return (
                <AnchorLink
                  key={label}
                  href={href}
                  className={active ? "is-active" : undefined}
                  aria-current={active ? "page" : undefined}
                >
                  {label}
                </AnchorLink>
              )
            })}
          </nav>
          <div className={bleu ? "site-header__actions on-bleu" : "site-header__actions"}>
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
        </header>
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
    </>
  )
}
