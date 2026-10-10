import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { SPRITE_VERSION } from "@/components/design/sprite"
import { COMMISSION_RATE } from "@/lib/constants/missions"

const COMMISSION_PERCENT = Math.round(COMMISSION_RATE * 100)

// Contenu du panneau de marque par public. Étudiant tutoyé (panneau bleu),
// client vouvoyé (panneau encre). Aucun délai d'examen, aucun prestataire de paiement nommé.
export const BRAND_PANELS = {
  student: {
    lines: ["Bosse entre", "deux cours."],
    highlight: "Encaisse.",
    points: [
      { icon: "i-lock", title: "Paiement garanti.", text: "Le client bloque l'argent avant que tu commences." },
      { icon: "i-shield", title: "Profils vérifiés.", text: "Carte étudiante contrôlée par l'équipe." },
      { icon: "i-smartphone", title: "Mobile Money.", text: "Retrait sur MTN MoMo, Moov Money ou Celtiis Cash." },
    ],
  },
  client: {
    lines: ["Un coup", "de main,"],
    highlight: "sans risque.",
    points: [
      { icon: "i-lock", title: "Fonds en séquestre.", text: "Votre budget est bloqué, puis versé seulement quand vous confirmez la fin." },
      { icon: "i-shield", title: "Étudiants vérifiés.", text: "Carte étudiante contrôlée par l'équipe." },
      { icon: "i-percent", title: "Commission claire.", text: `${COMMISSION_PERCENT} % prélevés sur le budget, rien d'autre à payer.` },
    ],
  },
}

/**
 * Coquille d'authentification (composant serveur) : racine .ds, gabarit .auth.
 * Bureau : panneau de marque + colonne formulaire. Sous 1024 px : en-tête .auth__top
 * (retour + logo) et une seule colonne, par media query (un seul DOM).
 *
 * Les enfants portent eux-mêmes la classe `auth__form` (le plus souvent le <form>).
 * `signOutAction` (action serveur) remplace le lien de retour par « Se déconnecter »
 * (onboardings, où l'utilisateur est déjà connecté).
 * Compatibilité avec les pages MUI de `main` : `title` et `subtitle` enveloppent alors
 * les enfants dans un `auth__form` ; `maxWidth` est ignoré.
 *
 * @param {{
 *   audience?: "student" | "client",
 *   backHref?: string,
 *   backLabel?: string,
 *   signOutAction?: (formData: FormData) => void | Promise<void>,
 *   brand?: { lines: string[], highlight: string, points?: { icon: string, title: string, text: string }[] },
 *   title?: string,
 *   subtitle?: string,
 *   maxWidth?: number,
 *   children: React.ReactNode,
 * }} props
 */
export function AuthShell({
  audience = "student",
  backHref = "/",
  backLabel = "Retour à l'accueil",
  signOutAction,
  brand,
  title,
  subtitle,
  children,
}) {
  const isClient = audience === "client"
  const panel = BRAND_PANELS[isClient ? "client" : "student"]
  const headline = brand?.lines ? brand : panel
  const points = brand?.points ?? panel.points
  const legacy = Boolean(title || subtitle)

  return (
    <div className="ds">
      <div className="auth">
        <div className={`auth__brand${isClient ? " auth__brand--client" : ""} grid-bg`}>
          <img className="logo" src="/logo-horizontal-blanc.svg" alt="EduCash" width={171} height={32} />
          <h2 className="display display--l a-brand__title">
            {headline.lines.map((line) => (
              <span key={line}>
                {line}
                <br />
              </span>
            ))}
            <span className="hl-citron">{headline.highlight}</span>
          </h2>
          <svg className="scribble a-brand__scribble" viewBox="0 0 150 70" aria-hidden="true" focusable="false">
            <use href={`/sprite.svg?v=${SPRITE_VERSION}#sc-loop`} />
          </svg>
          <div className="auth__points">
            {points.map((point) => (
              <div className="auth__point" key={point.title}>
                <span className="ic-sq ic-sq--sm">
                  <Icon name={point.icon} />
                </span>
                <span>
                  <b>{point.title}</b> {point.text}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="auth__main">
          <div className="auth__top">
            {signOutAction ? (
              <form action={signOutAction} method="post">
                <button className="btn-icon btn-icon--sm btn-icon--plain" type="submit" aria-label="Se déconnecter">
                  <Icon name="i-logout" />
                </button>
              </form>
            ) : (
              <Link className="btn-icon btn-icon--sm btn-icon--plain" href={backHref} aria-label={backLabel}>
                <Icon name="i-arrow-left" />
              </Link>
            )}
            <img className="logo logo--sm" src="/logo-horizontal-bleu.svg" alt="EduCash" width={139} height={26} />
            <span className="a-spacer" />
          </div>
          {signOutAction ? (
            <form action={signOutAction} method="post">
              <button className="auth__back a-linkbtn" type="submit">
                <Icon name="i-logout" className="ic ic--20" />
                Se déconnecter
              </button>
            </form>
          ) : (
            <Link className="auth__back" href={backHref}>
              <Icon name="i-arrow-left" className="ic ic--20" />
              {backLabel}
            </Link>
          )}
          {legacy ? (
            <div className="auth__form">
              <div>
                {title && <h1 className="ds-h1">{title}</h1>}
                {subtitle && <p className="muted a-lead">{subtitle}</p>}
              </div>
              {children}
            </div>
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  )
}
