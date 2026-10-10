"use client"

import Link from "next/link"
import { Icon } from "@/components/design/icon"

function moveFocus(event) {
  const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }
  const step = keys[event.key]
  if (!step) return false
  const group = event.currentTarget.closest('[role="radiogroup"]')
  const items = group ? [...group.querySelectorAll('[role="radio"]:not([aria-disabled="true"])')] : []
  const next = items[(items.indexOf(event.currentTarget) + step + items.length) % items.length]
  if (!next) return false
  event.preventDefault()
  next.focus()
  next.click()
  return true
}

/**
 * Carte de choix à sémantique radio (`.choice`), à placer dans un `role="radiogroup"`.
 * Clavier : Espace ou Entrée sélectionne, flèches déplacent et sélectionnent.
 * Avec `href`, la carte est un lien (fonctionne sans JavaScript, ex. `?role=`).
 * @param {{
 *   title: string,
 *   sub?: string,
 *   icon: string,
 *   tone?: "" | "bleu" | "menthe" | "lavande" | "rose",
 *   selected?: boolean,
 *   disabled?: boolean,
 *   invalid?: boolean,
 *   href?: string,
 *   onSelect?: () => void,
 * }} props
 */
export function ChoiceCard({ title, sub, icon, tone = "", selected = false, disabled = false, invalid = false, href, onSelect }) {
  const className = `choice${selected ? " is-selected" : ""}${invalid ? " is-error" : ""}${disabled ? " is-disabled" : ""}`
  const common = {
    className,
    role: "radio",
    "aria-checked": selected,
    "aria-disabled": disabled || undefined,
    tabIndex: disabled ? -1 : 0,
  }

  function select() {
    if (!disabled) onSelect?.()
  }

  function handleKeyDown(event) {
    if (disabled) return
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault()
      event.currentTarget.click()
      return
    }
    moveFocus(event)
  }

  const content = (
    <>
      <span className={`ic-sq${tone ? ` ic-sq--${tone}` : ""}`}>
        <Icon name={icon} />
      </span>
      <span>
        <span className="choice__title">{title}</span>
        {sub && <span className="choice__sub">{sub}</span>}
      </span>
      <span className="choice__mark" />
    </>
  )

  if (href && !disabled) {
    return (
      <Link {...common} href={href} replace scroll={false} onClick={select} onKeyDown={handleKeyDown}>
        {content}
      </Link>
    )
  }
  return (
    <div {...common} onClick={select} onKeyDown={handleKeyDown}>
      {content}
    </div>
  )
}
