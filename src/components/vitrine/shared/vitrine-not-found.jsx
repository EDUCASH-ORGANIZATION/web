import { VitrinePage } from "./vitrine-page"
import { StateBlock } from "./state-block"

// 404 dans le cadre de la vitrine (mission ou talent introuvable).
export function VitrineNotFound({ title, text, backHref, backLabel }) {
  return (
    <VitrinePage>
      <section className="section">
        <div className="container">
          <StateBlock
            title={title}
            text={text}
            actions={[{ href: backHref, label: backLabel, variant: "primary" }]}
          />
        </div>
      </section>
    </VitrinePage>
  )
}
