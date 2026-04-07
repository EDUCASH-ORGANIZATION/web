import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { PublicNavbar } from "@/components/home/public-navbar"
import { PublicFooter } from "@/components/home/public-footer"
import { MissionsFilters } from "@/components/home/missions-filters"
import { MissionsGrid } from "@/components/home/missions-grid"

export const metadata = {
  title: "Missions disponibles — EduCash",
  description: "Trouvez des opportunités locales pour financer vos études tout en développant vos compétences au Bénin.",
}

const PAGE_SIZE = 9

export default async function MissionsPage({ searchParams }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const isLoggedIn = !!user

  const q        = searchParams?.q ?? ""
  const type     = searchParams?.type ?? ""
  const city     = searchParams?.city ?? ""
  const urgency  = searchParams?.urgency ?? ""
  const budgetMax = searchParams?.budget ?? ""
  const page     = Math.max(1, parseInt(searchParams?.page ?? "1") || 1)

  let query = supabase
    .from("missions")
    .select("*", { count: "exact" })
    .eq("status", "open")
    .order("created_at", { ascending: false })

  if (q)                    query = query.ilike("title", `%${q}%`)
  if (type && type !== "all") query = query.eq("type", type)
  if (city)                 query = query.eq("city", city)
  if (urgency)              query = query.eq("urgency", urgency)
  if (budgetMax)            query = query.lte("budget", parseInt(budgetMax))

  const from = (page - 1) * PAGE_SIZE
  query = query.range(from, from + PAGE_SIZE - 1)

  const { data: missions, count } = await query

  const currentSearch = new URLSearchParams()
  if (q)         currentSearch.set("q", q)
  if (type)      currentSearch.set("type", type)
  if (city)      currentSearch.set("city", city)
  if (urgency)   currentSearch.set("urgency", urgency)
  if (budgetMax) currentSearch.set("budget", budgetMax)

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <PublicNavbar />

      {/* Hero */}
      <section className="bg-gradient-to-br from-gray-50 to-gray-100 border-b border-gray-200 px-4 py-12">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-3">
            Missions disponibles
          </h1>
          <p className="text-gray-500 text-base max-w-xl leading-relaxed">
            Trouvez des opportunités locales pour financer vos études tout en
            développant vos compétences professionnelles au Bénin.
          </p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 py-8 flex flex-col gap-8">
        <Suspense fallback={null}>
          <MissionsFilters />
        </Suspense>

        <MissionsGrid
          missions={missions ?? []}
          totalCount={count ?? 0}
          page={page}
          isLoggedIn={isLoggedIn}
          searchString={currentSearch.toString()}
        />
      </section>

      <PublicFooter />
    </div>
  )
}
