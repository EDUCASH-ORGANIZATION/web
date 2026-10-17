// @ds-screen RD-ADMIN-01
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { PageHead } from "@/components/app-ui/page-head"
import { HeroDecision } from "@/components/app-ui/hero-decision"
import { Stat, StatGroup } from "@/components/app-ui/stats"
import { ItemList, Item } from "@/components/app-ui/item-list"
import { ErrorState } from "@/components/app-ui/state-block"
import { formatAmount, formatRelative } from "@/lib/app/format"
import { adminUserHref, adminUsersHref, adminVerificationsHref, adminWalletsHref } from "@/lib/app/admin-routes"
import { buildQueue, heroItem, nextItems } from "@/lib/admin-space/dashboard-queue"
import { ageLabel } from "@/lib/admin-space/verification-queue"
import { roleLabel } from "@/lib/admin-space/labels"
import { STUCK_WITHDRAWAL_WARNING } from "@/lib/admin-space/finance"

const LIST_LIMIT = 6
const plural = (n, one, many) => (n > 1 ? many : one)
const who = (item) => item.name || "Compte sans nom"

function dateLabel(today) {
  const label = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(`${today}T00:00:00Z`),
  )
  return label.charAt(0).toLocaleUpperCase("fr-FR") + label.slice(1)
}

