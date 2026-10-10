import { cache } from "react"
import { notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Icon } from "@/components/design/icon"
import { VitrinePage } from "@/components/vitrine/shared/vitrine-page"
import { Breadcrumb } from "@/components/vitrine/shared/breadcrumb"
import { EscrowNote } from "@/components/vitrine/shared/escrow-note"
import { ApplyPanel } from "@/components/vitrine/mission-detail/apply-panel"
import { ApplyBar } from "@/components/vitrine/mission-detail/apply-bar"
import { ClientCard } from "@/components/vitrine/mission-detail/client-card"
import { SimilarMissions } from "@/components/vitrine/mission-detail/similar-missions"
import { COMMISSION_RATE, netAmount, missionTypeLabel } from "@/lib/constants/missions"
import { isUuid } from "@/lib/vitrine/ids"
import { todayInBenin } from "@/lib/vitrine/dates"
import { missionAvailability, CLOSED_REASON_LABELS } from "@/lib/vitrine/mission-availability"
import { applyCta } from "@/lib/vitrine/apply-cta"
import { formatDateFr, fmtInt } from "@/lib/vitrine/format"
import { TYPE_ICON } from "@/lib/vitrine/mission-icons"

const URGENCY_LABEL = { high: "Urgent", medium: "Cette semaine" }

const DESCRIPTION_MAX = 155

// Description de métadonnée : texte aplati, 155 caractères au plus.
function summarize(text, fallback) {
  const flat = (text ?? "").replace(/\s+/g, " ").trim() || fallback
  return flat.length > DESCRIPTION_MAX ? `${flat.slice(0, DESCRIPTION_MAX - 1).trimEnd()}…` : flat
}

// Mission publique, partagée entre generateMetadata et la page (une seule requête par rendu).
const loadMission = cache(async (id) => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("missions")
    .select("id, title, description, type, city, budget, urgency, status, deadline, created_at, client_id")
    .eq("id", id)
    .maybeSingle()
  if (error) {
    console.error("[mission] chargement impossible", { code: error.code, message: error.message })
    return { mission: null, failed: true }
  }
  return { mission: data, failed: false }
})

export async function generateMetadata({ params }) {
  const { id } = await params
  if (!isUuid(id)) return { title: "Mission introuvable" }

  const { mission, failed } = await loadMission(id)
  if (failed) return { title: "Mission" }
  if (!mission) return { title: "Mission introuvable" }

  const { accepting } = missionAvailability(mission, todayInBenin())
  const description = summarize(
    mission.description,
    `${missionTypeLabel(mission.type)}${mission.city ? ` à ${mission.city}` : ""} sur EduCash.`,
  )
  return {
    title: mission.title,
    description,
    ...(accepting ? {} : { robots: { index: false } }),
    openGraph: {
      title: mission.title,
      description,
      type: "article",
      url: `/missions/${mission.id}`,
    },
  }
}

