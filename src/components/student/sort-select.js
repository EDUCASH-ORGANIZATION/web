"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { ChevronRight } from "lucide-react"

export function SortSelect({ sort }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleChange(e) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("sort", e.target.value)
    params.delete("page")
    router.push(`/missions?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="relative">
      <select
        value={sort}
        onChange={handleChange}
        className="h-9 pl-3 pr-8 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1A6B4A]/30 appearance-none cursor-pointer"
      >
        <option value="recent">Plus récentes</option>
        <option value="budget_desc">Budget décroissant</option>
        <option value="budget_asc">Budget croissant</option>
      </select>
      <ChevronRight size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none rotate-90" />
    </div>
  )
}
