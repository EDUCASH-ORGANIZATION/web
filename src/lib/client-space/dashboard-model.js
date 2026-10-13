// Modèle pur du tableau de bord client (C01) : décisions en attente, priorité, état de l'écran.
// Aucune lecture de données ici : la forme d'entrée est `DashboardData` (client-dashboard.actions.js).
import { COMMISSION_RATE, netAmount } from "../constants/missions.js"
import { MIN_MISSION_BUDGET } from "../supabase/database.constants.js"
import { PAYMENTS_PENDING_COPY } from "../constants/payments.js"
import { formatAmount, formatDateFr, formatShortDate } from "../app/format.js"
import { missionStatusView } from "../app/mission-status.js"
import { clientMissionHref, clientPublishHref, clientReviewHref, clientWalletHref, clientMissionsHref } from "../app/client-routes.js"

/** Ordre de priorité : plus petit d'abord. */
export const DECISION_KINDS = ["applications", "overdue", "in_progress", "review"]

const SUPPORT_HREF = "/contact?sujet=question"
const LIST_LIMIT = 5

const plural = (n, one, many) => (n > 1 ? many : one)
const commissionPct = () => Math.round(COMMISSION_RATE * 100)

function dateLabel(today) {
  const label = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(`${today}T00:00:00Z`),
  )
  return label.charAt(0).toLocaleUpperCase("fr-FR") + label.slice(1)
}

function applicationsDecision(m) {
  const n = m.pendingCount
  return {
    key: `applications-${m.id}`,
    kind: "applications",
    missionId: m.id,
    title: m.title,
    icon: "i-users",
    subtitle: `${n} ${plural(n, "candidature à examiner", "candidatures à examiner")}`,
    meta: m.oldestPendingAt ? { text: `Depuis le ${formatShortDate(m.oldestPendingAt)}` } : null,
    action: { label: "Examiner", href: clientMissionHref(m.id) },
    count: n,
    sortKey: m.oldestPendingAt ?? m.createdAt ?? "",
    hero: {
      title: `${n} ${plural(n, "candidature", "candidatures")} pour « ${m.title} »`,
      text: `Examinez les profils et acceptez celui qui vous convient. Le budget de ${formatAmount(m.budget)} reste en séquestre jusqu'à votre validation.`,
      action: { label: "Examiner les candidatures", href: clientMissionHref(m.id), icon: "i-users" },
    },
  }
}

function overdueDecision(m, today) {
  const view = missionStatusView({ status: "open", deadline: m.deadline }, today)
  return {
    key: `overdue-${m.id}`,
    kind: "overdue",
    missionId: m.id,
    title: m.title,
    icon: "i-clock",
    subtitle: `Échéance du ${formatShortDate(m.deadline)} dépassée : examinez-la ou annulez-la`,
    meta: { badge: { label: view.label, tone: view.tone } },
    action: { label: "Voir", href: clientMissionHref(m.id) },
    count: 1,
    sortKey: m.deadline ?? "",
    hero: {
      title: `« ${m.title} » a dépassé son échéance`,
      text: `Échéance dépassée le ${formatDateFr(m.deadline)} : examinez-la ou annulez-la ; l'annulation rembourse le séquestre, donc les ${formatAmount(m.budget)} bloqués reviennent sur votre portefeuille.`,
      action: { label: "Voir la mission", href: clientMissionHref(m.id), icon: "i-clock" },
    },
  }
}

function inProgressDecision(m) {
  return {
    key: `in_progress-${m.id}`,
    kind: "in_progress",
    missionId: m.id,
    title: m.title,
    icon: "i-check-circle",
    subtitle: m.studentName ? `${m.studentName} · confirmez la fin quand le travail est fait` : "Confirmez la fin quand le travail est fait",
    meta: null,
    action: { label: "Confirmer la fin", href: clientMissionHref(m.id, { confirmer: true }) },
    count: 1,
    sortKey: m.createdAt ?? "",
    hero: {
      title: `« ${m.title} » est en cours`,
      text: `${m.studentName ? `${m.studentName} réalise cette mission. ` : ""}Quand le travail est fait, confirmez la fin : ${formatAmount(netAmount(m.budget))} des ${formatAmount(m.budget)} en séquestre sont versés à l'étudiant (commission ${commissionPct()} %). Les fonds restent bloqués jusqu'à votre validation.`,
      action: { label: "Confirmer la fin", href: clientMissionHref(m.id, { confirmer: true }), icon: "i-check-circle" },
      secondary: { label: "Signaler un problème", href: SUPPORT_HREF },
    },
  }
}

