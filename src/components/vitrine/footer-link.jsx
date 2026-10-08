"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

// Lien du pied de page : pose la page active (aria-current et is-active).
// Un lien avec ancre ou paramètre n'est jamais actif.
export function FooterLink({ href, children }) {
  const pathname = usePathname()
  const active = !href.includes("#") && !href.includes("?") && pathname === href
  return (
    <Link href={href} className={active ? "is-active" : undefined} aria-current={active ? "page" : undefined}>
      {children}
    </Link>
  )
}
