// @ds-screen RD-ADMIN-01
"use client"

import { useState } from "react"
import { Icon } from "@/components/design/icon"
import { CheckboxField, TextField } from "@/components/app-ui/fields"
import { formatDateFr } from "@/lib/app/format"
import { compareNames, expectedAcademicYears } from "@/lib/admin-space/verification-queue"
import { CardViewer } from "./card-viewer"

const CHECKLIST = ["La carte est lisible et entière", "Le nom correspond au profil", "L'année universitaire est en cours"]
const NOT_FILLED = "Non renseigné"

/** Encart des noms : rien sans saisie, « Noms concordants » (même ordre ou ordre différent) ou « Noms différents ». */
function NameVerdict({ verdict }) {
  if (verdict === "identiques" || verdict === "ordre-different") {
    return (
      <div className="banner banner--succes a2-02-namecheck">
        <Icon name="i-check-circle" className="ic" />
        <div className="banner__body">
          <div className="banner__title">Noms concordants</div>
          {verdict === "ordre-different"
            ? "Même nom et prénom dans un ordre différent. Vérifiez qu'ils sont identiques sur la carte (zone 3)."
            : "Le nom saisi est identique au nom du profil."}
        </div>
      </div>
    )
  }
  if (verdict === "differents") {
    return (
      <div className="banner banner--alerte a2-02-namecheck">
        <Icon name="i-alert-triangle" className="ic" />
        <div className="banner__body">
          <div className="banner__title">Noms différents</div>
          Le nom saisi ne correspond pas au nom du profil. Vérifiez la carte (zone 3) avant de décider.
        </div>
      </div>
    )
  }
  return null
}

/**
 * Colonne de revue d'un dossier : carte (zoom, rotation, ouverture), légende numérotée, nom lu sur la carte,
 * tableau déclaré / saisi et liste de contrôle. Le nom saisi et les cases restent dans le navigateur : ils ne sont
 * ni envoyés au serveur, ni enregistrés, ni placés dans l'URL. `children` s'affiche en fin de colonne (historique).
 * @param {{ dossier: object, today?: string, showChecklist?: boolean, children?: import("react").ReactNode }} props
 */
export function DossierReview({ dossier, today, showChecklist = false, children }) {
  const [typed, setTyped] = useState("")
  const name = dossier.name || "cet étudiant"
  const years = expectedAcademicYears(today)
  const verdict = compareNames(dossier.name, typed)
  const typedText = typed.trim()

  return (
    <div className="ad-review a2-02-review">
      <div>
        <CardViewer key={dossier.userId} cardView={dossier.cardView} name={name} />
        <div className="a2-02-legend">
          <ol className="ad-legend" aria-label="Repères de contrôle de la carte">
            <li>
              <b>1</b>Établissement : doit correspondre à celui déclaré.
            </li>
            <li>
              <b>2</b>Photo : visage visible, pas de capture d&apos;écran.
            </li>
            <li>
              <b>3</b>Nom et prénoms : comparés au nom du profil.
            </li>
            <li>
              <b>4</b>
              {years ? `Année universitaire : ${years.previous} ou ${years.current}.` : "Année universitaire : en cours ou précédente."}
            </li>
          </ol>
        </div>
      </div>

      <div className="stack">
        <TextField
          label="Nom lu sur la carte"
          optional
          help="Facultatif. Recopiez le nom pour le comparer au profil. Il n'est pas enregistré."
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          maxLength={120}
          name="card-name-check"
        />
        <div aria-live="polite">
          <NameVerdict verdict={verdict} />
        </div>

        <table className="ad-compare a2-tlist">
          <thead>
            <tr>
              <th scope="col">Champ</th>
              <th scope="col">Déclaré au profil</th>
              <th scope="col">Saisi avec la carte</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td data-label="Champ">Nom</td>
              <td data-label="Déclaré au profil">
                <b>{dossier.name || NOT_FILLED}</b>
              </td>
              <td data-label="Saisi avec la carte">
                <b>{typedText || NOT_FILLED}</b>
              </td>
            </tr>
            <tr>
              <td data-label="Champ">Établissement</td>
              <td data-label="Déclaré au profil">
                <b>{dossier.school || NOT_FILLED}</b>
              </td>
              <td data-label="Saisi avec la carte">
                <b>{NOT_FILLED}</b>
              </td>
            </tr>
            <tr>
              <td data-label="Champ">Niveau</td>
              <td data-label="Déclaré au profil">
                <b>{dossier.level || NOT_FILLED}</b>
              </td>
              <td data-label="Saisi avec la carte">
                <b>{NOT_FILLED}</b>
              </td>
            </tr>
            {years ? (
              <tr>
                <td data-label="Champ">Année</td>
                <td colSpan={2} data-label="Année attendue">
                  <b>{years.current}</b> <span className="caption">(année en cours)</span>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>

        {dossier.verifiedUntil ? (
          <p className="body-s">
            <b>Badge jusqu&apos;au</b> {formatDateFr(dossier.verifiedUntil)}
          </p>
        ) : null}
        {dossier.rejectionReason ? (
          <div className="a2-note a2-note--erreur">
            <Icon name="i-alert-circle" className="ic" />
            <span>
              <b>Motif du refus.</b> {dossier.rejectionReason}
            </span>
          </div>
        ) : null}

        {showChecklist ? (
          <fieldset className="a2-02-checklist">
            <legend className="body-s a2-02-checklist__legend">Contrôle</legend>
            {CHECKLIST.map((label) => (
              <CheckboxField key={label} label={label} />
            ))}
            <p className="caption">Ces cases vous aident à vérifier. Elles ne sont pas enregistrées.</p>
          </fieldset>
        ) : null}
        {children}
      </div>
    </div>
  )
}

export default DossierReview
