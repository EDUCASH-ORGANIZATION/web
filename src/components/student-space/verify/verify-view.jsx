// @ds-screen RD-STUDENT-01
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { PageHead } from "@/components/app-ui/page-head"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { ErrorState } from "@/components/app-ui/state-block"
import { formatDateFr, formatShortDate } from "@/lib/app/format"
import { studentMissionsHref, studentProfileHref } from "@/lib/app/student-routes"
import { CardDropzone } from "./card-dropzone"

// Pastille de statut : le citron n'y figure jamais (il reste l'étiquette « À faire »).
const BADGE = {
  not_submitted: { label: "Non vérifiée", tone: "neutre" },
  pending: { label: "En cours d'examen", tone: "alerte" },
  verified: { label: "Vérifiée", tone: "succes", icon: "i-check" },
  expiring: { label: "À renouveler", tone: "alerte" },
  expired: { label: "Badge expiré", tone: "erreur" },
  rejected: { label: "Carte refusée", tone: "erreur" },
}

const WHY = [
  ["Pour postuler.", "Vous pouvez postuler avec un badge actif ou une carte en cours d'examen."],
  ["Le sceau sur votre profil.", "Les clients voient que vous êtes bien étudiant."],
  ["Valable 1 an.", "Le renouvellement vous est proposé 30 jours avant la fin."],
]

/** Textes de la carte de statut : [étiquette « À faire » ou null, titre, texte]. */
function statusCopy(v) {
  const until = v.until ? formatDateFr(v.until) : ""
  switch (v.key) {
    case "not_submitted":
      return [
        "À faire pour postuler",
        "Envoyez votre carte étudiante",
        "Vous n'avez pas encore envoyé votre carte. Vous pouvez déjà explorer les missions ; pour postuler, envoyez-la ici.",
      ]
    case "pending":
      return [
        null,
        "Votre carte est en cours d'examen",
        `${v.submittedLabel ? `Envoyée le ${v.submittedLabel}. ` : ""}Vous pouvez déjà postuler : les clients voient « En cours d'examen ».`,
      ]
    case "verified":
      return [
        null,
        "Votre badge est actif",
        `${until ? `Valable jusqu'au ${until}. ` : ""}Le renouvellement vous est proposé 30 jours avant la fin.`,
      ]
    case "expiring":
      return [
        v.until ? `À faire avant le ${formatShortDate(v.until)}` : "À faire pour renouveler",
        "Renouvelez votre badge",
        `${until ? `Votre badge prend fin le ${until}. ` : ""}Envoyez votre carte de cette année : vous pouvez continuer à postuler pendant l'examen.`,
      ]
    case "expired":
      return [
        "À faire pour postuler",
        "Votre badge a expiré",
        `${until ? `Il a pris fin le ${until}. ` : ""}Vos nouvelles candidatures sont bloquées ; vos missions en cours continuent. Envoyez votre carte de cette année.`,
      ]
    default:
      return [
        "À faire pour postuler",
        "Renvoyez votre carte étudiante",
        "Votre carte a été refusée par l'équipe EduCash. Tant qu'elle n'est pas validée, vous ne pouvez pas postuler.",
      ]
  }
}

function StatusCard({ verification: v }) {
  const [flag, title, text] = statusCopy(v)
  const badge = BADGE[v.key]
  return (
    <section className="card2" aria-label="Statut actuel">
      {flag ? (
        <span className="flag2">
          <Icon name={v.key === "rejected" ? "i-alert-circle" : "i-id-card"} />
          {flag}
        </span>
      ) : (
        <span className="hero2__label">Statut actuel</span>
      )}
      <h2 className="hero2__title">{title}</h2>
      <p className="hero2__text">{text}</p>
      <div className="e2-12-status">
        {flag ? <span>Statut actuel</span> : null}
        <StatusBadge label={badge.label} tone={badge.tone} icon={badge.icon} />
      </div>
      {v.key === "rejected" && v.rejectionReason ? (
        <div className="e2-note">
          <Icon name="i-info" />
          <div className="e2-note__body">
            <div className="e2-note__title">Motif du refus</div>
            <div className="e2-note__text">{v.rejectionReason}</div>
          </div>
        </div>
      ) : null}
      {v.key === "pending" || v.key === "verified" ? (
        <div className="hero2__actions">
          <Link className="hero2__link" href={v.key === "pending" ? studentMissionsHref() : studentProfileHref()}>
            {v.key === "pending" ? "Explorer les missions" : "Retour à mon profil"}
          </Link>
        </div>
      ) : null}
    </section>
  )
}

/**
 * E12 Vérification de la carte étudiante. Composant pur : `result` vient de `getStudentVerification()`.
 * Aucun délai d'examen n'est annoncé. La zone d'envoi n'apparaît que lorsqu'une action est due.
 * @param {{ result: { verification: import("@/lib/actions/student-verification.actions").StudentVerification } | { error: string } }} props
 */
export function VerifyView({ result }) {
  if (!result || result.error || !result.verification) {
    return (
      <ErrorState
        titleAs="h1"
        title="Impossible de charger votre vérification"
        text="Vérifiez votre connexion puis réessayez. Votre carte et votre statut ne sont pas touchés."
      />
    )
  }
  const v = result.verification
  const back = { href: studentProfileHref(), label: "Mon profil" }
  return (
    <>
      <header className="e2-mtop">
        <Link className="iconbtn2" href={back.href} aria-label="Retour à mon profil">
          <Icon name="i-arrow-left" />
        </Link>
        <span className="e2-mtop__title">Vérification</span>
        <span className="e2-mtop__spacer" aria-hidden="true" />
      </header>
      <div className="e2-12-top">
        <Link className="e2-back" href={back.href}>
          <Icon name="i-arrow-left" />
          {back.label}
        </Link>
        <PageHead title="Vérification" />
        <p className="e2-lead">
          Un seul envoi par an : votre carte étudiante de l&apos;année. Elle vous donne le badge vérifié pendant 1 an.
        </p>
      </div>
      <div className="e2-cols">
        <div className="e2-stack">
          <StatusCard verification={v} />
          {v.action ? <CardDropzone actionLabel={v.action.label} /> : null}
        </div>
        <div className="e2-stack">
          <section className="e2-sec" aria-label="Pourquoi se faire vérifier">
            <div className="e2-sec__head">
              <h2 className="e2-sec__title">Pourquoi se faire vérifier</h2>
            </div>
            <div className="e2-sec__body e2-12-why">
              {WHY.map(([lead, text]) => (
                <p key={lead} className="e2-text">
                  <b>{lead}</b> <span className="e2-muted">{text}</span>
                </p>
              ))}
            </div>
          </section>
          <div className="e2-note">
            <Icon name="i-lock" />
            <div className="e2-note__body">
              <div className="e2-note__title">Votre carte reste confidentielle</div>
              <div className="e2-note__text">
                Elle n&apos;est vue que par l&apos;équipe de vérification et n&apos;est jamais montrée aux clients.
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default VerifyView
