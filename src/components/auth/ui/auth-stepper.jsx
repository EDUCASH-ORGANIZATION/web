import { Fragment } from "react"
import { Icon } from "@/components/design/icon"

/**
 * Indicateur d'étapes (`.stepper`) suivi de « Étape n sur N ».
 * @param {{
 *   steps: string[],
 *   current: number,
 *   compact?: boolean,
 *   showCaption?: boolean,
 *   errorSteps?: number[],
 * }} props `current` est 1-indexé ; les étapes précédentes sont marquées faites.
 * `errorSteps` (numéros 1-indexés) marque les étapes en erreur (`is-error`).
 * `compact` force l'affichage réduit (sous 768 px il est déjà appliqué par la feuille de style).
 */
export function AuthStepper({ steps, current, compact = false, showCaption = true, errorSteps = [] }) {
  return (
    <>
      <nav className={`stepper${compact ? " stepper--compact" : ""}`} aria-label="Étapes">
        {steps.map((label, index) => {
          const number = index + 1
          const done = number < current
          const isCurrent = number === current
          const hasError = errorSteps.includes(number)
          return (
            <Fragment key={label}>
              {index > 0 && <span className={`step__line${isCurrent || done ? " is-done" : ""}`} />}
              <div className={`step${done ? " is-done" : ""}${isCurrent ? " is-current" : ""}${hasError ? " is-error" : ""}`} aria-current={isCurrent ? "step" : undefined}>
                <span className="step__dot">{done && !hasError ? <Icon name="i-check" /> : number}</span>
                <span className="step__label">{label}</span>
              </div>
            </Fragment>
          )
        })}
      </nav>
      {showCaption && (
        <p className="caption">
          Étape {Math.min(Math.max(current, 1), steps.length)} sur {steps.length}
        </p>
      )}
    </>
  )
}
