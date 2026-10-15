// @ds-screen RD-ADMIN-01
"use client"

import { useState } from "react"
import { Icon } from "@/components/design/icon"
import { CheckboxField, TextField } from "@/components/app-ui/fields"
import { formatDateFr } from "@/lib/app/format"
import { compareNames, expectedAcademicYears } from "@/lib/admin-space/verification-queue"
import { CardViewer } from "./card-viewer"
import { shortDay } from "./queue-list"

const CHECKLIST = ["La carte est lisible et entière", "Le nom correspond au profil", "L'année universitaire est en cours"]
const NOT_FILLED = "Non renseigné"
const DAY_ONLY = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 24 * 60 * 60 * 1000

/** Jours écoulés depuis l'échéance du badge (jour "AAAA-MM-JJ" contre aujourd'hui), jamais négatif ; null si illisible. */
export function daysSinceExpiry(verifiedUntil, today) {
  const until = typeof verifiedUntil === "string" ? verifiedUntil.trim().slice(0, 10) : ""
  const day = typeof today === "string" ? today.trim().slice(0, 10) : ""
  if (!DAY_ONLY.test(until) || !DAY_ONLY.test(day)) return null
  const a = Date.parse(`${until}T00:00:00Z`)
  const b = Date.parse(`${day}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return Math.max(0, Math.round((b - a) / DAY_MS))
}

/** Titre de la bannière d'un badge expiré : « Badge expiré depuis 12 jours » (« Badge expiré » si le jour est illisible). */
export function expiredTitle(days) {
  if (days === null || days === undefined) return "Badge expiré"
  if (days === 0) return "Badge expiré aujourd'hui"
  return `Badge expiré depuis ${days} ${days > 1 ? "jours" : "jour"}`
}

/** Légende numérotée des repères de la carte (même contenu au bureau et sur mobile). */
function Legend({ years, className }) {
  return (
    <div className={className ? `a2-02-legend ${className}` : "a2-02-legend"}>
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
  )
}

/** Bannière du système : icône, titre et texte. */
function Note({ tone, icon, title, children }) {
  return (
    <div className={`banner banner--${tone}`}>
      <Icon name={icon} className="ic" />
      <div className="banner__body">
        <div className="banner__title">{title}</div>
        {children}
      </div>
    </div>
  )
}

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
 * Colonne de revue d'un dossier, selon l'onglet (`dossier.tab`) :
 * - À examiner : carte, légende numérotée, nom lu sur la carte, tableau déclaré / saisi (bureau) ou liste « kv »
 *   (mobile) et liste de contrôle ; un renouvellement rappelle l'échéance du badge actuel (« Badge actuel jusqu'au ») ;
 * - Refusés : motif du refus ; Vérifiés : échéance du badge ; Expirés : durée depuis l'échéance ;
 * - Incomplets : carte manquante et explication.
 * Le nom saisi et les cases restent dans le navigateur : ils ne sont ni envoyés au serveur, ni enregistrés, ni placés
 * dans l'URL. `children` s'affiche en fin de colonne (historique).
 * @param {{ dossier: object, today?: string, showChecklist?: boolean, children?: import("react").ReactNode }} props
 */
export function DossierReview({ dossier, today, showChecklist = false, children }) {
  const [typed, setTyped] = useState("")
  const tab = dossier.tab ?? "a-examiner"
  const name = dossier.name || "cet étudiant"
  const years = expectedAcademicYears(today)
  const verdict = compareNames(dossier.name, typed)
  const typedText = typed.trim()

  if (tab === "incomplets") {
    return (
      <div className="ad-review a2-02-review">
        <div className="ad-idcard ad-idcard--missing a2-02-missing">
          <div className="stack stack--2">
            <Icon name="i-id-card" className="ic" />
            <b>Aucune carte fournie</b>
            <span>Le compte existe mais aucune carte n&apos;a été envoyée.</span>
          </div>
        </div>
        <div className="stack">
          <Note tone="info" icon="i-info" title="Validation impossible sans carte">
            Un dossier incomplet ne peut être ni validé ni refusé.
          </Note>
          {children}
        </div>
      </div>
    )
  }

  const submitted = shortDay(dossier.submittedOn)
  const viewer = (
    <div>
      <CardViewer key={dossier.userId} cardView={dossier.cardView} name={name} />
      <Legend years={years} className={tab === "a-examiner" ? "ds-desk-only" : undefined} />
    </div>
  )

  if (tab !== "a-examiner") {
    return (
      <div className="ad-review a2-02-review">
        {viewer}
        <div className="stack">
          {tab === "refuses" ? (
            <Note tone="erreur" icon="i-x" title={dossier.rejectionReason ? `Motif : ${dossier.rejectionReason}` : "Carte refusée"} />
          ) : null}
          {tab === "verifies" ? (
            <>
              {dossier.verifiedUntil ? (
                <dl className="kv">
                  <dt>Badge valable jusqu&apos;au</dt>
                  <dd>{formatDateFr(dossier.verifiedUntil)}</dd>
                </dl>
              ) : null}
              <Note tone="info" icon="i-info" title="Révocation immédiate">
                La révocation retire le badge tout de suite. L&apos;étudiant devra renvoyer une carte.
              </Note>
            </>
          ) : null}
          {tab === "expires" ? (
            <Note tone="alerte-doux" icon="i-history" title={expiredTitle(daysSinceExpiry(dossier.verifiedUntil, today))}>
              Aucune nouvelle carte reçue.
            </Note>
          ) : null}
          {children}
        </div>
      </div>
    )
  }

  // Renouvellement : le dossier à examiner a encore un badge ; son échéance actuelle est rappelée (bureau et mobile).
  // Calculée ici seulement : les autres onglets lisent `verifiedUntil` chacun à leur manière (Expirés tolère un jour illisible).
  const currentUntil = dossier.verifiedUntil ? formatDateFr(dossier.verifiedUntil) : ""

  return (
    <div className="ad-review a2-02-review">
      {viewer}

      <div className="stack">
        <div className="ds-mob-only stack">
          <div aria-live="polite">
            <NameVerdict verdict={verdict} />
          </div>
          <dl className="kv a2-02-mkv">
            <dt>Nom au profil</dt>
            <dd>{dossier.name || NOT_FILLED}</dd>
            <dt>Nom saisi</dt>
            <dd>{typedText || "À lire zone 3"}</dd>
            <dt>Établissement</dt>
            <dd>{dossier.school || NOT_FILLED}</dd>
            {years ? (
              <>
                <dt>Année attendue</dt>
                <dd>{years.current}</dd>
              </>
            ) : null}
            {submitted ? (
              <>
                <dt>Soumis</dt>
                <dd>{submitted}</dd>
              </>
            ) : null}
            {currentUntil ? (
              <>
                <dt>Badge actuel jusqu&apos;au</dt>
                <dd>{currentUntil}</dd>
              </>
            ) : null}
          </dl>
          <Legend years={years} />
        </div>

        <TextField
          label="Nom lu sur la carte"
          optional
          help="Facultatif. Recopiez le nom pour le comparer au profil. Il n'est pas enregistré."
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          maxLength={120}
        />
        <div className="ds-desk-only" aria-live="polite">
          <NameVerdict verdict={verdict} />
        </div>

        <table className="ad-compare a2-tlist ds-desk-only">
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
                <b>{typedText || "À lire sur la carte (zone 3)"}</b>
              </td>
            </tr>
            <tr>
              <td data-label="Champ">Établissement</td>
              <td data-label="Déclaré au profil">
                <b>{dossier.school || NOT_FILLED}</b>
              </td>
              <td data-label="Saisi avec la carte">
                <b>À lire sur la carte (zone 1)</b>
              </td>
            </tr>
            <tr>
              <td data-label="Champ">Niveau</td>
              <td data-label="Déclaré au profil">
                <b>{dossier.level || NOT_FILLED}</b>
              </td>
              <td data-label="Saisi avec la carte">
                <b>À lire sur la carte</b>
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
            {currentUntil ? (
              <tr>
                <td data-label="Champ">Badge actuel</td>
                <td colSpan={2} data-label="Échéance">
                  jusqu&apos;au <b>{currentUntil}</b>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>

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
