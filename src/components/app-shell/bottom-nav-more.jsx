"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { Icon } from "@/components/design/icon"
import { isCloseKey, isOutside } from "./nav-model"

const PANEL_ID = "bnav2-more-panel"

// Entrée « Plus » de la barre mobile : bouton de divulgation et panneau au-dessus de la barre.
// Échap ferme et rend le focus au bouton, un clic hors du bloc ferme, un changement de route ferme
// (le panneau n'est ouvert que pour le chemin où on l'a ouvert, sans effet de synchronisation).
export function BottomNavMore({ more, active, activeKey, pathname }) {
  const [openAt, setOpenAt] = useState(null)
  const root = useRef(null)
  const button = useRef(null)
  const open = openAt === pathname

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => {
      if (!isCloseKey(event.key)) return
      setOpenAt(null)
      button.current?.focus()
    }
    const onPointer = (event) => {
      if (isOutside(root.current, event.target)) setOpenAt(null)
    }
    document.addEventListener("keydown", onKey)
    document.addEventListener("pointerdown", onPointer)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("pointerdown", onPointer)
    }
  }, [open])

  return (
    <div className="bnav2-more" ref={root}>
      <button
        ref={button}
        type="button"
        className={active ? "bnav-item is-active" : "bnav-item"}
        aria-expanded={open}
        aria-controls={PANEL_ID}
        aria-label={more.label}
        onClick={() => setOpenAt(open ? null : pathname)}
      >
        <Icon name={more.icon} />
        {active ? <span className="bnav-label">{more.label}</span> : null}
      </button>
      <ul id={PANEL_ID} className="bnav2-more__panel" hidden={!open}>
        {more.items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              className="bnav2-more__link"
              aria-current={item.key === activeKey ? "page" : undefined}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
