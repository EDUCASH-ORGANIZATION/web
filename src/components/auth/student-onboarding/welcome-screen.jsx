import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { FormBanner } from "@/components/auth/ui/form-banner"

export const MISSIONS_PATH = "/student/missions"
export const DASHBOARD_PATH = "/dashboard"
export const CARD_UPLOAD_PATH = "/profile/edit"

/** Prénom affiché : premier mot du nom complet. */
export function firstNameOf(fullName) {
  return String(fullName ?? "").trim().split(/\s+/)[0] ?? ""
}

/**
 * Écran Bienvenue (fin de l'onboarding étudiant).
 * `destination` vient de l'action serveur : le tableau de bord, ou un retour validé
 * (ex. mission d'où l'étudiant venait postuler).
 * @param {{ fullName: string, cardSent: boolean, destination: string }} props
 */
export function WelcomeScreen({ fullName, cardSent, destination }) {
  const firstName = firstNameOf(fullName)
  const resume = destination && destination !== DASHBOARD_PATH
  const primaryHref = resume ? destination : MISSIONS_PATH

  return (
    <div className="auth__form">
      <div className="stack stack--3 a-center">
        <span className="sticker sticker--round">
          <Icon name="i-sparkles" />
        </span>
        <h1 className="display display--m a-display--accent">
          Bienvenue,
          <br />
          <span className="hl-bleu">{firstName ? `${firstName}.` : "à bord."}</span>
        </h1>
        <p className="muted">Ton profil est prêt.</p>
        {cardSent ? (
          <span className="badge badge--alerte">
            <Icon name="i-clock" />
            En cours d&apos;examen
          </span>
        ) : (
          <span className="badge badge--neutre">
            <Icon name="i-id-card" />
            Non vérifié
          </span>
        )}
      </div>

      {cardSent ? (
        <FormBanner tone="info" icon="i-clock" title="Ta carte est en cours d'examen">
          Nous examinons ta carte, tu recevras un email. Tu peux déjà postuler, le client verra « En cours d&apos;examen ».
        </FormBanner>
      ) : (
        <FormBanner
          tone="alerte"
          icon="i-id-card"
          title="Carte étudiante à envoyer"
          actions={
            <Link className="btn btn--dark btn--sm" href={CARD_UPLOAD_PATH}>
              <Icon name="i-upload" />
              Envoyer ma carte
            </Link>
          }
        >
          Tu peux tout explorer, mais tu devras l&apos;envoyer pour postuler à une mission.
        </FormBanner>
      )}

      <Link className="btn btn--accent btn--lg btn--block" href={primaryHref}>
        {resume ? "Continuer" : "Explorer les missions"}
        <span className="btn__dot">
          <Icon name="i-arrow-right" />
        </span>
      </Link>
      <Link className="btn btn--secondary btn--block" href={DASHBOARD_PATH}>
        Aller à mon tableau de bord
      </Link>
      <p className="caption a-center">Astuce : complète ta bio et tes disponibilités depuis Mon profil.</p>
    </div>
  )
}
