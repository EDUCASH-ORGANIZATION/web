import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { VitrineProvider } from "@/components/vitrine/vitrine-provider"
import { VitrineNavbar } from "@/components/vitrine/vitrine-navbar"
import { VitrineFooter } from "@/components/vitrine/vitrine-footer"
import { MissionCard } from "@/components/vitrine/mission-card"
import { MissionExplorer } from "@/components/vitrine/mission-explorer"

export const metadata = {
  title: "Missions — EduCash",
  description:
    "Explorez les missions ouvertes près de chez vous au Bénin, filtrez par type, ville et budget, et postulez en un geste.",
}

const PAGE_SIZE = 9

function parseBudgetRange(id) {
  if (!id) return null
  if (id === "30000+") return { min: 30000 }
  const [min, max] = id.split("-").map(Number)
  return { min, max }
}

export default async function MissionsPage({ searchParams }) {
  const sp = (await searchParams) ?? {}
  const supabase = await createClient()

  const q = (sp.q ?? "").toString()
  const type = (sp.type ?? "").toString()
  const ville = (sp.ville ?? "").toString()
  const budget = (sp.budget ?? "").toString()
  const tri = (sp.tri ?? "").toString()
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1)

  let query = supabase.from("missions").select("*", { count: "exact" }).eq("status", "open")

  if (q) query = query.ilike("title", `%${q}%`)
  if (type) query = query.eq("type", type)
  if (ville) query = query.eq("city", ville)
  const range = parseBudgetRange(budget)
  if (range?.max) query = query.gte("budget", range.min).lte("budget", range.max)
  else if (range?.min) query = query.gte("budget", range.min)

  if (tri === "prix") query = query.order("budget", { ascending: true })
  else if (tri === "prix-desc") query = query.order("budget", { ascending: false })
  else query = query.order("created_at", { ascending: false })

  const from = (page - 1) * PAGE_SIZE
  query = query.range(from, from + PAGE_SIZE - 1)

  const [{ data: missions, count, error }] = await Promise.all([query])

  const total = count ?? 0
  const hasFilter = Boolean(q || type || ville || budget || tri)
  const empty = !error && Array.isArray(missions) && missions.length === 0

  return (
    <VitrineProvider>
      <VitrineNavbar />

      <main className="v02-body">
        <div className="v02-head">
          <h1 className="display display--l">Explore les missions</h1>
          <p className="v02-head__row">De vraies opportunités locales, payées via le séquestre EduCash.</p>
          <Suspense fallback={null}>
            <MissionExplorer q={q} type={type} ville={ville} budget={budget} tri={tri} />
          </Suspense>
        </div>

        <div className="filterbar__count" aria-live="polite" style={{ marginTop: "4px" }}>
          {error ? "Erreur de chargement" : `${total} mission(s) ouverte(s)`}
        </div>

        {error && (
          <div className="state__canvas">
            <div className="card card--soft">
              <p>Impossible de charger les missions.</p>
              <a className="btn btn--secondary" href="/missions">Réessayer</a>
            </div>
          </div>
        )}

        {!error && empty && (
          <div className="v02-promo">
            <div className="card card--soft">
              {hasFilter ? (
                <>
                  <h3 className="h3">Aucune mission ne correspond à ces critères</h3>
                  <p>Essaie d'élargir ta recherche ou d'effacer les filtres.</p>
                  <a className="btn btn--secondary" href="/missions">Effacer les filtres</a>
                </>
              ) : (
                <>
                  <h3 className="h3">Sois prêt·e pour les premières missions</h3>
                  <p>Crée ton profil étudiant pour être prévenu dès qu'une mission ouvre près de toi.</p>
                  <a className="btn btn--primary" href="/auth/register?role=student">Créer mon compte étudiant</a>
                </>
              )}
            </div>
          </div>
        )}

        {!error && !empty && (
          <div className="v02-grid" style={{ marginTop: 20 }}>
            {missions.map((m) => <MissionCard key={m.id} mission={m} />)}
          </div>
        )}
      </main>

      <VitrineFooter />
    </VitrineProvider>
  )
}