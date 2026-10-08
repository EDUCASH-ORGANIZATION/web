import { AnchorLink } from "./hash-scroll"
import { Icon } from "@/components/design/icon"

const COPY = {
  student: "Le client a déjà payé. L'argent t'est versé à la fin de la mission.",
  client: "Votre budget reste bloqué jusqu'à ce que vous validiez le travail.",
}

// Badge « Fonds bloqués » et son explication (maquette V03), tutoyé ou vouvoyé.
export function EscrowNote({ audience = "student" }) {
  return (
    <div className="row row--nowrap row--top">
      <span className="badge badge--lavande">
        <Icon name="i-lock" />
        Fonds bloqués
      </span>
      <span className="caption">
        {COPY[audience] ?? COPY.student}{" "}
        <AnchorLink className="link" href="/aide#sequestre">En savoir plus</AnchorLink>
      </span>
    </div>
  )
}
