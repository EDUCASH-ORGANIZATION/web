"use client"

import { useCallback, useTransition } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Icon } from "@/components/design/icon"
import {
  MISSION_TYPES, CITIES, BUDGET_RANGES, SORTS, SEARCH_MAX_LENGTH,
} from "@/lib/constants/missions"

function useMissionFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const navigate = useCallback((next) => {
    const sp = new URLSearchParams(searchParams?.toString() ?? {})
    Object.entries(next).forEach(([k, v]) => {
      if (v) sp.set(k, v)
      else sp.delete(k)
    })
    sp.delete("page")
    const qs = sp.toString()
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }))
  }, [router, pathname, searchParams])

  return { navigate, isPending }
}

export function MissionSearch({ q = "", type = "" }) {
  const { navigate } = useMissionFilters()

  const setType = (t) => navigate({ type: type === t ? "" : t })

  return (
    <>
      <form
        role="search"
        className="search search--hero v02-search"
        onSubmit={(e) => {
          e.preventDefault()
          navigate({ q: new FormData(e.currentTarget).get("q").toString().trim() })
        }}
      >
        <Icon name="i-search" className="ic" />
        <label className="sr-only" htmlFor="mission-q">Rechercher une mission</label>
        <input
          key={q}
          id="mission-q"
          name="q"
          type="search"
          maxLength={SEARCH_MAX_LENGTH}
          placeholder="Cours de maths, livraison, saisie…"
          defaultValue={q}
        />
        <button type="submit" className="btn btn--primary btn--sm">Chercher</button>
      </form>

      <div className="v02-types chips chips--scroll on-bleu">
        {MISSION_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            className={["chip", type === t ? "is-selected" : ""].filter(Boolean).join(" ")}
            aria-pressed={type === t}
            onClick={() => setType(t)}
          >
            {t}
          </button>
        ))}
      </div>
    </>
  )
}

export function MissionFilterBar({ q = "", type = "", ville = "", budget = "", tri = "", children }) {
  const { navigate, isPending } = useMissionFilters()

  return (
    <>
      <div className="filterbar">
        <select aria-label="Ville" value={ville} onChange={(e) => navigate({ ville: e.target.value })} className="chip chip--dropdown">
          <option value="">Toutes les villes</option>
          {CITIES.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <select aria-label="Budget" value={budget} onChange={(e) => navigate({ budget: e.target.value })} className="chip chip--dropdown">
          <option value="">Tous budgets</option>
          {BUDGET_RANGES.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
        </select>
        <select aria-label="Tri" value={tri} onChange={(e) => navigate({ tri: e.target.value })} className="chip chip--dropdown">
          {SORTS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        {(q || type || ville || budget || tri) && (
          <button type="button" className="chip chip--remove" onClick={() => navigate({ q: "", type: "", ville: "", budget: "", tri: "" })}>
            <Icon name="i-x" className="ic" /> Effacer les filtres
          </button>
        )}
        {children}
      </div>

      {isPending && <span className="filterbar__count muted" role="status">Chargement…</span>}
    </>
  )
}
