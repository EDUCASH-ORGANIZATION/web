// @ds-screen RD-STUDENT-01
// Modèle pur du tableau de bord étudiant (E01) : action prioritaire, indicateurs, liste « Ensuite ».
// Aucune lecture de données ici : la forme d'entrée est `StudentDashboardData` (student-dashboard.actions.js).
// Rien n'affirme qu'un travail a été « terminé » ou « à confirmer » : aucun signal de ce type n'existe en base.
import { COMMISSION_RATE } from "../constants/missions.js"
import { PAYMENTS_PENDING_COPY } from "../constants/payments.js"
import { formatAmount, formatShortDate } from "../app/format.js"
import { escrowSplit } from "../app/money.js"
import {
  studentConversationHref,
  studentMissionHref,
  studentMissionsHref,
  studentReviewHref,
  studentWalletHref,
  studentApplicationsHref,
} from "../app/student-routes.js"

const LIST_LIMIT = 5

const plural = (n, one, many) => (n > 1 ? many : one)
const commissionPct = () => Math.round(COMMISSION_RATE * 100)

function dateLabel(today) {
  const label = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(`${today}T00:00:00Z`),
  )
  return label.charAt(0).toLocaleUpperCase("fr-FR") + label.slice(1)
}

/** Vérification à faire ou à renouveler (priorité 1). `pending` et `verified` n'ont rien à faire. */
function verificationDecision(verification) {
  const { key, action, daysLeft } = verification
  if (!action) return null
  const base = { kind: "verification", key: "verification", action: { ...action, icon: "i-shield" } }
  if (key === "not_submitted") {
    return {
      ...base,
      icon: "i-upload",
      title: "Envoie ta carte étudiante",
      text: "Les clients font confiance aux comptes vérifiés. Tant que ta carte n'est pas envoyée, tu ne peux pas postuler.",
      badge: { label: verification.label, tone: "alerte" },
      subtitle: "Sans carte envoyée, tu ne peux pas postuler",
      due: true,
    }
  }
  if (key === "rejected") {
    return {
      ...base,
      icon: "i-alert-circle",
      title: "Renvoie ta carte étudiante",
      text: "Ta carte a été refusée. Le motif est indiqué dans ta vérification. Tant qu'elle n'est pas validée, tu ne peux pas postuler.",
      badge: { label: verification.label, tone: "erreur" },
      subtitle: "Tant qu'elle n'est pas validée, tu ne peux pas postuler",
      due: true,
    }
  }
  if (key === "expired") {
    return {
      ...base,
      icon: "i-shield",
      title: "Ton badge a expiré",
      text: "Envoie ta carte étudiante de l'année en cours pour postuler à nouveau. Tes missions en cours ne sont pas touchées.",
      badge: { label: verification.label, tone: "erreur" },
      subtitle: "Envoie ta carte de l'année en cours pour postuler à nouveau",
      due: true,
    }
  }
  const left = Math.max(daysLeft ?? 0, 0)
  const when = left === 0 ? "aujourd'hui" : `dans ${left} ${plural(left, "jour", "jours")}`
  return {
    ...base,
    icon: "i-shield",
    title: "Renouvelle ton badge vérifié",
    text: `Il expire ${when}. Envoie ta carte de l'année en cours pour le garder un an de plus.`,
    badge: { label: `Expire ${when}`, tone: "alerte" },
    subtitle: `Il expire ${when}`,
    due: true,
  }
}

function unreadDecision(u) {
  const n = u.count
  return {
    kind: "unread",
    key: `unread-${u.missionId}`,
    icon: "i-message",
    title: `Réponds à ${u.clientName}`,
    text: `${u.clientName} t'a écrit à propos de « ${u.title} » (${n} ${plural(n, "nouveau message", "nouveaux messages")}).`,
    listTitle: u.title,
    subtitle: `${u.clientName} · ${n} ${plural(n, "nouveau message", "nouveaux messages")}`,
    action: { label: `Répondre à ${u.clientName}`, href: studentConversationHref(u.missionId), icon: "i-message" },
    listAction: { label: "Répondre", href: studentConversationHref(u.missionId) },
    secondary: { label: "Voir la mission", href: studentMissionHref(u.missionId) },
    due: true,
  }
}

