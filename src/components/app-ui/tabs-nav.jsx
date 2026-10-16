"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { hasMoreToScroll } from "./interactive-logic"

const cx = (...parts) => parts.filter(Boolean).join(" ")

// Onglets soulignés en liens. items : [{ key, label, href, count }] ; `activeKey` désigne l'onglet courant.
// Quand la liste déborde (mobile), un dégradé signale qu'il reste des onglets à droite.
// `variant="e2"` : onglets sobres de l'espace étudiant (`e2-tabs`, `e2-tab`, compteur en <b>).
export function TabsNav({ items, activeKey, label, variant }) {
  const e2 = variant === "e2"
  const listRef = useRef(null)
  const [more, setMore] = useState(false)

  useEffect(() => {
    const el = listRef.current
    if (!el) return undefined
    const update = () => setMore(hasMoreToScroll(el))
    update()
    el.addEventListener("scroll", update, { passive: true })
    // Le ResizeObserver couvre la fenêtre, le conteneur et le contenu : aucune dépendance sur `items`.
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update)
    observer?.observe(el)
    for (const child of el.children) observer?.observe(child)
    // Onglets ajoutés, retirés ou renommés : le contenu change sans que la fenêtre bouge.
    const mutations = new MutationObserver(update)
    mutations.observe(el, { childList: true, subtree: true, characterData: true })
    return () => {
      el.removeEventListener("scroll", update)
      observer?.disconnect()
      mutations.disconnect()
    }
  }, [])

  return (
    <nav aria-label={label} className={cx("tabs-wrap", more && "tabs-wrap--more")}>
      <div ref={listRef} className={e2 ? "e2-tabs" : "tabs"}>
        {items.map((item) => {
          const active = item.key === activeKey
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cx(e2 ? "e2-tab" : "tab", active && "is-active")}
              aria-current={active ? "page" : undefined}
            >
              {item.label}
              {item.count > 0 ? e2 ? <b>{item.count}</b> : <span className="count">{item.count}</span> : null}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export default TabsNav
