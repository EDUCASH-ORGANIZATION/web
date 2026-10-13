"use client"

import { useEffect, useRef } from "react"
import { Icon } from "@/components/design/icon"
import { isSearchShortcut } from "./nav-model"

// Barre du haut du bureau : recherche en GET vers l'URL de la configuration, raccourci « / ».
// Pas de cloche tant qu'aucune notification n'existe.
export function TopBar({ search }) {
  const input = useRef(null)

  useEffect(() => {
    function onKeyDown(event) {
      if (!isSearchShortcut(event)) return
      event.preventDefault()
      input.current?.focus()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <header className="top2">
      <form role="search" method="get" action={search.action}>
        <label className="search2">
          <Icon name="i-search" />
          <input
            ref={input}
            type="search"
            name={search.param}
            placeholder={search.placeholder}
            aria-label={search.label}
            aria-keyshortcuts="/"
            autoComplete="off"
          />
          <kbd aria-hidden="true">/</kbd>
        </label>
      </form>
    </header>
  )
}
