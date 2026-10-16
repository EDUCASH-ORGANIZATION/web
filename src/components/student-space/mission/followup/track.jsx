// @ds-screen RD-STUDENT-01
import { Icon } from "@/components/design/icon"
import { safeDateFr } from "@/lib/student-space/mission-view"

const ICONS = { applied: "i-check", selected: "i-check", paid: "i-coins", reviewed: "i-star", cancelled: "i-x" }

/**
 * Étapes affichées d'après la chronologie de `missionDetailView`, sans rien inventer : une étape garde
 * sa date connue (candidature, retenue, grand livre, avis) et sinon une phrase neutre.
 * @param {Array<{ key: string, state: "done"|"now"|"todo", date: string|null }>} timeline
 * @param {{ status: string, hasLedger: boolean }} options
 */
export function trackSteps(timeline, { status, hasLedger }) {
  const steps = timeline.map((step) => {
    const date = safeDateFr(step.date)
    switch (step.key) {
      case "applied":
        return { ...step, title: "Candidature envoyée", sub: date }
      case "selected":
        return { ...step, title: "Votre candidature a été retenue", sub: date }
      case "paid":
        if (status === "done" && !hasLedger) {
          return { ...step, state: "now", title: "Paiement en cours de traitement", sub: "" }
        }
        return {
          ...step,
          title: step.state === "done" ? "Votre part est versée" : "Paiement sur votre portefeuille",
          sub: step.state === "done" ? date : "Quand le client confirme la fin de la mission",
        }
      default:
        return {
          ...step,
          title: "Votre avis sur le client",
          sub: step.state === "done" ? date : step.state === "now" ? "À donner" : "Après la fin de la mission",
        }
    }
  })
  if (status === "cancelled") {
    steps.push({ key: "cancelled", state: "done", title: "Mission annulée", sub: "" })
  }
  return steps
}

/**
 * Suivi vertical neutre (encre) : une étape cochée par ligne, un anneau sur l'étape en cours. Aucune séance
 * ni progression chiffrée : la base n'en contient pas.
 * @param {{ steps: ReturnType<typeof trackSteps> }} props
 */
export function Track({ steps }) {
  return (
    <ol className="e2-track e2-05-track">
      {steps.map((step) => (
        <li
          key={step.key}
          className={step.state === "done" ? "e2-step e2-step--done" : step.state === "now" ? "e2-step e2-step--now" : "e2-step"}
          aria-current={step.state === "now" ? "step" : undefined}
        >
          <span className="e2-step__dot">
            {step.state === "now" ? null : <Icon name={ICONS[step.key]} />}
          </span>
          <div>
            <div className="e2-step__title">{step.title}</div>
            {step.sub ? <div className="e2-step__sub">{step.sub}</div> : null}
          </div>
        </li>
      ))}
    </ol>
  )
}

export default Track
