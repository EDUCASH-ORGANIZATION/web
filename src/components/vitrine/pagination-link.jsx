"use client"

import Link from "next/link"
import { markPagination } from "@/components/shared/route-scroll"

// Lien de pagination : marque la navigation pour que RouteScroll remonte en haut de la liste (seule la recherche
// change). Les filtres, eux, gardent leur position.
export function PaginationLink({ onClick, ...props }) {
  return (
    <Link
      {...props}
      onClick={(event) => {
        onClick?.(event)
        markPagination()
      }}
    />
  )
}
