import { Icon } from "@/components/design/icon"
import { Lines } from "@/components/app-ui/lines"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { COMMISSION_RATE, missionTypeLabel } from "@/lib/constants/missions"
import { escrowSplit } from "@/lib/app/money"
import { formatAmount, formatShortDate } from "@/lib/app/format"
import { purchasesEstimateOf } from "@/lib/app/purchases"
import { STEPS, typeIcon, urgencyLabel } from "@/lib/client-space/publish-schema"

// Espace insécable avant « % » : le libellé ne se coupe jamais entre le nombre et le signe.
const COMMISSION_PERCENT = `${Math.round(COMMISSION_RATE * 100)}\u00A0%`

// Estimation affichée : seulement si la case « Mission avec achats » est cochée et le montant valable.
const purchasesOf = (values) => (values.avecAchats === true ? purchasesEstimateOf(values.estimationAchats) : null)

// Un budget n'a de répartition que s'il est un nombre entier positif : sinon aucune ligne n'est inventée.
const hasBudget = (budget) => Number.isInteger(budget) && budget > 0

/**
 * Récapitulatif en direct de l'étape 3 : montant bloqué, commission, part de l'étudiant (`escrowSplit`).
 * `purchases` : estimation des achats (indicative, hors séquestre), null sans achats.
 * @param {{ budget: number|null, purchases?: number|null }} props
 */
export function LiveSummary({ budget, purchases = null }) {
  const split = escrowSplit(budget)
  return (
    <section className="card2" aria-label="Récapitulatif en direct">
      <div className="sec2">
        <h2 className="sec2__title">Récapitulatif en direct</h2>
      </div>
      {hasBudget(budget) ? (
        <>
          <Lines
            rows={[
              { label: "Budget bloqué en séquestre", value: split.total },
              { label: `Commission EduCash ${COMMISSION_PERCENT}`, value: split.commission, sign: "debit" },
            ]}
            total={{ label: "L'étudiant recevra", value: split.student }}
          />
          <p className="note2">
            <span>
              {formatAmount(split.total)} seront bloqués à la publication, l&apos;étudiant recevra {formatAmount(split.student)}.
            </span>
          </p>
        </>
      ) : (
        <p className="note2">
          <span>Indiquez un budget pour voir ce qui sera bloqué et ce que recevra l&apos;étudiant.</span>
        </p>
      )}
      {purchases ? (
        <p className="note2">
          <Icon name="i-info" />
          <span>
            Les achats (environ {formatAmount(purchases)}) ne sont pas bloqués : prévoyez-les sur votre MoMo.
          </span>
        </p>
      ) : null}
      <p className="note2">
        <Icon name="i-lock" />
        <span>Rien n&apos;est bloqué avant la publication.</span>
      </p>
    </section>
  )
}

/**
 * Aperçu de la mission côté étudiant. Le type passe toujours par `missionTypeLabel`.
 * @param {{ values: import("@/lib/client-space/publish-schema").PublishValues }} props
 */
export function PreviewCard({ values }) {
  const split = escrowSplit(values.budget)
  const deadline = formatShortDate(values.deadline)
  const purchases = purchasesOf(values)
  return (
    <section className="card2" aria-label="Aperçu">
      <span className="eyebrow2">Aperçu côté étudiant</span>
      <div className="preview2">
        <div className="preview2__top">
          <span>
            <Icon name={typeIcon(values.type)} />
            {missionTypeLabel(values.type)}
          </span>
          <StatusBadge label="Ouverte" />
        </div>
        {purchases ? (
          <div className="meta2">
            <span>
              <Icon name="i-receipt" />
              Avec achats
            </span>
          </div>
        ) : null}
        <div className="preview2__title">{values.title.trim()}</div>
        <div className="meta2">
          <span>
            <Icon name="i-map-pin" />
            {values.city}
          </span>
          {deadline ? (
            <span>
              <Icon name="i-calendar" />
              Avant le {deadline}
            </span>
          ) : null}
          <span>
            <Icon name="i-shield" />
            Fonds en séquestre
          </span>
        </div>
        <div className="preview2__price">
          <b>{formatAmount(split.total)}</b>
          <span>L&apos;étudiant touche {formatAmount(split.student)}</span>
        </div>
        {purchases ? <p className="note2">Achats estimés : environ {formatAmount(purchases)}, non bloqués</p> : null}
      </div>
    </section>
  )
}