/** « d'octobre », « de novembre » : nom du mois (jour du Bénin) précédé de la bonne préposition. */
export function monthPhrase(month) {
  const name = new Intl.DateTimeFormat("fr-FR", { month: "long", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`))
  return /^[aeiouhâéèêîô]/i.test(name) ? `d'${name}` : `de ${name}`
}

/** Ancienneté d'un dossier : « Dossier reçu aujourd'hui », « Dossier reçu hier », « En attente depuis 3 jours ». */
export function waitText(since, now) {
  const label = ageLabel(now, since)
  if (!label) return "Dossier en attente d'examen."
  if (label === "Aujourd'hui") return "Dossier reçu aujourd'hui."
  if (label === "Hier") return "Dossier reçu hier."
  const days = Number.parseInt(label, 10)
  return `En attente depuis ${days} ${plural(days, "jour", "jours")}.`
}

/** Lien d'un élément de la file : le dossier dans la file de vérification, ou la liste des portefeuilles. */
export function itemHref(item) {
  return item.kind === "dossier" ? adminVerificationsHref({ id: item.userId }) : adminWalletsHref()
}

/** Libellés d'un élément de la file (alerte d'argent ou dossier de vérification). */
export function describeItem(item, now) {
  if (item.kind === "dossier") {
    return {
      icon: "i-id-card",
      heroTitle: `Vérifier la carte de ${who(item)}`,
      rowTitle: `${who(item)} · vérification`,
      text: waitText(item.since, now),
      meta: ageLabel(now, item.since),
      heroAction: "Examiner le dossier",
      rowAction: "Examiner",
    }
  }
  if (item.reason === "negative-balance") {
    const text = `Solde du portefeuille : ${formatAmount(Math.abs(item.balance), { sign: "debit" })}.`
    return { icon: "i-alert-triangle", heroTitle: `Solde négatif : ${who(item)}`, rowTitle: `${who(item)} · solde négatif`, text, meta: "", heroAction: "Voir le portefeuille", rowAction: "Voir" }
  }
  if (item.reason === "reserved-over-balance") {
    const text = `${formatAmount(item.reserved)} réservés pour un solde de ${formatAmount(item.balance)}.`
    return {
      icon: "i-alert-triangle",
      heroTitle: `Argent réservé supérieur au solde : ${who(item)}`,
      rowTitle: `${who(item)} · réservé supérieur au solde`,
      text,
      meta: "",
      heroAction: "Voir le portefeuille",
      rowAction: "Voir",
    }
  }
  const since = formatRelative(item.since, now)
  return {
    icon: "i-arrow-up-right",
    heroTitle: `Retrait débité sans virement créé : ${who(item)}`,
    rowTitle: `${who(item)} · retrait sans virement`,
    text: `${formatAmount(item.amount)} débités ${since}, sans référence de paiement enregistrée. ${STUCK_WITHDRAWAL_WARNING}`,
    meta: since,
    heroAction: "Voir le portefeuille",
    rowAction: "Voir",
  }
}

/**
 * Modèle de l'écran : file à traiter (alertes d'argent, retraits, dossiers), totaux exacts fournis par le serveur
 * (`alerts.total`, `withdrawals.total`, `dossiers.total`), blocs en erreur.
 */
export function buildDashboardModel(data) {
  const now = new Date(data.now)
  const { alerts, withdrawals, dossiers } = data
  const queue = buildQueue(
    {
      moneyAlerts: alerts.ok ? alerts.items : [],
      withdrawals: withdrawals.ok ? withdrawals.items : [],
      dossiers: dossiers.ok ? dossiers.dossiers : [],
    },
    now,
  )
  const moneyCount = (alerts.ok ? alerts.total : 0) + (withdrawals.ok ? withdrawals.total : 0)
  const dossierCount = dossiers.ok ? dossiers.total : 0
  const blocks = { alerts, withdrawals, dossiers, escrow: data.escrow, commissions: data.commissions, missions: data.missions }
  const failed = Object.entries(blocks).filter(([, block]) => !block.ok).map(([key]) => key)
  if (data.recent && !data.recent.ok) failed.push("recent")
  return {
    now,
    queue,
    moneyCount,
    dossierCount,
    total: moneyCount + dossierCount,
    queueComplete: alerts.ok && withdrawals.ok && dossiers.ok,
    failed,
  }
}

function metaLines(model) {
  const lines = []
  if (model.moneyCount > 0) {
    lines.push({ count: model.moneyCount, text: plural(model.moneyCount, "alerte d'argent", "alertes d'argent") })
  }
  if (model.dossierCount > 0) {
    lines.push({ count: model.dossierCount, text: plural(model.dossierCount, "dossier de vérification", "dossiers de vérification") })
  }
  return lines
}

function Hero({ model }) {
  const first = heroItem(model.queue)
  const label = "À traiter aujourd'hui"
  if (!first) {
    return model.queueComplete ? (
      <HeroDecision
        ariaLabel="File à traiter"
        label={label}
        figure={0}
        flag={{ label: "Tout est à jour", icon: "i-check-circle", due: false }}
        title="Rien à traiter pour le moment"
        text="Les nouveaux dossiers de vérification et les alertes d'argent apparaîtront ici."
      />
    ) : (
      <HeroDecision
        ariaLabel="File à traiter"
        label={label}
        figure="-"
        title="La file n'a pas pu être calculée en entier"
        text="Réessayez dans un instant : aucune décision n'a été perdue."
      />
    )
  }
  const text = describeItem(first, model.now)
  const second = model.queue[1]
  return (
    <HeroDecision
      ariaLabel="File à traiter"
      label={label}
      figure={model.total}
      metaLines={metaLines(model)}
      flag={
        first.kind === "money"
          ? { label: "Priorité haute · argent", icon: "i-alert-circle" }
          : { label: "Vérification", icon: "i-id-card", due: false }
      }
      title={text.heroTitle}
      text={text.text}
      action={{ href: itemHref(first), label: text.heroAction, icon: first.kind === "money" ? "i-wallet" : "i-id-card" }}
      secondary={second ? { href: itemHref(second), label: "Passer au suivant" } : undefined}
    />
  )
}

function Money({ data }) {
  const { escrow, commissions } = data
  return (
    <section className="money2 money2--split" aria-label="Argent de la plateforme">
      <div className="money2__head">
        <span>Argent de la plateforme</span>
        <Link className="btn btn--blanc btn--sm" href={adminWalletsHref()}>
          Portefeuilles
        </Link>
      </div>
      {escrow.ok ? (
        <Stat
          label="En séquestre"
          amount={escrow.total}
          sub={
            typeof escrow.fundedMissions === "number"
              ? `${escrow.fundedMissions} ${plural(escrow.fundedMissions, "mission financée", "missions financées")}`
              : undefined
          }
        />
      ) : (
        <Stat label="En séquestre" value="Indisponible" sub="Lecture impossible pour le moment" />
      )}
      {commissions.ok ? (
        <Stat label={`Commissions ${monthPhrase(commissions.month)}`} amount={commissions.total} />
      ) : (
        <Stat label="Commissions du mois" value="Indisponible" sub="Lecture impossible pour le moment" />
      )}
    </section>
  )
}

function Missions({ missions }) {
  return (
    <StatGroup label="Missions">
      {missions.ok ? (
        <Stat
          label="Missions publiées"
          value={missions.published}
          sub={`7 derniers jours · ${missions.filled} ${plural(missions.filled, "pourvue", "pourvues")}`}
        />
      ) : (
        <Stat label="Missions publiées" value="Indisponible" sub="Lecture impossible pour le moment" />
      )}
    </StatGroup>
  )
}

function NextInQueue({ model }) {
  const items = nextItems(model.queue, LIST_LIMIT)
  if (items.length === 0) return null
  return (
    <ItemList
      title="Ensuite dans la file"
      count={items.length}
      more={{ href: adminVerificationsHref(), label: "Voir toute la file" }}
    >
      {items.map((item) => {
        const text = describeItem(item, model.now)
        return (
          <Item
            key={item.key}
            icon={text.icon}
            title={text.rowTitle}
            subtitle={text.text}
            meta={text.meta || undefined}
            action={{ href: itemHref(item), label: text.rowAction }}
          />
        )
      })}
    </ItemList>
  )
}

function Recent({ recent, now }) {
  if (!recent?.ok || recent.users.length === 0) return null
  return (
    <ItemList title="Derniers inscrits" count={recent.users.length} more={{ href: adminUsersHref(), label: "Voir les utilisateurs" }}>
      {recent.users.map((user) => (
        <Item
          key={user.userId}
          icon="i-user"
          title={user.name || "Compte sans nom"}
          subtitle={roleLabel(user.role)}
          meta={ageLabel(now, user.createdAt) || undefined}
          action={{ href: adminUserHref(user.userId), label: "Voir" }}
        />
      ))}
    </ItemList>
  )
}

/**
 * Tableau de bord admin (AD01) : la file à traiter d'abord (alertes d'argent, puis dossiers par ancienneté), une
 * seule carte colorée (argent de la plateforme), les missions de la semaine. Vue pure : le serveur fournit `now`.
 * `data` est la réponse de `getAdminDashboard` ; `error` vaut son message quand la lecture a échoué.
 */
export function AdminDashboardView({ data, error, firstName }) {
  const greeting = firstName ? `Bonjour, ${firstName}` : "Bonjour"
  if (error || !data) {
    return (
      <div className="a2-01">
        <PageHead title={greeting} />
        <ErrorState titleAs="h2" title="Le tableau de bord n'a pas pu être chargé" text={error || undefined} />
      </div>
    )
  }

  const model = buildDashboardModel(data)
  const quiet = model.queueComplete && model.queue.length === 0
  return (
    <div className="a2-01">
      <PageHead date={dateLabel(data.today)} title={greeting} />
      {model.failed.length > 0 ? (
        <ErrorState
          compact
          title="Une partie des données n'a pas pu être chargée"
          text="Les chiffres affichés peuvent être incomplets. Aucune décision n'a été perdue."
        />
      ) : null}
      <Hero model={model} />
      <div className="a2-01-cols">
        <Money data={data} />
        <div className="a2-01-side">
          <Missions missions={data.missions} />
        </div>
      </div>
      {quiet ? <Recent recent={data.recent} now={model.now} /> : <NextInQueue model={model} />}
    </div>
  )
}

export default AdminDashboardView
