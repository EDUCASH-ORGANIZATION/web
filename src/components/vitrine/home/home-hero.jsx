import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { SPRITE_VERSION } from "@/components/design/sprite"
import { CITIES, MISSION_TYPES, SEARCH_MAX_LENGTH, netAmount } from "@/lib/constants/missions"
import { formatFcfa } from "@/lib/vitrine/format"
import { VitrineNavbar } from "@/components/vitrine/vitrine-navbar"

const POPULAR = ["Cours particuliers", "Livraison", "Saisie", "Babysitting"].filter((t) =>
  MISSION_TYPES.includes(t),
)
const EXAMPLE_BUDGET = 25000

const SPRITE = `/sprite.svg?v=${SPRITE_VERSION}`

function ctasFor(role) {
  if (role === "student") {
    return { primary: { href: "/student/missions", label: "Voir les missions pour moi" }, secondary: null }
  }
  if (role === "client") {
    return { primary: { href: "/client/missions/new", label: "Publier une mission" }, secondary: null }
  }
  return {
    primary: { href: "/auth/register?role=student", label: "Créer mon compte" },
    secondary: { href: "/clients", label: "Pour les clients" },
  }
}

function CitySelect({ id }) {
  return (
    <>
      <label className="sr-only" htmlFor={id}>Ville</label>
      <select id={id} name="ville" className="select select--sm ds-select-bare" defaultValue="">
        <option value="">Toutes les villes</option>
        {CITIES.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
    </>
  )
}

function Chip({ type }) {
  return (
    <Link className="chip chip--sm" href={`/missions?type=${encodeURIComponent(type)}`}>
      {type}
    </Link>
  )
}

// Hero de l'accueil (maquette V01). La pastille affiche le compteur seulement en mode "live".
export function HomeHero({ live, openMissions, role }) {
  const { primary, secondary } = ctasFor(role)
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
    <div className="hero grid-bg">
      <VitrineNavbar tone="bleu" />
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
            Des petites missions près de ta fac : cours, livraisons, saisie, garde d&rsquo;enfants. Le client bloque
            l&rsquo;argent avant que tu commences, tu le retires sur ton MTN MoMo ou ton Moov Money.
          </p>

          <form className="search search--hero v01-hero-search ds-desk-only" role="search" action="/missions" method="get">
            <Icon name="i-search" />
            <label className="sr-only" htmlFor="home-q">Mot-clé</label>
            <input
              id="home-q"
              name="q"
              type="search"
              maxLength={SEARCH_MAX_LENGTH}
              placeholder="Cours de maths, livraison, saisie…"
            />
            <span className="search__city">
              <Icon name="i-map-pin" className="ic ic--16" />
              <CitySelect id="home-ville" />
            </span>
            <button type="submit" className="btn btn--primary">Chercher</button>
          </form>

          <form className="v-msearch ds-mt-5 ds-mob-only" role="search" action="/missions" method="get">
            <div className="search">
              <Icon name="i-search" />
              <label className="sr-only" htmlFor="home-q-m">Mot-clé</label>
              <input
                id="home-q-m"
                name="q"
                type="search"
                maxLength={SEARCH_MAX_LENGTH}
                placeholder="Cours, livraison, saisie…"
              />
            </div>
            <div className="v-msearch__row">
              <span className="v-msearch__city">
                <Icon name="i-map-pin" className="ic ic--16" />
                <CitySelect id="home-ville-m" />
              </span>
              <button type="submit" className="btn btn--primary">Chercher</button>
            </div>
          </form>

          <div className="v-popular on-bleu ds-desk-only">
            <span>Populaire :</span>
            {POPULAR.map((t) => <Chip key={t} type={t} />)}
          </div>
          <div className="chips chips--scroll on-bleu ds-mt-4 ds-mob-only">
            {POPULAR.map((t) => <Chip key={t} type={t} />)}
          </div>

          <div className="row ds-mt-6 ds-gap-4">
            <Link className="btn btn--accent btn--lg" href={primary.href}>
              {primary.label}
              <span className="btn__dot"><Icon name="i-arrow-right" /></span>
            </Link>
            {secondary ? (
              <Link className="btn btn--ghost" href={secondary.href}>{secondary.label}</Link>
            ) : null}
          </div>
        </div>

        <div className="v-hero__visual" aria-hidden="true">
          <div className="photo-ph">
            <svg className="v01-ph-art" viewBox="0 0 64 64" focusable="false">
              <use href={`${SPRITE}#av-1`} />
            </svg>
          </div>
          <div className="push v-hero__push">
            <img className="logo-sym" src="/logo-symbole-bleu.svg" alt="" width={40} height={40} />
            <div>
              <div className="push__app">EduCash · exemple</div>
              <div className="push__title">Paiement reçu : {formatFcfa(netAmount(EXAMPLE_BUDGET))}</div>
              <div className="caption">Versé sur ton MTN MoMo</div>
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
