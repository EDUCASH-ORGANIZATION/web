// @ds-screen RD-STUDENT-01
import { Icon } from "@/components/design/icon"
import { Avatar } from "@/components/app-ui/avatar"
import { formatAmount } from "@/lib/app/format"
import { STUDENT_PERCENT } from "./gain-recap"

function ratingText(rating) {
  return rating > 0 ? `${rating.toFixed(1).replace(".", ",")} / 5` : null
}

/**
 * Le client, vu de l'étudiant : prénom et initiale seulement (jamais téléphone ni email), ville, note,
 * missions publiées, mention du séquestre (seulement si les paiements sont activés). Composant pur.
 * @param {{ client: import("@/lib/actions/student-mission-detail.actions").StudentMissionClient, budget: number, paymentsEnabled?: boolean }} props
 */
export function ClientCard({ client, budget, paymentsEnabled = false }) {
  const sub = [client.city, ratingText(client.rating)].filter(Boolean).join(" · ")
  const published = client.missionsPublished
  return (
    <section className="e2-sec" aria-label="Le client">
      <div className="e2-sec__head">
        <h2 className="e2-sec__title">Le client</h2>
      </div>
      <div className="e2-sec__body">
        <div className="e2-03-client">
          <div className="e2-who">
            <Avatar name={client.name} src={client.avatarUrl} verified={client.isVerified} />
            <div>
              <div className="e2-who__name">{client.name}</div>
              {sub ? <div className="e2-who__sub">{sub}</div> : null}
            </div>
          </div>
        </div>
        <div className="e2-03-badges">
          {published > 0 ? (
            <span className="badge badge--neutre badge--sm">
              <Icon name="i-briefcase" />
              {published > 1 ? `${published} missions publiées` : "1 mission publiée"}
            </span>
          ) : null}
          {paymentsEnabled ? (
            <span className="badge badge--succes badge--sm">
              <Icon name="i-shield" />
              Fonds bloqués en séquestre
            </span>
          ) : null}
        </div>
        {paymentsEnabled ? (
          <p className="e2-03-caption">
            {`Les ${formatAmount(budget)} du budget sont déjà bloqués par EduCash. Ils vous sont versés (${STUDENT_PERCENT} %) quand le client valide la fin de la mission ; rien n'est versé automatiquement.`}
          </p>
        ) : null}
      </div>
    </section>
  )
}

export default ClientCard
