import { Suspense } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { VitrineNavbar } from "@/components/vitrine/vitrine-navbar"
import { VitrineFooter } from "@/components/vitrine/vitrine-footer"
import { MissionCard } from "@/components/vitrine/mission-card"
import { MissionExplorer } from "@/components/vitrine/mission-explorer"
import { MissionsPagination } from "@/components/vitrine/missions-pagination"
import {
  MISSION_TYPES,
  CITIES,
  BUDGET_RANGES,
  SORTS,
  SEARCH_MAX_LENGTH,
  MISSIONS_PAGE_SIZE,
} from "@/lib/constants/missions"

export const metadata = {
  title: "Missions",
  description:
    "Explorez les missions ouvertes près de chez vous au Bénin, filtrez par type, ville et budget, et postulez en un geste.",
}

function first(value) {
  return Array.isArray(value) ? value[0] : value
}

function pick(value, allowed) {
  const v = typeof first(value) === "string" ? first(value) : ""
  return allowed.includes(v) ? v : ""
}

// Échappe les caractères spéciaux de LIKE (\, % et _) pour une recherche littérale.
function escapeLike(text) {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`)
}

// Date du jour (AAAA-MM-JJ) au fuseau du Bénin.
function todayInBenin() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Porto-Novo" })
}

export default async function MissionsPage({ searchParams }) {
  const sp = (await searchParams) ?? {}
  const supabase = await createClient()

  const rawQ = first(sp.q)
  const q = (typeof rawQ === "string" ? rawQ : "").trim().slice(0, SEARCH_MAX_LENGTH)
  const type = pick(sp.type, MISSION_TYPES)
  const ville = pick(sp.ville, CITIES)
  const budget = pick(sp.budget, BUDGET_RANGES.map((r) => r.id))
  const tri = pick(sp.tri, SORTS.map((s) => s.id))
  const rawPage = Number.parseInt(first(sp.page) ?? "1", 10)
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.min(rawPage, 100000) : 1

  let query = supabase
    .from("missions")
    .select("*", { count: "exact" })
    .eq("status", "open")
    .or(`deadline.is.null,deadline.gte.${todayInBenin()}`)

  if (q) query = query.ilike("title", `%${escapeLike(q)}%`)
  if (type) query = query.eq("type", type)
  if (ville) query = query.eq("city", ville)
  const range = BUDGET_RANGES.find((r) => r.id === budget)
  if (range) {
    query = query.gte("budget", range.min)
    if (range.max !== undefined) query = query.lte("budget", range.max)
  }

  if (tri === "prix") query = query.order("budget", { ascending: true })
  else if (tri === "prix-desc") query = query.order("budget", { ascending: false })
  else query = query.order("created_at", { ascending: false })

  const from = (page - 1) * MISSIONS_PAGE_SIZE
  query = query.range(from, from + MISSIONS_PAGE_SIZE - 1)

  const { data: missions, count, error: queryError } = await query

  // PGRST103 : page au-delà du dernier résultat, traitée comme une liste vide.
  const outOfRange = queryError?.code === "PGRST103"
  const error = outOfRange ? null : queryError
  if (error) {
    console.error("[missions] list failed", { code: error.code, message: error.message })
  }

  const total = count ?? 0
  const hasFilter = Boolean(q || type || ville || budget || tri)
  const empty = !error && (!Array.isArray(missions) || missions.length === 0)
  const filters = { q, type, ville, budget, tri }

  return (
    <div className="ds">
      <VitrineNavbar />

      <main>
        <div className="v02-head grid-bg">
          <div className="v02-head__row">
            <h1 className="display display--l">Explore les missions</h1>
            <p className="body-l">De vraies opportunités locales, payées via le séquestre EduCash.</p>
          </div>
          <Suspense fallback={null}>
            <MissionExplorer {...filters} />
          </Suspense>
        </div>

        <div className="v02-body stack stack--6">
          <div className="filterbar__count" aria-live="polite">
            {error ? "Erreur de chargement" : `${total} mission(s) ouverte(s)`}
          </div>

          {error && (
            <div className="card card--soft stack stack--3">
              <p>Impossible de charger les missions.</p>
              <div className="row"><Link className="btn btn--secondary" href="/missions">Réessayer</Link></div>
            </div>
          )}

          {!error && empty && (
            <div className="card card--soft stack stack--3">
              {hasFilter || page > 1 ? (
                <>
                  <h3 className="ds-h3">Aucune mission ne correspond à ces critères</h3>
                  <p>Essaie d’élargir ta recherche ou d’effacer les filtres.</p>
                  <div className="row">
                    <Link className="btn btn--secondary" href="/missions">
                      {hasFilter ? "Effacer les filtres" : "Revenir à la première page"}
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="ds-h3">Sois prêt·e pour les premières missions</h3>
                  <p>Crée ton profil étudiant pour être prévenu dès qu’une mission ouvre près de toi.</p>
                  <div className="row"><Link className="btn btn--primary" href="/auth/register?role=student">Créer mon compte étudiant</Link></div>
                </>
              )}
            </div>
          )}

          {!error && !empty && (
            <div className="v02-grid">
              {missions.map((m) => <MissionCard key={m.id} mission={m} />)}
            </div>
          )}

          {!error && !empty && (
            <MissionsPagination page={page} pageSize={MISSIONS_PAGE_SIZE} total={total} params={filters} />
          )}
        </div>
      </main>

      <VitrineFooter />
    </div>
  )
}
