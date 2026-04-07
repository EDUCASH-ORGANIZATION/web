"use client"

import Link from "next/link"

const TABS = [
  { value: "open",        label: "Ouvertes" },
  { value: "in_progress", label: "En cours" },
  { value: "done",        label: "Terminées" },
  { value: "cancelled",   label: "Annulées" },
]

export function MissionsTabs({ activeTab }) {
  return (
    <div className="flex gap-0 border-b border-gray-200 overflow-x-auto">
      {TABS.map(({ value, label }) => {
        const isActive = activeTab === value
        return (
          <Link
            key={value}
            href={`/client/missions?tab=${value}`}
            className={[
              "shrink-0 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap",
              isActive
                ? "border-b-2 border-[#1A6B4A] text-[#1A6B4A]"
                : "text-gray-500 hover:text-gray-700 border-b-2 border-transparent",
            ].join(" ")}
          >
            {label}
          </Link>
        )
      })}
    </div>
  )
}
