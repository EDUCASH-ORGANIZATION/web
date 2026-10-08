import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { formatFcfa } from "@/lib/vitrine/format"
import { Scribble, Shape } from "./scribble"
import { COMMISSION_PERCENT, EXAMPLE_BUDGET, EXAMPLE_COMMISSION, MIN_BUDGET } from "./clients-content"

// Hero client (maquette V05). Le faux profil étudiant de la planche est omis (décision 20).
export function ClientsHero({ publishHref }) {
  return (
    <div className="hero v05-hero grid-bg">
      <div className="v05-grid">
        <div>
          <span className="v-hero__chip v-hero__chip--plain">Particuliers · PME · associations</span>
          <h1 className="display display--xl ds-mt-6">
            Des étudiants<br />vérifiés pour vos<br />
            <span className="underline-scribble hl-citron">
              petites missions.
              <Scribble name="sc-underline" viewBox="0 0 240 24" />
            </span>
          </h1>
          <p className="body-l v05-lead">
            Un cours pour votre enfant, une livraison, une saisie, une garde le samedi. Vous publiez, des étudiants de
            Cotonou, Abomey-Calavi et Porto-Novo postulent, vous choisissez. Votre budget reste bloqué jusqu&apos;à ce
            que vous validiez le travail.
          </p>
          <div className="v05-ctas">
            <Link className="btn btn--accent btn--lg" href={publishHref}>
              Publier une mission
              <span className="btn__dot"><Icon name="i-arrow-right" /></span>
            </Link>
            <Link className="btn btn--ghost" href="#sequestre">Comment ça marche</Link>
          </div>
          <div className="v05-facts">
            <span className="v05-fact"><Icon name="i-banknote" />Budget dès {formatFcfa(MIN_BUDGET)}</span>
            <span className="v05-fact"><Icon name="i-percent" />Commission de {COMMISSION_PERCENT}&nbsp;% incluse</span>
            <span className="v05-fact"><Icon name="i-undo" />Remboursé si vous annulez avant de choisir</span>
          </div>
        </div>
        <div className="v05-visual" aria-hidden="true">
          <div className="v05-recap">
            <span className="eyebrow">Exemple de mission</span>
            <div className="recap">
              <div className="recap__line"><span>Budget bloqué</span><b>{formatFcfa(EXAMPLE_BUDGET)}</b></div>
              <div className="recap__line"><span>Commission {COMMISSION_PERCENT}&nbsp;%</span><b>{formatFcfa(EXAMPLE_COMMISSION)}</b></div>
            </div>
            <span className="badge badge--encre badge--sm ds-self-start">
              <Icon name="i-lock" />Libéré quand vous validez
            </span>
          </div>
          <Shape name="roundel" className="roundel spin" />
          <Scribble name="sc-burst" className="v05-scribble" />
        </div>
      </div>
    </div>
  )
}
