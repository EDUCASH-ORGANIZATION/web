import Link from "next/link"
import { preload } from "react-dom"
import { AnchorLink } from "../shared/hash-scroll"
import { Icon } from "@/components/design/icon"
import { formatFcfa } from "@/lib/vitrine/format"
import { Scribble, Shape } from "./scribble"
import { COMMISSION_PERCENT, EXAMPLE_BUDGET, EXAMPLE_COMMISSION, MIN_BUDGET } from "./clients-content"

// Photo : Daniel Sunga, Pexels (licence Pexels, attribution non requise), détourée en local puis exportée en WebP
// (562 x 920, déjà optimisée : pas de passage par l'optimiseur de next/image). Même mécanique que l'accueil :
// la photo se pose sur l'aplat citron `photo-ph`, et un <picture> dont la seule source est réservée aux écrans
// larges ne demande jamais l'image sous 1024 px (le repli est un pixel transparent en data URI).
const PIXEL = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="
const CLIENT_PHOTO = { src: "/images/clients/portrait-client.webp", width: 562, height: 920 }
const CLIENT_PHOTO_MEDIA = "(min-width: 1024px)"

// Hero client (maquette V05). Le faux profil étudiant de la planche est omis (décision 20).
export function ClientsHero({ publishHref }) {
  preload(CLIENT_PHOTO.src, { as: "image", media: CLIENT_PHOTO_MEDIA })
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
            <AnchorLink className="btn btn--ghost" href="#sequestre">Comment ça marche</AnchorLink>
          </div>
          <div className="v05-facts">
            <span className="v05-fact"><Icon name="i-banknote" />Budget dès {formatFcfa(MIN_BUDGET)}</span>
            <span className="v05-fact"><Icon name="i-percent" />Commission de {COMMISSION_PERCENT}&nbsp;% incluse</span>
            <span className="v05-fact"><Icon name="i-undo" />Remboursé si vous annulez avant de choisir</span>
          </div>
        </div>
        <div className="v05-visual" aria-hidden="true">
          <div className="photo-ph">
            <picture className="v-hero__picture">
              <source media={CLIENT_PHOTO_MEDIA} srcSet={CLIENT_PHOTO.src} />
              <img
                className="v-hero__photo"
                src={PIXEL}
                width={CLIENT_PHOTO.width}
                height={CLIENT_PHOTO.height}
                alt=""
              />
            </picture>
          </div>
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
        </div>
      </div>
    </div>
  )
}
