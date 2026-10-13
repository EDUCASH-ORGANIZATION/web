import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { splitAmount } from "./amount"

const cx = (...parts) => parts.filter(Boolean).join(" ")

// Liste en carte : titre h2 optionnel avec compteur, lien « voir plus », puis les `Item`.
export function ItemList({ label, title, count, more, children }) {
  return (
    <section className="list2" aria-label={label ?? title}>
      {title || more ? (
        <div className="list2__head">
          {title ? (
            <h2 className="list2__title">
              {title}
              {count !== undefined && count !== null ? <span>{count}</span> : null}
            </h2>
          ) : (
            <span />
          )}
          {more ? (
            <Link className="list2__more" href={more.href}>
              {more.label}
            </Link>
          ) : null}
        </div>
      ) : null}
      <div role="list">{children}</div>
    </section>
  )
}

function ItemAction({ action, title }) {
  const name = typeof title === "string" ? `${action.label} : ${title}` : undefined
  return (
    <Link className="item2__action" href={action.href} aria-label={name}>
      {action.label}
    </Link>
  )
}

/**
 * Rangée : icône, titre, sous-titre, méta, montant et action lien.
 * - `variant="mission"` : rangée riche (ligne de badges `line`, montant `amount` avec mention `amountNote`, `actions`).
 * - `action` : { href, label } ; `actions` : liste de la même forme (variante mission).
 */
export function Item({ icon, title, subtitle, line, meta, amount, amountSign = "none", amountNote, action, actions, variant, muted = false }) {
  const money = amount === undefined || amount === null ? null : splitAmount(amount, amountSign)
  const links = actions ?? (action ? [action] : [])
  return (
    <div role="listitem" className={cx("item2", variant === "mission" && "item2--mission", muted && "item2--muted")}>
      {icon ? (
        <span className="item2__ic">
          <Icon name={icon} />
        </span>
      ) : null}
      <div>
        <div className="item2__title">{title}</div>
        {subtitle ? <div className="item2__sub">{subtitle}</div> : null}
        {line ? <div className="item2__line">{line}</div> : null}
      </div>
      {meta ? <span className="item2__meta">{meta}</span> : null}
      {money ? (
        <span className="item2__amount">
          {money.text}
          <small>{money.unit}</small>
          {amountNote ? <span>{amountNote}</span> : null}
        </span>
      ) : null}
      {variant === "mission" && links.length > 0 ? (
        <span className="item2__cell">
          {links.map((a) => (
            <ItemAction key={`${a.href}-${a.label}`} action={a} title={title} />
          ))}
        </span>
      ) : (
        links.map((a) => <ItemAction key={`${a.href}-${a.label}`} action={a} title={title} />)
      )}
    </div>
  )
}

export default ItemList
