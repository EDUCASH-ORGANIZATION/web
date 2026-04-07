import Link from "next/link"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/actions/auth.actions"
import { createClient } from "@/lib/supabase/server"
import { Badge } from "@/components/ui/badge"
import { MissionsTabs } from "@/components/client/missions-tabs"

export const metadata = { title: "Mes missions — EduCash" }

const EMPTY_STATES = {
  open: {
    title: "Aucune mission ouverte",
    description: "Publiez votre première mission pour trouver un étudiant.",
    showCta: true,
  },
  in_progress: {
    title: "Aucune mission en cours",
    description: "Les missions acceptées par un étudiant apparaîtront ici.",
    showCta: false,
  },
  done: {
    title: "Aucune mission terminée",
    description: "Vos missions complétées apparaîtront ici.",
    showCta: false,
  },
  cancelled: {
    title: "Aucune mission annulée",
    description: "Vos missions annulées apparaîtront ici.",
    showCta: false,
  },
}

function MissionClientCard({ mission }) {
  const count = mission.applications?.[0]?.count ?? 0
  const formattedBudget = new Intl.NumberFormat("fr-FR").format(mission.budget)
  const formattedDate = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(mission.created_at))

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold text-gray-900 leading-snug">{mission.title}</p>
        <Badge status={mission.status} />
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span>{mission.type}</span>
        <span className="text-gray-300">·</span>
        <span>{mission.city}</span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-[#1A6B4A]">
          {formattedBudget} FCFA
        </span>
        <span className="text-sm text-gray-400">
          {count} candidature{count !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{formattedDate}</span>
        <Link
          href={`/client/missions/${mission.id}`}
          className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Gérer
        </Link>
      </div>
    </div>
  )
}

function EmptyState({ tab }) {
  const config = EMPTY_STATES[tab] ?? EMPTY_STATES.open
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      </div>
      <p className="text-base font-semibold text-gray-800 mb-1">{config.title}</p>
      <p className="text-sm text-gray-400 max-w-xs mb-6">{config.description}</p>
      {config.showCta && (
        <Link
          href="/client/missions/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1A6B4A] text-white text-sm font-semibold hover:bg-[#155a3d] transition-colors"
        >
          + Publier ma première mission
        </Link>
      )}
    </div>
  )
}

export default async function ClientMissionsPage({ searchParams }) {
  const user = await getCurrentUser()
  if (!user) redirect("/auth/login")

  const activeTab = searchParams.tab || "open"

  const supabase = await createClient()
  const { data: missions } = await supabase
    .from("missions")
    .select("*, applications(count)")
    .eq("client_id", user.id)
    .eq("status", activeTab)
    .order("created_at", { ascending: false })

  const list = missions ?? []

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Mes missions</h1>
          <Link
            href="/client/missions/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1A6B4A] text-white text-sm font-semibold hover:bg-[#155a3d] transition-colors"
          >
            + Nouvelle mission
          </Link>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <MissionsTabs activeTab={activeTab} />

          {list.length === 0 ? (
            <EmptyState tab={activeTab} />
          ) : (
            <>
              {/* Mobile — cartes */}
              <div className="md:hidden flex flex-col gap-3 p-4">
                {list.map((mission) => (
                  <MissionClientCard key={mission.id} mission={mission} />
                ))}
              </div>

              {/* Desktop — tableau */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-left">
                      <th className="px-4 py-3 font-medium text-gray-500">Titre</th>
                      <th className="px-4 py-3 font-medium text-gray-500">Type</th>
                      <th className="px-4 py-3 font-medium text-gray-500">Candidatures</th>
                      <th className="px-4 py-3 font-medium text-gray-500">Statut</th>
                      <th className="px-4 py-3 font-medium text-gray-500">Date</th>
                      <th className="px-4 py-3 font-medium text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {list.map((mission) => {
                      const count = mission.applications?.[0]?.count ?? 0
                      const formattedDate = new Intl.DateTimeFormat("fr-FR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      }).format(new Date(mission.created_at))

                      return (
                        <tr key={mission.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-900 max-w-xs">
                            <span className="truncate block">{mission.title}</span>
                          </td>
                          <td className="px-4 py-3 text-gray-500">{mission.type}</td>
                          <td className="px-4 py-3 text-gray-500">
                            {count} candidature{count !== 1 ? "s" : ""}
                          </td>
                          <td className="px-4 py-3">
                            <Badge status={mission.status} />
                          </td>
                          <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{formattedDate}</td>
                          <td className="px-4 py-3">
                            <Link
                              href={`/client/missions/${mission.id}`}
                              className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                            >
                              Gérer
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
