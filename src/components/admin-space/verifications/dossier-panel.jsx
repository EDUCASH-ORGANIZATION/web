// @ds-screen RD-ADMIN-01
"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/design/icon"
import { CheckboxField } from "@/components/app-ui/fields"
import { useAppToast } from "@/components/app-ui/toast"
import { adminUserHref } from "@/lib/app/admin-routes"
import { formatDateFr, formatShortDate } from "@/lib/app/format"
import {
  approveStudentCard,
  rejectStudentCard,
  resetStudentRejection,
  revokeStudentBadge,
} from "@/lib/actions/admin-verifications.actions"
import { CardViewer } from "./card-viewer"
import { ApproveDialog } from "./approve-dialog"
import { RejectDialog } from "./reject-dialog"
import { ResetDialog } from "./reset-dialog"
import { RevokeDialog } from "./revoke-dialog"
import { useQueueShortcuts } from "./use-queue-shortcuts"

const CHECKLIST = ["La carte est lisible et entière", "Le nom correspond au profil", "L'année universitaire est en cours"]

const ACTION_LABELS = {
  approve: { label: "Valider", icon: "i-check", className: "btn btn--dark", key: "V" },
  reject: { label: "Refuser", icon: "i-x", className: "btn btn--danger-outline", key: "R" },
  reset: { label: "Réinitialiser le refus", icon: "i-undo", className: "btn btn--dark" },
  revoke: { label: "Révoquer le badge", icon: "i-ban", className: "btn btn--danger-outline" },
}

const KIND_HISTORY = { renouvellement: "renouvellement du badge", premiere: "première demande" }

/** Ligne d'historique : création du compte, dépôt de la carte et nature de la demande. */
export function historyLine(dossier) {
  const parts = []
  if (dossier.createdAt) parts.push(`compte créé le ${formatShortDate(dossier.createdAt)}`)
  if (dossier.submittedAt) {
    const kind = KIND_HISTORY[dossier.kind]
    parts.push(`carte envoyée le ${formatShortDate(dossier.submittedAt)}${kind ? `, ${kind}` : ""}`)
  }
  return parts.length > 0 ? `Historique : ${parts.join(" · ")}.` : ""
}

/**
 * Exécute une décision. Un refus (déjà traité, carte remplacée) recharge la file et renvoie `{ error }` : le message
 * reste affiché dans la boîte. Un succès notifie, passe au dossier suivant et recharge les données.
 * @returns {Promise<{ error: string } | { done: true }>}
 */
export async function runDecision({ run, title, text, router, notify, afterHref }) {
  const result = await run()
  if (result?.error) {
    router.refresh()
    return { error: result.error }
  }
  notify(title, result?.emailSent === false ? "E-mail non envoyé" : text)
  router.replace(afterHref)
  router.refresh()
  return { done: true }
}

