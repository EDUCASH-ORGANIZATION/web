import Link from "next/link"
import { isValidElement } from "react"
import { Icon } from "@/components/design/icon"
import { splitAmount } from "./amount"
import { Stat } from "./stats"

// Bouton posé sur la carte bleue : blanc plein (principal) ou contour clair (secondaire).
// `action` est soit { label, href, icon }, soit un élément React prêt (ex. formulaire d'action serveur).
function MoneyAction({ action, secondary = false, small = true }) {
  if (!action) return null
  if (isValidElement(action)) return action
  const tone = secondary ? "btn--ghost-blanc" : "btn--blanc"
  return (
    <Link className={`btn ${tone}${small ? " btn--sm" : ""}`} href={action.href}>
      {action.icon ? <Icon name={action.icon} /> : null}
      {action.label}
    </Link>
  )
}

// Garde le separateur " · " collé au mot qui le suit : sur 320 px il ne reste jamais seul en fin de ligne.
function TitleText({ text }) {
  const at = text.indexOf(" · ")
  if (at < 0) return text
  const rest = text.slice(at + 3)
  const cut = rest.search(/\s/)
  const glued = cut < 0 ? rest : rest.slice(0, cut)
  return (
    <>
      {text.slice(0, at)}{" "}
      <span className="money2__glue">{"· " + glued}</span>
      {cut < 0 ? "" : rest.slice(cut)}
    </>
  )
}

/**
 * Carte argent : la seule carte colorée de l'écran (bleu plein, texte blanc).
 * - Variante partagée : `available` et `escrow` (nombres) côte à côte.
 * - Variante simple : `amount` (nombre) avec libellé et mention.
 * `action` va dans l'en-tête, ou en pied avec `actionIn="foot"` ; `secondaryAction` et `hint` sont en pied.
 */
export function MoneyCard({
  label = "Votre argent",
  title,
  available,
  escrow,
  availableNote,
  escrowNote,
  amount,
  note,
  action,
  secondaryAction,
  actionIn = "head",
  hint,
}) {
  const split = available !== undefined || escrow !== undefined
  const headAction = actionIn === "foot" ? null : action
  const footAction = actionIn === "foot" ? action : null

  if (split) {
    return (
      <section className="money2 money2--split" aria-label={title ?? label}>
        <div className="money2__head">
          <span><TitleText text={title ?? label} /></span>
          <MoneyAction action={headAction} />
        </div>
        <Stat label="Disponible" amount={available ?? 0} sub={availableNote} />
        <Stat label="En séquestre" amount={escrow ?? 0} sub={escrowNote} />
        {footAction || secondaryAction || hint ? (
          <div className="money2__foot">
            <MoneyAction action={footAction} />
            <MoneyAction action={secondaryAction} secondary />
            {hint ? <span className="money2__hint">{hint}</span> : null}
          </div>
        ) : null}
      </section>
    )
  }

  const money = splitAmount(amount ?? 0)
  return (
    <section className="money2" aria-label={title ?? label}>
      <span className="hero2__label">{label}</span>
      <div className="hero2__figure">
        {money.text}
        <small>{money.unit}</small>
      </div>
      {note ? <p className="hero2__meta">{note}</p> : null}
      {action || secondaryAction || hint ? (
        <div className="hero2__actions">
          <MoneyAction action={action} small={false} />
          <MoneyAction action={secondaryAction} secondary small={false} />
          {hint ? <span className="money2__hint">{hint}</span> : null}
        </div>
      ) : null}
    </section>
  )
}

export default MoneyCard
