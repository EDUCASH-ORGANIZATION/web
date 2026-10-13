"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { hasMoreToScroll } from "./interactive-logic"

const cx = (...parts) => parts.filter(Boolean).join(" ")

// Onglets soulignés en liens. items : [{ key, label, href, count }] ; `activeKey` désigne l'onglet courant.
// Quand la liste déborde (mobile), un dégradé signale qu'il reste des onglets à droite.
export function TabsNav({ items, activeKey, label }) {
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
      <div ref={listRef} className="tabs">
        {items.map((item) => {
          const active = item.key === activeKey
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cx("tab", active && "is-active")}
              aria-current={active ? "page" : undefined}
            >
              {item.label}
              {item.count > 0 ? <span className="count">{item.count}</span> : null}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export default TabsNav
