"use client"

import { useEffect, useId, useRef, useState } from "react"
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { NotificationsPanel } from "./notifications-panel"
import { useNotifications } from "./notifications-provider"
import { announcementFor, bellLabel } from "./notifications-logic"

// Annonce (aria-live, polite) d'une hausse du compteur : jamais au premier rendu, jamais à la baisse.
function useCountAnnouncement(count) {
  const previous = useRef(null)
  const [message, setMessage] = useState("")
  useEffect(() => {
    setMessage(announcementFor(previous.current, count))
    previous.current = count
  }, [count])
  return message
}

/**
 * Cloche du bureau (barre du haut) : bouton qui ouvre le panneau. Le panneau est non modal ; Échap et le clic
 * extérieur le ferment et rendent le focus à la cloche.
 * @param {{ allHref: string }} props `allHref` : page des notifications de l'espace
 */
export function NotificationBell({ allHref }) {
  const ctx = useNotifications()
  const count = ctx?.count ?? 0
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const anchor = useRef(null)
  const button = useRef(null)
  const message = useCountAnnouncement(count)

  function close({ restoreFocus = true } = {}) {
    setOpen(false)
    if (restoreFocus) button.current?.focus()
  }

  useEffect(() => {
    if (!open) return undefined
    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault()
        close()
      }
    }
    function onPointerDown(event) {
      if (anchor.current && !anchor.current.contains(event.target)) close()
    }
    document.addEventListener("keydown", onKeyDown)
    document.addEventListener("mousedown", onPointerDown)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.removeEventListener("mousedown", onPointerDown)
    }
  }, [open])

  if (!ctx) return null

  return (
    <div className="ntf-anchor" ref={anchor}>
      <button
        ref={button}
        type="button"
        className="iconbtn2"
        aria-label={bellLabel(count)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="i-bell" />
        {count > 0 ? <span className="iconbtn2__dot" aria-hidden="true" /> : null}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {message}
      </span>
      {open ? <NotificationsPanel id={panelId} allHref={allHref} onClose={close} /> : null}
    </div>
  )
}

/**
 * Cloche de l'en-tête mobile : lien vers la page des notifications (aucun panneau sous 1024 px).
 * @param {{ href: string }} props
 */
export function NotificationBellLink({ href }) {
  const ctx = useNotifications()
  const count = ctx?.count ?? 0
  const message = useCountAnnouncement(count)
  if (!ctx) return null
  return (
    <>
      <Link className="iconbtn2 ntf-bell-link" href={href} prefetch={false} aria-label={bellLabel(count)}>
        <Icon name="i-bell" />
        {count > 0 ? <span className="iconbtn2__dot" aria-hidden="true" /> : null}
      </Link>
      <span className="sr-only" role="status" aria-live="polite">
        {message}
      </span>
    </>
  )
}
