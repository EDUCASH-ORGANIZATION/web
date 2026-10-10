"use client"

import { useRef } from "react"
import { Icon } from "@/components/design/icon"
import { AuthStepper } from "@/components/auth/ui/auth-stepper"
import { FieldError } from "@/components/auth/ui/field-error"
import { FormBanner } from "@/components/auth/ui/form-banner"
import { STEP_LABELS, StepSubmit } from "./step-identity"

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
export const AVATAR_TYPES = ["image/jpeg", "image/png"]
export const CARD_TYPES = ["image/jpeg", "image/png", "application/pdf"]

const TIPS = [
  "Les 4 coins de la carte sont visibles.",
  "La photo est nette, sans reflet.",
  "Ton nom et l'année en cours sont lisibles.",
  "JPG, PNG ou PDF, 10 Mo maximum.",
]

function megabytes(size) {
  return `${(size / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`
}

/**
 * Contrôle d'un fichier choisi avant tout envoi.
 * @param {{ type: string, size: number }} file
 * @param {string[]} accepted types MIME acceptés
 * @param {"photo" | "carte"} kind
 * @returns {string} message d'erreur tutoyé, ou "" si le fichier est valide
 */
export function validateUpload(file, accepted, kind) {
  if (!accepted.includes(file.type)) {
    return kind === "photo"
      ? "Format non accepté. Envoie une photo JPG ou PNG."
      : "Format non accepté. Envoie une photo JPG, PNG ou un PDF."
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `Fichier trop lourd (${megabytes(file.size)}). 10 Mo maximum. Réduis la photo ou envoie un PDF.`
  }
  return ""
}

/**
 * Étape 3 : carte étudiante facultative.
 * @param {{
 *   card: { name: string } | null,
 *   cardError?: string,
 *   formError?: string,
 *   pending: boolean,
 *   onPickCard: (file: File | null) => void,
 *   onBack: () => void,
 *   onSubmit: () => void,
 *   onSkip: () => void,
 * }} props
 */
export function StepCard({ card, cardError = "", formError = "", pending, onPickCard, onBack, onSubmit, onSkip }) {
  const fileRef = useRef(null)

  function handleSubmit(event) {
    event.preventDefault()
    if (!pending) onSubmit()
  }

  function openPicker() {
    fileRef.current?.click()
  }

  return (
    <form className="auth__form" method="post" noValidate onSubmit={handleSubmit}>
      <AuthStepper steps={STEP_LABELS} current={3} />
      <div>
        <h1 className="ds-h1">Ta carte étudiante</h1>
        <p className="muted a-lead">Elle prouve que tu es étudiant. Seule l&apos;équipe EduCash la voit.</p>
      </div>
      {formError && <FormBanner tone="erreur">{formError}</FormBanner>}
      <FormBanner tone="info" title="Facultatif à ce stade">
        Tu pourras postuler dès l&apos;envoi : le client verra « En cours d&apos;examen ». Nous examinons ta carte, tu recevras
        un email.
      </FormBanner>

      <div className="field">
        <span className="field__label">
          Carte étudiante <span className="opt">facultatif</span>
        </span>
        <input
          ref={fileRef}
          className="sr-only"
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          tabIndex={-1}
          aria-label="Choisir ta carte étudiante"
          onChange={(event) => {
            onPickCard(event.target.files?.[0] ?? null)
            event.target.value = ""
          }}
        />
        {card ? (
          <div className="file file--ok">
            <span className="file__thumb">
              <Icon name="i-id-card" className="ic ic--20" />
            </span>
            <div className="ds-grow">
              <div className="file__name">{card.name}</div>
              <div className="file__meta">Prête à être envoyée</div>
            </div>
            <button className="btn btn--ghost btn--sm" type="button" onClick={openPicker}>
              Remplacer
            </button>
          </div>
        ) : (
          <div
            className={`upload${cardError ? " is-error" : ""}`}
            role="button"
            tabIndex={0}
            onClick={openPicker}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                openPicker()
              }
            }}
          >
            <span className={`ic-sq ic-sq--lg${cardError ? " ic-sq--erreur" : ""}`}>
              <Icon name={cardError ? "i-alert-triangle" : "i-id-card"} />
            </span>
            <span className="upload__title">Dépose ta carte étudiante</span>
            <span className="upload__hint">
              ou <span className="link">choisis un fichier</span> · JPG, PNG, PDF · 10 Mo max
            </span>
          </div>
        )}
        <FieldError id="o-card-error" message={cardError} />
      </div>

      <ul className="a-tips">
        {TIPS.map((tip) => (
          <li key={tip}>
            <Icon name="i-check-circle" />
            {tip}
          </li>
        ))}
      </ul>

      <div className="stack stack--3">
        <StepSubmit block pending={pending}>
          {card ? "Envoyer et terminer" : "Terminer"}
        </StepSubmit>
        <div className="row row--between">
          <button className="btn btn--secondary" type="button" disabled={pending} onClick={onBack}>
            <Icon name="i-arrow-left" />
            Retour
          </button>
          <button className="btn btn--ghost" type="button" disabled={pending} onClick={onSkip}>
            Plus tard
          </button>
        </div>
      </div>
    </form>
  )
}
