// Lien d'évitement : premier élément focalisable de la coquille, visible au focus.
export function SkipLink({ targetId = "contenu", label = "Aller au contenu" }) {
  return (
    <a className="ds-skip-link btn btn--secondary" href={`#${targetId}`}>
      {label}
    </a>
  )
}
