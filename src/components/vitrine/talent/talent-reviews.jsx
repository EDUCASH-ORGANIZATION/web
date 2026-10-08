import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { firstName } from "@/lib/vitrine/public-name"
import { formatDateFr } from "@/lib/vitrine/format"

export const REVIEWS_PAGE_SIZE = 5

function Stars({ value }) {
  return (
    <span className="stars" role="img" aria-label={`${value} sur 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Icon key={i} name="i-star" className={i < value ? "ic is-on" : "ic"} />
      ))}
    </span>
  )
}

function Pagination({ talentId, page, total }) {
  const totalPages = Math.ceil(total / REVIEWS_PAGE_SIZE)
  if (totalPages <= 1) return null
  const href = (p) => (p > 1 ? `/talents/${talentId}?avis=${p}` : `/talents/${talentId}`)
  const first = (page - 1) * REVIEWS_PAGE_SIZE + 1
  const last = Math.min(page * REVIEWS_PAGE_SIZE, total)
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)

  return (
    <nav className="pagination ds-mt-2" aria-label="Pagination des avis">
      <span className="pagination__info">Avis {first} à {last} sur {total}</span>
      {page > 1 ? (
        <Link className="page-btn page-btn--nav" href={href(page - 1)} aria-label="Page précédente">
          <Icon name="i-chevron-left" />
        </Link>
      ) : (
        <span className="page-btn page-btn--nav is-disabled" aria-label="Page précédente">
          <Icon name="i-chevron-left" />
        </span>
      )}
      {pages.map((p) => (
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
      {page < totalPages ? (
        <Link className="page-btn page-btn--nav" href={href(page + 1)} aria-label="Page suivante">
          <Icon name="i-chevron-right" />
        </Link>
      ) : (
        <span className="page-btn page-btn--nav is-disabled" aria-label="Page suivante">
          <Icon name="i-chevron-right" />
        </span>
      )}
    </nav>
  )
}

// Avis reçus, paginés par ?avis=N. L'auteur n'est montré que par son prénom.
export function TalentReviews({ talentId, reviews, total, page, ratingLabel }) {
  return (
    <div className="card" id="avis">
      <div className="card__head">
        <h2 className="card__title">Avis reçus</h2>
        {ratingLabel ? (
          <span className="rating">{ratingLabel.value} <small>{ratingLabel.detail}</small></span>
        ) : null}
      </div>
      {reviews.length === 0 ? (
        <p className="ds-text-brume">Aucun avis pour le moment. Les avis apparaissent après chaque mission terminée.</p>
      ) : (
        <div className="stack stack--3">
          {reviews.map((review) => {
            const author = firstName(review.reviewer?.full_name)
            return (
              <div key={review.id} className="v04-review">
                <div className="row row--between">
                  <span className="row ds-gap-3">
                    <span className="avatar avatar--sm avatar--lavande" aria-hidden="true">
                      {author.charAt(0).toLocaleUpperCase("fr-FR")}
                    </span>
                    <span>
                      <b className="body-s">{author}</b>
                      <span className="caption muted">{formatDateFr(review.created_at)}</span>
                    </span>
                  </span>
                  <Stars value={review.rating} />
                </div>
                {review.comment ? <p>{review.comment}</p> : null}
              </div>
            )
          })}
        </div>
      )}
      <Pagination talentId={talentId} page={page} total={total} />
    </div>
  )
}