export default async function MissionDetailPage({ params }) {
  const { id } = await params
  if (!isUuid(id)) notFound()

  const supabase = await createClient()
  const [{ mission, failed }, authResult] = await Promise.all([
    loadMission(id),
    supabase.auth.getUser(),
  ])
  if (failed) throw new Error("Chargement de la mission impossible")
  if (!mission) notFound()

  const user = authResult?.data?.user ?? null
  const today = todayInBenin()
  const { accepting, reason } = missionAvailability(mission, today)

  const [clientRes, similarRes, viewerRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, city, rating, missions_done")
      .eq("user_id", mission.client_id)
      .maybeSingle(),
    supabase
      .from("missions")
      .select("id, title, type, city, budget, urgency, deadline, created_at")
      .eq("type", mission.type)
      .eq("status", "open")
      .neq("id", mission.id)
      .or(`deadline.is.null,deadline.gte.${today}`)
      .order("created_at", { ascending: false })
      .limit(3),
    user
      ? supabase.from("profiles").select("role, is_verified").eq("user_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  if (clientRes.error) {
    console.error("[mission] profil client", { code: clientRes.error.code, message: clientRes.error.message })
  }
  if (similarRes.error) {
    console.error("[mission] missions similaires", { code: similarRes.error.code, message: similarRes.error.message })
  }

  const viewer = viewerRes.data ?? null
  const role = viewer?.role ?? null

  let hasApplied = false
  if (role === "student") {
    const { data: application } = await supabase
      .from("applications")
      .select("id")
      .eq("mission_id", mission.id)
      .eq("student_id", user.id)
      .maybeSingle()
    hasApplied = Boolean(application)
  }

  const cta = applyCta({
    role,
    missionId: mission.id,
    missionType: mission.type,
    accepting,
    hasApplied,
  })
  const needsVerification = cta.kind === "student" && !viewer?.is_verified

  const budget = mission.budget ?? 0
  const net = netAmount(budget)
  const commission = budget - net
  const commissionPct = Math.round(COMMISSION_RATE * 100)
  const isEmployerView = role === "client" || role === "admin"
  const netLabel = isEmployerView ? "L'étudiant touche" : "Tu touches"
  const reportHref = `/contact?sujet=signalement&ref=${encodeURIComponent(`/missions/${mission.id}`)}`
  const typeIcon = TYPE_ICON[mission.type] ?? "i-briefcase"
  const urgencyLabel = URGENCY_LABEL[mission.urgency]
  const paragraphs = (mission.description ?? "").split(/\n+/).map((p) => p.trim()).filter(Boolean)
  const reasonLabel = reason ? CLOSED_REASON_LABELS[reason] : null
  const barCaption = accepting
    ? `${netLabel} ${fmtInt(net)} FCFA`
    : reasonLabel

  return (
    <VitrinePage>
      <div className="v03-wrap v03-with-bar">
        <div className="ds-desk-only">
          <Breadcrumb
            items={[
              { label: "Accueil", href: "/" },
              { label: "Missions", href: "/missions" },
              { label: missionTypeLabel(mission.type), href: `/missions?type=${encodeURIComponent(mission.type)}` },
              { label: mission.title },
            ]}
          />
        </div>
        <Link className="auth__back body-s ds-mob-only" href="/missions">
          <Icon name="i-arrow-left" className="ic ic--20" />Missions
        </Link>

        <div className="v03-grid">
          <div className="stack stack--6">
            {!accepting ? (
              <div className="banner banner--alerte-doux" role="status">
                <Icon name="i-info" />
                <div className="banner__body">
                  <div className="banner__title">{cta.message}</div>
                  {reasonLabel}
                </div>
              </div>
            ) : null}

            <div>
              <div className="row ds-gap-2">
                <span className="mission__cat">
                  <span className="ic-sq ic-sq--sm"><Icon name={typeIcon} /></span>
                  {missionTypeLabel(mission.type)}
                </span>
                {accepting ? (
                  <span className="badge badge--bleu"><i />Ouverte</span>
                ) : (
                  <span className="badge badge--encre">{reasonLabel}</span>
                )}
                {accepting && urgencyLabel ? (
                  <span className="badge badge--contour"><Icon name="i-zap" />{urgencyLabel}</span>
                ) : null}
              </div>
              <h1 className="v03-title">{mission.title}</h1>
              <div className="v03-meta">
                {mission.city ? (
                  <span><Icon name="i-map-pin" />{mission.city}</span>
                ) : null}
                {mission.deadline ? (
                  <span><Icon name="i-calendar" />Échéance : {formatDateFr(mission.deadline.slice(0, 10))}</span>
                ) : null}
                <span><Icon name="i-clock" />Publiée le {formatDateFr(mission.created_at)}</span>
              </div>
            </div>

            <div className="card card--sm v03-mprice">
              <div className="row row--between">
                <span className="amount amount--l">{fmtInt(budget)}&#8239;<small>FCFA</small></span>
                <span className="badge badge--citron">{netLabel} {fmtInt(net)}</span>
              </div>
              {accepting ? (
                <div className="row ds-gap-2 ds-mt-3">
                  <span className="badge badge--lavande badge--sm"><Icon name="i-lock" />Fonds bloqués</span>
                  <span className="caption">Commission {commissionPct} % incluse</span>
                </div>
              ) : null}
            </div>

            <div className="card v03-desc">
              <h2 className="card__title ds-mb-3">Description</h2>
              {paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>

            <ClientCard profile={clientRes.data ?? null} viewerLoggedIn={Boolean(user)} reportHref={reportHref} />

            <SimilarMissions missions={similarRes.data ?? []} type={mission.type} />

            <Link className="link body-s ds-self-start" href={reportHref}>
              <Icon name="i-flag" className="ic ic--16" />Signaler cette mission
            </Link>
          </div>

          {accepting ? (
            <aside className="v03-apply ds-desk-only" aria-label="Postuler">
              <div className="v03-apply__top grid-bg">
                <Icon name="sc-burst" className="scribble" />
                <span className="body-s">Budget de la mission</span>
                <div className="amount amount--xl">{fmtInt(budget)}&#8239;<small>FCFA</small></div>
                <div className="row">
                  <span className="badge badge--citron">{netLabel} {fmtInt(net)}&#8239;FCFA</span>
                </div>
              </div>
              <div className="v03-apply__body">
                <div className="recap">
                  <div className="recap__line">
                    <span>Budget payé par le client</span>
                    <b>{fmtInt(budget)}&#8239;FCFA</b>
                  </div>
                  <div className="recap__line">
                    <span>Commission EduCash {commissionPct} %</span>
                    <b>&minus;&#8239;{fmtInt(commission)}&#8239;FCFA</b>
                  </div>
                  <div className="recap__line recap__total">
                    <span>{isEmployerView ? "Versé à l'étudiant" : "Tu touches"}</span>
                    <b>{fmtInt(net)}&#8239;FCFA</b>
                  </div>
                </div>
                <EscrowNote audience={role === "client" ? "client" : "student"} />
                <ApplyPanel cta={cta} needsVerification={needsVerification} />
              </div>
            </aside>
          ) : (
            <aside className="v03-off ds-desk-only" aria-label="Candidatures fermées">
              <ApplyPanel cta={cta} />
            </aside>
          )}
        </div>
      </div>

      <ApplyBar
        cta={cta}
        budget={budget}
        caption={barCaption}
        needsVerification={needsVerification}
      />
    </VitrinePage>
  )
}
