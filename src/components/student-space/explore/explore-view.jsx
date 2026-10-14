// @ds-screen RD-STUDENT-01
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { PageHead } from "@/components/app-ui/page-head"
import { ChipFilter } from "@/components/app-ui/chip-filter"
import { EmptyState } from "@/components/app-ui/empty-state"
import { ErrorState } from "@/components/app-ui/state-block"
import { BUDGET_RANGES, COMMISSION_RATE, MISSION_TYPE_OPTIONS, SEARCH_MAX_LENGTH, URGENCY_FILTERS } from "@/lib/constants/missions"
import { studentMissionsHref } from "@/lib/app/student-routes"
import { MissionCard } from "./mission-card"
import { FiltersColumn, FiltersSheet, SortControl } from "./filters-sheet"

const PAGE_WINDOW = 5
const NBSP = " "
const plural = (n, one, many) => `${n}${NBSP}${n > 1 ? many : one}`

// Part nette de l'étudiant, en pour cent du budget du client (dérivée de la commission, jamais en dur).
const NET_PERCENT = Math.round((1 - COMMISSION_RATE) * 100)

// Note de vérification : seulement quand l'étudiant ne peut pas encore postuler (carte jamais envoyée, refusée ou
// badge expiré). Les missions restent consultables.
const VERIFICATION_NOTES = {
  not_submitted: {
    title: "Envoie ta carte pour postuler",
    text: "Tu peux consulter toutes les missions. Pour postuler, ta carte étudiante doit d'abord être envoyée.",
    blanc: false,
  },
  rejected: {
    title: "Renvoie ta carte pour postuler",
    text: "Ta carte a été refusée. Tu peux toujours consulter les missions : envoie-en une nouvelle pour postuler.",
    blanc: true,
  },
  expired: {
    title: "Renouvelle ton badge pour postuler",
    text: "Ton badge a pris fin. Tu peux toujours consulter les missions.",
    blanc: true,
  },
}

