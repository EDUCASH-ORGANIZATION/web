"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { Icon } from "@/components/design/icon"
import {
  closeMoreState,
  initialMoreState,
  isCloseKey,
  isOutside,
  moreAccessibleName,
  syncMoreState,
  toggleMoreState,
} from "./nav-model"

const PANEL_ID = "bnav2-more-panel"

// Entrée « Plus » de la barre mobile : bouton de divulgation et panneau au-dessus de la barre.
// Échap ferme (et rend le focus au bouton si le focus était dans le bloc), un clic hors du bloc ferme, un clic sur un lien
// ferme (même la page courante), un changement de route ferme et ne se rouvre pas au retour (état recalé pendant le rendu).
export function BottomNavMore({ more, active, activeKey, pathname }) {
  const [stored, setStored] = useState(() => initialMoreState(pathname))
  const state = syncMoreState(stored, pathname)
  if (state !== stored) setStored(state)
  const open = state.open
  const root = useRef(null)
  const button = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => {
      if (!isCloseKey(event.key)) return
      setStored(closeMoreState)
      if (!isOutside(root.current, document.activeElement)) button.current?.focus()
    }
    const onPointer = (event) => {
      if (isOutside(root.current, event.target)) setStored(closeMoreState)
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
        aria-label={moreAccessibleName(more, activeKey)}
        onClick={() => setStored(toggleMoreState)}
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
              onClick={() => setStored(closeMoreState)}
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
