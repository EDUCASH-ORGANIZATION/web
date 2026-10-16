// @ds-screen RD-STUDENT-01
import { Icon } from "@/components/design/icon"
import { Avatar } from "@/components/app-ui/avatar"
import { formatAmount } from "@/lib/app/format"
import { clientFirstName } from "@/lib/student-space/mission-view"
import { STUDENT_PERCENT } from "./gain-recap"

export function ratingText(rating) {
  return rating > 0 ? `${rating.toFixed(1).replace(".", ",")} / 5` : null
}

/**
 * Le client, vu de l'étudiant : prénom et initiale seulement (jamais téléphone ni email), ville, note,
 * missions publiées, mention du séquestre (seulement si les paiements sont activés et le budget valide).
 * `withPurchases` : mission avec achats, le service seul est bloqué. Composant pur.
 * @param {{ client: import("@/lib/actions/student-mission-detail.actions").StudentMissionClient, budget: number, paymentsEnabled?: boolean, withPurchases?: boolean }} props
 */
export function ClientCard({ client, budget, paymentsEnabled = false, withPurchases = false }) {
  const rating = ratingText(client.rating)
  const published = client.missionsPublished
  const publishedText = published > 1 ? `${published} missions publiées` : "1 mission publiée"
  const sub = [client.city, rating].filter(Boolean).join(" · ")
  // Mobile (planche) : note et missions publiées sur une ligne, la ville et le détail du séquestre sont omis.
  const subMobile = [rating, published > 0 ? publishedText : null].filter(Boolean).join(" · ")
  const who = clientFirstName(client.name) ?? "le client"
  const amountsOk = Number.isFinite(budget) && budget > 0
  return (
    <section className="e2-sec e2-03-clientcard" aria-label="Le client">
      <div className="e2-sec__head">
        <h2 className="e2-sec__title">Le client</h2>
      </div>
      <div className="e2-sec__body">
        <div className="e2-03-client">
          <div className="e2-who">
            <Avatar name={client.name} src={client.avatarUrl} verified={client.isVerified} />
            <div>
              <div className="e2-who__name">{client.name}</div>
              {sub || subMobile ? (
                <div className="e2-who__sub">
                  <span className="e2-03-sub-desk">{sub}</span>
                  <span className="e2-03-sub-mob">{subMobile}</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <div className="e2-03-badges">
          {published > 0 ? (
            <span className="badge badge--neutre badge--sm e2-03-badge-desk">
              <Icon name="i-briefcase" />
              {publishedText}
            </span>
          ) : null}
          {paymentsEnabled ? (
            <span className="badge badge--succes badge--sm">
              <Icon name="i-shield" />
              Fonds bloqués en séquestre
            </span>
          ) : null}
        </div>
        {paymentsEnabled && amountsOk ? (
          <p className="e2-03-caption e2-03-caption-desk">
            {withPurchases
              ? `Les ${formatAmount(budget)} du service sont bloqués par EduCash et vous sont versés (${STUDENT_PERCENT} %) quand ${who} valide la fin de la mission. Les achats ne sont jamais bloqués : ils sont payés directement aux vendeurs.`
              : `Les ${formatAmount(budget)} du budget sont déjà bloqués par EduCash. Ils vous sont versés (${STUDENT_PERCENT} %) quand le client valide la fin de la mission ; rien n'est versé automatiquement.`}
          </p>
        ) : null}
      </div>
    </section>
  )
}

export default ClientCard
