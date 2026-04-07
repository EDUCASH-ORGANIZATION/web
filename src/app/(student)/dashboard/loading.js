import { LoadingSkeleton } from "@/components/ui/loading-skeleton"

function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <LoadingSkeleton className="w-4 h-4 rounded" />
        <LoadingSkeleton className="h-3 w-16" />
      </div>
      <LoadingSkeleton className="h-8 w-12" />
      <LoadingSkeleton className="h-3 w-14" />
    </div>
  )
}

function MissionCardSkeleton() {
  return (
    <div className="shrink-0 w-72 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-5 flex flex-col gap-3">
        <div className="flex justify-between">
          <LoadingSkeleton className="h-5 w-20 rounded-md" />
          <LoadingSkeleton className="h-5 w-24 rounded-md" />
        </div>
        <LoadingSkeleton className="h-5 w-full" />
        <LoadingSkeleton className="h-4 w-5/6" />
        <LoadingSkeleton className="h-4 w-4/6" />
        <div className="flex gap-4">
          <LoadingSkeleton className="h-3 w-16 rounded-full" />
          <LoadingSkeleton className="h-3 w-14 rounded-full" />
        </div>
      </div>
    </div>
  )
}

function ApplicationRowSkeleton() {
  return (
    <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-4 py-3">
      <div className="flex-1 flex flex-col gap-1.5">
        <LoadingSkeleton className="h-4 w-48" />
        <LoadingSkeleton className="h-3 w-20" />
      </div>
      <LoadingSkeleton className="h-5 w-20 rounded-full shrink-0" />
    </div>
  )
}

export default function StudentDashboardLoading() {
  return (
    <div className="px-4 py-6 max-w-2xl mx-auto lg:max-w-3xl flex flex-col gap-6">

      {/* Salutation */}
      <div className="flex flex-col gap-2">
        <LoadingSkeleton className="h-8 w-56" />
        <LoadingSkeleton className="h-4 w-72" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      {/* Missions recommandées */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <LoadingSkeleton className="h-5 w-40" />
          <LoadingSkeleton className="h-4 w-16" />
        </div>
        <div className="flex gap-4 overflow-hidden -mx-4 px-4">
          <MissionCardSkeleton />
          <MissionCardSkeleton />
          <MissionCardSkeleton />
        </div>
      </section>

      {/* Candidatures récentes */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <LoadingSkeleton className="h-5 w-44" />
          <LoadingSkeleton className="h-4 w-16" />
        </div>
        <div className="flex flex-col gap-2">
          <ApplicationRowSkeleton />
          <ApplicationRowSkeleton />
          <ApplicationRowSkeleton />
        </div>
      </section>
    </div>
  )
}
