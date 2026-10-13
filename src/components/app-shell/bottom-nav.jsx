"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Icon } from "@/components/design/icon"
import { useUnread } from "./unread-provider"
import { activeKey, countLabel, formatCount } from "./nav-model"

// Barre du bas mobile (sous 1024) : 5 onglets, onglet actif, pastille de messages non lus.
// La feuille de la coquille la masque au bureau et sur les écrans de détail.
export function BottomNav({ items }) {
  const pathname = usePathname()
  const unread = useUnread()
  const active = activeKey(pathname, items)
  const counts = { messages: unread }

  return (
    <nav className="bottom-nav bottom-nav--v2" aria-label="Navigation mobile">
      {items.map((item) => {
        const isActive = item.key === active
        const count = item.badge ? formatCount(counts[item.badge]) : null
        return (
          <Link
            key={item.key}
            href={item.href}
            className={isActive ? "bnav-item is-active" : "bnav-item"}
            aria-current={isActive ? "page" : undefined}
            aria-label={count ? countLabel(item.label, counts[item.badge]) : undefined}
          >
            <Icon name={item.icon} />
            <span className="bnav-label">{item.label}</span>
            {count ? <i className="bnav-item__dot" aria-hidden="true">{count}</i> : null}
          </Link>
        )
      })}
    </nav>
  )
}
