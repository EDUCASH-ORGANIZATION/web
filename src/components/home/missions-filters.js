"use client"

import { useCallback, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Search } from "lucide-react"
import { MISSION_TYPES, CITIES } from "@/lib/supabase/database.constants"
import clsx from "clsx"

export function MissionsFilters() {
  const router = useRouter()
  const params = useSearchParams()
  const searchRef = useRef(null)

  const set = useCallback(
    (key, value) => {
      const next = new URLSearchParams(params.toString())
      if (value) next.set(key, value)
      else next.delete(key)
      next.delete("page")
      router.push(`/missions?${next.toString()}`)
    },
    [params, router]
  )

  const activeType = params.get("type") ?? ""
  const activeCity = params.get("city") ?? ""
  const activeUrgency = params.get("urgency") ?? ""
  const activeBudget = params.get("budget") ?? ""

  function handleSearch(e) {
    e.preventDefault()
    set("q", searchRef.current?.value ?? "")
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Barre de recherche avec bouton */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            ref={searchRef}
            type="search"
            defaultValue={params.get("q") ?? ""}
            placeholder="Quel job recherchez-vous ?"
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1A6B4A] focus:border-transparent shadow-sm"
          />
        </div>
        <button
          type="submit"
          className="h-11 px-5 rounded-xl bg-[#1A6B4A] text-white text-sm font-semibold hover:bg-[#155a3d] transition-colors touch-manipulation shrink-0"
        >
          Rechercher
        </button>
      </form>

      {/* Chips type — "Tout voir" + un par type */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => set("type", "")}
          className={clsx(
            "px-4 py-1.5 rounded-full text-sm font-medium border transition-colors touch-manipulation",
            !activeType
              ? "bg-[#1A6B4A] text-white border-[#1A6B4A]"
              : "bg-white text-gray-600 border-gray-200 hover:border-[#1A6B4A] hover:text-[#1A6B4A]"
          )}
        >
          Tout voir
        </button>
        {MISSION_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => set("type", activeType === type ? "" : type)}
            className={clsx(
              "px-4 py-1.5 rounded-full text-sm font-medium border transition-colors touch-manipulation",
              activeType === type
                ? "bg-[#1A6B4A] text-white border-[#1A6B4A]"
                : "bg-white text-gray-600 border-gray-200 hover:border-[#1A6B4A] hover:text-[#1A6B4A]"
            )}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Filtres secondaires + tri */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex flex-wrap gap-2">
          {/* Ville */}
          <select
            value={activeCity}
            onChange={(e) => set("city", e.target.value)}
            className="h-9 pl-3 pr-8 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1A6B4A] focus:border-transparent appearance-none cursor-pointer"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center" }}
          >
            <option value="">Ville : Toutes</option>
            {CITIES.map((c) => (
              <option key={c} value={c}>Ville : {c}</option>
            ))}
          </select>

          {/* Budget max */}
          <select
            value={activeBudget}
            onChange={(e) => set("budget", e.target.value)}
            className="h-9 pl-3 pr-8 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1A6B4A] focus:border-transparent appearance-none cursor-pointer"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center" }}
          >
            <option value="">Budget : Tous</option>
            <option value="5000">Budget : &lt; 5 000 FCFA</option>
            <option value="15000">Budget : &lt; 15 000 FCFA</option>
            <option value="30000">Budget : &lt; 30 000 FCFA</option>
            <option value="50000">Budget : &lt; 50 000 FCFA</option>
          </select>

          {/* Urgence */}
          <select
            value={activeUrgency}
            onChange={(e) => set("urgency", e.target.value)}
            className="h-9 pl-3 pr-8 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1A6B4A] focus:border-transparent appearance-none cursor-pointer"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center" }}
          >
            <option value="">Urgence : Toutes</option>
            <option value="high">Urgent</option>
            <option value="medium">Moyen</option>
            <option value="low">Normal</option>
          </select>
        </div>

        {/* Tri */}
        <div className="flex items-center gap-1.5 text-sm text-gray-500">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
            <path d="M3 6h18M7 12h10M11 18h2" />
          </svg>
          <span>Trier par : <strong className="text-gray-700">Récents</strong></span>
        </div>
      </div>
    </div>
  )
}
