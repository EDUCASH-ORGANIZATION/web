"use client"

import { useEffect, useRef } from "react"
import { useSearchParams } from "next/navigation"

/**
 * Scrolle vers l'élément #missions-results dès qu'un filtre change dans l'URL.
 * À monter une seule fois dans la page, en dehors du hero.
 */
export function ScrollToResults({ targetId = "missions-results" }) {
  const searchParams = useSearchParams()
  const isFirst = useRef(true)

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false
      // Au premier chargement : si filtres actifs, scroller directement
      const hasFilters = searchParams.toString().length > 0
      if (hasFilters) {
        const el = document.getElementById(targetId)
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
      }
      return
    }
    // Après chaque changement de filtre : scroller
    const el = document.getElementById(targetId)
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [searchParams, targetId])

  return null
}