function VerificationNote({ verification }) {
  if (!verification || verification.canApply) return null
  const note = VERIFICATION_NOTES[verification.key]
  if (!note) return null
  return (
    <div className={`e2-note${note.blanc ? " e2-note--blanc" : ""}`} role="note">
      <Icon name={verification.key === "not_submitted" ? "i-id-card" : "i-history"} />
      <div className="e2-note__body">
        <div className="e2-note__title">
          {note.title}
          {note.blanc ? <span className="badge badge--erreur badge--sm">{verification.label}</span> : null}
        </div>
        <div className="e2-note__text">{note.text}</div>
        {verification.action ? (
          <div className="e2-note__actions">
            <Link className="e2-link" href={verification.action.href}>
              {verification.action.label}
              <Icon name="i-arrow-right" />
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function pageWindow(page, totalPages) {
  const size = Math.min(PAGE_WINDOW, totalPages)
  const start = Math.min(Math.max(1, page - Math.floor(size / 2)), totalPages - size + 1)
  return Array.from({ length: size }, (_, i) => start + i)
}

function Pagination({ filters, page, pageSize, total }) {
  if (total <= pageSize) return null
  const totalPages = Math.ceil(total / pageSize)
  const href = (p) => studentMissionsHref({ ...filters, page: p })
  const first = (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)
  const nav = (p, icon, label) =>
    p >= 1 && p <= totalPages ? (
      <Link className="page-btn page-btn--nav" href={href(p)} aria-label={label}>
        <Icon name={icon} />
      </Link>
    ) : (
      <span className="page-btn page-btn--nav is-disabled" aria-label={label}>
        <Icon name={icon} />
      </span>
    )
  return (
    <nav className="pagination" aria-label="Pagination">
      <span className="pagination__info">{`${first} à ${last} sur ${total}`}</span>
      {nav(page - 1, "i-chevron-left", "Page précédente")}
      {pageWindow(page, totalPages).map((p) => (
        <Link
          key={p}
          className={p === page ? "page-btn is-active" : "page-btn"}
          href={href(p)}
          aria-current={p === page ? "page" : undefined}
          aria-label={`Page ${p}`}
        >
          {p}
        </Link>
      ))}
      {nav(page + 1, "i-chevron-right", "Page suivante")}
    </nav>
  )
}

// Filtres actifs (hors types, déjà visibles en pastilles) : chacun se retire par un lien.
function ActiveTags({ filters }) {
  const budget = BUDGET_RANGES.find((r) => r.id === filters.budget)
  const urgency = URGENCY_FILTERS.find((u) => u.id === filters.urgency)
  const tags = [
    filters.q && { key: "q", label: `« ${filters.q} »`, href: studentMissionsHref({ ...filters, q: "" }) },
    ...filters.cities.map((city) => ({
      key: `city-${city}`,
      label: city,
      href: studentMissionsHref({ ...filters, cities: filters.cities.filter((c) => c !== city) }),
    })),
    budget && { key: "budget", label: budget.label, href: studentMissionsHref({ ...filters, budget: "" }) },
    urgency && { key: "urgency", label: urgency.label, href: studentMissionsHref({ ...filters, urgency: "" }) },
  ].filter(Boolean)
  if (tags.length === 0) return null
  return (
    <div className="e2-02-tags">
      {tags.map((tag) => (
        <Link key={tag.key} className="e2-pill e2-02-tag" href={tag.href} aria-label={`Retirer le filtre ${tag.label}`}>
          {tag.label}
          <Icon name="i-x" />
        </Link>
      ))}
      <Link className="e2-link" href={studentMissionsHref({ type: filters.type, sort: filters.sort })}>
        Tout effacer
      </Link>
    </div>
  )
}

// Recherche du mobile (la barre du haut du bureau porte la même recherche, paramètre `q`) : formulaire GET,
// les autres choix de l'URL sont conservés en champs cachés.
function MobileSearch({ filters }) {
  const { q, ...rest } = filters
  const kept = { ...rest, cities: filters.cities.join(",") }
  return (
    <form role="search" method="get" action={studentMissionsHref()} className="ds-mob-only">
      {["type", "cities", "urgency", "budget", "sort"].map((name) =>
        kept[name] ? <input key={name} type="hidden" name={name} value={kept[name]} /> : null,
      )}
      <label className="search2 e2-02-msearch">
        <Icon name="i-search" />
        <input
          type="search"
          name="q"
          defaultValue={q}
          maxLength={SEARCH_MAX_LENGTH}
          placeholder="Rechercher une mission"
          aria-label="Rechercher une mission"
          autoComplete="off"
        />
      </label>
    </form>
  )
}

function Lead() {
  return (
    <p className="e2-lead">
      {`Le montant en gras est ce que tu touches : ${NET_PERCENT}${NBSP}% du budget du client. Les missions dont l'échéance est passée sont masquées.`}
    </p>
  )
}

function EmptyBlock({ filters, hasFilter }) {
  let content
  if (filters.page > 1) {
    // Au-delà du dernier résultat (filtres actifs ou non) : la page est vide, pas la recherche. Le lien garde les filtres.
    content = (
      <EmptyState
        icon="i-search"
        title="Cette page est vide"
        text="Il n'y a pas autant de missions."
        action={{ label: "Revenir à la première page", href: studentMissionsHref({ ...filters, page: 1 }) }}
      />
    )
  } else if (hasFilter) {
    content = (
      <EmptyState
        icon="i-search"
        title={filters.q ? `Aucune mission pour « ${filters.q} »` : "Aucune mission ne correspond"}
        text="Essaie un autre mot, une autre ville ou retire un filtre."
        action={{ label: "Effacer les filtres", href: studentMissionsHref() }}
      />
    )
  } else {
    content = (
      <EmptyState
        icon="i-briefcase"
        title="Aucune mission ouverte pour l'instant"
        text="Reviens un peu plus tard : les clients publient de nouvelles missions chaque jour."
      />
    )
  }
  return (
    <section className="e2-sec" aria-label="Aucun résultat">
      {content}
    </section>
  )
}

/** Squelette de la page, affiché par le <Suspense> de la page pendant la lecture des missions. */
export function StudentExploreSkeleton() {
  return (
    <>
      <PageHead title="Missions" />
      <div role="status" aria-busy="true" aria-live="polite">
        <span className="sr-only">Chargement en cours</span>
        <div className="e2-grid3" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skel e2-02-skel" />
          ))}
        </div>
      </div>
    </>
  )
}

/**
 * Explorer les missions (E02). `result` est la réponse de getStudentExplore : soit `{ error }`, soit la page de
 * missions avec les filtres lus dans l'URL. Composant pur, sans accès aux données.
 */
export function StudentExploreView({ result }) {
  if (!result || result.error) {
    return (
      <>
        <PageHead title="Missions" />
        <section className="e2-sec" aria-label="Erreur">
          <ErrorState
            title="Impossible de charger les missions"
            text="La liste n'a pas pu être récupérée. Vérifie ta connexion : tes filtres sont conservés."
          />
        </section>
      </>
    )
  }

  const { filters, hasFilter, total, pageSize, verification, missions } = result
  const countText = hasFilter
    ? `${plural(total, "mission", "missions")}${filters.q ? ` pour « ${filters.q} »` : ""}`
    : plural(total, "mission ouverte", "missions ouvertes")
  const activeType = filters.type
  const typeOptions = [{ value: "", label: "Toutes" }, ...MISSION_TYPE_OPTIONS].map((option) => ({
    ...option,
    href: studentMissionsHref({ ...filters, type: option.value }),
  }))

  return (
    <>
      <div>
        <PageHead date={countText} title="Missions" />
        <Lead />
      </div>
      <VerificationNote verification={verification} />
      <MobileSearch filters={filters} />
      <ChipFilter label="Types de mission" options={typeOptions} value={activeType} />
      <div className="e2-cols e2-02-cols">
        <FiltersColumn current={filters} />
        <div className="e2-stack">
          <div className="e2-02-bar">
            <div className="e2-02-bar__left ds-mob-only">
              <FiltersSheet current={filters} />
            </div>
            <SortControl current={filters} />
          </div>
          <ActiveTags filters={filters} />
          {missions.length === 0 ? (
            <EmptyBlock filters={filters} hasFilter={hasFilter} />
          ) : (
            <>
              <div className="e2-grid3 e2-02-grid">
                {missions.map((mission) => (
                  <MissionCard key={mission.id} mission={mission} />
                ))}
              </div>
              <Pagination filters={filters} page={filters.page} pageSize={pageSize} total={total} />
            </>
          )}
        </div>
      </div>
    </>
  )
}

export default StudentExploreView