function reviewDecision(m, index) {
  const who = m.studentName ? ` à ${m.studentName}` : ""
  return {
    key: `review-${m.id}`,
    kind: "review",
    missionId: m.id,
    title: m.title,
    icon: "i-star",
    subtitle: `Terminée · laissez un avis${who}`,
    meta: null,
    action: { label: "Noter", href: clientReviewHref(m.id) },
    count: 1,
    sortKey: String(index).padStart(6, "0"),
    hero: {
      title: `Laissez un avis${who}`,
      text: `« ${m.title} » est terminée. Votre avis aide les autres clients et valorise l'étudiant.`,
      action: { label: "Noter l'étudiant", href: clientReviewHref(m.id), icon: "i-star" },
    },
  }
}

/**
 * Décisions en attente, la plus prioritaire d'abord : 1 candidatures à examiner (la plus ancienne d'abord),
 * 2 échéance dépassée, 3 mission en cours, 4 avis à laisser. Une mission n'apparaît qu'une fois.
 * Rien n'affirme qu'un travail a été « livré » : aucun signal de ce type n'existe en base.
 * @param {import("../actions/client-dashboard.actions.js").DashboardData} data
 * @param {string} today "AAAA-MM-JJ" (todayInBenin)
 */
export function buildDecisions(data, today) {
  const active = data?.active ?? []
  const open = active.filter((m) => m.status === "open")
  const withApplications = open.filter((m) => m.pendingCount > 0)
  const taken = new Set(withApplications.map((m) => m.id))
  const overdue = open.filter((m) => !taken.has(m.id) && missionStatusView(m, today).key === "overdue")
  const inProgress = active.filter((m) => m.status === "in_progress")
  const byKey = (a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0)
  return [
    ...withApplications.map(applicationsDecision).sort(byKey),
    ...overdue.map((m) => overdueDecision(m, today)).sort(byKey),
    ...inProgress.map(inProgressDecision).sort(byKey),
    ...(data?.toReview ?? []).map(reviewDecision),
  ]
}

function metaLines(decisions) {
  const of = (kind) => decisions.filter((d) => d.kind === kind)
  const lines = []
  const apps = of("applications")
  if (apps.length > 0) {
    const total = apps.reduce((sum, d) => sum + d.count, 0)
    lines.push({
      count: total,
      text: `${plural(total, "candidature à examiner", "candidatures à examiner")} sur ${apps.length} ${plural(apps.length, "mission", "missions")}`,
    })
  }
  const overdue = of("overdue")
  if (overdue.length > 0) lines.push({ count: overdue.length, text: plural(overdue.length, "échéance dépassée", "échéances dépassées") })
  const running = of("in_progress")
  if (running.length > 0) lines.push({ count: running.length, text: plural(running.length, "mission en cours à clôturer", "missions en cours à clôturer") })
  const reviews = of("review")
  if (reviews.length > 0) lines.push({ count: reviews.length, text: plural(reviews.length, "avis à laisser", "avis à laisser") })
  return lines
}

function newClientHero(paymentsEnabled) {
  const base = { label: "En attente de votre décision", figure: 0, metaLines: [] }
  if (paymentsEnabled) {
    return {
      ...base,
      flag: { label: "À faire maintenant", icon: "i-sparkles", due: false },
      title: "Publiez votre première mission",
      text: `Rédigez librement : le budget (${formatAmount(MIN_MISSION_BUDGET)} minimum) n'est bloqué en séquestre qu'au moment de publier.`,
      action: { label: "Publier une mission", href: clientPublishHref(), icon: "i-plus" },
    }
  }
  return {
    ...base,
    flag: { label: "En cours d'activation", icon: "i-clock", due: false },
    title: PAYMENTS_PENDING_COPY.publish.title,
    text: PAYMENTS_PENDING_COPY.publish.lead,
    action: { label: "Prévenez-moi", href: clientPublishHref(), icon: "i-bell" },
  }
}

function upToDateHero(active) {
  const open = active.filter((m) => m.status === "open").length
  const text =
    open === 1
      ? "Votre mission ouverte attend des candidatures."
      : open > 1
        ? `Vos ${open} missions ouvertes attendent des candidatures.`
        : "Aucune mission active pour le moment."
  return {
    label: "En attente de votre décision",
    figure: 0,
    metaLines: [],
    flag: { label: "Rien à décider", icon: "i-check", due: false },
    title: "Tout est à jour",
    text,
    secondary: { label: "Publier une mission", href: clientPublishHref() },
  }
}

