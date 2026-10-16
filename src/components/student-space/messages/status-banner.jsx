// @ds-screen RD-STUDENT-01
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { formatFcfa, formatShortDate } from "@/lib/app/format"
import { studentMissionHref, studentReviewHref } from "@/lib/app/student-routes"
import { COMPLETION_COPY, completionState } from "@/lib/missions/completion"

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

// Action du bandeau (le seul bouton encre) : mission terminée -> noter le client ; mission en cours, colonne de
// déclaration disponible et fin non déclarée -> « J'ai terminé », simple lien vers la fiche de la mission
// (?terminer=1 ouvre la fenêtre de confirmation, rien n'est déclaré ici). « Voir la mission » est dans
// l'en-tête de la conversation.
function actionOf(state, missionId, canDeclare) {
  if (state === "done") {
    return { label: "Noter le client", href: studentReviewHref(missionId), className: "btn btn--dark btn--sm" }
  }
  if (canDeclare) {
    return {
      label: COMPLETION_COPY.action,
      icon: "i-check-circle",
      href: studentMissionHref(missionId, { terminer: true }),
      className: "btn btn--dark btn--sm",
    }
  }
  return null
}

// Fin déclarée : état daté à la place des montants, sans bouton. La date courte finit par un point, retiré
// puis remis comme ponctuation de la phrase.
function declaredOf(declaredAt) {
  const day = formatShortDate(declaredAt).replace(/\.$/, "")
  return {
    badge: { label: COMPLETION_COPY.toConfirmBadge, tone: "neutre", icon: "i-clock" },
    long: day
      ? `Vous avez indiqué avoir terminé le ${day}. Le client doit confirmer la fin.`
      : "Vous avez indiqué avoir terminé. Le client doit confirmer la fin.",
    short: COMPLETION_COPY.declaredBadge,
  }
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
 * Le badge « Avec achats » suit l'estimation d'achats de la mission. `completionAvailable` (colonne de
 * déclaration présente en base) et `completionDeclaredAt` viennent de getStudentConversation : colonne
 * absente, le bandeau reste celui d'une mission en cours, sans bouton ni état de fin.
 * @param {{ state: string, missionId: string, mission?: object, paymentsEnabled?: boolean,
 *   completionDeclaredAt?: string|null, completionAvailable?: boolean }} props
 */
export function StatusBanner({
  state,
  missionId,
  mission,
  paymentsEnabled = false,
  completionDeclaredAt = null,
  completionAvailable = false,
}) {
  const banner = BANNERS[state]
  if (!banner) return null
  const available = completionAvailable === true
  const declared =
    available && completionState({ status: state, completionDeclaredAt }) === "declared"
      ? declaredOf(completionDeclaredAt)
      : null
  const canDeclare = available && state === "in_progress" && !completionDeclaredAt
  const action = actionOf(state, missionId, canDeclare)
  const purchases = !declared && Number.isFinite(mission?.purchasesEstimate) && mission.purchasesEstimate > 0
  const amounts =
    declared ??
    amountsOf({
      state,
      budget: mission?.budget,
      net: mission?.net,
      purchases,
      paymentsEnabled,
    })
  // Quand les montants (ou l'état déclaré) s'affichent, le texte « Prévenez le client par message quand c'est
  // terminé » n'est pas repris ; il reste celui des bandeaux sans montants.
  return (
    <div className={amounts ? "e2-07-status e2-07-status--amounts" : "e2-07-status"}>
      <StatusBadge {...(declared ? declared.badge : banner.badge)} />
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
          {action.icon ? <Icon name={action.icon} /> : null}
          {action.label}
          {action.icon ? null : <Icon name="i-arrow-right" />}
        </Link>
      ) : null}
    </div>
  )
}

export default StatusBanner
