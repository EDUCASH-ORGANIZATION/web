// @ds-screen RD-ADMIN-01
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { TabsNav } from "@/components/app-ui/tabs-nav"
import { SectionCard } from "@/components/app-ui/section-card"
import { StatGroup, Stat } from "@/components/app-ui/stats"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { EmptyState } from "@/components/app-ui/empty-state"
import { ErrorState } from "@/components/app-ui/state-block"
import { Lines } from "@/components/app-ui/lines"
import { adminMissionHref, adminUserHref, adminUsersHref, adminVerificationsHref } from "@/lib/app/admin-routes"
import { formatAmount, formatDateFr } from "@/lib/app/format"
import { missionStatusView } from "@/lib/app/mission-status"
import { missionTypeLabel } from "@/lib/constants/missions"
import { roleLabel, transactionTypeLabel } from "@/lib/admin-space/labels"
import { AccountActions } from "./account-actions"
import { isClosedEmail } from "@/lib/account-closure/closure-rules"

const RECENT_MISSIONS = 5

/** Note affichée : « 4,9 / 5 » ou une mention neutre quand l'étudiant n'a pas encore d'avis. */
export function ratingText(rating) {
  const value = Number(rating)
  if (!Number.isFinite(value) || value <= 0) return "Pas encore de note"
  return `${value.toFixed(1).replace(".", ",")} / 5`
}

/** Statut du compte : le cycle de fermeture prime sur la suspension (un compte fermé est aussi suspendu). */
function stateLabel(user) {
  if (user.closure === "closed") return "Fermé"
  if (user.closure === "pseudonymizing" || user.closure === "pseudonymized") return "Clôturé"
  return user.isSuspended ? "Suspendu" : "Actif"
}

/** Sous-titre de la fiche : rôle, vérification, statut, niveau, établissement, ville. */
export function subtitleParts(data) {
  const { user, verification } = data
  return [
    roleLabel(user.role),
    verification?.label,
    stateLabel(user),
    [user.level, user.school].filter(Boolean).join(" · "),
    user.city,
  ].filter(Boolean)
}

const DEFERRED_LABELS = {
  REPORT_OPEN: "signalement ouvert",
  WALLET_NOT_EMPTY: "portefeuille non vide",
  PURCHASE_OPEN: "demande d'achat ouverte",
  TRANSACTION_PENDING: "transaction en attente",
  READ_ERROR: "vérifications impossibles",
}

const ERASED_EMAIL = "Adresse effacée (compte clôturé)"

const EVENT_LABELS = { closed: "Fermeture", reopened: "Réactivation", pseudonymized: "Pseudonymisation" }
const ACTOR_LABELS = { admin: "Administrateur", self: "Titulaire du compte", system: "Automatique" }

function ClosureNote({ closure }) {
  if (closure.state === "pseudonymized") {
    return (
      <div className="a2-note a2-note--erreur">
        <Icon name="i-lock" className="ic" />
        <span>
          Compte clôturé{closure.pseudonymizedAt ? ` le ${formatDateFr(closure.pseudonymizedAt)}` : ""} : réactivation impossible, les données
          personnelles ont été effacées.
        </span>
      </div>
    )
  }
  if (closure.state === "pseudonymizing") {
    return (
      <div className="a2-note a2-note--erreur">
        <Icon name="i-lock" className="ic" />
        <span>Effacement des données personnelles en cours : réactivation impossible.</span>
      </div>
    )
  }
  const deferred = (closure.deferred ?? []).map((code) => DEFERRED_LABELS[code] ?? DEFERRED_LABELS.READ_ERROR)
  return (
    <div className="a2-note">
      <Icon name="i-ban" className="ic" />
      <span>
        {closure.closedAt ? `Fermé le ${formatDateFr(closure.closedAt)}` : "Compte fermé"}
        {closure.dueAt ? ` - pseudonymisation prévue le ${formatDateFr(closure.dueAt)}` : ""}.
        {deferred.length > 0 ? ` Pseudonymisation reportée : ${[...new Set(deferred)].join(", ")}.` : ""}
      </span>
    </div>
  )
}

