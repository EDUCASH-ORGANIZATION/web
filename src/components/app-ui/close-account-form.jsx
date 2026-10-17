"use client"

import { useActionState, useState } from "react"
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { FormBanner } from "@/components/auth/ui/form-banner"
import { HydratedSubmit } from "@/components/auth/ui/hydrated-submit"
import { PasswordInput } from "@/components/auth/ui/password-input"

export const CONFIRMATION_WORD = "FERMER"

/**
 * Formulaire de confirmation de fermeture : saisie de FERMER et mot de passe. Le bouton reste inactif tant que
 * les deux champs ne sont pas remplis ; le serveur revérifie tout (mot de passe, confirmation exacte, blocages).
 * En succès, l'action redirige : aucun état de réussite ici.
 * @param {{ closeAction: (prev: unknown, formData: FormData) => Promise<{ error?: string, blockers?: { code: string, message: string }[] }|void>, cancelHref: string }} props
 */
export function CloseAccountForm({ closeAction, cancelHref }) {
  const [state, formAction, pending] = useActionState(closeAction, null)
  const [confirmation, setConfirmation] = useState("")
  const [password, setPassword] = useState("")
  const ready = confirmation === CONFIRMATION_WORD && password.length > 0
  const blockers = Array.isArray(state?.blockers) ? state.blockers : []

  return (
    <form action={formAction} className="form2" noValidate>
      {state?.error ? (
        <FormBanner tone="erreur">
          {state.error}
          {blockers.length > 0 ? (
            <ul>
              {blockers.map((blocker) => (
                <li key={blocker.code}>{blocker.message}</li>
              ))}
            </ul>
          ) : null}
        </FormBanner>
      ) : null}
      <div className="field">
        <label className="field__label" htmlFor="close-confirmation">
          Saisissez {CONFIRMATION_WORD} pour confirmer
          <span className="req" aria-hidden="true">*</span>
        </label>
        <input
          className="input"
          id="close-confirmation"
          name="confirmation"
          autoComplete="off"
          autoCapitalize="characters"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
      </div>
      <div className="field">
        <label className="field__label" htmlFor="close-password">
          Votre mot de passe
          <span className="req" aria-hidden="true">*</span>
        </label>
        <PasswordInput
          id="close-password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      <div className="actions2">
        <Link className="btn btn--soft" href={cancelHref}>
          Annuler
        </Link>
        <HydratedSubmit className="btn btn--danger" pending={pending} disabled={!ready}>
          Fermer mon compte
        </HydratedSubmit>
      </div>
      <p className="note2">
        <Icon name="i-lock" />
        <span>Vous êtes déconnecté tout de suite. Un email vous rappelle la date limite de réactivation.</span>
      </p>
    </form>
  )
}

export default CloseAccountForm
