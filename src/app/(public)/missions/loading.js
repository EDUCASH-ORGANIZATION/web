import { LoadingSkeleton } from "@/components/ui/loading-skeleton"
import { PublicNavbar } from "@/components/home/public-navbar"

function CardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <LoadingSkeleton className="h-5 w-20 rounded-md" />
          <LoadingSkeleton className="h-5 w-24 rounded-md" />
        </div>
        <LoadingSkeleton className="h-5 w-full" />
        <LoadingSkeleton className="h-4 w-5/6" />
        <LoadingSkeleton className="h-4 w-full" />
        <LoadingSkeleton className="h-4 w-4/6" />
        <div className="flex gap-4 mt-1">
          <LoadingSkeleton className="h-3 w-20 rounded-full" />
          <LoadingSkeleton className="h-3 w-16 rounded-full" />
        </div>
      </div>
      <div className="border-t border-gray-100 px-5 py-3">
        <LoadingSkeleton className="h-4 w-16 mx-auto" />
      </div>
    </div>
  )
}

export default function MissionsLoading() {
  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <PublicNavbar />

      {/* Hero skeleton */}
      <section className="bg-gradient-to-br from-gray-50 to-gray-100 border-b border-gray-200 px-4 py-12">
        <div className="max-w-5xl mx-auto flex flex-col gap-3">
          <LoadingSkeleton className="h-10 w-72" />
          <LoadingSkeleton className="h-5 w-96 max-w-full" />
          <LoadingSkeleton className="h-4 w-48" />
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 py-8 flex flex-col gap-8">
        {/* Filtres skeleton */}
        <div className="flex flex-col gap-5">
          <div className="flex gap-2">
            <LoadingSkeleton className="h-11 flex-1 rounded-xl" />
            <LoadingSkeleton className="h-11 w-28 rounded-xl" />
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <LoadingSkeleton key={i} className="h-8 w-24 rounded-full" />
            ))}
          </div>
          <div className="flex gap-2">
            <LoadingSkeleton className="h-9 w-36 rounded-lg" />
            <LoadingSkeleton className="h-9 w-36 rounded-lg" />
            <LoadingSkeleton className="h-9 w-32 rounded-lg" />
          </div>
        </div>

        {/* Grille 6 cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </section>
    </div>
  )
}
