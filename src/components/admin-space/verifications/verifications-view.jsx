// @ds-screen RD-ADMIN-01
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { Select } from "@/components/design/select"
import { TabsNav } from "@/components/app-ui/tabs-nav"
import { EmptyState } from "@/components/app-ui/empty-state"
import { ErrorState } from "@/components/app-ui/state-block"
import { adminVerificationsHref } from "@/lib/app/admin-routes"
import { DEFAULT_VERIFICATION_TAB, VERIFICATION_TABS, badgeUntil } from "@/lib/admin-space/verification-queue"
import { QueueList } from "./queue-list"
import { DossierPanel } from "./dossier-panel"

const TAB_LABELS = {
  "a-examiner": "À examiner",
  incomplets: "Incomplets",
  refuses: "Refusés",
  verifies: "Vérifiés",
  expires: "Expirés",
}

const plural = (n, one, many) => (n > 1 ? many : one)

/** Sous-titre : nombre de dossiers à examiner et ancienneté du plus ancien (repère interne à l'administration). */
export function queueSubtitle(pending, oldestAgeDays) {
  if (pending === 0) return { strong: "Aucun dossier à examiner", rest: "" }
  const strong = `${pending} ${plural(pending, "dossier", "dossiers")} à examiner`
  if (oldestAgeDays === null || oldestAgeDays === undefined) return { strong, rest: "" }
  const since = oldestAgeDays === 0 ? "aujourd'hui" : `${oldestAgeDays} ${plural(oldestAgeDays, "jour", "jours")}`
  return { strong, rest: oldestAgeDays === 0 ? "le plus ancien attend depuis aujourd'hui" : `le plus ancien attend depuis ${since}` }
}

function Header({ data }) {
  const sub = data ? queueSubtitle(data.counts["a-examiner"], data.oldestAgeDays) : null
  return (
    <div className="head2">
      <div>
        <h1 className="head2__title">Vérifications</h1>
        {sub ? (
          <p className="head2__sub">
            <b>{sub.strong}</b>
            {sub.rest ? ` · ${sub.rest}` : ""}
          </p>
        ) : null}
      </div>
    </div>
  )
}

const DELAY_OPTIONS = [
  { value: "", label: "Tous les délais" },
  { value: "plus-48h", label: "Plus de 48 h" },
  { value: "moins-48h", label: "Moins de 48 h" },
]

function Filters({ data }) {
  const { onglet, q, ecole, delai = "", schools, total } = data
  const known = ecole && !schools.includes(ecole) ? [...schools, ecole] : schools
  const options = [{ value: "", label: "Tous les établissements" }, ...known.map((school) => ({ value: school, label: school }))]
  return (
    <form className="a2-filters" method="get" action="/admin/verifications" role="search" aria-label="Rechercher un dossier">
      {onglet !== DEFAULT_VERIFICATION_TAB ? <input type="hidden" name="onglet" value={onglet} /> : null}
      <label className="search2">
        <Icon name="i-search" />
        <input type="search" name="q" defaultValue={q} placeholder="Nom de l'étudiant" aria-label="Rechercher un dossier" maxLength={80} />
      </label>
      {known.length > 0 ? (
        <Select
          variant="chip"
          name="ecole"
          icon="i-building"
          defaultValue={ecole}
          options={options}
          placeholder="Établissement"
          aria-label="Établissement"
        />
      ) : null}
      {onglet === DEFAULT_VERIFICATION_TAB ? (
        <Select
          variant="chip"
          name="delai"
          icon="i-clock"
          defaultValue={delai}
          options={DELAY_OPTIONS}
          placeholder="Délai"
          aria-label="Délai"
        />
      ) : null}
      <span className="a2-02-sort">
        <Icon name="i-sort" />
        Plus anciens d&apos;abord
      </span>
      <button type="submit" className="btn btn--secondary btn--sm">
        Rechercher
      </button>
      <span className="a2-filters__count">
        {total} {plural(total, "dossier", "dossiers")}
      </span>
    </form>
  )
}

function Empty({ data }) {
  const { onglet, q, ecole, delai, counts } = data
  if (q || ecole || delai) return <EmptyState compact icon="i-search" title="Aucun dossier ne correspond à cette recherche." />
  if (onglet !== "a-examiner") return <EmptyState compact title="Aucun dossier dans cet onglet." />
  const missing = counts.incomplets
  return (
    <EmptyState
      icon="i-check-circle"
      title="Aucun dossier à examiner."
      text={
        missing > 0
          ? `${missing} ${plural(missing, "étudiant n'a", "étudiants n'ont")} pas encore envoyé de carte.`
          : "Tous les dossiers sont à jour."
      }
      action={missing > 0 ? { href: adminVerificationsHref({ onglet: "incomplets" }), label: "Voir les incomplets" } : undefined}
    />
  )
}