function reviewDecision(m) {
  return {
    kind: "review",
    key: `review-${m.id}`,
    icon: "i-star",
    title: `Note ${m.clientName}`,
    text: `« ${m.title} » est terminée. Ton avis aide les autres étudiants à choisir leurs missions.`,
    listTitle: m.title,
    subtitle: `${m.clientName} · terminée, laisse un avis`,
    action: { label: "Noter le client", href: studentReviewHref(m.id), icon: "i-star" },
    listAction: { label: "Noter le client", href: studentReviewHref(m.id) },
    secondary: { label: "Voir la mission", href: studentMissionHref(m.id) },
    due: true,
  }
}

function inProgressDecision(m) {
  const student = formatAmount(escrowSplit(m.budget).student)
  return {
    kind: "in_progress",
    key: `in_progress-${m.id}`,
    icon: "i-check-circle",
    title: `Préviens ${m.clientName} quand c'est fini`,
    text: `« ${m.title} » est en cours. Quand le travail est fait, préviens ${m.clientName} dans la messagerie : le client confirme la fin et ta part de ${student} est versée sur ton portefeuille.`,
    listTitle: m.title,
    subtitle: `${m.clientName} · ta part : ${student}`,
    action: { label: `Écrire à ${m.clientName}`, href: studentConversationHref(m.id), icon: "i-message" },
    listAction: { label: "Voir", href: studentMissionHref(m.id) },
    secondary: { label: "Voir la mission", href: studentMissionHref(m.id) },
    due: false,
  }
}

/**
 * Actions à faire, la plus prioritaire d'abord : 1 vérification à faire ou à renouveler, 2 message non lu d'un
 * client sur une mission en cours, 3 avis à laisser, 4 mission en cours. Une mission n'apparaît qu'une fois
 * (un message non lu l'emporte sur la ligne « mission en cours » de la même mission).
 * @param {import("../actions/student-dashboard.actions.js").StudentDashboardData} data
 */
export function buildDecisions(data) {
  const verification = verificationDecision(data.verification)
  const unread = data.unread ?? []
  const withMessage = new Set(unread.map((u) => u.missionId))
  return [
    ...(verification ? [verification] : []),
    ...unread.map(unreadDecision),
    ...(data.toReview ?? []).map(reviewDecision),
    ...(data.inProgress ?? []).filter((m) => !withMessage.has(m.id)).map(inProgressDecision),
  ]
}

function moneyNote(data) {
  const { earnedThisMonth, escrowToCome } = data.wallet
  const lines = []
  if (earnedThisMonth) lines.push({ strong: formatAmount(earnedThisMonth), text: "gagnés ce mois-ci" })
  if (escrowToCome > 0) {
    lines.push({
      strong: formatAmount(escrowToCome),
      text: `à venir, en séquestre (ta part, commission de ${commissionPct()} % déduite)`,
    })
  }
  return lines
}

function newHero(verification) {
  const pending = verification.key === "pending"
  return {
    flag: { label: "À faire maintenant", icon: "i-sparkles", due: false },
    title: "Trouve ta première mission",
    text: pending
      ? "Ta carte est en cours d'examen : tu peux déjà postuler aux missions ouvertes."
      : "Parcours les missions ouvertes à Cotonou, Porto-Novo et Abomey-Calavi, et postule à celle qui te plaît.",
    badge: null,
    action: { label: "Explorer les missions", href: studentMissionsHref() },
    secondary: null,
  }
}

function upToDateHero(verification) {
  const pending = verification.key === "pending"
  return {
    flag: { label: "Rien d'urgent", icon: "i-check", due: false },
    title: "Tout est à jour",
    text: pending
      ? "Ta carte est en cours d'examen : tu peux déjà postuler. Profites-en pour regarder les nouvelles missions."
      : "Profites-en pour regarder les nouvelles missions.",
    badge: null,
    action: null,
    secondary: { label: "Explorer les missions", href: studentMissionsHref() },
  }
}

