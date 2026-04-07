"use client"

import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight, Briefcase } from "lucide-react"
import { MissionCard } from "@/components/shared/mission-card"
import { EmptyState } from "@/components/ui/empty-state"
import clsx from "clsx"

const PAGE_SIZE = 9

/**
 * @param {{
 *   missions: import('@/lib/supabase/database.constants').Mission[],
 *   totalCount: number,
 *   page: number,
 *   isLoggedIn: boolean,
 *   searchString: string
 * }} props
 */
export function MissionsGrid({ missions, totalCount, page, isLoggedIn, searchString }) {
  const router = useRouter()

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  function goToPage(p) {
    const params = new URLSearchParams(searchString)
    params.set("page", String(p))
    router.push(`/missions?${params.toString()}`)
  }

  function handleApply(mission) {
    if (!isLoggedIn) {
      router.push(`/auth/register?redirect=/missions/${mission.id}`)
      return
    }
    router.push(`/missions/${mission.id}`)
  }

  function handleCardClick(mission) {
    router.push(`/missions/${mission.id}`)
  }

  if (!missions?.length) {
    return (
      <EmptyState
        icon={Briefcase}
        title="Aucune mission trouvée"
        message="Essayez de modifier vos filtres ou revenez plus tard."
      />
    )
  }

  // Pagination — affiche max 5 numéros de page + ellipsis
  function getPageNumbers() {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)

    const pages = []
    if (page <= 3) {
      pages.push(1, 2, 3, "…", totalPages)
    } else if (page >= totalPages - 2) {
      pages.push(1, "…", totalPages - 2, totalPages - 1, totalPages)
    } else {
      pages.push(1, "…", page - 1, page, page + 1, "…", totalPages)
    }
    return pages
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Grille */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {missions.map((mission) => (
          <div
            key={mission.id}
            onClick={() => handleCardClick(mission)}
            className="cursor-pointer"
          >
            <MissionCard
              mission={mission}
              showApplyButton
              onApply={(m) => { handleApply(m) }}
            />
          </div>
        ))}
      </div>

      {/* Pagination style image */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          <button
            type="button"
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
            className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors touch-manipulation"
          >
            <ChevronLeft size={16} />
          </button>

          {getPageNumbers().map((p, i) =>
            p === "…" ? (
              <span key={`ellipsis-${i}`} className="w-9 h-9 flex items-center justify-center text-sm text-gray-400">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => goToPage(p)}
                className={clsx(
                  "w-9 h-9 flex items-center justify-center rounded-full text-sm font-medium transition-colors touch-manipulation",
                  p === page
                    ? "bg-[#1A6B4A] text-white"
                    : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                )}
              >
                {p}
              </button>
            )
          )}

          <button
            type="button"
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages}
            className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors touch-manipulation"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
