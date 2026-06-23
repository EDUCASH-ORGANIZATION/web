export default function MissionsLoading() {
  return (
    <div className="flex flex-col min-h-full animate-pulse">
      {/* Chips catégories skeleton */}
      <div className="bg-white border-b border-gray-100 px-4 lg:px-6 py-3">
        <div className="flex items-center gap-2 overflow-x-hidden">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="shrink-0 h-7 rounded-full bg-gray-100" style={{ width: `${60 + (i % 3) * 20}px` }} />
          ))}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row flex-1 gap-4 lg:gap-6 p-4 lg:p-6 max-w-[1280px] w-full mx-auto">
        {/* Sidebar skeleton */}
        <div className="hidden lg:flex w-56 shrink-0 flex-col gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-5">
            <div className="h-3 w-24 bg-gray-100 rounded-full" />
            <div className="flex flex-col gap-3">
              <div className="h-3 w-32 bg-gray-100 rounded-full" />
              <div className="h-2 bg-gray-100 rounded-full" />
              <div className="flex justify-between">
                <div className="h-2 w-12 bg-gray-100 rounded-full" />
                <div className="h-2 w-20 bg-gray-100 rounded-full" />
              </div>
            </div>
            <div className="flex flex-col gap-2.5">
              <div className="h-3 w-20 bg-gray-100 rounded-full" />
              {[1,2,3].map(i => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-gray-100 shrink-0" />
                  <div className="h-3 w-24 bg-gray-100 rounded-full" />
                </div>
              ))}
            </div>
          </div>
          <div className="h-36 bg-gray-100 rounded-2xl" />
        </div>

        {/* Contenu principal skeleton */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-1.5">
              <div className="h-5 w-44 bg-gray-200 rounded-full" />
              <div className="h-3 w-20 bg-gray-100 rounded-full" />
            </div>
            <div className="h-9 w-36 bg-gray-100 rounded-xl" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 lg:gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 pt-5 flex items-start justify-between gap-3">
                  <div className="h-6 w-20 bg-gray-100 rounded-xl" />
                  <div className="flex flex-col items-end gap-1">
                    <div className="h-6 w-16 bg-gray-100 rounded-full" />
                    <div className="h-3 w-10 bg-gray-100 rounded-full" />
                  </div>
                </div>
                <div className="px-5 py-3 flex flex-col gap-2">
                  <div className="h-4 w-3/4 bg-gray-100 rounded-full" />
                  <div className="h-3 w-full bg-gray-100 rounded-full" />
                  <div className="h-3 w-2/3 bg-gray-100 rounded-full" />
                </div>
                <div className="px-5 pb-4 flex flex-col gap-3">
                  <div className="flex justify-between">
                    <div className="h-3 w-20 bg-gray-100 rounded-full" />
                    <div className="h-3 w-16 bg-gray-100 rounded-full" />
                  </div>
                  <div className="h-10 w-full bg-gray-100 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
