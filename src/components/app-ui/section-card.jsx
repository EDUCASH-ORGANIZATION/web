import Link from "next/link"
import { useId } from "react"

// Carte blanche : titre h2 (avec compteur et lien optionnels), puis le contenu. `flush` retire le padding (listes).
export function SectionCard({ title, count, more, flush = false, children }) {
  const id = useId()
  return (
    <section className={flush ? "card2 card2--flush" : "card2"} aria-labelledby={title ? id : undefined}>
      {title ? (
        <div className="sec2">
          <h2 className="sec2__title" id={id}>
            {title}
            {count !== undefined && count !== null ? <span>{count}</span> : null}
          </h2>
          {more ? (
            <Link className="sec2__more" href={more.href}>
              {more.label}
            </Link>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}

export default SectionCard
