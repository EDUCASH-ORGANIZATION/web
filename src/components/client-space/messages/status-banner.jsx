import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { clientMissionHref } from "@/lib/app/client-routes"
import { formatFcfa } from "@/lib/app/format"

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

// Premier mot du nom affiché (« Afiavi D. » -> « Afiavi »), sans rien d'autre : vide si le nom est vide.
const firstNameOf = (name) => (typeof name === "string" ? (name.trim().split(/\s+/)[0] ?? "") : "")

// Action du bandeau : candidat -> « Accepter <prénom> » (ouvre le tiroir de la candidature, rien n'est accepté par
// l'adresse), en cours -> confirmer la fin (ouvre la fenêtre de confirmation), sinon la mission en lecture.
function actionOf(state, missionId, studentId, studentName) {
  if (state === "candidate") {
    const firstName = firstNameOf(studentName)
    return {
      label: firstName ? `Accepter ${firstName}` : "Voir la candidature",
      href: clientMissionHref(missionId, { candidat: studentId }),
      className: "btn btn--dark btn--sm",
    }
  }
  if (state === "in_progress") {
    return { label: "Confirmer la fin", href: clientMissionHref(missionId, { confirmer: true }), className: "btn btn--dark btn--sm" }
  }
  return { label: "Voir la mission", href: clientMissionHref(missionId), className: "btn btn--soft btn--sm" }
}

// Montants du bandeau : le budget du client (retenu en séquestre quand les paiements sont ouverts) et l'estimation
// des achats qu'il paiera lui-même. Aucun montant tant que le budget n'est pas strictement positif et fini ;
// jamais le gain de l'étudiant. Paiements fermés : formulation indicative, jamais une promesse de séquestre.
function amountsOf({ state, budget, purchasesEstimate, paymentsEnabled }) {
  if (state !== "in_progress" && state !== "candidate") return null
  if (!(Number.isFinite(budget) && budget > 0)) return null
  const service = <b className="conv2__amount">{formatFcfa(budget)}</b>
  if (state === "candidate") {
    return {
      long: paymentsEnabled ? <>Candidature en attente · {service} en séquestre</> : <>Candidature en attente · budget : {service}</>,
      short: paymentsEnabled ? <>{service} en séquestre</> : <>Budget : {service}</>,
    }
  }
  const estimate =
    Number.isFinite(purchasesEstimate) && purchasesEstimate > 0 ? (
      <> · achats estimés : environ <b className="conv2__amount">{formatFcfa(purchasesEstimate)}</b></>
    ) : null
  return {
    long: paymentsEnabled ? (
      <>
        {service} en séquestre pour le service{estimate}
      </>
    ) : (
      <>
        {service} pour le service (montant indicatif){estimate}
      </>
    ),
    short: paymentsEnabled ? <>{service} en séquestre</> : <>{service} (indicatif)</>,
  }
}

/**
 * Bandeau de statut de la conversation, toujours visible sous l'en-tête. `mission` : { budget, purchasesEstimate }
 * de getClientConversation ; `paymentsEnabled` est lu côté serveur par la page.
 * @param {{ state: string, missionId: string, studentId: string, studentName?: string, mission?: object, paymentsEnabled?: boolean }} props
 */
export function StatusBanner({ state, missionId, studentId, studentName, mission, paymentsEnabled = false }) {
  const banner = BANNERS[state]
  if (!banner) return null
  const action = actionOf(state, missionId, studentId, studentName)
  const amounts = amountsOf({ state, budget: mission?.budget, purchasesEstimate: mission?.purchasesEstimate, paymentsEnabled })
  return (
    <div className={amounts ? "chat-status chat-status--amounts" : "chat-status"}>
      <StatusBadge {...banner.badge} />
      {amounts ? (
        <>
          <span className="chat-status__text chat-status__text--long">{amounts.long}</span>
          <span className="chat-status__text chat-status__text--short">{amounts.short}</span>
        </>
      ) : (
        <span className="chat-status__text">{banner.text}</span>
      )}
      <Link className={action.className} href={action.href}>
        {action.label}
        <Icon name="i-arrow-right" />
      </Link>
    </div>
  )
}

export default StatusBanner
