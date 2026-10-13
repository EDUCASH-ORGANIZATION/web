import { Icon } from "@/components/design/icon"
import { PageHead } from "@/components/app-ui/page-head"
import { TabsNav } from "@/components/app-ui/tabs-nav"
import { ItemList, Item } from "@/components/app-ui/item-list"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { EmptyState } from "@/components/app-ui/empty-state"
import { ErrorState } from "@/components/app-ui/state-block"
import { SkeletonRows } from "@/components/app-ui/skeletons"
import { SEARCH_MAX_LENGTH, missionTypeLabel } from "@/lib/constants/missions"
import { TYPE_ICON } from "@/lib/vitrine/mission-icons"
import { formatShortDate } from "@/lib/app/format"
import { missionStatusView } from "@/lib/app/mission-status"
import {
  clientConversationHref,
  clientMissionHref,
  clientMissionsHref,
  clientPublishHref,
  clientReviewHref,
} from "@/lib/app/client-routes"

const TABS = [
  { key: "open", label: "Ouvertes" },
  { key: "in_progress", label: "En cours" },
  { key: "done", label: "Terminées" },
  { key: "cancelled", label: "Annulées" },
]

const EMPTY = {
  open: {
    icon: "i-briefcase",
    title: "Aucune mission ouverte",
    text: "Publiez un besoin pour recevoir des candidatures d'étudiants.",
    action: () => ({ label: "Publier une mission", href: clientPublishHref() }),
  },
  in_progress: {
    icon: "i-clock",
    title: "Aucune mission en cours",
    text: "Acceptez un candidat sur une mission ouverte pour la démarrer.",
    action: () => ({ label: "Voir les ouvertes", href: clientMissionsHref() }),
  },
  done: {
    icon: "i-check-circle",
    title: "Aucune mission terminée",
    text: "Vos missions terminées et vos avis apparaîtront ici.",
  },
  cancelled: {
    icon: "i-ban",
    title: "Aucune mission annulée",
    text: "L'annulation d'une mission ouverte rembourse le séquestre sur votre portefeuille.",
  },
}

const STATUS_ICON = { overdue: "i-clock", done: "i-check", cancelled: "i-ban" }
const AMOUNT_NOTE = { open: "en séquestre", in_progress: "en séquestre", done: "libérés", cancelled: "budget" }

const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`

function applicationsText(mission) {
  if (mission.pendingCount > 0) return `${plural(mission.pendingCount, "candidature", "candidatures")} à examiner`
  if (mission.applicationsCount > 0) return plural(mission.applicationsCount, "candidature", "candidatures")
  return "aucune candidature"
}

// Sous-titre d'une rangée : type, ville, puis ce qui compte pour le statut.
function subtitleOf(mission) {
  const parts = [missionTypeLabel(mission.type)]
  if (mission.city) parts.push(mission.city)
  const date = formatShortDate(mission.deadline)
  if (mission.status === "open") {
    if (mission.overdue && date) parts.push(`échéance du ${date} dépassée`)
    else if (date) parts.push(`avant le ${date}`)
    parts.push(applicationsText(mission))
  } else if (mission.status === "in_progress") {
    if (date) parts.push(`jusqu'au ${date}`)
  } else if (mission.status === "done" && mission.reviewed) {
    parts.push("avis donné")
  }
  return parts.join(" · ")
}

// Actions de la rangée, la plus importante en dernier (à droite).
function actionsOf(mission) {
  const { id, status } = mission
  if (status === "open") {
    return [{ label: mission.pendingCount > 0 ? "Examiner" : "Voir", href: clientMissionHref(id) }]
  }
  if (status === "in_progress") {
    const actions = []
    if (mission.studentId) actions.push({ label: "Discuter", href: clientConversationHref(id, mission.studentId) })
    actions.push({ label: "Confirmer la fin", href: clientMissionHref(id, { confirmer: true }) })
    return actions
  }
  const actions = [{ label: "Republier", href: clientPublishHref({ duplicate: id }) }]
  if (status === "done" && !mission.reviewed) actions.push({ label: "Noter", href: clientReviewHref(id) })
  return actions
}

function MissionRow({ mission, today }) {
  const view = missionStatusView(mission, today)
  return (
    <Item
      variant="mission"
      icon={TYPE_ICON[mission.type] ?? "i-briefcase"}
      title={mission.title}
      subtitle={subtitleOf(mission)}
      line={<StatusBadge label={view.label} tone={view.tone} icon={STATUS_ICON[view.key]} />}
      amount={mission.budget}
      amountNote={AMOUNT_NOTE[mission.status]}
      actions={actionsOf(mission)}
    />
  )
}