function ClosureBlockers({ blockers }) {
  return (
    <div className="a2-note" id="closure-blockers">
      <Icon name="i-info" className="ic" />
      <div>
        Fermeture impossible pour le moment :
        <ul>
          {blockers.map((b) => (
            <li key={b.code}>{b.message}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function Notes({ user, closure }) {
  const state = closure?.state ?? "active"
  if (state !== "active" && !user.isSelf && user.role !== "admin") return <ClosureNote closure={closure} />
  if (user.isSelf) {
    return (
      <div className="a2-note">
        <Icon name="i-info" className="ic" />
        <span>Il s&apos;agit de votre compte. Vous ne pouvez pas le suspendre.</span>
      </div>
    )
  }
  if (user.role === "admin") {
    return (
      <div className="a2-note">
        <Icon name="i-info" className="ic" />
        <span>Le statut d&apos;un compte administrateur ne peut pas être modifié depuis cet écran.</span>
      </div>
    )
  }
  if (user.isSuspended) {
    return (
      <div className="stack stack--3">
        <div className="a2-note">
          <Icon name="i-ban" className="ic" />
          <span>Ce compte est suspendu : il ne peut pas se connecter. Les missions et l&apos;argent en séquestre restent en l&apos;état.</span>
        </div>
        {(closure?.blockers ?? []).length > 0 ? <ClosureBlockers blockers={closure.blockers} /> : null}
      </div>
    )
  }
  return (closure?.blockers ?? []).length > 0 ? <ClosureBlockers blockers={closure.blockers} /> : null
}

function History({ closure }) {
  if (closure.history === null) {
    return <EmptyState compact icon="i-inbox" title="L'historique de fermeture n'a pas pu être chargé." />
  }
  return (
    <SectionCard title="Historique de fermeture" count={closure.history.length} flush>
      <div className="ds-table-wrap">
        <table className="ds-table a2-tlist" aria-label="Historique de fermeture du compte">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Événement</th>
              <th scope="col">Acteur</th>
            </tr>
          </thead>
          <tbody>
            {closure.history.map((e) => (
              <tr key={`${e.event}-${e.createdAt}`}>
                <td data-label="Date">{e.createdAt ? formatDateFr(e.createdAt) : "-"}</td>
                <td data-label="Événement">{EVENT_LABELS[e.event] ?? "Événement"}</td>
                <td data-label="Acteur">{ACTOR_LABELS[e.actorKind] ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  )
}

function Indicators({ data }) {
  const { user, wallet, missions } = data
  if (user.role === "admin") return null
  if (user.role === "student") {
    return (
      <StatGroup label="Indicateurs du compte">
        <Stat label="Missions terminées" value={user.missionsDone} />
        <Stat label="Note" value={ratingText(user.rating)} />
        <Stat label="Disponible" amount={wallet?.balance ?? 0} />
      </StatGroup>
    )
  }
  return (
    <StatGroup label="Indicateurs du compte">
      <Stat label="Missions publiées" value={missions.count} />
      <Stat label="Disponible" amount={wallet?.balance ?? 0} />
      <Stat label="En séquestre" amount={wallet?.reserved ?? 0} />
    </StatGroup>
  )
}

function MissionsTable({ missions, today, limit }) {
  const rows = limit ? missions.rows.slice(0, limit) : missions.rows
  if (rows.length === 0) {
    return (
      <EmptyState
        compact
        icon="i-briefcase"
        title={missions.role === "client" ? "Aucune mission publiée." : "Aucune mission retenue."}
      />
    )
  }
  return (
    <div className="ds-table-wrap">
      <table className="ds-table a2-tlist" aria-label="Missions du compte">
        <thead>
          <tr>
            <th scope="col">Mission</th>
            <th scope="col">Type</th>
            <th scope="col">Statut</th>
            <th scope="col">Budget</th>
            <th scope="col">Ville</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => {
            const status = missionStatusView(m, today)
            return (
              <tr key={m.id}>
                <td data-label="Mission">
                  <Link className="a2-04-link" href={adminMissionHref(m.id)}>
                    {m.title || "Mission sans titre"}
                  </Link>
                </td>
                <td data-label="Type">{missionTypeLabel(m.type)}</td>
                <td data-label="Statut">
                  <StatusBadge label={status.label} tone={status.tone} />
                </td>
                <td data-label="Budget">{formatAmount(m.budget)}</td>
                <td data-label="Ville">{m.city || "-"}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Overview({ data }) {
  const { user, missions, today } = data
  return (
    <div className="stack stack--5">
      <SectionCard title="Coordonnées">
        <dl className="a2-kv">
          <dt>E-mail</dt>
          <dd>{isClosedEmail(user.email) ? ERASED_EMAIL : user.email || "Non renseigné"}</dd>
          <dt>Téléphone</dt>
          <dd>{user.phone || "Non renseigné"}</dd>
          <dt>Ville</dt>
          <dd>{user.city || "Non renseignée"}</dd>
          {user.role === "student" ? (
            <>
              <dt>Établissement</dt>
              <dd>{user.school || "Non renseigné"}</dd>
              <dt>Niveau</dt>
              <dd>{user.level || "Non renseigné"}</dd>
            </>
          ) : null}
          <dt>Inscription</dt>
          <dd>{user.createdAt ? formatDateFr(user.createdAt) : "Non renseignée"}</dd>
        </dl>
      </SectionCard>
      {data.closure?.history?.length > 0 || data.closure?.history === null ? <History closure={data.closure} /> : null}
      {user.role !== "admin" ? (
        <SectionCard
          title={user.role === "client" ? "Missions récentes" : "Missions retenues"}
          count={missions.count}
          more={missions.count > RECENT_MISSIONS ? { href: adminUserHref(user.userId, { onglet: "missions" }), label: "Toutes les missions" } : undefined}
          flush
        >
          <MissionsTable missions={missions} today={today} limit={RECENT_MISSIONS} />
        </SectionCard>
      ) : null}
    </div>
  )
}

function Verification({ data }) {
  const { user, verification } = data
  return (
    <SectionCard title="Vérification de la carte étudiante">
      <div className="stack stack--3">
        <dl className="a2-kv">
          <dt>État</dt>
          <dd>{verification.label}</dd>
          <dt>Carte envoyée</dt>
          <dd>{verification.hasCard ? "Oui" : "Non"}</dd>
          {verification.submittedAt ? (
            <>
              <dt>Envoyée le</dt>
              <dd>{formatDateFr(verification.submittedAt)}</dd>
            </>
          ) : null}
          {verification.verifiedUntil ? (
            <>
              <dt>Badge jusqu&apos;au</dt>
              <dd>{formatDateFr(verification.verifiedUntil)}</dd>
            </>
          ) : null}
        </dl>
        {verification.rejectionReason ? (
          <div className="a2-note a2-note--erreur">
            <Icon name="i-alert-circle" className="ic" />
            <span>
              <b>Motif du refus.</b> {verification.rejectionReason}
            </span>
          </div>
        ) : null}
        <Link className="link body-s" href={adminVerificationsHref({ onglet: verification.tab, id: user.userId })}>
          Ouvrir le dossier de vérification
        </Link>
      </div>
    </SectionCard>
  )
}

function Wallet({ data }) {
  const { wallet } = data
  if (!wallet || wallet.balance === null) {
    return <EmptyState compact icon="i-wallet" title="Aucun portefeuille pour ce compte." />
  }
  return (
    <div className="stack stack--5">
      <SectionCard title="Portefeuille">
        <Lines
          rows={[
            { label: "Disponible", value: wallet.balance },
            { label: "En séquestre", value: wallet.reserved },
          ]}
        />
      </SectionCard>
      <SectionCard title="Derniers mouvements" count={wallet.transactions.length} flush>
        {wallet.transactions.length === 0 ? (
          <EmptyState compact icon="i-inbox" title="Aucun mouvement pour le moment." />
        ) : (
          <div className="ds-table-wrap">
            <table className="ds-table a2-tlist" aria-label="Derniers mouvements du portefeuille">
              <thead>
                <tr>
                  <th scope="col">Mouvement</th>
                  <th scope="col">Date</th>
                  <th scope="col">Montant</th>
                </tr>
              </thead>
              <tbody>
                {wallet.transactions.map((t) => (
                  <tr key={t.id}>
                    <td data-label="Mouvement">{transactionTypeLabel(t.type)}</td>
                    <td data-label="Date">{t.createdAt ? formatDateFr(t.createdAt) : "-"}</td>
                    <td data-label="Montant">{formatAmount(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
      <p className="caption">Lecture seule. Aucune action d&apos;argent n&apos;est possible depuis cet écran.</p>
    </div>
  )
}

function tabsFor(data) {
  const { user, missions } = data
  const href = (onglet) => adminUserHref(user.userId, { onglet })
  const tabs = [{ key: "apercu", label: "Aperçu", href: href("apercu") }]
  if (user.role === "student") tabs.push({ key: "verification", label: "Vérification", href: href("verification") })
  if (user.role !== "admin") {
    tabs.push({ key: "missions", label: "Missions", href: href("missions"), count: missions.count })
    tabs.push({ key: "portefeuille", label: "Portefeuille", href: href("portefeuille") })
  }
  return tabs
}

/**
 * Fiche d'un compte (AD04). Vue pure : `data` est la réponse de `getAdminUserDetail`. Aucune action pour un compte
 * administrateur ni pour le compte connecté ; « Suspendre » ou « Réactiver » pour les autres.
 */
export function UserDetailView({ data, error }) {
  if (error || !data) {
    return (
      <div className="a2-04">
        <Link className="head2__back" href={adminUsersHref()}>
          <Icon name="i-arrow-left" className="ic" />
          Utilisateurs
        </Link>
        <ErrorState titleAs="h1" title="La fiche n'a pas pu être chargée" text={error || undefined} />
      </div>
    )
  }
  const { user, onglet } = data
  const tabs = tabsFor(data)
  const active = tabs.some((t) => t.key === onglet) ? onglet : "apercu"
  const canAct = user.role !== "admin" && !user.isSelf && !["pseudonymizing", "pseudonymized"].includes(user.closure)
  const name = user.name || "Profil incomplet"

  return (
    <div className="a2-04">
      <Link className="head2__back" href={adminUsersHref()}>
        <Icon name="i-arrow-left" className="ic" />
        Utilisateurs
      </Link>
      <div className="a2-04-head">
        <div className="a2-04-id">
          <div>
            <h1 className="head2__title">{name}</h1>
            <p className="head2__sub">{subtitleParts(data).join(" · ")}</p>
          </div>
        </div>
        {canAct ? (
          <div className="head2__actions">
            <AccountActions userId={user.userId} name={name} isSuspended={user.isSuspended} closure={data.closure} />
          </div>
        ) : null}
      </div>
      <Notes user={user} closure={data.closure} />
      <Indicators data={data} />
      <TabsNav label="Onglets de la fiche" items={tabs} activeKey={active} />
      {active === "apercu" ? <Overview data={data} /> : null}
      {active === "verification" && data.verification ? <Verification data={data} /> : null}
      {active === "missions" ? (
        <SectionCard title="Missions" count={data.missions.count} flush>
          <MissionsTable missions={data.missions} today={data.today} />
        </SectionCard>
      ) : null}
      {active === "portefeuille" ? <Wallet data={data} /> : null}
    </div>
  )
}

export default UserDetailView
