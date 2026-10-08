import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { SPRITE_VERSION } from "@/components/design/sprite"
import { MissionCard } from "../mission-card"
import { StateBlock } from "../shared/state-block"

const WAITING_POINTS = [
  { icon: "i-user-check", tone: "", label: "Profil prêt" },
  { icon: "i-bell", tone: " ic-sq--bleu", label: "Alerte à la publication" },
  { icon: "i-smartphone", tone: " ic-sq--encre", label: "MoMo enregistré" },
]

function Empty() {
  return (
    <div className="v01-empty">
      <div>
        <span className="eyebrow eyebrow--bleu">Missions ouvertes</span>
        <h2 className="display display--l ds-mt-3">
          Sois prêt pour<br /><span className="hl-bleu">les premières missions.</span>
        </h2>
        <p className="body-l muted ds-mt-4 ds-measure-l">
          Aucune mission n&rsquo;est ouverte à cet instant. Crée ton compte maintenant : on te prévient dès qu&rsquo;une
          mission tombe près de chez toi.
        </p>
        <div className="row ds-mt-6 ds-gap-4">
          <Link className="btn btn--primary btn--lg" href="/auth/register?role=student">
            Créer mon compte
            <span className="btn__dot"><Icon name="i-arrow-right" /></span>
          </Link>
          <Link className="btn btn--ghost" href="/#etapes">Comment ça marche</Link>
        </div>
      </div>
      <ul className="v01-empty__list">
        {WAITING_POINTS.map(({ icon, tone, label }) => (
          <li key={label}>
            <span className={`ic-sq${tone}`}><Icon name={icon} /></span>
            {label}
          </li>
        ))}
      </ul>
      <svg className="scribble scribble--bleu v01-empty__scribble" viewBox="0 0 60 60" aria-hidden="true" focusable="false">
        <use href={`/sprite.svg?v=${SPRITE_VERSION}#sc-burst`} />
      </svg>
    </div>
  )
}

// Aperçu des dernières missions ouvertes (maquette V01), avec états vide et erreur.
export function HomePreview({ missions, openCount, error }) {
  if (error) {
    return (
      <section className="section">
        <div className="card card--soft">
          <StateBlock
            kind="error"
            title="Les missions n'ont pas pu être chargées"
            text="Le reste de la page fonctionne. Vérifie ta connexion puis réessaie."
            actions={[
              { href: "/", label: "Réessayer" },
              { href: "/missions", label: "Voir toutes les missions", variant: "ghost" },
            ]}
          />
        </div>
      </section>
    )
  }

  if (missions.length === 0) {
    return (
      <section className="section">
        <Empty />
      </section>
    )
  }

  return (
    <section className="section">
      <div className="section__head">
        <div>
          <span className="eyebrow eyebrow--bleu">Missions ouvertes</span>
          <h2 className="display display--l ds-mt-3">
            Ouvertes<br /><span className="hl-bleu">en ce moment.</span>
          </h2>
        </div>
        <Link className="btn btn--secondary" href="/missions">
          {openCount > missions.length ? `Voir les ${openCount} missions` : "Voir toutes les missions"}
          <span className="btn__dot btn__dot--encre"><Icon name="i-arrow-right" /></span>
        </Link>
      </div>
      <div className="v02-grid">
        {missions.map((m) => <MissionCard key={m.id} mission={m} />)}
      </div>
    </section>
  )
}
