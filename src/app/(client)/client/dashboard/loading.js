import { LoadingSkeleton } from "@/components/ui/loading-skeleton"

function StatSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-3 flex flex-col gap-2">
      <LoadingSkeleton className="w-8 h-8 rounded-lg" />
      <LoadingSkeleton className="h-8 w-14" />
      <LoadingSkeleton className="h-3 w-24" />
    </div>
  )
}

function TableRowSkeleton() {
  return (
    <tr className="border-b border-gray-50">
      <td className="px-4 py-3"><LoadingSkeleton className="h-4 w-36" /></td>
      <td className="px-4 py-3"><LoadingSkeleton className="h-4 w-24" /></td>
      <td className="px-4 py-3 text-center"><LoadingSkeleton className="h-4 w-8 mx-auto" /></td>
      <td className="px-4 py-3"><LoadingSkeleton className="h-5 w-20 rounded-full" /></td>
      <td className="px-4 py-3"><LoadingSkeleton className="h-3 w-16" /></td>
      <td className="px-4 py-3"><LoadingSkeleton className="h-4 w-10" /></td>
    </tr>
  )
}

function MobileCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 px-4 py-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <LoadingSkeleton className="h-4 flex-1 max-w-[200px]" />
        <LoadingSkeleton className="h-5 w-20 rounded-full shrink-0" />
      </div>
      <LoadingSkeleton className="h-3 w-32" />
      <LoadingSkeleton className="h-4 w-14" />
    </div>
  )
}

function ToHandleSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3">
      <div className="flex-1 flex flex-col gap-1.5">
        <LoadingSkeleton className="h-4 w-40" />
        <LoadingSkeleton className="h-3 w-28" />
      </div>
      <LoadingSkeleton className="w-4 h-4 rounded shrink-0" />
    </div>
  )
}

export default function ClientDashboardLoading() {
  return (
    <div className="px-4 py-6 max-w-5xl mx-auto flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <LoadingSkeleton className="h-8 w-52" />
          <LoadingSkeleton className="h-4 w-72" />
        </div>
        <LoadingSkeleton className="hidden md:block h-9 w-40 rounded-lg" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatSkeleton />
        <StatSkeleton />
        <StatSkeleton />
        <StatSkeleton />
      </div>

      {/* Corps */}
      <div className="flex flex-col md:flex-row gap-6">

        {/* Tableau desktop */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <LoadingSkeleton className="h-5 w-44" />
            <LoadingSkeleton className="h-4 w-16" />
          </div>

          <div className="hidden md:block bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {["Titre", "Type", "Candidatures", "Statut", "Date", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left">
                      <LoadingSkeleton className="h-3 w-16" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <TableRowSkeleton />
                <TableRowSkeleton />
                <TableRowSkeleton />
                <TableRowSkeleton />
                <TableRowSkeleton />
              </tbody>
            </table>
          </div>

          <div className="md:hidden flex flex-col gap-3">
            <MobileCardSkeleton />
            <MobileCardSkeleton />
            <MobileCardSkeleton />
          </div>
        </div>

        {/* À traiter */}
        <div className="md:w-72 shrink-0 flex flex-col gap-3">
          <LoadingSkeleton className="h-5 w-24" />
          <ToHandleSkeleton />
          <ToHandleSkeleton />
          <ToHandleSkeleton />
        </div>
      </div>
    </div>
  )
}
