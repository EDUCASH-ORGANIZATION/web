import { Suspense } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { VitrineNavbar } from "@/components/vitrine/vitrine-navbar"
import { VitrineFooter } from "@/components/vitrine/vitrine-footer"
import { Icon } from "@/components/design/icon"
import { MissionCard } from "@/components/vitrine/mission-card"
import { MissionSearch, MissionFilterBar } from "@/components/vitrine/mission-explorer"
import { MissionsPagination } from "@/components/vitrine/missions-pagination"
import {
  MISSION_TYPES,
  CITIES,
  BUDGET_RANGES,
  SORTS,
  URGENCY_FILTERS,
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

// Échappe les caractères spéciaux de LIKE (\, %, _ et *) pour une recherche littérale.
function escapeLike(text) {
  return text.replace(/[\\%_*]/g, (c) => `\\${c}`)
}

// Date du jour (AAAA-MM-JJ) au fuseau du Bénin.
function todayInBenin() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Porto-Novo" })
}

function retryHref(filters, page) {
  const sp = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => { if (v) sp.set(k, v) })
  if (page > 1) sp.set("page", String(page))
  const qs = sp.toString()
  return qs ? `/missions?${qs}` : "/missions"
}

// Encart « Publier une mission » intercalé dans la grille (maquette V02).
function PublishPromo() {
  return (
    <div className="v02-promo on-encre">
      <Icon name="sc-burst" className="scribble" />
      <span className="badge badge--citron badge--sm v02-promo__badge">Pour les clients</span>
      <h3 className="display display--s v02-promo__title">Un coup de main ?</h3>
      <p className="body-s v02-promo__text">
        Publiez une mission, le budget reste bloqué jusqu&rsquo;à votre validation. Étudiants vérifiés par l&rsquo;équipe.
      </p>
      <Link className="btn btn--primary v02-promo__cta" href="/auth/register?role=client">
        Publier une mission
        <span className="btn__dot"><Icon name="i-arrow-right" className="ic" /></span>
      </Link>
    </div>
  )
}

// Replis du Suspense (useSearchParams) : même cadre que la version interactive, sans interaction.
function MissionSearchFallback() {
  return (
    <div className="search search--hero v02-search" aria-hidden="true">
      <Icon name="i-search" className="ic" />
      <input type="search" tabIndex={-1} readOnly placeholder="Cours de maths, livraison, saisie…" />
      <span className="btn btn--primary btn--sm">Chercher</span>
    </div>
  )
}

function FilterBarFallback({ countLabel }) {
  return (
    <div className="filterbar" aria-hidden="true">
      <span className="skel skel--pill v02-skel-chip" />
      <span className="skel skel--pill v02-skel-chip" />
      <span className="skel skel--pill v02-skel-chip" />
      <span className="filterbar__count">{countLabel}</span>
    </div>
  )
}

