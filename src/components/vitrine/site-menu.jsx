"use client"

import { useRef } from "react"
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { useModalFocus } from "@/hooks/use-modal-focus"

// Menu plein écran mobile de la vitrine (design system Direction A, maquette V01).
export function SiteMenu({ id, links, isActive, session, onClose, returnFocusRef }) {
  const ref = useRef(null)
  const closeRef = useRef(null)
  const { user, fullName, spaceHref, signOut } = session

  useModalFocus({ containerRef: ref, initialFocusRef: closeRef, returnFocusRef, onClose })

  async function handleSignOut() {
    onClose()
    await signOut()
  }

  return (
    <div
      ref={ref}
      id={id}
      className="ds site-menu site-menu--page on-bleu"
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
    >
      <div className="site-menu__top">
        <img className="logo logo--sm" src="/logo-horizontal-blanc.svg" alt="EduCash" width={534} height={100} />
        <button ref={closeRef} type="button" className="btn-icon btn-icon--sm" aria-label="Fermer le menu" onClick={onClose}>
          <Icon name="i-x" />
        </button>
      </div>
      {user && fullName ? (
        <p className="body-s">
          Connecté en tant que <b>{fullName}</b>
        </p>
      ) : null}
      <nav className="site-menu__links" aria-label="Navigation du menu">
        {links.map(({ label, href }) => {
          const active = isActive(href)
          return (
            <Link
              key={label}
              href={href}
              className={active ? "is-active" : undefined}
              aria-current={active ? "page" : undefined}
              onClick={onClose}
            >
              {label}
              {active ? <Icon name="i-arrow-right" /> : null}
            </Link>
          )
        })}
      </nav>
      <div className="site-menu__foot">
        {user ? (
          <>
            <Link className="btn btn--accent btn--block" href={spaceHref} onClick={onClose}>
              <Icon name="i-grid" />
              Mon espace
            </Link>
            <button type="button" className="btn btn--secondary btn--block" onClick={handleSignOut}>
              <Icon name="i-logout" />
              Se déconnecter
            </button>
          </>
        ) : (
          <>
            <span className="body-s">Gratuit pour les étudiants. 12 % de commission, rien d&rsquo;autre.</span>
            <Link className="btn btn--accent btn--block" href="/auth/register?role=student" onClick={onClose}>
              Créer mon compte
            </Link>
            <Link className="btn btn--secondary btn--block" href="/auth/login" onClick={onClose}>
              Se connecter
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