/** Détail du dossier : carte, données déclarées, liste de contrôle, historique et décisions de l'onglet. */
export function DossierPanel({ dossier, hrefs, badgeUntil }) {
  const router = useRouter()
  const { success } = useAppToast()
  const [dialog, setDialog] = useState(null)
  const headingRef = useRef(null)
  const refocus = useRef(false)
  const name = dossier.name || "cet étudiant"
  const { actions } = dossier

  // Après une décision, le focus passe au dossier suivant (titre du détail), pas à la page.
  useEffect(() => {
    if (!refocus.current) return
    refocus.current = false
    headingRef.current?.focus()
  }, [dossier.userId])

  useQueueShortcuts({
    allowed: actions,
    dialogOpen: dialog !== null,
    onPrev: hrefs.prev ? () => router.push(hrefs.prev) : undefined,
    onNext: hrefs.next ? () => router.push(hrefs.next) : undefined,
    onApprove: () => setDialog("approve"),
    onReject: () => setDialog("reject"),
  })

  const decide = async (run, title, text) => {
    const outcome = await runDecision({ run, title, text, router, notify: success, afterHref: hrefs.afterDecision })
    if (outcome.done) refocus.current = true
    return outcome.error ? { error: outcome.error } : undefined
  }

  // Bureau : icône et raccourci ; mobile (barre fixe) : libellé seul. La décision elle-même passe par une confirmation.
  const buttons = (compact) =>
    actions.map((action) => {
      const spec = ACTION_LABELS[action]
      return (
        <button key={action} type="button" className={spec.className} onClick={() => setDialog(action)}>
          {compact ? null : <Icon name={spec.icon} />}
          {spec.label}
          {!compact && spec.key ? <span className="ad-kbd">{spec.key}</span> : null}
        </button>
      )
    })

  return (
    <div className="card a2-02-dossier">
      <div className="row row--between row--top">
        <div>
          {dossier.overdue48h ? (
            <span className="flag2">
              <Icon name="i-clock" />
              Délai de 48 h dépassé
            </span>
          ) : null}
          <h2 className="ds-h3 a2-02-dossier__name" ref={headingRef} tabIndex={-1}>
            {dossier.name || "Étudiant sans nom"}
          </h2>
          <div className="caption">
            {[dossier.level, dossier.school].filter(Boolean).join(" · ") || "Profil étudiant"}
          </div>
        </div>
        <Link className="link body-s" href={adminUserHref(dossier.userId)}>
          Ouvrir la fiche
        </Link>
      </div>

      <div className="ad-review">
        <CardViewer key={dossier.userId} cardView={dossier.cardView} name={name} />
        <div className="stack">
          <dl className="a2-kv">
            <dt>Nom au profil</dt>
            <dd>{dossier.name || "Non renseigné"}</dd>
            <dt>Établissement</dt>
            <dd>{dossier.school || "Non renseigné"}</dd>
            <dt>Niveau</dt>
            <dd>{dossier.level || "Non renseigné"}</dd>
            {dossier.verifiedUntil ? (
              <>
                <dt>Badge jusqu&apos;au</dt>
                <dd>{formatDateFr(dossier.verifiedUntil)}</dd>
              </>
            ) : null}
          </dl>
          {dossier.rejectionReason ? (
            <div className="a2-note a2-note--erreur">
              <Icon name="i-alert-circle" className="ic" />
              <span>
                <b>Motif du refus.</b> {dossier.rejectionReason}
              </span>
            </div>
          ) : null}
          {actions.includes("approve") ? (
            <fieldset className="a2-02-checklist">
              <legend className="body-s a2-02-checklist__legend">Contrôle (indicatif)</legend>
              {CHECKLIST.map((label) => (
                <CheckboxField key={label} label={label} />
              ))}
            </fieldset>
          ) : null}
          <p className="caption">{historyLine(dossier)}</p>
        </div>
      </div>

      {actions.length > 0 ? (
        <>
          <div className="a2-02-actions">{buttons(false)}</div>
          <div className="a2-mbar">{buttons(true)}</div>
        </>
      ) : (
        <div className="a2-note">
          <Icon name="i-info" className="ic" />
          <span>
            {dossier.tab === "expires" ? "En attente d'une nouvelle carte de l'étudiant." : "En attente d'une carte de l'étudiant."}
          </span>
        </div>
      )}

      <ApproveDialog
        open={dialog === "approve"}
        onClose={() => setDialog(null)}
        name={name}
        badgeUntil={badgeUntil}
        onConfirm={() =>
          decide(() => approveStudentCard(dossier.userId, { expectedSubmittedAt: dossier.submittedAt, expectedCardPath: dossier.cardPath }), `${name} vérifié(e)`)
        }
      />
      <RejectDialog
        open={dialog === "reject"}
        onClose={() => setDialog(null)}
        name={name}
        onConfirm={({ reason, message }) =>
          decide(
            () => rejectStudentCard(dossier.userId, { reason, message, expectedSubmittedAt: dossier.submittedAt, expectedCardPath: dossier.cardPath }),
            `Carte de ${name} refusée`,
          )
        }
      />
      <ResetDialog
        open={dialog === "reset"}
        onClose={() => setDialog(null)}
        name={name}
        onConfirm={({ reason }) =>
          decide(() => resetStudentRejection(dossier.userId, { reason }), `Refus de ${name} réinitialisé`)
        }
      />
      <RevokeDialog
        open={dialog === "revoke"}
        onClose={() => setDialog(null)}
        name={name}
        onConfirm={({ reason }) => decide(() => revokeStudentBadge(dossier.userId, { reason }), `Badge de ${name} révoqué`)}
      />
    </div>
  )
}

export default DossierPanel
