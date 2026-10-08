import { Icon } from "@/components/design/icon"

// FAQ en <details> natifs (maquettes V01 et V07). Isomorphe : sans hook ni import serveur.
export function Faq({ items, headingLevel = 3 }) {
  const Heading = `h${headingLevel}`
  return (
    <div className="v-faq">
      {items.map(({ id, question, answer }) => (
        <details key={id} id={id} className="v-faq__item">
          <summary className="v-faq__q">
            <Heading>{question}</Heading>
            <span className="btn-icon btn-icon--sm">
              <Icon name="i-plus" />
            </span>
          </summary>
          <div className="v-faq__a">{answer}</div>
        </details>
      ))}
    </div>
  )
}
