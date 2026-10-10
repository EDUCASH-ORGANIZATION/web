import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { Select } from "@/components/design/select"
import { SPRITE_VERSION } from "@/components/design/sprite"
import { HERO_PHOTOS, HeroPhoto } from "../shared/hero-photo"
import { CITIES, MISSION_TYPES, SEARCH_MAX_LENGTH, missionTypeLabel, netAmount } from "@/lib/constants/missions"
import { formatFcfa } from "@/lib/vitrine/format"
import { studentAction } from "./etudiants-cta"

// Valeurs en base : le lien filtre sur la valeur, la puce affiche le libellé.
const POPULAR = ["Cours particuliers", "Livraison", "Saisie", "Babysitting"].filter((t) =>
  MISSION_TYPES.includes(t),
)
const EXAMPLE_BUDGET = 25000

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
    <Link className="chip chip--sm" href={`/missions?type=${encodeURIComponent(type)}`}>
      {missionTypeLabel(type)}
    </Link>
  )
}

// Hero de /etudiants (maquette V05 v3). La pastille affiche le compteur seulement en mode "live".
export function EtudiantsHero({ live, openMissions, role }) {
  const primary = studentAction(role)
  const showSecondary = role !== "student" && role !== "client"
  const chip = live ? (
    <span className="v-hero__chip">
      <b>{openMissions}</b>missions ouvertes en ce moment
    </span>
  ) : (
    <span className="v-hero__chip v-hero__chip--plain">
      <Icon name="i-map-pin" className="ic ic--16" />
      {CITIES.join(" · ")}
    </span>
  )

  return (
    <div className="hero hero--under-header grid-bg">
      <div className="v-hero">
        <div>
          {chip}
          <h1 className="display display--xxl v01-hero-h1">
            Bosse entre<br />deux cours.<br />
            <span className="underline-scribble hl-citron">
              Encaisse.
              <svg className="scribble" viewBox="0 0 240 24" preserveAspectRatio="none" aria-hidden="true">
                <use href={`${SPRITE}#sc-underline`} />
              </svg>
            </span>
          </h1>
          <p className="body-l v01-hero-lead">
            Des petites missions près de ta fac&nbsp;: cours à domicile, marché pour une famille, travaux sur
            ordinateur, garde d&rsquo;enfants. Le client bloque l&rsquo;argent avant que tu commences, tu le retires sur
            ton MTN MoMo, ton Moov Money ou ton Celtiis Cash.
          </p>

          <form className="search search--hero v01-hero-search ds-desk-only" role="search" action="/missions" method="get">
            <Icon name="i-search" />
            <label className="sr-only" htmlFor="etu-q">Mot-clé</label>
            <input
              id="etu-q"
              name="q"
              type="search"
              maxLength={SEARCH_MAX_LENGTH}
              placeholder="Cours de maths, marché, Excel…"
            />
            <span className="search__city">
              <Icon name="i-map-pin" className="ic ic--16" />
              <CitySelect id="etu-ville" />
            </span>
            <button type="submit" className="btn btn--primary">Chercher</button>
          </form>

          <form className="v-msearch ds-mt-5 ds-mob-only" role="search" action="/missions" method="get">
            <div className="search">
              <Icon name="i-search" />
              <label className="sr-only" htmlFor="etu-q-m">Mot-clé</label>
              <input
                id="etu-q-m"
                name="q"
                type="search"
                maxLength={SEARCH_MAX_LENGTH}
                placeholder="Cours, marché, Excel…"
              />
            </div>
            <div className="v-msearch__row">
              <span className="v-msearch__city">
                <Icon name="i-map-pin" className="ic ic--16" />
                <CitySelect id="etu-ville-m" />
              </span>
              <button type="submit" className="btn btn--primary">Chercher</button>
            </div>
          </form>

          <div className="v-popular on-bleu ds-desk-only">
            <span>Populaire :</span>
            {POPULAR.map((t) => <Chip key={t} type={t} />)}
          </div>
          <div className="chips chips--scroll v-hero__chips on-bleu ds-mob-only">
            {POPULAR.map((t) => <Chip key={t} type={t} />)}
          </div>

          <div className="row ds-mt-6 ds-gap-4">
            <Link className="btn btn--accent btn--lg" href={primary.href}>
              {primary.label}
              <span className="btn__dot"><Icon name="i-arrow-right" /></span>
            </Link>
            {showSecondary ? (
              <Link className="btn btn--ghost" href="/missions">Voir les missions</Link>
            ) : null}
          </div>
        </div>

        <div className="v-hero__visual" aria-hidden="true">
          <HeroPhoto photo={HERO_PHOTOS.student} priority />
          <div className="push v-hero__push">
            <img className="logo-sym" src="/logo-symbole-bleu.svg" alt="" width={40} height={40} />
            <div>
              <div className="push__app">EduCash · exemple</div>
              <div className="push__title">Paiement reçu : {formatFcfa(netAmount(EXAMPLE_BUDGET))}</div>
              <div className="caption">Versé sur ton portefeuille</div>
            </div>
          </div>
          <div className="v-hero__card">
            <span className="badge badge--lavande badge--sm">
              <Icon name="i-lock" />En séquestre
            </span>
            <b className="body-s">Exemple de mission</b>
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
