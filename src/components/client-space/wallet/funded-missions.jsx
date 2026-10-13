import Link from "next/link"
import { SectionCard } from "@/components/app-ui/section-card"
import { EmptyState } from "@/components/app-ui/empty-state"
import { ErrorState } from "@/components/app-ui/state-block"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { splitAmount } from "@/components/app-ui/amount"
import { missionStatusView } from "@/lib/app/mission-status"
import { formatAmount } from "@/lib/app/format"
import { clientMissionHref } from "@/lib/app/client-routes"
import { COMMISSION_RATE } from "@/lib/constants/missions"

function plural(n, one, many) {
  return n > 1 ? many : one
}

function subtitle(mission) {
  if (mission.status === "in_progress") return mission.studentName ?? "Étudiant retenu"
  if (mission.pendingCount > 0) return `${mission.pendingCount} ${plural(mission.pendingCount, "candidature", "candidatures")} en attente`
  return "Aucune candidature pour l'instant"
}

function Fund({ mission, today }) {
  const money = splitAmount(mission.budget)
  const status = missionStatusView(mission, today)
  return (
    <div className="fund2" role="listitem">
      <Link className="fund2__title" href={clientMissionHref(mission.id)}>
        {mission.title}
      </Link>
      <span className="fund2__amt">
        {money.text}
        <small>{money.unit}</small>
      </span>
      <span className="fund2__sub">{subtitle(mission)}</span>
      <span>
        <StatusBadge label={status.label} tone={status.tone} />
      </span>
    </div>
  )
}

/**
 * Missions dont le budget est en séquestre (ouvertes et en cours), en blanc. `missions` vaut null quand leur
 * lecture a échoué : le solde de la carte argent reste affiché, seule cette liste est en erreur.
 * @param {{ missions: Array<object>|null, escrow: number, today: string, paymentsEnabled: boolean }} props
 */
export function FundedMissions({ missions, escrow, today, paymentsEnabled }) {
  if (missions === null) {
    return (
      <SectionCard title="Missions financées">
        <ErrorState compact title="Impossible de charger vos missions financées" text="Votre solde, lui, est à jour." />
      </SectionCard>
    )
  }
  if (missions.length === 0) {
    return (
      <SectionCard title="Missions financées" count={0}>
        <EmptyState
          compact
          icon="i-briefcase"
          title="Aucune mission financée"
          text="Le budget d'une mission publiée est bloqué ici jusqu'à ce que vous confirmiez sa fin."
          action={paymentsEnabled ? { href: "/client/missions/new", label: "Publier une mission" } : undefined}
        />
      </SectionCard>
    )
  }
  return (
    <SectionCard title="Missions financées" count={missions.length}>
      <div role="list">
        {missions.map((m) => (
          <Fund key={m.id} mission={m} today={today} />
        ))}
      </div>
      <div className="fund2 fund2--total">
        <span className="fund2__title">Total en séquestre</span>
        <span className="fund2__amt">{formatAmount(escrow)}</span>
      </div>
    </SectionCard>
  )
}

/** Explication du séquestre, sans promesse que le fonctionnement actuel ne tient pas. */
export function EscrowExplainer() {
  const percent = Math.round(COMMISSION_RATE * 100)
  return (
    <SectionCard title="Comment fonctionne le séquestre">
      <ol className="steps2">
        <li>
          <span>
            <b>Vous publiez</b>
            Le budget de la mission est bloqué sur votre portefeuille : il n&apos;est pas versé.
          </span>
        </li>
        <li>
          <span>
            <b>Un étudiant réalise la mission</b>
            Les fonds restent bloqués pendant toute la mission.
          </span>
        </li>
        <li>
          <span>
            <b>Vous confirmez la fin</b>
            Les fonds sont alors versés à l&apos;étudiant, moins la commission EduCash de {percent} %.
          </span>
        </li>
      </ol>
      <p className="note2">
        <span>Rien n&apos;est libéré sans votre validation. Si vous annulez une mission ouverte, les fonds reviennent sur votre disponible.</span>
      </p>
    </SectionCard>
  )
}
