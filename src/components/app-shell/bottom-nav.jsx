"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Icon } from "@/components/design/icon"
import { BottomNavMore } from "./bottom-nav-more"
import { useUnread } from "./unread-provider"
import { countLabel, formatCount, isHiddenBelow, isItemActive, resolveMobileActive } from "./nav-model"

// Barre du bas mobile (sous 1024), capsule flottante : l'entrée active est une pastille avec icône et libellé,
// les autres sont des icônes seules (nom accessible en aria-label). Une entrée `cta` est le bouton rond central
// (icône seule, jamais de pastille ni de libellé, aria-current sur sa route). `more` ajoute un bouton « Plus » et son panneau.
// `hideBelow` masque la barre sur les enfants stricts de ces chemins ; `reserveSpace` rend un espaceur seulement
// quand la barre l'est (espaces sans coquille). La feuille de la coquille la masque au bureau.
export function BottomNav({ items, more, counts = {}, hideBelow = [], reserveSpace = false }) {
  const pathname = usePathname()
  const unread = useUnread()
  if (isHiddenBelow(pathname, hideBelow)) return null

  const values = { messages: unread, ...counts }
  const { activeKey, moreActive, moreActiveKey } = resolveMobileActive(pathname, items, more)

  return (
    <>
      {reserveSpace ? <div className="bnav2-spacer" aria-hidden="true" /> : null}
      <nav className="bottom-nav bottom-nav--v2" aria-label="Navigation mobile">
        {items.map((item) => {
          if (item.cta) {
            const current = isItemActive(pathname, item)
            return (
              <Link
                key={item.key}
                href={item.href}
                className="bottom-nav__cta"
                aria-current={current ? "page" : undefined}
                aria-label={item.label}
              >
                <Icon name={item.icon} />
              </Link>
            )
          }
          const isActive = item.key === activeKey
          const value = item.badge ? values[item.badge] : null
          const count = formatCount(value)
          const name = count ? countLabel(item.label, value, item.badgeUnit ?? "non lus") : item.label
          return (
            <Link
              key={item.key}
              href={item.href}
              className={isActive ? "bnav-item is-active" : "bnav-item"}
              aria-current={isActive ? "page" : undefined}
              aria-label={!isActive || count ? name : undefined}
            >
              <Icon name={item.icon} />
              {isActive ? <span className="bnav-label">{item.label}</span> : null}
              {count ? <i className="bnav-item__dot" aria-hidden="true">{count}</i> : null}
            </Link>
          )
        })}
        {more ? <BottomNavMore more={more} active={moreActive} activeKey={moreActiveKey} pathname={pathname} /> : null}
      </nav>
    </>
  )
}
