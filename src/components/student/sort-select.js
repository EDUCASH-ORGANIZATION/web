"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { ArrowUpDown, ChevronDown } from "lucide-react"

const SORT_OPTIONS = [
  { value: "recent",      label: "Plus récentes" },
  { value: "budget_desc", label: "Budget décroissant" },
  { value: "budget_asc",  label: "Budget croissant" },
]

export function SortSelect({ sort }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleChange(e) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("sort", e.target.value)
    params.delete("page")
    router.push(`/student/missions?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="relative flex items-center">
      <ArrowUpDown size={13} className="absolute left-2.5 text-gray-400 pointer-events-none z-10" />
      <select
        value={sort}
        onChange={handleChange}
        className="h-9 pl-8 pr-8 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1A6B4A]/20 focus:border-[#1A6B4A] appearance-none cursor-pointer transition-colors hover:border-gray-300"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown size={13} className="absolute right-2.5 text-gray-400 pointer-events-none" />
    </div>
  )
}