function heroFrom(decision) {
  return {
    flag: { label: "À faire maintenant", icon: decision.kind === "verification" ? "i-shield" : "i-clock", due: decision.due },
    title: decision.title,
    text: decision.text,
    badge: decision.badge ?? null,
    action: decision.action,
    secondary: decision.secondary ?? null,
  }
}

function firstSteps(data) {
  const sent = data.verification.key !== "not_submitted"
  return {
    kind: "steps",
    title: "Premiers pas",
    steps: [
      {
        key: "carte",
        done: sent,
        title: "Envoyer ta carte étudiante",
        subtitle: "Demandée pour que les clients te fassent confiance",
        action: sent ? null : data.verification.action,
      },
      {
        key: "postuler",
        done: false,
        title: "Postuler à une mission",
        subtitle: "Le client voit ton profil",
        action: { label: "Explorer", href: studentMissionsHref() },
      },
    ],
  }
}

/**
 * Modèle d'affichage complet du tableau de bord.
 * `state` : "new" (nouvel inscrit sans rien à faire), "todo" (au moins une action) ou "uptodate".
 * @param {import("../actions/student-dashboard.actions.js").StudentDashboardData} data
 * @param {{ today: string, paymentsEnabled: boolean }} options
 */
export function buildDashboardModel(data, { today, paymentsEnabled }) {
  const decisions = buildDecisions(data)
  const isNew = !data.hasActivity && decisions.length === 0
  const state = decisions.length > 0 ? "todo" : isNew ? "new" : "uptodate"
  const { available } = data.wallet

  const hero = state === "todo" ? heroFrom(decisions[0]) : state === "new" ? newHero(data.verification) : upToDateHero(data.verification)

  const noteLines = moneyNote(data)
  const next = decisions.slice(1, 1 + LIST_LIMIT)
  const { rating, pendingApplications } = data
  const verified = data.verification.key === "verified" || data.verification.key === "expiring"
  const inProgressCount = data.inProgress.length

  let list = null
  if (state === "new") list = firstSteps(data)
  else if (next.length > 0) {
    list = {
      kind: "items",
      title: "Ensuite",
      count: decisions.length - 1,
      items: next.map((d) => ({
        key: d.key,
        icon: d.icon,
        title: d.listTitle ?? d.title,
        subtitle: d.subtitle,
        meta: d.badge ?? null,
        action: d.listAction ?? d.action,
      })),
      more: { label: "Voir mes candidatures", href: studentApplicationsHref() },
    }
  } else if (state === "uptodate") {
    list = { kind: "empty", title: "Ensuite", count: 0, text: "Aucune mission en cours, aucun avis à laisser." }
  }

  return {
    greeting: data.firstName ? `Bonjour, ${data.firstName}` : "Bonjour",
    dateLabel: dateLabel(today),
    state,
    hero,
    money: {
      label: "Disponible sur ton portefeuille",
      title: "Ton argent",
      amount: available,
      noteLines: noteLines.length > 0 ? noteLines : [{ strong: null, text: "Tes gains arriveront ici après ta première mission." }],
      action: paymentsEnabled ? { label: "Retirer sur Mobile Money", href: studentWalletHref({ retrait: true }), icon: "i-arrow-down" } : null,
      secondaryAction: { label: "Historique", href: studentWalletHref() },
      hint: paymentsEnabled ? null : PAYMENTS_PENDING_COPY.wallet.student,
    },
    stats: {
      inProgress: {
        label: "Missions en cours",
        value: inProgressCount,
        sub: inProgressCount > 0 ? "à clôturer avec le client" : "aucune pour le moment",
      },
      pending: {
        label: "Candidatures en attente",
        value: pendingApplications.count,
        sub: pendingApplications.lastAt ? `dernière envoyée le ${formatShortDate(pendingApplications.lastAt)}` : "aucune en attente",
      },
      rating: {
        label: "Ta note",
        hasRating: rating.reviewsCount > 0,
        value: rating.value,
        sub: `${rating.reviewsCount} avis${verified ? " · compte vérifié" : ""}`,
      },
    },
    list,
    decisionCount: decisions.length,
  }
}
