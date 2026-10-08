import { Fragment } from "react"

// Bloc d'une page légale : <section id> et titre de niveau 2 (maquette V09).
export function LegalSection({ id, title, children }) {
  return (
    <section id={id}>
      <h2>{title}</h2>
      {children}
    </section>
  )
}

// Liste de faits (libellé / valeur) en <dl>. Une valeur manquante se signale
// avec <span className="v-note">À fournir</span>.
export function LegalFacts({ items }) {
  return (
    <dl>
      {items.map(({ label, value }) => (
        <Fragment key={label}>
          <dt>{label} :</dt>
          <dd>{value}</dd>
        </Fragment>
      ))}
    </dl>
  )
}
