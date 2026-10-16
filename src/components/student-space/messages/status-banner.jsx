// @ds-screen RD-STUDENT-01
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { formatFcfa } from "@/lib/app/format"
import { studentReviewHref } from "@/lib/app/student-routes"

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

// Seule action du bandeau : mission terminée -> noter le client (le seul bouton encre). « Voir la mission »
// est dans l'en-tête de la conversation.
function actionOf(state, missionId) {
  if (state === "done") {
    return { label: "Noter le client", href: studentReviewHref(missionId), className: "btn btn--dark btn--sm" }
  }
  return null
}

// Montants de la mission en cours : budget du client (retenu en séquestre) et net de l'étudiant. Aucun montant
// quand le budget n'est pas strictement positif ou que le net est négatif ou non fini. Paiements fermés : formulation indicative, jamais une promesse de séquestre.
function amountsOf({ state, budget, net, purchases, paymentsEnabled }) {
  if (state !== "in_progress" || !(Number.isFinite(budget) && budget > 0 && Number.isFinite(net) && net >= 0)) return null
  const service = <b>{formatFcfa(budget)}</b>
  const touched = <b>{formatFcfa(net)}</b>
  const tail = purchases ? " · les achats se paient hors EduCash" : ""
  return {
    long: paymentsEnabled ? (
      <>
        Service : {service} en séquestre · vous touchez {touched}
        {tail}
      </>
    ) : (
      <>
        Service : {service} · vous touchez {touched} (montants indicatifs)
        {tail}
      </>
    ),
    short: paymentsEnabled ? <>{service} en séquestre</> : <>{service} (indicatif)</>,
  }
}

/**
 * Bandeau de statut de la conversation, toujours visible sous l'en-tête. `mission` : { budget, net,
 * purchasesEstimate } de getStudentConversation ; `paymentsEnabled` est lu côté serveur (page).
 * Le badge « Avec achats » suit l'estimation d'achats de la mission.
 * @param {{ state: string, missionId: string, mission?: object, paymentsEnabled?: boolean }} props
 */
export function StatusBanner({ state, missionId, mission, paymentsEnabled = false }) {
  const banner = BANNERS[state]
  if (!banner) return null
  const action = actionOf(state, missionId)
  const purchases = Number.isFinite(mission?.purchasesEstimate) && mission.purchasesEstimate > 0
  const amounts = amountsOf({
    state,
    budget: mission?.budget,
    net: mission?.net,
    purchases,
    paymentsEnabled,
  })
  // Quand les montants s'affichent, le texte « Prévenez le client par message quand c'est terminé » n'est pas
  // repris (plan ST-05) : il reviendra avec le bouton « J'ai terminé » (RD-DONE-01, branchement hors ST-05).
  return (
    <div className={amounts ? "e2-07-status e2-07-status--amounts" : "e2-07-status"}>
      <StatusBadge {...banner.badge} />
      {purchases ? (
        <span className="badge badge--neutre badge--sm e2-07-status__achats">
          <Icon name="i-receipt" />
          Avec achats
        </span>
      ) : null}
      {amounts ? (
        <>
          <span className="e2-07-status__text e2-07-status__text--long">{amounts.long}</span>
          <span className="e2-07-status__text e2-07-status__text--short">{amounts.short}</span>
        </>
      ) : (
        <span className="e2-07-status__text">{banner.text}</span>
      )}
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
