"use client"

import { usePathname } from "next/navigation"
import { AnchorLink } from "./shared/hash-scroll"

// Lien du pied de page : pose la page active (aria-current et is-active).
// Un lien avec ancre ou paramètre n'est jamais actif.
export function FooterLink({ href, children }) {
  const pathname = usePathname()
  const active = !href.includes("#") && !href.includes("?") && pathname === href
  return (
    <AnchorLink href={href} className={active ? "is-active" : undefined} aria-current={active ? "page" : undefined}>
      {children}
    </AnchorLink>
  )
}