// Mobile seulement : à partir de 1024 px la recherche de la barre du haut suffit (planche C02).
function SearchForm({ onglet, q }) {
  return (
    <form role="search" method="get" action={clientMissionsHref()} className="tools2 ds-mob-only">
      {onglet !== "open" ? <input type="hidden" name="onglet" value={onglet} /> : null}
      <label className="search">
        <Icon name="i-search" />
        <input
          type="search"
          name="q"
          defaultValue={q}
          maxLength={SEARCH_MAX_LENGTH}
          placeholder="Rechercher dans mes missions"
          aria-label="Rechercher dans mes missions"
          autoComplete="off"
        />
      </label>
    </form>
  )
}

function EmptyBlock({ onglet, q, otherMatches }) {
  if (q) {
    const text =
      otherMatches > 0
        ? `${plural(otherMatches, "mission correspond", "missions correspondent")} dans les autres onglets. Consultez-les ou essayez un autre mot.`
        : "Essayez un autre mot."
    return (
      <section className="card2 card2--flush" aria-label="Aucun résultat">
        <EmptyState
          compact
          icon="i-search"
          title={`Aucune mission pour « ${q} »`}
          text={text}
          action={{ label: "Effacer la recherche", href: clientMissionsHref({ onglet: onglet === "open" ? undefined : onglet }) }}
        />
      </section>
    )
  }
  const cfg = EMPTY[onglet]
  return (
    <section className="card2 card2--flush" aria-label={cfg.title}>
      <EmptyState icon={cfg.icon} title={cfg.title} text={cfg.text} action={cfg.action?.()} />
    </section>
  )
}

/** Squelette de la page, affiché par le <Suspense> de la page pendant la lecture des missions. */
export function ClientMissionsSkeleton() {
  return (
    <>
      <PageHead title="Mes missions" />
      <SkeletonRows count={3} />
    </>
  )
}

/**
 * Mes missions (C02). `result` est la réponse de getClientMissions : soit `{ error }`, soit les missions de
 * l'onglet courant avec les compteurs des quatre statuts. Composant pur, sans accès aux données.
 */
export function ClientMissionsView({ result }) {
  if (!result || result.error) {
    return (
      <>
        <PageHead title="Mes missions" />
        <section className="card2 card2--m card2--flush" aria-label="Erreur">
          <ErrorState
            compact
            title="Impossible de charger vos missions"
            text="La liste n'a pas pu être récupérée. Vos fonds en séquestre ne sont pas concernés."
          />
        </section>
      </>
    )
  }

  const { onglet, q, today, counts, total, missions } = result
  const active = counts.open + counts.in_progress
  const date = q
    ? plural(total, "résultat", "résultats")
    : active > 0
      ? plural(active, "mission active", "missions actives")
      : "Aucune mission active"
  const tabs = TABS.map((tab) => ({
    ...tab,
    count: counts[tab.key],
    href: clientMissionsHref({ onglet: tab.key === "open" ? undefined : tab.key, q: q || undefined }),
  }))
  const otherMatches = total - counts[onglet]
  const label = TABS.find((tab) => tab.key === onglet)?.label

  return (
    <>
      <PageHead date={date} title="Mes missions" />
      <SearchForm onglet={onglet} q={q} />
      <TabsNav label="Mes missions par statut" activeKey={onglet} items={tabs} />
      {missions.length === 0 ? (
        <EmptyBlock onglet={onglet} q={q} otherMatches={otherMatches} />
      ) : (
        <div className="col2">
          <ItemList label={label}>
            {missions.map((mission) => (
              <MissionRow key={mission.id} mission={mission} today={today} />
            ))}
          </ItemList>
          {missions.some((m) => m.overdue) ? (
            <p className="note2">
              <Icon name="i-info" />
              <span>
                {"Rien ne se passe automatiquement : "}
                <b>ouvrez la mission dont l&apos;échéance est dépassée</b>
                {" pour examiner ses candidatures ou l'annuler. Une annulation rembourse le séquestre sur votre portefeuille."}
              </span>
            </p>
          ) : null}
        </div>
      )}
    </>
  )
}

export default ClientMissionsView