/** En-tête de la liste : ordre fixe et plage affichée (« 1 à 4 sur 4 »). */
function ListHead({ data }) {
  const { rows, page, pageSize = 25, total } = data
  if (rows.length === 0) return null
  const first = (page - 1) * pageSize + 1
  return (
    <div className="a2-02-listhead">
      <span>Plus ancien en premier</span>
      <span>
        {first} à {first + rows.length - 1} sur {total}
      </span>
    </div>
  )
}

function Pager({ data }) {
  const { onglet, q, ecole, delai, page, pageCount } = data
  if (pageCount <= 1) return null
  const href = (target) => adminVerificationsHref({ onglet, q, ecole, delai, page: target })
  return (
    <nav className="row row--between" aria-label="Pagination des dossiers">
      {page > 1 ? (
        <Link className="btn btn--secondary btn--sm" href={href(page - 1)}>
          <Icon name="i-chevron-left" />
          Précédent
        </Link>
      ) : (
        <span />
      )}
      <span className="caption">
        Page {page} sur {pageCount}
      </span>
      {page < pageCount ? (
        <Link className="btn btn--secondary btn--sm" href={href(page + 1)}>
          Suivant
          <Icon name="i-chevron-right" />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  )
}

/** Dossier précédent et suivant dans la liste de la page, et destination après une décision. */
export function dossierNeighbors(data) {
  const { onglet, q, ecole, delai, page, rows, dossier } = data
  const link = (id) => adminVerificationsHref({ onglet, id, q, ecole, delai, page })
  const list = adminVerificationsHref({ onglet, q, ecole, delai, page })
  const index = dossier ? rows.findIndex((row) => row.userId === dossier.userId) : -1
  const prev = index > 0 ? link(rows[index - 1].userId) : null
  const next = index >= 0 && index < rows.length - 1 ? link(rows[index + 1].userId) : null
  return {
    position: index >= 0 ? { index, total: rows.length } : null,
    hrefs: { prev, next, afterDecision: next ?? prev ?? list, list },
  }
}

/**
 * File de vérification (AD02), maître et détail. Vue pure : le serveur fournit toutes les données.
 * `data` est la réponse de `getVerificationQueue` ; `error` vaut son message quand la lecture a échoué.
 */
export function VerificationsView({ data, error }) {
  if (error || !data) {
    return (
      <div className="a2-02">
        <Header data={null} />
        <ErrorState titleAs="h2" title="Les dossiers n'ont pas pu être chargés" text={error || undefined} />
      </div>
    )
  }

  const { onglet, q, ecole, delai, counts, rows, dossier, dossierNotFound } = data
  const open = Boolean(dossier) || dossierNotFound
  const { position, hrefs } = dossierNeighbors(data)
  const tabs = VERIFICATION_TABS.map((key) => ({
    key,
    label: TAB_LABELS[key],
    href: adminVerificationsHref({ onglet: key, q, ecole }),
    count: counts[key],
  }))

  return (
    <div className={open ? "a2-02 a2-02--open" : "a2-02"}>
      {open ? (
        <div className="a2-mtop">
          <Link className="iconbtn2" href={hrefs.list} aria-label="Retour à la liste des dossiers">
            <Icon name="i-arrow-left" />
          </Link>
          <span className="a2-mtop__title">{position ? `Dossier ${position.index + 1} sur ${position.total}` : "Dossier"}</span>
          <span className="a2-mtop__spacer" aria-hidden="true" />
        </div>
      ) : null}

      <div className="a2-02-head">
        <Header data={data} />
        <TabsNav label="Onglets de la file de vérification" items={tabs} activeKey={onglet} />
        <Filters data={data} />
      </div>

      <div className="ad-md">
        <div className="a2-02-master stack stack--3">
          {rows.length > 0 ? (
            <>
              <ListHead data={data} />
              <QueueList
                rows={rows}
                openId={dossier?.userId ?? null}
                onglet={onglet}
                q={q}
                ecole={ecole}
                delai={delai}
                page={data.page}
                today={data.today}
              />
            </>
          ) : (
            <Empty data={data} />
          )}
          <Pager data={data} />
          <div className="ad-kbds ds-desk-only" aria-label="Raccourcis clavier">
            <span>
              <span className="ad-kbd">↑</span>
              <span className="ad-kbd">↓</span>Dossier
            </span>
            <span>
              <span className="ad-kbd">V</span>Valider
            </span>
            <span>
              <span className="ad-kbd">R</span>Refuser
            </span>
          </div>
        </div>

        <div className="a2-02-detail">
          {dossier ? (
            <DossierPanel dossier={dossier} hrefs={hrefs} badgeUntil={badgeUntil(data.today)} />
          ) : dossierNotFound ? (
            <div className="a2-note a2-note--alerte" role="status">
              <Icon name="i-alert-triangle" className="ic" />
              <span>Ce dossier est introuvable. Il a peut-être été supprimé.</span>
            </div>
          ) : (
            <div className="ds-desk-only">
              <EmptyState compact icon="i-id-card" title="Choisissez un dossier dans la liste pour l'examiner." />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default VerificationsView
