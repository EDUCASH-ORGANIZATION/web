import { VitrinePage } from "./vitrine-page"
import { StateBlock } from "./state-block"

// 404 dans le cadre de la vitrine (mission ou talent introuvable). audience est transmise à VitrinePage.
export function VitrineNotFound({ title, text, backHref, backLabel, audience = "clients" }) {
  return (
    <VitrinePage audience={audience}>
      <section className="section">
        <div className="ds-container">
          <StateBlock
            title={title}
            titleAs="h1"
            text={text}
            actions={[{ href: backHref, label: backLabel, variant: "primary" }]}
          />
        </div>
      </section>
    </VitrinePage>
  )
}
