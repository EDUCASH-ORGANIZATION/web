"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Icon } from "@/components/design/icon"
import { logout } from "@/lib/actions/auth.actions"
import { useUnread } from "./unread-provider"
import { activeKey, countLabel, formatCount } from "./nav-model"
import { initialsOf } from "@/lib/app/format"

// Sidebar encre du bureau (masquée sous 1024 par la feuille de la coquille). Les compteurs de messages
// suivent le temps réel via UnreadProvider (un seul abonnement pour la coquille).
export function Sidebar({ nav, fullName }) {
  const pathname = usePathname()
  const unread = useUnread()
  const active = activeKey(pathname, nav.groups.flatMap((group) => group.items))
  const counts = { messages: unread }

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <Link href={nav.homeHref}>
          <img className="logo" src="/logo-horizontal-blanc.svg" alt="EduCash" width={165} height={40} />
        </Link>
        <span className="sidebar__space">{nav.space}</span>
      </div>
      {nav.cta ? (
        <Link className="btn btn--sidebar btn--sm btn--block sidebar__cta" href={nav.cta.href}>
          <Icon name={nav.cta.icon} />
          {nav.cta.label}
        </Link>
      ) : null}
      <nav className="sidebar__nav" aria-label="Navigation principale">
        {nav.groups.map((group, index) => (
          <GroupItems key={group.title ?? `groupe-${index}`} group={group} active={active} counts={counts} />
        ))}
      </nav>
      <div className="sidebar__me">
        <span className="av2" aria-hidden="true">{initialsOf(fullName)}</span>
        <span className="side2__me">
          <b>{fullName || nav.identityLabel}</b>
          <small>{nav.identityLabel}</small>
        </span>
        <form action={logout}>
          <button type="submit" className="iconbtn2" aria-label="Déconnexion">
            <Icon name="i-logout" />
          </button>
        </form>
      </div>
    </aside>
  )
}

function GroupItems({ group, active, counts }) {
  return (
    <>
      {group.title ? <span className="sidebar__group">{group.title}</span> : null}
      {group.items.map((item) => {
        const isActive = item.key === active
        const count = item.badge ? formatCount(counts[item.badge]) : null
        return (
          <Link
            key={item.key}
            href={item.href}
            className={isActive ? "nav-item is-active" : "nav-item"}
            aria-current={isActive ? "page" : undefined}
            aria-label={count ? countLabel(item.label, counts[item.badge]) : undefined}
          >
            <Icon name={item.icon} />
            {item.label}
            {count ? <span className="count" aria-hidden="true">{count}</span> : null}
          </Link>
        )
      })}
    </>
  )
}
