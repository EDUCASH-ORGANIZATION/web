"use client"

import { useCallback, useTransition } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Icon } from "@/components/design/icon"

export const TYPE_CHIPS = [
  "Babysitting", "Livraison", "Saisie", "Community Management",
  "Traduction", "Cours particuliers", "Autre",
]
export const VILLES = ["Cotonou", "Abomey-Calavi", "Porto-Novo"]
export const BUDGETS = [
  { id: "", label: "Tous budgets" },
  { id: "0-5000", label: "Moins de 5 000 FCFA" },
  { id: "5000-15000", label: "5 000 à 15 000 FCFA" },
  { id: "15000-30000", label: "15 000 à 30 000 FCFA" },
  { id: "30000+", label: "Plus de 30 000 FCFA" },
]
export const TRIS = [
  { id: "", label: "Plus récentes" },
  { id: "prix", label: "Budget croissant" },
  { id: "prix-desc", label: "Budget décroissant" },
]

export function MissionExplorer({ q = "", type = "", ville = "", budget = "", tri = "" }) {
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
    const qs = sp.toString()
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }))
  }, [router, pathname, searchParams])

  const setType = (t) => navigate({ type: type === t ? "" : t })

  return (
    <>
      <div className="v02-search">
        <Icon name="i-search" className="ic" />
        <input
          type="search"
          placeholder="Rechercher une mission…"
          aria-label="Rechercher une mission"
          defaultValue={q}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); navigate({ q: e.currentTarget.value.trim() }) } }}
        />
      </div>

      <div className="v02-types chips chips--scroll">
        {TYPE_CHIPS.map((t) => (
          <button
            key={t}
            className={["chip", type === t ? "is-active" : ""].filter(Boolean).join(" ")}
            onClick={() => setType(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="filterbar">
        <select aria-label="Ville" value={ville} onChange={(e) => navigate({ ville: e.target.value })} className="chip chip--dropdown">
          {["", ...VILLES].map((v) => <option key={v || "all"} value={v}>{v === "" ? "Toutes les villes" : v}</option>)}
        </select>
        <select aria-label="Budget" value={budget} onChange={(e) => navigate({ budget: e.target.value })} className="chip chip--dropdown">
          {BUDGETS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
        </select>
        <select aria-label="Tri" value={tri} onChange={(e) => navigate({ tri: e.target.value })} className="chip chip--dropdown">
          {TRIS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        {(q || type || ville || budget || tri) && (
          <button className="chip chip--remove" onClick={() => navigate({ q: "", type: "", ville: "", budget: "", tri: "" })}>
            <Icon name="i-x" className="ic" /> Effacer les filtres
          </button>
        )}
      </div>

      {isPending && <span className="filterbar__count" style={{ opacity: 0.6 }}>Chargement…</span>}
    </>
  )
}