// @ds-screen RD-STUDENT-01
import { clientFirstName } from "@/lib/student-space/mission-view"

/**
 * Déroulé d'une mission avec achats, vu de l'étudiant (décision 24 : les achats passent par des photos dans la
 * conversation, jamais par une demande de paiement). Le mot « séquestre » n'apparaît que si les paiements sont ouverts.
 * @param {{ clientName: string, paymentsEnabled?: boolean }} props
 * @returns {Array<{ title: string, sub: string }>}
 */
export function purchaseSteps({ clientName, paymentsEnabled = false }) {
  const who = clientFirstName(clientName) ?? "Le client"
  return [
    {
      title: "Au marché, vous envoyez une photo dans la conversation",
      sub: "La photo du ticket ou des articles achetés, envoyée au client dans la messagerie avant de quitter le vendeur.",
    },
    {
      title: `${who} paie le vendeur directement par MoMo`,
      sub: "Hors EduCash : le client règle le vendeur lui-même, sans passer par vous. Vous n'avancez jamais d'argent.",
    },
    paymentsEnabled
      ? {
          title: "EduCash ne garde que le prix du service en séquestre",
          sub: "Les achats ne sont jamais bloqués et ne portent aucune commission. Le service est versé à la validation.",
        }
      : {
          title: "EduCash n'intervient pas dans les achats",
          sub: "Les achats ne passent pas par la plateforme et ne portent aucune commission : le client règle les vendeurs.",
        },
  ]
}

/**
 * Carte « Comment se passent les achats » : trois étapes numérotées. Composant pur.
 * @param {{ clientName: string, paymentsEnabled?: boolean }} props
 */
export function PurchasesSteps({ clientName, paymentsEnabled = false }) {
  const steps = purchaseSteps({ clientName, paymentsEnabled })
  return (
    <section className="e2-sec" aria-label="Comment se passent les achats">
      <div className="e2-sec__head">
        <h2 className="e2-sec__title">Comment se passent les achats</h2>
      </div>
      <div className="e2-sec__body">
        <ol className="e2-track">
          {steps.map((step, index) => (
            <li className="e2-step" key={step.title}>
              <span className="e2-step__dot">{index + 1}</span>
              <div>
                <div className="e2-step__title">{step.title}</div>
                <div className="e2-step__sub">{step.sub}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export default PurchasesSteps
