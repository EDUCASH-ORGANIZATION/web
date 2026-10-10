"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { RouteScroll } from "./route-scroll"

function WithSearch() {
  return <RouteScroll search={useSearchParams().toString()} />
}

// useSearchParams exige une frontière Suspense hors rendu dynamique : sans elle, les pages statiques
// basculeraient en rendu côté client.
export function RouteScrollMount() {
  return (
    <Suspense fallback={null}>
      <WithSearch />
    </Suspense>
  )
}
