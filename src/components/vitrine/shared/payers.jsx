import Link from "next/link"
import { OperatorLogo } from "./operator-logo"

// Opérateurs de retrait branchés (MTN et Moov). Celtiis n'est pas affiché : pas de retrait Celtiis pour l'instant.
export function PayerOperators() {
  return (
    <>
      <span className="payer"><OperatorLogo operator="mtn" />MTN MoMo</span>
      <span className="payer"><OperatorLogo operator="moov" />Moov Money</span>
    </>
  )
}

// Pastilles des opérateurs de paiement, avec en option la phrase sur le séquestre.
export function Payers({ withEscrow = false }) {
  return (
    <>
      <div className="v-payers">
        <span className="payer payer--fedapay"><span className="payer__mark">F</span>FedaPay</span>
        <PayerOperators />
      </div>
      {withEscrow ? (
        <p className="body-s ds-text-brume ds-mt-3">
          Le budget est bloqué en séquestre jusqu’à la fin de la mission.{" "}
          <Link className="link" href="/aide#sequestre">Comment ça marche</Link>
        </p>
      ) : null}
    </>
  )
}
