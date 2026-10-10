"use client"

import Link from "next/link"
import { markPagination } from "@/components/shared/route-scroll"
import { plainLeftClick } from "@/components/vitrine/shared/hash-scroll"

// Vrai si le clic mène vraiment à une autre page de la liste : clic gauche simple, non annulé, hors lien de la
// page courante (aria-current), sinon le marqueur resterait posé sans navigation.
export function shouldMarkPagination(click, current) {
  if (current || click.defaultPrevented) return false
  return plainLeftClick(click)
}

// Lien de pagination : marque la navigation pour que RouteScroll remonte en haut de la liste (seule la recherche
// change). Les filtres, eux, gardent leur position.
export function PaginationLink({ onClick, ...props }) {
  return (
    <Link
      {...props}
      onClick={(event) => {
        onClick?.(event)
        const link = event.currentTarget
        const click = {
          button: event.button,
          metaKey: event.metaKey,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          defaultPrevented: event.defaultPrevented,
          target: link.getAttribute("target"),
          download: link.hasAttribute("download"),
        }
        if (shouldMarkPagination(click, props["aria-current"] === "page")) markPagination()
      }}
    />
  )
}
