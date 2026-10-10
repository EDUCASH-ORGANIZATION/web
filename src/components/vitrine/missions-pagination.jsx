import { PaginationLink } from "./pagination-link"
import { Icon } from "@/components/design/icon"

const WINDOW = 5

function pageWindow(page, totalPages) {
  const size = Math.min(WINDOW, totalPages)
  const start = Math.min(Math.max(1, page - Math.floor(size / 2)), totalPages - size + 1)
  return Array.from({ length: size }, (_, i) => start + i)
}

// Pagination de la liste des missions (maquette V02). Composant serveur :
// les boutons sont des liens qui conservent les autres filtres.
export function MissionsPagination({ page, pageSize, total, params = {} }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  if (total <= pageSize) return null

  const href = (p) => {
    const sp = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => { if (v) sp.set(k, v) })
    if (p > 1) sp.set("page", String(p))
    const qs = sp.toString()
    return qs ? `/missions?${qs}` : "/missions"
  }

  const first = (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)

  return (
    <nav className="pagination" aria-label="Pagination">
      <span className="pagination__info">Missions {first} à {last} sur {total}</span>
      {page > 1 ? (
        <PaginationLink className="page-btn page-btn--nav" href={href(page - 1)} aria-label="Précédente">
          <Icon name="i-chevron-left" className="ic" />
        </PaginationLink>
      ) : (
        <span className="page-btn page-btn--nav is-disabled" aria-label="Précédente">
          <Icon name="i-chevron-left" className="ic" />
        </span>
      )}
      {pageWindow(page, totalPages).map((p) => (
        <PaginationLink
          key={p}
          className={p === page ? "page-btn is-active" : "page-btn"}
          href={href(p)}
          aria-current={p === page ? "page" : undefined}
          aria-label={`Page ${p}`}
        >
          {p}
        </PaginationLink>
      ))}
      {page < totalPages ? (
        <PaginationLink className="page-btn page-btn--nav" href={href(page + 1)} aria-label="Suivante">
          <Icon name="i-chevron-right" className="ic" />
        </PaginationLink>
      ) : (
        <span className="page-btn page-btn--nav is-disabled" aria-label="Suivante">
          <Icon name="i-chevron-right" className="ic" />
        </span>
      )}
    </nav>
  )
}
