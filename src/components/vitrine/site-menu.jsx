"use client"

import { useRef } from "react"
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { useModalFocus } from "@/hooks/use-modal-focus"
import { COMMISSION_RATE } from "@/lib/constants/missions"
import { AnchorLink } from "./shared/hash-scroll"

const COMMISSION_PERCENT = Math.round(COMMISSION_RATE * 100)

// Menu plein écran mobile de la vitrine (design system Direction A, maquette V01).
// audience : « clients » ou « etudiants », qui choisit le bouton accent et la phrase de pied.
export function SiteMenu({ id, links, isActive, session, audience, publishHref, onClose, returnFocusRef }) {
  const forStudents = audience === "etudiants"
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
        {links.map(({ label, href, switchAudience }) => {
          const active = isActive(href)
          return (
            <AnchorLink
              key={label}
              href={href}
              className={[active ? "is-active" : "", switchAudience ? "site-menu__switch" : ""].filter(Boolean).join(" ") || undefined}
              aria-current={active ? "page" : undefined}
              onClick={onClose}
            >
              {label}
              {active ? <Icon name="i-arrow-right" /> : null}
            </AnchorLink>
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
            <span className="body-s">
              {forStudents
                ? `Gratuit pour les étudiants. ${COMMISSION_PERCENT} % de commission, rien d’autre.`
                : `Commission unique de ${COMMISSION_PERCENT} %, incluse dans le budget.`}
            </span>
            {forStudents ? (
              <Link className="btn btn--accent btn--block" href="/auth/register?role=student" onClick={onClose}>
                Créer mon compte
              </Link>
            ) : (
              <Link className="btn btn--accent btn--block" href={publishHref} onClick={onClose}>
                Publier une mission
              </Link>
            )}
            <Link className="btn btn--secondary btn--block" href="/auth/login" onClick={onClose}>
              Se connecter
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
