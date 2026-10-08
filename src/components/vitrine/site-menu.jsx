"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { Icon } from "@/components/design/icon"

const FOCUSABLE = "a[href], button:not([disabled])"

// Menu plein écran mobile de la vitrine (design system Direction A, maquette V01).
export function SiteMenu({ id, links, isActive, session, onClose, returnFocusRef }) {
  const ref = useRef(null)
  const closeRef = useRef(null)
  const { user, fullName, spaceHref, signOut } = session

  useEffect(() => {
    const returnTarget = returnFocusRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    closeRef.current?.focus()

    function onKeyDown(e) {
      if (e.key === "Escape") {
        onClose()
        return
      }
      if (e.key !== "Tab" || !ref.current) return
      const items = ref.current.querySelectorAll(FOCUSABLE)
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", onKeyDown)

    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = previousOverflow
      returnTarget?.focus()
    }
  }, [onClose, returnFocusRef])

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
