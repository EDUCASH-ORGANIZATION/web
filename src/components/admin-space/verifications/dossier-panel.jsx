// @ds-screen RD-ADMIN-01
"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/design/icon"
import { Avatar } from "@/components/app-ui/avatar"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { useAppToast } from "@/components/app-ui/toast"
import { adminUserHref } from "@/lib/app/admin-routes"
import { historySteps } from "@/lib/admin-space/verification-queue"
import {
  approveStudentCard,
  rejectStudentCard,
  resetStudentRejection,
  revokeStudentBadge,
} from "@/lib/actions/admin-verifications.actions"
import { DossierReview } from "./dossier-review"
import { shortDay } from "./queue-list"
import { ApproveDialog } from "./approve-dialog"
import { RejectDialog } from "./reject-dialog"
import { ResetDialog } from "./reset-dialog"
import { RevokeDialog } from "./revoke-dialog"
import { useQueueShortcuts } from "./use-queue-shortcuts"
import { leaveFullscreen } from "./card-viewer"

const ACTION_LABELS = {
  approve: { label: "Valider", icon: "i-check", className: "btn btn--primary a2-02-cta", key: "V" },
  reject: { label: "Refuser", icon: "i-x", className: "btn btn--danger-outline", key: "R" },
  reset: { label: "Réinitialiser le dossier", icon: "i-refresh", className: "btn btn--secondary" },
  revoke: { label: "Révoquer le badge", icon: "i-ban", className: "btn btn--danger-outline" },
}

// État du dossier selon l'onglet : pastille d'en-tête.
const TAB_STATUS = {
  "a-examiner": { label: "En cours d'examen", tone: "alerte", icon: "i-clock" },
  refuses: { label: "Carte refusée", tone: "erreur" },
  verifies: { label: "Vérifié", tone: "succes" },
  expires: { label: "Badge expiré", tone: "neutre" },
  incomplets: { label: "Non vérifié", tone: "neutre" },
}

// Ordre d'affichage des décisions (planche v1 : Refuser à gauche de Valider) ; l'ensemble vient de `dossier.actions`.
const ACTION_ORDER = ["reject", "approve", "reset", "revoke"]

const STEP_ICONS = { done: "i-check", current: "i-clock", error: "i-x" }

const plural = (n, one, many) => (n > 1 ? many : one)

/** Légende de l'en-tête : « Licence 3 · EPAC · soumis le 5 oct. (3 jours) » ; seules les données connues figurent. */
export function dossierCaption(dossier) {
  const parts = [dossier.level, dossier.school].filter(Boolean)
  const day = shortDay(dossier.submittedOn)
  if (day) {
    const age = Number.isInteger(dossier.ageDays) ? ` (${dossier.ageDays === 0 ? "aujourd'hui" : `${dossier.ageDays} ${plural(dossier.ageDays, "jour", "jours")}`})` : ""
    parts.push(`soumis le ${day}${age}`)
  }
  return parts.join(" · ") || "Profil étudiant"
}

