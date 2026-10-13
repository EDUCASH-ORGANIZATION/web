import Link from "next/link"
import { Fragment, isValidElement } from "react"
import { Icon } from "@/components/design/icon"
import { splitAmount } from "./amount"

/**
 * Bloc de décision de l'accueil : à gauche le chiffre clé, à droite la décision à prendre en premier.
 * - `figure` : nombre ou texte ; `figureAmount` : montant en FCFA (prioritaire).
 * - `metaLines` : [{ count, text }] sous le chiffre.
 * - `flag` : { label, icon, due } ; l'étiquette citron (`flag2`) n'apparaît que si `due` est vrai (par défaut),
 *   sinon version neutre. Sans `flag`, rien.
 * - `action` : { label, href, icon } (bouton encre) ou un élément React prêt ; `secondary` : { label, href } lien.
 */
export function HeroDecision({ ariaLabel, label, figure, figureAmount, metaLines = [], flag, title, text, action, secondary }) {
  const money = figureAmount === undefined || figureAmount === null ? null : splitAmount(figureAmount)
  return (
    <section className="hero2" aria-label={ariaLabel ?? label}>
      <div className="hero2__col">
        <span className="hero2__label">{label}</span>
        <div className="hero2__figure">
          {money ? (
            <>
              {money.text}
              <small>{money.unit}</small>
            </>
          ) : (
            figure
          )}
        </div>
        {metaLines.length > 0 ? (
          <p className="hero2__meta">
            {metaLines.map((line, i) => (
              <Fragment key={line.text}>
                {i > 0 ? <br /> : null}
                <b>{line.count}</b> {line.text}
              </Fragment>
            ))}
          </p>
        ) : null}
      </div>
      <div className="hero2__col">
        {flag ? (
          <span className={flag.due === false ? "flag2 flag2--neutre" : "flag2"}>
            {flag.icon ? <Icon name={flag.icon} /> : null}
            {flag.label}
          </span>
        ) : null}
        {title ? <h2 className="hero2__title">{title}</h2> : null}
        {text ? <p className="hero2__text">{text}</p> : null}
        {action || secondary ? (
          <div className="hero2__actions">
            {isValidElement(action) ? (
              action
            ) : action ? (
              <Link className="btn btn--dark" href={action.href}>
                {action.icon ? <Icon name={action.icon} /> : null}
                {action.label}
              </Link>
            ) : null}
            {secondary ? (
              <Link className="hero2__link" href={secondary.href}>
                {secondary.label}
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}

export default HeroDecision
