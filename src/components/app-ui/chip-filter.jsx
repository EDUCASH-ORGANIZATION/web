"use client"

import Link from "next/link"
import { useRef } from "react"
import { nextRadioIndex } from "./interactive-logic"

const cx = (...parts) => parts.filter(Boolean).join(" ")

// Groupe de puces à choix unique. options : [{ value, label, href?, count? }].
// Avec `href` sur les options : mode lien (la sélection est l'URL) ; sinon mode bouton (`onChange(value)`).
// Flèches gauche/droite (et haut/bas, Début, Fin) déplacent le choix ; un seul arrêt de tabulation.
export function ChipFilter({ options, value, onChange, label }) {
  const refs = useRef([])
  const selectedIndex = options.findIndex((o) => o.value === value)
  const tabbable = selectedIndex >= 0 ? selectedIndex : 0

  const onKeyDown = (e, index) => {
    const next = nextRadioIndex(options.length, index, e.key)
    if (next < 0) return
    e.preventDefault()
    const el = refs.current[next]
    el?.focus()
    el?.click()
  }

  return (
    <div className="chips chips--scroll" role="radiogroup" aria-label={label}>
      {options.map((o, i) => {
        const selected = i === selectedIndex
        const props = {
          ref: (node) => {
            refs.current[i] = node
          },
          role: "radio",
          "aria-checked": selected,
          tabIndex: i === tabbable ? 0 : -1,
          className: cx("chip", selected && "is-selected"),
          onKeyDown: (e) => onKeyDown(e, i),
        }
        const content = (
          <>
            {o.label}
            {o.count > 0 ? <span className="count">{o.count}</span> : null}
          </>
        )
        return o.href ? (
          <Link key={o.value} href={o.href} {...props}>{content}</Link>
        ) : (
          <button key={o.value} type="button" {...props} onClick={() => onChange?.(o.value)}>{content}</button>
        )
      })}
    </div>
  )
}

export default ChipFilter