/** Frise « Historique des décisions » : dates connues, sauf la validation, estimée depuis l'échéance (voir `historySteps`). */
export function DecisionTimeline({ dossier }) {
  const steps = historySteps(dossier)
  if (steps.length === 0) return null
  return (
    <div>
      <b className="body-s">Historique des décisions</b>
      <ol className="timeline a2-02-timeline">
        {steps.map((step) => {
          const meta = [shortDay(step.at), step.meta].filter(Boolean).join(" · ")
          return (
            <li key={step.title} className={`tl-item is-${step.state}`}>
              <span className="tl-item__dot">
                <Icon name={STEP_ICONS[step.state]} />
              </span>
              <div>
                <div className="tl-item__title">{step.title}</div>
                {meta ? <div className="tl-item__meta">{meta}</div> : null}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
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

/** Détail du dossier : en-tête, revue de la carte, historique et décisions de l'onglet. */
export function DossierPanel({ dossier, hrefs, badgeUntil }) {
  const router = useRouter()
  const { success } = useAppToast()
  const [dialog, setDialog] = useState(null)
  const [advance, setAdvance] = useState(true)
  const headingRef = useRef(null)
  const refocus = useRef(false)
  const name = dossier.name || "cet étudiant"
  const { actions } = dossier

  // Après une décision, le focus va au titre du détail : celui du dossier suivant (changement d'identifiant) ou,
  // bascule désactivée, celui du même dossier dont l'état a changé (changement d'onglet). Jamais à la page.
  useEffect(() => {
    if (!refocus.current) return
    refocus.current = false
    headingRef.current?.focus()
  }, [dossier.userId, dossier.tab])

  // Une confirmation rendue dans la page resterait cachée derrière la carte en plein écran : on en sort d'abord.
  const openDialog = (action) => {
    if (typeof document !== "undefined") leaveFullscreen(document)
    setDialog(action)
  }

  useQueueShortcuts({
    allowed: actions,
    dialogOpen: dialog !== null,
    onPrev: hrefs.prev ? () => router.push(hrefs.prev) : undefined,
    onNext: hrefs.next ? () => router.push(hrefs.next) : undefined,
    onApprove: () => openDialog("approve"),
    onReject: () => openDialog("reject"),
  })

  // Valider et Refuser suivent la bascule (visible seulement sur À examiner) ; Réinitialiser et Révoquer restent sur le
  // dossier (`self`) quel que soit l'état mémorisé de la bascule, qu'ils n'affichent pas.
  const decide = async (run, title, text, { followAdvance = true } = {}) => {
    const afterHref = followAdvance && advance ? hrefs.afterDecision : hrefs.self
    const outcome = await runDecision({ run, title, text, router, notify: success, afterHref })
    if (outcome.done) refocus.current = true
    return outcome.error ? { error: outcome.error } : undefined
  }

  // Bureau : icône et raccourci ; mobile (barre fixe) : libellé seul. La décision elle-même passe par une confirmation.
  const buttons = (compact) =>
    ACTION_ORDER.filter((action) => actions.includes(action)).map((action) => {
      const spec = ACTION_LABELS[action]
      return (
        <button key={action} type="button" className={spec.className} onClick={() => openDialog(action)}>
          {compact ? null : <Icon name={spec.icon} />}
          {spec.label}
          {!compact && spec.key ? <span className="ad-kbd">{spec.key}</span> : null}
        </button>
      )
    })

  return (
    <div className="card a2-02-dossier">
      <div className="a2-02-dossier__head">
        {/* Avatar décoratif : le nom est déjà annoncé par le titre h2 qui suit. */}
        <span className="a2-02-avatar" aria-hidden="true">
          <Avatar name={dossier.name || "Étudiant sans nom"} />
        </span>
        <div className="a2-02-dossier__id">
          <h2 className="ds-h3 a2-02-dossier__name" ref={headingRef} tabIndex={-1}>
            {dossier.name || "Étudiant sans nom"}
          </h2>
          {dossier.overdue48h ? (
            <div className="ds-mob-only">
              <span className="badge badge--erreur badge--sm">+48 h</span>
            </div>
          ) : null}
          <div className="caption">{dossierCaption(dossier)}</div>
        </div>
        <div className="a2-02-dossier__status">
          {/* Annonce du nouvel état après une décision quand le dossier reste affiché (bascule désactivée). */}
          <span aria-live="polite">
            <StatusBadge {...(TAB_STATUS[dossier.tab] ?? TAB_STATUS.incomplets)} />
          </span>
          <Link className="link body-s" href={adminUserHref(dossier.userId)}>
            Ouvrir la fiche
          </Link>
        </div>
      </div>

      {/* Une instance par dossier : le nom recopié et les cases de contrôle ne passent jamais d'un dossier à l'autre. */}
      <DossierReview key={dossier.userId} dossier={dossier} today={dossier.today} showChecklist={actions.includes("approve")}>
        <DecisionTimeline dossier={dossier} />
      </DossierReview>

      {actions.length > 0 ? (
        <>
          <div className="a2-02-actions">
            {actions.includes("approve") ? (
              <label className="switch">
                <input type="checkbox" checked={advance} onChange={(event) => setAdvance(event.target.checked)} />
                Passer au dossier suivant après décision
              </label>
            ) : null}
            <div className="a2-02-actions__btns">{buttons(false)}</div>
          </div>
          <div className="a2-mbar">{buttons(true)}</div>
        </>
      ) : null}

      <ApproveDialog
        open={dialog === "approve"}
        onClose={() => setDialog(null)}
        name={name}
        caption={[dossier.level, dossier.school].filter(Boolean).join(" · ")}
        badgeUntil={badgeUntil}
        advance={advance}
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
          decide(() => resetStudentRejection(dossier.userId, { reason }), `Dossier de ${name} réinitialisé`, undefined, { followAdvance: false })
        }
      />
      <RevokeDialog
        open={dialog === "revoke"}
        onClose={() => setDialog(null)}
        name={name}
        onConfirm={({ reason }) =>
          decide(() => revokeStudentBadge(dossier.userId, { reason }), `Badge de ${name} révoqué`, undefined, { followAdvance: false })
        }
      />
    </div>
  )
}

export default DossierPanel