export default async function MissionsPage({ searchParams }) {
  const sp = (await searchParams) ?? {}
  const supabase = await createClient()

  const rawQ = first(sp.q)
  const q = (typeof rawQ === "string" ? rawQ : "").trim().slice(0, SEARCH_MAX_LENGTH)
  const type = pick(sp.type, MISSION_TYPES)
  const ville = pick(sp.ville, CITIES)
  const budget = pick(sp.budget, BUDGET_RANGES.map((r) => r.id))
  const urgence = pick(sp.urgence, URGENCY_FILTERS.map((u) => u.id))
  const tri = pick(sp.tri, SORTS.map((s) => s.id))
  const rawPage = Number.parseInt(first(sp.page) ?? "1", 10)
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.min(rawPage, 100000) : 1

  const notExpired = `deadline.is.null,deadline.gte.${todayInBenin()}`
  let query = supabase
    .from("missions")
    .select("id, title, type, city, budget, urgency, deadline, created_at", { count: "exact" })
    .eq("status", "open")
    .or(notExpired)

  if (q) query = query.ilike("title", `%${escapeLike(q)}%`)
  if (type) query = query.eq("type", type)
  if (ville) query = query.eq("city", ville)
  const urgencyFilter = URGENCY_FILTERS.find((u) => u.id === urgence)
  if (urgencyFilter) query = query.eq("urgency", urgencyFilter.value)
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

  // Total des missions ouvertes sans filtre (chip du bandeau), requête de comptage seul.
  const openQuery = supabase
    .from("missions")
    .select("id", { count: "exact", head: true })
    .eq("status", "open")
    .or(notExpired)

  const [{ data: missions, count, error: queryError }, { count: openCount }] = await Promise.all([query, openQuery])

  // PGRST103 : page au-delà du dernier résultat, traitée comme une liste vide.
  const outOfRange = queryError?.code === "PGRST103"
  const error = outOfRange ? null : queryError
  if (error) {
    console.error("[missions] list failed", { code: error.code, message: error.message })
  }

  const total = count ?? 0
  const hasFilter = Boolean(q || type || ville || budget || tri || urgence)
  const empty = !error && (!Array.isArray(missions) || missions.length === 0)
  const filters = { q, type, ville, budget, tri, urgence }
  const openTotal = openCount ?? (hasFilter || page > 1 ? 0 : total)
  const plural = (n) => (n > 1 ? "s" : "")
  const countLabel = error
    ? "Erreur de chargement"
    : hasFilter
      ? `${total} mission${plural(total)}`
      : `${total} mission${plural(total)} ouverte${plural(total)}`
  const cards = Array.isArray(missions) ? missions.map((m) => <MissionCard key={m.id} mission={m} />) : []
  // Encart « Publier une mission » en 5e position (en dernier s'il y a moins de 4 cartes).
  cards.splice(Math.min(4, cards.length), 0, <PublishPromo key="publish-promo" />)

  return (
    <div className="ds">
      <VitrineNavbar />

      <main>
        <div className="v02-head grid-bg">
          <Icon name="sc-loop" className="scribble v02-scribble ds-desk-only" />
          <div className="v02-head__row">
            <div>
              <span className="v-hero__chip">
                <b>{openTotal}</b>mission{plural(openTotal)} ouverte{plural(openTotal)}
              </span>
              <h1 className="display display--xl v02-title">
                Trouve<br /><span className="hl-citron">ta mission.</span>
              </h1>
            </div>
            <p className="body-l v02-lead ds-desk-only">
              Seules les missions ouvertes et dans les temps s&rsquo;affichent. Le montant net est indiqué sur chaque carte.
            </p>
          </div>
          <Suspense fallback={<MissionSearchFallback />}>
            <MissionSearch q={filters.q} type={filters.type} ville={filters.ville} />
          </Suspense>
        </div>

        <div className="v02-body stack stack--6">
          <Suspense fallback={<FilterBarFallback countLabel={countLabel} />}>
            <MissionFilterBar {...filters} total={total} countLabel={countLabel} />
          </Suspense>

          {error && (
            <div className="card card--soft">
              <div className="empty empty--erreur">
                <div className="empty__art"><span className="ic-sq"><Icon name="i-alert-triangle" className="ic" /></span></div>
                <div className="empty__title">Impossible de charger les missions</div>
                <div className="empty__text">Ce n&rsquo;est pas qu&rsquo;il n&rsquo;y a rien : le serveur n&rsquo;a pas répondu. Tes filtres sont conservés.</div>
                <Link className="btn btn--primary" href={retryHref(filters, page)}><Icon name="i-refresh" className="ic" />Réessayer</Link>
              </div>
            </div>
          )}

          {!error && empty && (
            <div className="card card--soft">
              <div className="empty">
                <div className="empty__art">
                  <span className="ic-sq"><Icon name={hasFilter || page > 1 ? "i-search" : "i-briefcase"} className="ic" /></span>
                  <Icon name="sc-burst" className="scribble scribble--bleu v02-empty-scribble" />
                </div>
                {hasFilter || page > 1 ? (
                  <>
                    <div className="empty__title">Aucune mission ne correspond</div>
                    <div className="empty__text">Essaie d&rsquo;élargir ta recherche ou d&rsquo;effacer les filtres.</div>
                    <Link className="btn btn--primary" href="/missions">
                      {hasFilter ? "Effacer les filtres" : "Revenir à la première page"}
                    </Link>
                  </>
                ) : (
                  <>
                    <div className="empty__title">Sois prêt·e pour les premières missions</div>
                    <div className="empty__text">Crée ton profil étudiant pour être prévenu dès qu&rsquo;une mission ouvre près de toi.</div>
                    <div className="row">
                      <Link className="btn btn--primary" href="/auth/register?role=student">Créer mon compte étudiant</Link>
                      <Link className="btn btn--secondary" href="/auth/register?role=client">Publier une mission</Link>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {!error && !empty && (
            <div className="v02-grid">
              {cards}
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
