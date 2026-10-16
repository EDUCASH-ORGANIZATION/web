import { Icon } from "@/components/design/icon"
import { formatAmount } from "@/lib/app/format"

const MOMENT_TZ = "Africa/Porto-Novo"

/**
 * Date et heure au Bénin, ex. "8 oct. · 09:02". Chaîne vide si la date est absente ou invalide.
 * @param {string|null|undefined} iso
 */
export function formatMoment(iso) {
  const date = new Date(iso ?? "")
  if (!iso || Number.isNaN(date.getTime())) return ""
  const day = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: MOMENT_TZ }).format(date)
  const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: MOMENT_TZ }).format(date)
  return `${day} · ${time}`
}

/** Jour au Bénin, ex. "8 oct.". Chaîne vide si la date est absente ou invalide. */
export function formatDay(iso) {
  const date = new Date(iso ?? "")
  if (!iso || Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: MOMENT_TZ }).format(date)
}

/** Date du dernier mouvement du grand livre d'un type, ou null. */
export function movementDate(ledger, type) {
  const dates = (Array.isArray(ledger) ? ledger : []).filter((m) => m?.type === type).map((m) => String(m.createdAt))
  return dates.length ? dates.reduce((a, b) => (b > a ? b : a)) : null
}

/**
 * Étapes de la chronologie, fondées sur les seules dates connues (publication, mouvements du grand livre).
 * Aucune étape n'est inventée : la date d'acceptation d'une candidature n'est pas connue, elle n'est pas affichée.
 * @param {import("@/lib/actions/client-mission-detail.actions").ClientMissionDetail} detail
 * @param {ReturnType<import("@/lib/client-space/mission-view").missionView>} view
 * @param {string} studentName Prénom (ou libellé neutre)
 * @returns {Array<{ state: "done"|"current"|"todo", icon: string, title: string, meta?: string }>}
 */
export function buildTimeline(detail, view, studentName) {
  const { mission, ledger } = detail
  const items = []

  if (view.reservedAt) {
    const amount = view.receipt.reserved || view.split.total
    items.push({
      state: "done",
      icon: "i-check",
      title: `Publiée, ${formatAmount(amount)} en séquestre`,
      meta: formatMoment(mission.createdAt),
    })
  } else {
    items.push({ state: "done", icon: "i-check", title: "Mission publiée", meta: formatMoment(mission.createdAt) })
  }

  if (mission.status === "cancelled") {
    items.push({ state: "done", icon: "i-x", title: "Mission annulée" })
    if (view.refund) {
      items.push({
        state: "done",
        icon: "i-undo",
        title: `${formatAmount(view.refund.amount)} remboursés sur votre portefeuille`,
        meta: formatMoment(view.refund.date),
      })
    }
    return items
  }

  items.push({ state: "done", icon: "i-user-check", title: `Candidature de ${studentName} acceptée` })

  if (mission.status === "done") {
    items.push({ state: "done", icon: "i-check-circle", title: "Fin de mission confirmée par vous" })
    items.push({
      state: "done",
      icon: "i-coins",
      title: `Fonds libérés : ${formatAmount(view.split.student)} à ${studentName}`,
      meta: formatMoment(movementDate(ledger, "release")),
    })
    if (!detail.review) items.push({ state: "current", icon: "i-star", title: "Avis à laisser" })
    return items
  }

  items.push({ state: "current", icon: "i-clock", title: "Mission en cours" })
  items.push({ state: "todo", icon: "i-check-circle", title: "Votre validation de la fin" })
  items.push({ state: "todo", icon: "i-coins", title: `Fonds versés à ${studentName}` })
  return items
}

export function Timeline({ items }) {
  return (
    <ol className="timeline">
      {items.map((item) => (
        <li key={item.title} className={`tl-item is-${item.state}`}>
          <span className="tl-item__dot">
            <Icon name={item.icon} />
          </span>
          <div>
            <div className="tl-item__title">{item.title}</div>
            {item.meta ? <div className="tl-item__meta">{item.meta}</div> : null}
          </div>
        </li>
      ))}
    </ol>
  )
}

export default Timeline
