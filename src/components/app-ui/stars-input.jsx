"use client"

import { useRef } from "react"
import { Icon } from "@/components/design/icon"
import { nextStarValue } from "./interactive-logic"

const STARS = [1, 2, 3, 4, 5]

// Note de 1 à 5 : groupe radio d'étoiles. `value` : entier ou 0 (aucune note). Flèches, Début et Fin au clavier.
export function StarsInput({ value = 0, onChange, label = "Note", disabled = false }) {
  const refs = useRef([])
  // Un seul arrêt de tabulation : l'étoile choisie, ou la première sans note.
  const tabbable = value >= 1 && value <= 5 ? value : 1

  const onKeyDown = (e) => {
    const next = nextStarValue(value, e.key)
    if (next === null) return
    e.preventDefault()
    onChange?.(next)
    refs.current[next - 1]?.focus()
  }

  return (
    <div className="stars stars--input" role="radiogroup" aria-label={label}>
      {STARS.map((n) => (
        <button
          key={n}
          ref={(node) => {
            refs.current[n - 1] = node
          }}
          type="button"
          className="ds-stars__btn"
          role="radio"
          aria-checked={n === value}
          aria-label={n === 1 ? "1 étoile sur 5" : `${n} étoiles sur 5`}
          tabIndex={n === tabbable ? 0 : -1}
          disabled={disabled}
          onClick={() => onChange?.(n)}
          onKeyDown={onKeyDown}
        >
          <Icon name="i-star" className={n <= value ? "ic is-on" : "ic"} />
        </button>
      ))}
    </div>
  )
}

export default StarsInput
