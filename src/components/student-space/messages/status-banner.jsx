// @ds-screen RD-STUDENT-01
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { studentMissionHref, studentReviewHref } from "@/lib/app/student-routes"

const BANNERS = {
  candidate: {
    badge: { label: "En attente", tone: "neutre", icon: "i-clock" },
    text: "Candidature en attente de la réponse du client",
  },
  in_progress: {
    badge: { label: "En cours", tone: "neutre" },
    text: "Mission en cours. Prévenez le client par message quand c'est terminé.",
  },
  done: { badge: { label: "Terminée", tone: "neutre", icon: "i-check" }, text: "Mission terminée, conversation en lecture seule" },
  cancelled: { badge: { label: "Annulée", tone: "neutre", icon: "i-ban" }, text: "Mission annulée, conversation en lecture seule" },
  rejected: { badge: { label: "Non retenue", tone: "neutre", icon: "i-ban" }, text: "Candidature non retenue, conversation en lecture seule" },
  closed: { badge: { label: "Attribuée", tone: "neutre", icon: "i-lock" }, text: "Un autre étudiant a été retenu, conversation en lecture seule" },
}

// Action du bandeau : candidature et mission en cours -> la mission, terminée -> noter le client (le seul bouton encre).
function actionOf(state, missionId) {
  if (state === "candidate" || state === "in_progress") {
    return { label: "Voir la mission", href: studentMissionHref(missionId), className: "btn btn--soft btn--sm" }
  }
  if (state === "done") {
    return { label: "Noter le client", href: studentReviewHref(missionId), className: "btn btn--dark btn--sm" }
  }
  return null
}

// Bandeau de statut de la conversation, toujours visible sous l'en-tête.
export function StatusBanner({ state, missionId }) {
  const banner = BANNERS[state]
  if (!banner) return null
  const action = actionOf(state, missionId)
  return (
    <div className="e2-07-status">
      <StatusBadge {...banner.badge} />
      <span className="e2-07-status__text">{banner.text}</span>
      {action ? (
        <Link className={action.className} href={action.href}>
          {action.label}
          <Icon name="i-arrow-right" />
        </Link>
      ) : null}
    </div>
  )
}

export default StatusBanner