/**
 * Effet de la publication sur le solde. `available` est le disponible lu à l'ouverture de la page
 * (`null` : non lisible, la carte n'est pas affichée) ; le serveur revérifie au moment de publier.
 * @param {{ available: number|null, budget: number|null }} props
 */
export function WalletImpact({ available, budget }) {
  if (available === null || !hasBudget(budget)) return null
  const shortfall = budget - available
  const covered = shortfall <= 0
  return (
    <section className="card2" aria-label="Impact sur votre portefeuille">
      <div className="sec2">
        <h2 className="sec2__title">Impact sur votre portefeuille</h2>
        <StatusBadge label="En séquestre" icon="i-lock" />
      </div>
      <Lines
        rows={[
          { label: "Disponible aujourd'hui", value: available },
          { label: "Bloqué en séquestre à la publication", value: budget, sign: "debit" },
        ]}
        total={covered ? { label: "Disponible après publication", value: available - budget } : { label: "Il manque pour publier", value: shortfall }}
      />
      {covered ? null : (
        <p className="note2">
          <Icon name="i-info" />
          <span>Votre disponible ne couvre pas ce budget : vous pourrez recharger au moment de publier.</span>
        </p>
      )}
    </section>
  )
}

function Section({ title, step, onEdit, disabled, children }) {
  const label = STEPS.find((s) => s.id === step)?.label ?? title
  return (
    <>
      <div className="sec2">
        <h2 className="sec2__title">{title}</h2>
        <button type="button" className="link2" onClick={() => onEdit(step)} disabled={disabled} aria-label={`Modifier : ${label}`}>
          Modifier
        </button>
      </div>
      <dl className="review2">{children}</dl>
      <hr className="divider" />
    </>
  )
}

/**
 * Étape 4 : toutes les réponses avec un lien « Modifier » par bloc, puis ce qui se passe à la publication.
 * @param {{ values: import("@/lib/client-space/publish-schema").PublishValues, onEdit: (step: number) => void, disabled?: boolean }} props
 */
export function RecapBody({ values, onEdit, disabled = false }) {
  const split = escrowSplit(values.budget)
  const deadline = formatShortDate(values.deadline)
  const purchases = purchasesOf(values)
  return (
    <>
      <Section title="Le besoin" step={1} onEdit={onEdit} disabled={disabled}>
        <dt>Type</dt>
        <dd>{missionTypeLabel(values.type)}</dd>
        <dt>Titre</dt>
        <dd>{values.title.trim()}</dd>
      </Section>
      <Section title="Détails" step={2} onEdit={onEdit} disabled={disabled}>
        <dt>Ville</dt>
        <dd>{values.city}</dd>
        <dt>Description</dt>
        <dd className="review2__text">{values.description.trim()}</dd>
      </Section>
      <Section title="Budget et échéance" step={3} onEdit={onEdit} disabled={disabled}>
        <dt>Budget</dt>
        <dd>{formatAmount(split.total)}</dd>
        {purchases ? (
          <>
            <dt>Achats estimés</dt>
            <dd>environ {formatAmount(purchases)}</dd>
          </>
        ) : null}
        <dt>Urgence</dt>
        <dd>{urgencyLabel(values.urgency)}</dd>
        <dt>Date limite</dt>
        <dd>{deadline}</dd>
      </Section>
      <div className="sec2">
        <h2 className="sec2__title">Ce qui se passe à la publication</h2>
      </div>
      <Lines
        rows={[
          { label: "Bloqué aujourd'hui sur votre portefeuille", value: split.total },
          { label: `Commission EduCash ${COMMISSION_PERCENT}, prélevée à la fin`, value: split.commission, sign: "debit" },
        ]}
        total={{ label: "Versé à l'étudiant quand vous confirmez la fin", value: split.student }}
      />
      <ul className="checklist">
        {purchases ? (
          <li className="is-ok">
            Les achats (environ {formatAmount(purchases)}) ne sont pas bloqués : prévoyez-les sur votre MoMo
          </li>
        ) : null}
        <li className="is-ok">
          {purchases
            ? "Seul le budget du service est bloqué, sans autre montant à payer à EduCash"
            : "Un seul paiement : aucun autre montant ne vous sera demandé"}
        </li>
        <li className="is-ok">Annulation libre tant qu&apos;aucun étudiant n&apos;est retenu, remboursement intégral</li>
      </ul>
    </>
  )
}