function lowBalanceBanner(available, paymentsEnabled) {
  if (!paymentsEnabled) {
    return {
      title: PAYMENTS_PENDING_COPY.publish.title,
      text: PAYMENTS_PENDING_COPY.publish.lead,
      action: { label: "Prévenez-moi", href: clientPublishHref() },
    }
  }
  const shortfall = MIN_MISSION_BUDGET - available
  return {
    title: "Solde insuffisant pour publier",
    text: `Une mission demande au moins ${formatAmount(MIN_MISSION_BUDGET)} en séquestre. Il vous reste ${formatAmount(available)} disponibles.`,
    action: { label: `Recharger ${formatAmount(shortfall)}`, href: clientWalletHref({ recharger: true, montant: shortfall }) },
  }
}

function firstSteps(data, paymentsEnabled) {
  const funded = data.wallet.available > 0 || data.wallet.escrow > 0
  const steps = [
    paymentsEnabled
      ? {
          key: "recharger",
          done: funded,
          title: "Recharger votre portefeuille",
          subtitle: "MTN MoMo, Moov Money ou Celtiis Cash",
          action: funded ? null : { label: "Recharger", href: clientWalletHref({ recharger: true }) },
        }
      : {
          key: "recharger",
          done: funded,
          title: "Recharger votre portefeuille",
          subtitle: PAYMENTS_PENDING_COPY.wallet.title,
          action: null,
        },
    paymentsEnabled
      ? {
          key: "publier",
          done: false,
          title: "Publier une mission",
          subtitle: "Votre budget n'est bloqué en séquestre qu'au moment de publier",
          action: { label: "Publier", href: clientPublishHref() },
        }
      : {
          key: "publier",
          done: false,
          title: PAYMENTS_PENDING_COPY.publish.title,
          subtitle: "Laissez votre adresse email pour être prévenu de l'ouverture",
          action: { label: "Prévenez-moi", href: clientPublishHref() },
        },
  ]
  return { steps, doneCount: steps.filter((s) => s.done).length }
}

/**
 * Modèle d'affichage complet du tableau de bord.
 * `state` : "new" (aucune mission), "decisions" (au moins une décision) ou "uptodate".
 * @param {import("../actions/client-dashboard.actions.js").DashboardData} data
 * @param {{ today: string, paymentsEnabled: boolean }} options
 */
export function buildDashboardModel(data, { today, paymentsEnabled }) {
  const active = data.active ?? []
  const decisions = buildDecisions(data, today)
  const isNew = (data.totalMissions ?? 0) === 0
  const state = isNew ? "new" : decisions.length > 0 ? "decisions" : "uptodate"
  const openCount = active.filter((m) => m.status === "open").length
  const inProgressCount = active.filter((m) => m.status === "in_progress").length
  const activeCount = openCount + inProgressCount
  const { available, escrow } = data.wallet

  let hero
  if (state === "new") hero = newClientHero(paymentsEnabled)
  else if (state === "uptodate") hero = upToDateHero(active)
  else {
    const first = decisions[0]
    hero = {
      label: "En attente de votre décision",
      figure: decisions.length,
      metaLines: metaLines(decisions),
      flag: {
        label: decisions.length > 1 ? `À décider en premier · 1 sur ${decisions.length}` : "À décider en premier",
        icon: "i-clock",
        due: true,
      },
      ...first.hero,
    }
  }

  const next = decisions.slice(1, 1 + LIST_LIMIT)
  return {
    greeting: data.firstName ? `Bonjour, ${data.firstName}` : "Bonjour",
    dateLabel: dateLabel(today),
    state,
    hero,
    banner: state !== "new" && available < MIN_MISSION_BUDGET ? lowBalanceBanner(available, paymentsEnabled) : null,
    money: {
      title: `Votre argent · ${formatAmount(available + escrow)} au total`,
      available,
      escrow,
      availableNote: paymentsEnabled ? "pour publier ou retirer" : undefined,
      escrowNote:
        escrow > 0 && activeCount > 0
          ? `bloqués pour ${activeCount} ${plural(activeCount, "mission financée", "missions financées")}`
          : undefined,
      action: paymentsEnabled ? { label: "Recharger", href: clientWalletHref({ recharger: true }), icon: "i-plus" } : null,
      hint: paymentsEnabled ? null : PAYMENTS_PENDING_COPY.wallet.client,
    },
    stats: {
      activeCount,
      sub: `${openCount} ${plural(openCount, "ouverte", "ouvertes")} · ${inProgressCount} en cours`,
    },
    list:
      state === "new"
        ? { kind: "steps", title: "Premiers pas", ...firstSteps(data, paymentsEnabled) }
        : next.length > 0
          ? { kind: "decisions", title: "À traiter ensuite", count: decisions.length - 1, items: next, more: { label: "Voir mes missions", href: clientMissionsHref() } }
          : null,
    decisionCount: decisions.length,
  }
}
