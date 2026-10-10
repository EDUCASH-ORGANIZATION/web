import { AnchorLink } from "./hash-scroll"
import { OperatorLogo } from "./operator-logo"

// Opérateurs Mobile Money affichés en vitrine : MTN MoMo, Moov Money et Celtiis Cash.
export function PayerOperators() {
  return (
    <>
      <span className="payer"><OperatorLogo operator="mtn" />MTN MoMo</span>
      <span className="payer"><OperatorLogo operator="moov" />Moov Money</span>
      <span className="payer"><OperatorLogo operator="celtiis" />Celtiis Cash</span>
    </>
  )
}

// Pastilles des opérateurs de paiement, avec en option la phrase sur le séquestre.
export function Payers({ withEscrow = false }) {
  return (
    <>
      <div className="v-payers">
        <PayerOperators />
      </div>
      {withEscrow ? (
        <p className="body-s ds-text-brume ds-mt-3">
          Le budget est bloqué en séquestre jusqu’à la fin de la mission.{" "}
          <AnchorLink className="link" href="/aide#sequestre">Comment ça marche</AnchorLink>
        </p>
      ) : null}
    </>
  )
}
