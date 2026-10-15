"use client"

import { Suspense, useEffect, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { Icon } from "@/components/design/icon"
import { NotificationBell } from "@/components/notifications/notification-bell"
import { isSearchShortcut } from "./nav-model"

const MAX_ECHO = 100
// Choix de l'URL conservés quand on relance une recherche depuis la barre du haut (mêmes noms que le formulaire mobile).
const KEPT_PARAMS = ["type", "cities", "urgency", "budget", "sort"]
const MAX_KEPT_VALUE = 200

function SearchField({ search, inputRef, defaultValue, echo = false }) {
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
      {...(echo ? { maxLength: MAX_ECHO } : {})}
    />
  )
}

// Reprend la recherche courante (élaguée, bornée à 100 caractères) seulement si l'action du formulaire est la page affichée.
function EchoSearchField({ search, inputRef }) {
  const pathname = usePathname()
  const params = useSearchParams()
  const current = pathname === search.action ? (params.get(search.param) ?? "").trim().slice(0, MAX_ECHO) : ""
  return <SearchField search={search} inputRef={inputRef} defaultValue={current || undefined} echo />
}

// Conserve les filtres actifs (type, villes, urgence, budget, tri) dans la recherche, en champs cachés, comme le
// formulaire mobile. Seulement sur la page de l'action ; la page courante n'est pas conservée.
function EchoKeptFilters({ search }) {
  const pathname = usePathname()
  const params = useSearchParams()
  if (pathname !== search.action) return null
  return KEPT_PARAMS.map((name) => {
    const value = (params.get(name) ?? "").slice(0, MAX_KEPT_VALUE)
    return value ? <input key={name} type="hidden" name={name} value={value} /> : null
  })
}

// Barre du haut du bureau : recherche en GET vers l'URL de la configuration, raccourci « / ».
// Avec search.echo, le champ affiche la recherche courante ; sans, le rendu reste inchangé.
// Cloche des notifications après la recherche (`notificationsHref` : page de l'espace) ; sans lien, pas de cloche.
export function TopBar({ search, notificationsHref }) {
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
        {search.echo ? (
          <Suspense fallback={null}>
            <EchoKeptFilters search={search} />
          </Suspense>
        ) : null}
        <label className="search2">
          <Icon name="i-search" />
          {search.echo ? (
            <Suspense fallback={<SearchField search={search} inputRef={input} echo />}>
              <EchoSearchField search={search} inputRef={input} />
            </Suspense>
          ) : (
            <SearchField search={search} inputRef={input} />
          )}
          <kbd aria-hidden="true">/</kbd>
        </label>
      </form>
      {notificationsHref ? (
        <div className="top2__actions">
          <NotificationBell allHref={notificationsHref} />
        </div>
      ) : null}
    </header>
  )
}
