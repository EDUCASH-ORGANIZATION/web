import Link from "next/link"

// Pastilles des opérateurs de paiement, avec en option la phrase sur le séquestre.
export function Payers({ withEscrow = false }) {
  return (
    <>
      <div className="v-payers">
        <span className="payer payer--fedapay"><span className="payer__mark">F</span>FedaPay</span>
        <span className="payer payer--mtn"><span className="payer__mark">MTN</span>MTN MoMo</span>
        <span className="payer payer--moov"><span className="payer__mark">M</span>Moov Money</span>
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
