import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { Select } from "@/components/design/select"
import { SPRITE_VERSION } from "@/components/design/sprite"
import { HERO_PHOTOS, HeroPhoto } from "../shared/hero-photo"
import { CITIES, MISSION_TYPES, missionTypeLabel } from "@/lib/constants/missions"
import { PUBLISH_PATH, publishHref } from "@/lib/utils/publish-prefill"
import { formatFcfa } from "@/lib/vitrine/format"

// Types proposés en idées : valeurs en base, libellés issus du dictionnaire.
const IDEAS = ["Livraison", "Cours particuliers", "Babysitting", "Saisie"].filter((t) => MISSION_TYPES.includes(t))
const EXAMPLE_BUDGET = 25000
const BESOIN_MAX_LENGTH = 80

const SPRITE = `/sprite.svg?v=${SPRITE_VERSION}`

const CITY_OPTIONS = [
  { value: "", label: "Toutes les villes" },
  ...CITIES.map((c) => ({ value: c, label: c })),
]

function CitySelect({ id }) {
  return (
    <Select
      id={id}
      name="ville"
      variant="bare"
      aria-label="Ville"
      placeholder="Toutes les villes"
      options={CITY_OPTIONS}
      defaultValue=""
    />
  )
}

function Chip({ type }) {
  return (
    <Link className="chip chip--sm" href={publishHref({ type })}>
      {missionTypeLabel(type)}
    </Link>
  )
}

// Hero de l'accueil (maquette V01 v3) : s'adresse aux clients, le formulaire ouvre la publication pré-remplie.
export function HomeHero({ role }) {
  return (
    <div className="hero hero--under-header grid-bg">
      <div className="v-hero">
        <div>
          <span className="v-hero__chip v-hero__chip--plain">
            <Icon name="i-map-pin" className="ic ic--16" />
            {CITIES.join(" · ")}
          </span>
          <h1 className="display display--xxl v01-hero-h1">
            Votre temps<br />est précieux.<br />
            <span className="underline-scribble hl-citron">
              Déléguez.
              <svg className="scribble" viewBox="0 0 240 24" preserveAspectRatio="none" aria-hidden="true">
                <use href={`${SPRITE}#sc-underline`} />
              </svg>
            </span>
          </h1>
          <p className="body-l v01-hero-lead">
            Le marché à Dantokpa, les devoirs des enfants, vos documents à mettre en forme&nbsp;: confiez vos petites
            missions à des étudiants vérifiés. Votre argent reste bloqué jusqu&rsquo;à ce que vous validiez le travail.
          </p>

          <form className="search search--hero v01-hero-search ds-desk-only" role="search" action={PUBLISH_PATH} method="get">
            <Icon name="i-pencil" />
            <label className="sr-only" htmlFor="home-besoin">De quoi avez-vous besoin&nbsp;?</label>
            <input
              id="home-besoin"
              name="besoin"
              type="text"
              maxLength={BESOIN_MAX_LENGTH}
              placeholder="De quoi avez-vous besoin&nbsp;?"
            />
            <span className="search__city">
              <Icon name="i-map-pin" className="ic ic--16" />
              <CitySelect id="home-ville" />
            </span>
            <button type="submit" className="btn btn--primary">Publier</button>
          </form>

          <form className="v-msearch ds-mt-5 ds-mob-only" role="search" action={PUBLISH_PATH} method="get">
            <div className="search">
              <Icon name="i-pencil" />
              <label className="sr-only" htmlFor="home-besoin-m">De quoi avez-vous besoin&nbsp;?</label>
              <input
                id="home-besoin-m"
                name="besoin"
                type="text"
                maxLength={BESOIN_MAX_LENGTH}
                placeholder="Ex. : le marché samedi"
              />
            </div>
            <div className="v-msearch__row">
              <span className="v-msearch__city">
                <Icon name="i-map-pin" className="ic ic--16" />
                <CitySelect id="home-ville-m" />
              </span>
              <button type="submit" className="btn btn--primary">Publier</button>
            </div>
          </form>

          <div className="v-popular on-bleu ds-desk-only">
            <span>Idées :</span>
            {IDEAS.map((t) => <Chip key={t} type={t} />)}
          </div>
          <div className="chips chips--scroll v-hero__chips on-bleu ds-mob-only">
            {IDEAS.map((t) => <Chip key={t} type={t} />)}
          </div>

          {role === "student" ? (
            <div className="row ds-mt-6 ds-gap-4">
              <Link className="btn btn--accent btn--lg" href="/student/missions">
                Voir les missions pour moi
                <span className="btn__dot"><Icon name="i-arrow-right" /></span>
              </Link>
            </div>
          ) : (
            <p className="body-s ds-mt-6">
              <Link className="btn btn--ghost on-bleu v-hero__student" href="/etudiants">
                <Icon name="i-graduation" />
                Vous êtes étudiant&nbsp;? Trouvez des missions près de votre fac
              </Link>
            </p>
          )}
        </div>

        <div className="v-hero__visual" aria-hidden="true">
          <HeroPhoto photo={HERO_PHOTOS.client} priority />
          <div className="push v-hero__push">
            <img className="logo-sym" src="/logo-symbole-bleu.svg" alt="" width={40} height={40} />
            <div>
              <div className="push__app">EduCash · maintenant</div>
              <div className="push__title">Afiavi a terminé votre marché</div>
              <div className="caption">Vérifiez, puis validez pour la payer</div>
            </div>
          </div>
          <div className="v-hero__card">
            <span className="badge badge--lavande badge--sm">
              <Icon name="i-lock" />Bloqué jusqu&rsquo;à votre validation
            </span>
            <b className="body-s">Cours de maths 3e · Akpakpa</b>
            <span className="amount amount--s">{formatFcfa(EXAMPLE_BUDGET)}</span>
          </div>
          <svg className="roundel spin v-hero__roundel" focusable="false">
            <use href={`${SPRITE}#roundel`} />
          </svg>
          <svg className="scribble v01-burst" viewBox="0 0 60 60" focusable="false">
            <use href={`${SPRITE}#sc-burst`} />
          </svg>
        </div>
      </div>
    </div>
  )
}
