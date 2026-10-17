// @ds-screen RD-STUDENT-01
import { clientFirstName } from "@/lib/student-space/mission-view"

/**
 * Déroulé d'une mission avec achats, vu de l'étudiant : chez le vendeur, une demande de paiement dans la conversation ;
 * le client paie le vendeur directement par MoMo, hors EduCash ; l'étudiant confirme la réception. L'estimation
 * d'achats reste hors séquestre, hors total et hors net. Le mot « séquestre » n'apparaît que si les paiements sont
 * ouverts.
 * @param {{ clientName: string, paymentsEnabled?: boolean }} props
 * @returns {Array<{ title: string, sub: string }>}
 */
export function purchaseSteps({ clientName, paymentsEnabled = false }) {
  const who = clientFirstName(clientName) ?? "Le client"
  return [
    {
      title: "Chez le vendeur, vous envoyez une demande de paiement dans la conversation",
      sub: "Photo du numéro marchand MoMo (ou du numéro personnel du vendeur), nom du vendeur, montant total, photo du ticket ou des articles.",
    },
    {
      title: `${who} paie le vendeur directement par MoMo`,
      sub: `Hors EduCash. ${who} vérifie le nom du bénéficiaire affiché par MoMo, puis marque la carte « Payé » avec la capture du SMS.`,
    },
    {
      title: "Vous confirmez « Reçu par le vendeur » et repartez avec les articles",
      sub: `Statuts de la carte : En attente de paiement, Payé, Reçu par le vendeur, Signalé. Chaque carte peut être signalée.${
        paymentsEnabled ? " Seul le service est bloqué en séquestre." : ""
      }`,
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
