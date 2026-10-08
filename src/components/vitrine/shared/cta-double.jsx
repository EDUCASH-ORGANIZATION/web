import Link from "next/link"
import { Icon } from "@/components/design/icon"

// Double appel à l'action étudiant / client (maquette V01).
export function CtaDouble({ student, client }) {
  return (
    <div className="v-cta2">
      <div className="v-cta v-cta--citron">
        <span className="badge badge--encre ds-self-start">Étudiant</span>
        <h2 className="display display--l">{student.title}</h2>
        <p className="body-l ds-measure-m">{student.text}</p>
        <div className="v-cta__actions">
          <Link className="btn btn--dark btn--lg" href={student.href}>
            {student.label}
            <span className="btn__dot"><Icon name="i-arrow-right" /></span>
          </Link>
        </div>
      </div>
      <div className="v-cta v-cta--bleu grid-bg on-bleu">
        <span className="badge badge--citron ds-self-start">Client</span>
        <h2 className="display display--l">{client.title}</h2>
        <p className="body-l ds-measure-m">{client.text}</p>
        <div className="v-cta__actions">
          <Link className="btn btn--primary btn--lg" href={client.href}>
            {client.label}
            <span className="btn__dot"><Icon name="i-arrow-right" /></span>
          </Link>
        </div>
      </div>
    </div>
  )
}
