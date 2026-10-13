// @ds-screen RD-STUDENT-01
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { PageHead } from "@/components/app-ui/page-head"
import { MoneyCard } from "@/components/app-ui/money-card"
import { StatGroup, Stat } from "@/components/app-ui/stats"
import { ItemList, Item } from "@/components/app-ui/item-list"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { ErrorState } from "@/components/app-ui/state-block"
import { buildDashboardModel } from "@/lib/student-space/dashboard-model"

const ratingFormat = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })

// Lignes de la carte argent : montant en gras puis texte (la ligne d'accueil n'a pas de montant).
function MoneyNote({ lines }) {
  return lines.map((line, i) => (
    <span key={line.text}>
      {i > 0 ? <br /> : null}
      {line.strong ? <b>{line.strong}</b> : null}
      {line.strong ? " " : ""}
      {line.text}
    </span>
  ))
}

// Carte « À faire maintenant » : étiquette citron seulement si une action est due, un seul bouton encre.
function TodoCard({ hero }) {
  const { flag } = hero
  return (
    <section className="card2" aria-label="À faire maintenant">
      <span className={flag.due ? "flag2" : "flag2 flag2--neutre"}>
        <Icon name={flag.icon} />
        {flag.label}
      </span>
      <h2 className="hero2__title">{hero.title}</h2>
      <p className="hero2__text">{hero.text}</p>
      {hero.badge ? (
        <div>
          <StatusBadge label={hero.badge.label} tone={hero.badge.tone} />
        </div>
      ) : null}
      {hero.action || hero.secondary ? (
        <div className="hero2__actions">
          {hero.action ? (
            <Link className="btn btn--dark" href={hero.action.href}>
              {hero.action.icon ? <Icon name={hero.action.icon} /> : null}
              {hero.action.label}
            </Link>
          ) : null}
          {hero.secondary ? (
            <Link className="hero2__link" href={hero.secondary.href}>
              {hero.secondary.label}
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  )
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
    const doneCount = list.steps.filter((s) => s.done).length
    return (
      <ItemList title={list.title} count={`${doneCount} sur ${list.steps.length}`}>
        {list.steps.map((step, i) => (
          <Step key={step.key} step={step} index={i} />
        ))}
      </ItemList>
    )
  }
  if (list.kind === "empty") {
    return (
      <ItemList title={list.title} count={list.count}>
        <Item icon="i-check" title="Rien cette semaine" subtitle={list.text} />
      </ItemList>
    )
  }
  return (
    <ItemList title={list.title} count={list.count} more={list.more}>
      {list.items.map((it) => (
        <Item
          key={it.key}
          icon={it.icon}
          title={it.title}
          subtitle={it.subtitle}
          meta={it.meta ? <StatusBadge label={it.meta.label} tone={it.meta.tone} /> : undefined}
          action={it.action}
        />
      ))}
    </ItemList>
  )
}

/**
 * Tableau de bord étudiant (E01). Vue pure : les données viennent de `getStudentDashboard`.
 * @param {{
 *   data?: import("@/lib/actions/student-dashboard.actions").StudentDashboardData,
 *   error?: string,
 *   today: string,
 *   paymentsEnabled: boolean,
 * }} props
 */
export function StudentDashboardView({ data, error, today, paymentsEnabled }) {
  if (error || !data) {
    return (
      <div className="page2">
        <ErrorState
          titleAs="h1"
          title="Impossible de charger ton tableau de bord"
          text="Le chargement a échoué. Ton argent et tes missions ne sont pas touchés."
        />
      </div>
    )
  }
  const model = buildDashboardModel(data, { today, paymentsEnabled })
  const { money, stats } = model
  return (
    <div className="page2 dash2">
      <PageHead date={model.dateLabel} title={model.greeting} />
      <div className="duo2">
        <MoneyCard
          label={money.label}
          title={money.title}
          amount={money.amount}
          note={<MoneyNote lines={money.noteLines} />}
          action={money.action}
          secondaryAction={money.secondaryAction}
          hint={money.hint}
        />
        <TodoCard hero={model.hero} />
      </div>
      <StatGroup label="Indicateurs">
        <Stat label={stats.inProgress.label} value={stats.inProgress.value} sub={stats.inProgress.sub} />
        <Stat label={stats.pending.label} value={stats.pending.value} sub={stats.pending.sub} />
        <Stat
          label={stats.rating.label}
          value={
            stats.rating.hasRating ? (
              <>
                {ratingFormat.format(stats.rating.value)}
                <small>/ 5</small>
              </>
            ) : (
              "-"
            )
          }
          sub={stats.rating.sub}
        />
      </StatGroup>
      <Rows list={model.list} />
    </div>
  )
}

export default StudentDashboardView
