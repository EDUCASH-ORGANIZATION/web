import { cache } from "react"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isUuid } from "@/lib/vitrine/ids"
import { firstName, publicDisplayName } from "@/lib/vitrine/public-name"
import { VitrinePage } from "@/components/vitrine/shared/vitrine-page"
import { Breadcrumb } from "@/components/vitrine/shared/breadcrumb"
import { TalentHeader } from "@/components/vitrine/talent/talent-header"
import { TalentReviews, REVIEWS_PAGE_SIZE } from "@/components/vitrine/talent/talent-reviews"
import { TalentActions, OwnerBanner } from "@/components/vitrine/talent/talent-actions"

const PROFILE_COLUMNS =
  "user_id, full_name, city, avatar_url, bio, role, is_verified, verified_until, rating, missions_done"

// Chargement partagé entre les métadonnées et la page (une seule requête par rendu).
const loadTalent = cache(async (id) => {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("user_id", id)
    .maybeSingle()
  return profile?.role === "student" ? profile : null
})

function parsePage(raw) {
  const value = Array.isArray(raw) ? raw[0] : raw
  return /^[1-9]\d{0,5}$/.test(value ?? "") ? Number(value) : 1
}

function isStillVerified(profile, now = new Date()) {
  if (!profile.is_verified) return false
  return !profile.verified_until || new Date(profile.verified_until) > now
}

async function loadReviews(supabase, id, requestedPage) {
  const fetchPage = (page) => {
    const from = (page - 1) * REVIEWS_PAGE_SIZE
    return supabase
      .from("reviews")
      .select("id, rating, comment, created_at, reviewer:profiles!reviewer_id(full_name)", { count: "exact" })
      .eq("reviewed_id", id)
      .order("created_at", { ascending: false })
      .range(from, from + REVIEWS_PAGE_SIZE - 1)
  }

  let page = requestedPage
  let { data, count } = await fetchPage(page)
  const total = count ?? 0
  const lastPage = Math.max(1, Math.ceil(total / REVIEWS_PAGE_SIZE))
  if (page > lastPage) {
    page = lastPage
    ;({ data } = await fetchPage(page))
  }
  return { reviews: data ?? [], total, page }
}

export async function generateMetadata({ params }) {
  const { id } = await params
  if (!isUuid(id)) notFound()
  const profile = await loadTalent(id)
  if (!profile) notFound()

  return {
    title: `${publicDisplayName(profile.full_name)} - profil étudiant`,
    description: "Profil d'un étudiant EduCash : compétences, missions terminées et avis des clients.",
    robots: { index: false },
  }
}

export default async function TalentPage({ params, searchParams }) {
  const { id } = await params
  if (!isUuid(id)) notFound()

  const profile = await loadTalent(id)
  if (!profile) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [studentResult, viewerResult] = await Promise.all([
    supabase.from("student_profiles").select("school, level, skills, availability").eq("user_id", id).maybeSingle(),
    user
      ? supabase.from("profiles").select("role").eq("user_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  const student = studentResult.data
  const viewerRole = user ? (viewerResult.data?.role ?? "student") : null
  const isOwner = user?.id === id

  let commonMissionId = null
  if (viewerRole === "client") {
    const { data: common } = await supabase
      .from("missions")
      .select("id")
      .eq("client_id", user.id)
      .eq("selected_student_id", id)
      .in("status", ["in_progress", "done"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    commonMissionId = common?.id ?? null
  }

  const { reviews, total, page } = await loadReviews(supabase, id, parsePage((await searchParams)?.avis))

  const displayName = publicDisplayName(profile.full_name, { full: Boolean(user) })
  const skills = Array.isArray(student?.skills) ? student.skills : []
  const missionsDone = profile.missions_done ?? 0
  const rating = Number(profile.rating) || 0
  const hasRating = total > 0 && rating > 0
  const ratingText = hasRating
    ? `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(rating)} / 5`
    : "-"

  return (
    <VitrinePage>
      {isOwner ? <OwnerBanner /> : null}
      <TalentHeader
        displayName={displayName}
        avatarUrl={profile.avatar_url}
        isVerified={isStillVerified(profile)}
        verifiedUntil={profile.verified_until}
        school={student?.school}
        level={student?.level}
        city={profile.city}
        rating={rating}
        reviewsCount={total}
        missionsDone={missionsDone}
      />

      <div className="v04-wrap">
        <Breadcrumb
          items={[
            { label: "Accueil", href: "/" },
            { label: "Missions", href: "/missions" },
            { label: displayName },
          ]}
        />
        <div className="v04-grid ds-mt-5">
          <div className="stack stack--6">
            <div className="card">
              <h2 className="card__title ds-mb-3">À propos</h2>
              <p className="body-l">{profile.bio?.trim() || "Cet étudiant n'a pas encore rédigé de présentation."}</p>
            </div>

            <div className="ds-grid ds-grid--2">
              <div className="card">
                <h2 className="card__title ds-mb-4">Compétences</h2>
                {skills.length > 0 ? (
                  <div className="row ds-gap-2">
                    {skills.map((skill) => (
                      <span key={skill} className="tag">{skill}</span>
                    ))}
                  </div>
                ) : (
                  <p className="ds-text-brume">Aucune compétence renseignée.</p>
                )}
              </div>
              <div className="card">
                <h2 className="card__title ds-mb-4">Disponibilités</h2>
                <p>{student?.availability?.trim() || "Non précisées."}</p>
              </div>
            </div>

            <div className="card">
              <div className="card__head">
                <h2 className="card__title">Missions réussies</h2>
                <span className="caption muted">{missionsDone} terminée{missionsDone > 1 ? "s" : ""} sur EduCash</span>
              </div>
              <p className="ds-text-brume">
                {missionsDone > 0
                  ? `${firstName(profile.full_name, { fallback: "Cet étudiant" })} a mené à terme ${missionsDone} mission${missionsDone > 1 ? "s" : ""} sur EduCash, avec paiement validé par le client.`
                  : "Aucune mission terminée pour le moment."}
              </p>
            </div>

            <TalentReviews
              talentId={id}
              reviews={reviews}
              total={total}
              page={page}
              ratingLabel={hasRating ? { value: ratingText.replace(" / 5", ""), detail: `/ 5 · ${total} avis` } : null}
            />
          </div>

          <TalentActions
            talentId={id}
            firstName={firstName(profile.full_name, { fallback: "Cet étudiant" })}
            role={isOwner ? "owner" : viewerRole}
            commonMissionId={commonMissionId}
            missionsDone={missionsDone}
            ratingText={ratingText}
          />
        </div>
      </div>
    </VitrinePage>
  )
}
