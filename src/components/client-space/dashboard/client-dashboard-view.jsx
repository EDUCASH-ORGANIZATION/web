import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { PageHead } from "@/components/app-ui/page-head"
import { HeroDecision } from "@/components/app-ui/hero-decision"
import { MoneyCard } from "@/components/app-ui/money-card"
import { StatGroup, Stat } from "@/components/app-ui/stats"
import { ItemList, Item } from "@/components/app-ui/item-list"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { ErrorState } from "@/components/app-ui/state-block"
import { buildDashboardModel } from "@/lib/client-space/dashboard-model"

function Banner({ banner }) {
  return (
    <div className="banner banner--alerte" role="status">
      <Icon name="i-wallet" />
      <div className="banner__body">
        <div className="banner__title">{banner.title}</div>
        {banner.text}
        <div className="banner__actions">
          <Link className="btn btn--dark btn--sm" href={banner.action.href}>
            {banner.action.label}
          </Link>
        </div>
      </div>
    </div>
  )
}

function Meta({ meta }) {
  return meta.badge ? <StatusBadge label={meta.badge.label} tone={meta.badge.tone} /> : meta.text
}

// Rangée d'un « premier pas » : pastille numérotée ou cochée à la place de l'icône.
function Step({ step, index }) {
  return (
    <div role="listitem" className="item2">
      <span className={step.done ? "step2 step2--done" : "step2"}>
        {step.done ? <Icon name="i-check" className="ic ic--16" /> : index + 1}
      </span>
      <div>
        <div className="item2__title">{step.title}</div>
        <div className="item2__sub">{step.done ? "Fait" : step.subtitle}</div>
      </div>
      {step.action && !step.done ? (
        <Link className="item2__action" href={step.action.href}>
          {step.action.label}
        </Link>
      ) : (
        <span />
      )}
    </div>
  )
}

function Rows({ list }) {
  if (!list) return null
  if (list.kind === "steps") {
    return (
      <ItemList title={list.title} count={`${list.doneCount} sur ${list.steps.length}`}>
        {list.steps.map((step, i) => (
          <Step key={step.key} step={step} index={i} />
        ))}
      </ItemList>
    )
  }
  return (
    <ItemList title={list.title} count={list.count} more={list.more}>
      {list.items.map((d) => (
        <Item key={d.key} icon={d.icon} title={d.title} subtitle={d.subtitle} meta={d.meta ? <Meta meta={d.meta} /> : undefined} action={d.action} />
      ))}
    </ItemList>
  )
}

/**
 * Tableau de bord client (C01). Vue pure : les données viennent de `getClientDashboard`.
 * @param {{
 *   data?: import("@/lib/actions/client-dashboard.actions").DashboardData,
 *   error?: string,
 *   today: string,
 *   paymentsEnabled: boolean,
 * }} props
 */
export function ClientDashboardView({ data, error, today, paymentsEnabled }) {
  if (error || !data) {
    return (
      <div className="page2">
        <ErrorState titleAs="h1" title="Impossible de charger votre tableau de bord" />
      </div>
    )
  }
  const model = buildDashboardModel(data, { today, paymentsEnabled })
  return (
    <div className="page2 dash2">
      <PageHead date={model.dateLabel} title={model.greeting} />
      {model.banner ? <Banner banner={model.banner} /> : null}
      <HeroDecision ariaLabel="Décisions en attente" {...model.hero} />
      {model.state === "new" ? (
        <MoneyCard {...model.money} />
      ) : (
        <div className="row2">
          <MoneyCard {...model.money} />
          <StatGroup label="Missions">
            <Stat label="Missions actives" value={model.stats.activeCount} sub={model.stats.sub} />
          </StatGroup>
        </div>
      )}
      <Rows list={model.list} />
    </div>
  )
}

export default ClientDashboardView
