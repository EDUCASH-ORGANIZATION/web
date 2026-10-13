import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { clientMissionHref } from "@/lib/app/client-routes"

const BANNERS = {
  candidate: {
    badge: { label: "En attente", tone: "alerte", icon: "i-clock" },
    text: "Candidature en attente de votre réponse",
  },
  in_progress: { badge: { label: "En cours", tone: "bleu" }, text: "Mission en cours" },
  done: { badge: { label: "Terminée", tone: "succes", icon: "i-check" }, text: "Mission terminée, conversation en lecture seule" },
  cancelled: { badge: { label: "Annulée", tone: "neutre", icon: "i-ban" }, text: "Mission annulée, conversation en lecture seule" },
  rejected: { badge: { label: "Refusée", tone: "neutre", icon: "i-ban" }, text: "Candidature refusée, conversation en lecture seule" },
  closed: { badge: { label: "Clôturée", tone: "neutre", icon: "i-lock" }, text: "Un autre étudiant a été retenu, conversation en lecture seule" },
}

// Action du bandeau : candidat -> la candidature, en cours -> confirmer la fin, sinon la mission en lecture.
function actionOf(state, missionId, studentId) {
  if (state === "candidate") {
    return { label: "Voir la candidature", href: clientMissionHref(missionId, { candidat: studentId }), className: "btn btn--soft btn--sm" }
  }
  if (state === "in_progress") {
    return { label: "Confirmer la fin", href: clientMissionHref(missionId, { confirmer: true }), className: "btn btn--dark btn--sm" }
  }
  return { label: "Voir la mission", href: clientMissionHref(missionId), className: "btn btn--soft btn--sm" }
}

// Bandeau de statut de la conversation, toujours visible sous l'en-tête.
export function StatusBanner({ state, missionId, studentId }) {
  const banner = BANNERS[state]
  if (!banner) return null
  const action = actionOf(state, missionId, studentId)
  return (
    <div className="chat-status">
      <StatusBadge {...banner.badge} />
      <span>{banner.text}</span>
      <Link className={action.className} href={action.href}>
        {action.label}
        <Icon name="i-arrow-right" />
      </Link>
    </div>
  )
}

export default StatusBanner
