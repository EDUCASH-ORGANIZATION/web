"use client"

import { Suspense, useEffect, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { Icon } from "@/components/design/icon"
import { isSearchShortcut } from "./nav-model"

const MAX_ECHO = 100

function SearchField({ search, inputRef, defaultValue }) {
  return (
    <input
      key={defaultValue}
      ref={inputRef}
      type="search"
      name={search.param}
      placeholder={search.placeholder}
      aria-label={search.label}
      aria-keyshortcuts="/"
      autoComplete="off"
      defaultValue={defaultValue}
    />
  )
}

// Reprend la recherche courante (bornée à 100 caractères) seulement si l'action du formulaire est la page affichée.
function EchoSearchField({ search, inputRef }) {
  const pathname = usePathname()
  const params = useSearchParams()
  const current = pathname === search.action ? (params.get(search.param) ?? "").slice(0, MAX_ECHO) : ""
  return <SearchField search={search} inputRef={inputRef} defaultValue={current || undefined} />
}

// Barre du haut du bureau : recherche en GET vers l'URL de la configuration, raccourci « / ».
// Avec search.echo, le champ affiche la recherche courante ; sans, le rendu reste inchangé.
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
          {search.echo ? (
            <Suspense fallback={<SearchField search={search} inputRef={input} />}>
              <EchoSearchField search={search} inputRef={input} />
            </Suspense>
          ) : (
            <SearchField search={search} inputRef={input} />
          )}
          <kbd aria-hidden="true">/</kbd>
        </label>
      </form>
    </header>
  )
}
