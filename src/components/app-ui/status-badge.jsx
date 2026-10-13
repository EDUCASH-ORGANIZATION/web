import { Icon } from "@/components/design/icon"

// Tons de badge autorisés pour un statut. Le citron n'en fait jamais partie : il reste l'accent de `flag2`.
const TONES = new Set(["neutre", "bleu", "succes", "erreur", "alerte"])

// Pastille de statut : toujours un libellé et une couleur.
// `label` et `tone` viennent de missionStatusView ou applicationStatusView.
export function StatusBadge({ label, tone = "neutre", icon }) {
  const safeTone = TONES.has(tone) ? tone : "neutre"
  return (
    <span className={`badge badge--${safeTone} badge--sm`}>
      {icon ? <Icon name={icon} /> : null}
      {label}
    </span>
  )
}

export default StatusBadge
