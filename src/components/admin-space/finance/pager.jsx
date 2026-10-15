// @ds-screen RD-ADMIN-01
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { totalPages } from "@/lib/admin-space/finance"

const WINDOW = 5

function pageWindow(page, pages) {
  const size = Math.min(WINDOW, pages)
  const start = Math.min(Math.max(1, page - Math.floor(size / 2)), pages - size + 1)
  return Array.from({ length: size }, (_, i) => start + i)
}

/**
 * Pagination numérotée en liens. `hrefFor(page)` fabrique l'URL (filtres conservés). Rien n'est rendu quand tout
 * tient sur une page.
 */
export function Pager({ page, pageSize, total, hrefFor, label = "Pagination" }) {
  if (!(total > pageSize)) return null
  const pages = totalPages(total, pageSize)
  const first = (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)
  const step = (target, icon, text) =>
    target >= 1 && target <= pages ? (
      <Link className="page-btn page-btn--nav" href={hrefFor(target)} aria-label={text}>
        <Icon name={icon} />
      </Link>
    ) : (
      <span className="page-btn page-btn--nav is-disabled" aria-label={text}>
        <Icon name={icon} />
      </span>
    )
  return (
    <nav className="pagination" aria-label={label}>
      <span className="pagination__info">{`${first} à ${last} sur ${total}`}</span>
      {step(page - 1, "i-chevron-left", "Page précédente")}
      {pageWindow(page, pages).map((p) => (
        <Link
          key={p}
          className={p === page ? "page-btn is-active" : "page-btn"}
          href={hrefFor(p)}
          aria-current={p === page ? "page" : undefined}
          aria-label={`Page ${p}`}
        >
          {p}
        </Link>
      ))}
      {step(page + 1, "i-chevron-right", "Page suivante")}
    </nav>
  )
}

export default Pager
