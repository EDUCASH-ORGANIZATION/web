import { Icon } from "@/components/design/icon"
import { Shape } from "../shared/scribble"
import { GUARANTEES } from "./home-content"

// Section « Confiance » : quatre garanties pour le client.
export function HomeTrust() {
  return (
    <section className="section" id="confiance">
      <div className="section__head">
        <div>
          <span className="eyebrow eyebrow--bleu">Confiance</span>
          <h2 className="display display--l ds-mt-3">
            Si ça coince,<br /><span className="hl-bleu">on est là.</span>
          </h2>
        </div>
      </div>
      <div className="v05-guar">
        {GUARANTEES.map((g) => (
          <div key={g.title} className={`v05-g ${g.variant}`}>
            <Shape name={g.shape} className="v05-g__shape" />
            <span className={`ic-sq ${g.square}`.trim()}><Icon name={g.icon} /></span>
            <div className="v05-g__t">{g.title}</div>
            <p>{g.text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
