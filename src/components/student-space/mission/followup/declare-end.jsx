"use client"
// @ds-screen RD-STUDENT-01
import { useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/design/icon"
import { Modal } from "@/components/app-ui/modal"
import { useAppToast } from "@/components/app-ui/toast"
import { declareMissionCompletion } from "@/lib/actions/mission-completion.actions"
import { COMPLETION_COPY } from "@/lib/missions/completion"
import { formatFcfa } from "@/lib/app/format"
import { COMMISSION_RATE } from "@/lib/constants/missions"
import { clientWho, declarePrompt, declaredToast } from "./declare-copy"

const FALLBACK_ERROR = "Une erreur est survenue. Réessayez dans un instant."
const COMMISSION_PERCENT = Math.round(COMMISSION_RATE * 100)

/**
 * Déclaration de la fin, une seule à la fois : tant qu'un appel est en cours, un second clic est ignoré.
 * `lock` est un objet `{ busy }` conservé entre les rendus (useRef). Renvoie `{ skipped: true }`,
 * `{ error, code }` ou `{ success: true, alreadyDeclared }`.
 * @param {{ busy: boolean }} lock
 * @param {(missionId: string) => Promise<{ success?: boolean, alreadyDeclared?: boolean, error?: string, code?: string }>} declare
 * @param {string} missionId
 */
export async function declareOnce(lock, declare, missionId) {
  if (lock.busy) return { skipped: true }
  lock.busy = true
  try {
    const result = await declare(missionId)
    if (result?.error) return { error: result.error, code: result.code ?? "generic" }
    if (!result?.success) return { error: FALLBACK_ERROR, code: "generic" }
    return { success: true, alreadyDeclared: result.alreadyDeclared === true }
  } catch {
    return { error: FALLBACK_ERROR, code: "generic" }
  } finally {
    lock.busy = false
  }
}

/** « Actualiser » recharge les données de la page puis ferme la modale (la mission affichée est celle à jour). */
export function refreshAndClose(refresh, close) {
  refresh()
  close()
}

/** Carte « Vous avez fini ? » (non déclarée) : le bouton ouvre la modale, il n'écrit rien. */
export function DeclareEndCard({ clientName, paymentsEnabled, reportHref, onOpen, children }) {
  return (
    <section className="e2-sec e2-05-end" aria-label="Fin de mission">
      <div className="e2-sec__head">
        <h2 className="e2-sec__title">Vous avez fini ?</h2>
      </div>
      <div className="e2-sec__body">
        <p className="e2-05-caption">{declarePrompt(clientName, paymentsEnabled)}</p>
        <button type="button" className="btn btn--dark btn--block e2-05-end__btn" onClick={onOpen}>
          <Icon name="i-check-circle" />
          {COMPLETION_COPY.action}
        </button>
        <Link className="e2-link e2-link--quiet" href={reportHref}>
          <Icon name="i-flag" />
          Signaler un problème
        </Link>
        {children}
      </div>
    </section>
  )
}

/** Barre fixe mobile : « Votre part » (si le gain est valide) et le même bouton que la carte. */
export function DeclareEndBar({ net, paymentsEnabled, onOpen }) {
  return (
    <div className="e2-mbar">
      <div className="e2-mbar__info">
        {net === null ? null : (
          <>
            <span className="e2-amount e2-amount--s">{formatFcfa(net)}</span>
            <small>{`Votre part (${100 - COMMISSION_PERCENT} %)${paymentsEnabled ? " · en séquestre" : ""}`}</small>
          </>
        )}
      </div>
      <button type="button" className="btn btn--dark" onClick={onOpen}>
        <Icon name="i-check-circle" />
        {COMPLETION_COPY.action}
      </button>
    </div>
  )
}

/**
 * Vue pure de la modale. « Annuler » reçoit le focus initial. En cas d'échec, une bannière montre le message de
 * l'action ; `already_done` remplace l'envoi par « Actualiser », `unavailable` retire le bouton d'envoi.
 */
export function DeclareEndDialogView({
  title,
  clientName,
  net,
  paymentsEnabled,
  pending,
  error,
  errorCode,
  onSubmit,
  onRefresh,
  onCancel,
  cancelRef,
}) {
  const who = clientWho(clientName)
  const alreadyDone = Boolean(error) && errorCode === "already_done"
  const unavailable = Boolean(error) && errorCode === "unavailable"
  return (
    <Modal
      open
      onClose={onCancel}
      title={COMPLETION_COPY.confirmTitle}
      description={title}
      initialFocusRef={cancelRef}
      footer={
        <>
          <button type="button" ref={cancelRef} className="btn btn--soft" onClick={onCancel} disabled={pending}>
            {COMPLETION_COPY.confirmCancel}
          </button>
          {alreadyDone ? (
            <button type="button" className="btn btn--dark" onClick={onRefresh}>
              <Icon name="i-refresh" />
              Actualiser
            </button>
          ) : unavailable ? null : (
            <button
              type="button"
              className="btn btn--dark"
              onClick={onSubmit}
              disabled={pending}
              aria-busy={pending ? "true" : undefined}
            >
              {pending ? (
                "Envoi en cours"
              ) : (
                <>
                  <Icon name="i-check-circle" />
                  {COMPLETION_COPY.confirmSubmit}
                </>
              )}
            </button>
          )}
        </>
      }
    >
      {error ? (
        <div className="banner banner--erreur" role="alert">
          <Icon name="i-alert-triangle" />
          <div className="banner__body">{error}</div>
        </div>
      ) : null}
      <p className="e2-05-caption">{`Nous prévenons ${who.lower} tout de suite.`}</p>
      <div className="e2-kv">
        <div className="e2-kv__row">
          <span>Statut</span>
          <b>{COMPLETION_COPY.toConfirmBadge}</b>
        </div>
        <div className="e2-kv__row">
          <span>Ensuite</span>
          <b>{`${who.upper} confirme la fin de mission`}</b>
        </div>
        {paymentsEnabled && net !== null ? (
          <div className="e2-kv__row e2-kv__row--total">
            <span>{`Votre part (${100 - COMMISSION_PERCENT} %), versée après sa confirmation`}</span>
            <b>{formatFcfa(net)}</b>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}

function DeclareEndDialog({ missionId, title, clientName, net, paymentsEnabled, onClose }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(null)
  const [errorCode, setErrorCode] = useState(null)
  const router = useRouter()
  const toast = useAppToast()
  const lock = useRef({ busy: false })
  const cancelRef = useRef(null)

  async function submit() {
    setPending(true)
    setError(null)
    setErrorCode(null)
    const result = await declareOnce(lock.current, declareMissionCompletion, missionId)
    if (result.skipped) return
    if (result.error) {
      setError(result.error)
      setErrorCode(result.code ?? "generic")
      setPending(false)
      return
    }
    onClose()
    toast.success("C'est noté.", declaredToast(clientName))
    router.refresh()
  }

  return (
    <DeclareEndDialogView
      title={title}
      clientName={clientName}
      net={net}
      paymentsEnabled={paymentsEnabled}
      pending={pending}
      error={error}
      errorCode={errorCode}
      onSubmit={submit}
      onRefresh={() => refreshAndClose(router.refresh, onClose)}
      onCancel={() => {
        if (!pending) onClose()
      }}
      cancelRef={cancelRef}
    />
  )
}

/**
 * Îlot client de la fin de mission (E05) : un seul état d'ouverture partagé entre la carte, la barre mobile et la
 * modale. `initialOpen` (drapeau `?terminer=1`, déjà filtré par `actions.declareEnd`) ouvre la modale au premier
 * rendu : rien n'est écrit tant que l'étudiant n'a pas cliqué sur « Oui, j'ai terminé ».
 * `net` : part de l'étudiant (nombre) ou null si le gain n'est pas valide.
 */
export function DeclareEnd({ missionId, title, clientName, net, paymentsEnabled, reportHref, initialOpen = false }) {
  const [open, setOpen] = useState(initialOpen)
  return (
    <DeclareEndCard
      clientName={clientName}
      paymentsEnabled={paymentsEnabled}
      reportHref={reportHref}
      onOpen={() => setOpen(true)}
    >
      <DeclareEndBar net={net} paymentsEnabled={paymentsEnabled} onOpen={() => setOpen(true)} />
      {open ? (
        <DeclareEndDialog
          missionId={missionId}
          title={title}
          clientName={clientName}
          net={net}
          paymentsEnabled={paymentsEnabled}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </DeclareEndCard>
  )
}

export default DeclareEnd
