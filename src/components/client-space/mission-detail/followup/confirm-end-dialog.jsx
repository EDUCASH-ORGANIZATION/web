"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { Modal } from "@/components/app-ui/modal"
import { Lines } from "@/components/app-ui/lines"
import { confirmMission } from "@/lib/actions/mission.actions"
import { formatAmount } from "@/lib/app/format"
import { clientReviewHref } from "@/lib/app/client-routes"
import { commissionLabel } from "./escrow-card"

const FALLBACK_ERROR = "Une erreur est survenue. Réessayez dans un instant."
const REPORT_HREF = "/contact?sujet=question"

/**
 * Libération du paiement, une seule à la fois : tant qu'un appel est en cours, un second clic est ignoré.
 * `lock` est un objet `{ busy }` conservé entre les rendus (useRef). Renvoie
 * `{ skipped: true }`, `{ error }` ou `{ amount }` (montant versé renvoyé par l'action).
 * @param {{ busy: boolean }} lock
 * @param {(missionId: string) => Promise<{ success?: boolean, amountStudent?: number, error?: string }>} confirm
 * @param {string} missionId
 */
export async function releaseOnce(lock, confirm, missionId) {
  if (lock.busy) return { skipped: true }
  lock.busy = true
  try {
    const result = await confirm(missionId)
    if (result?.error) return { error: result.error }
    if (!result?.success) return { error: FALLBACK_ERROR }
    return { amount: Number(result.amountStudent) || 0 }
  } catch {
    return { error: FALLBACK_ERROR }
  } finally {
    lock.busy = false
  }
}

/**
 * Vue pure de la modale C09. Le bouton de libération est inactif tant que la case n'est pas cochée
 * et pendant l'envoi. En cas d'échec, les fonds restent en séquestre et le bouton devient « Réessayer ».
 */
export function ConfirmEndDialogView({
  title,
  studentName,
  split,
  since,
  checked,
  pending,
  error,
  onCheck,
  onSubmit,
  onCancel,
  checkRef,
}) {
  return (
    <Modal
      open
      onClose={onCancel}
      title="Confirmer la fin de la mission"
      description={`${title} · ${studentName}`}
      initialFocusRef={checkRef}
      footer={
        <>
          <button type="button" className="btn btn--soft" onClick={onCancel} disabled={pending}>
            Annuler
          </button>
          <button
            type="button"
            className="btn btn--dark"
            onClick={onSubmit}
            disabled={!checked || pending}
            aria-busy={pending ? "true" : undefined}
          >
            {pending ? (
              "Libération en cours"
            ) : error ? (
              <>
                <Icon name="i-refresh" />
                Réessayer
              </>
            ) : (
              <>
                <Icon name="i-coins" />
                Libérer le paiement
              </>
            )}
          </button>
        </>
      }
    >
      {error ? (
        <div className="banner banner--erreur" role="alert">
          <Icon name="i-alert-triangle" />
          <div className="banner__body">
            <div className="banner__title">La libération n&apos;a pas abouti</div>
            Les fonds restent en séquestre, rien n&apos;a été versé. {error}
          </div>
        </div>
      ) : null}
      <Lines
        rows={[
          { label: since ? `En séquestre depuis le ${since}` : "En séquestre", value: split.total },
          { label: commissionLabel(), value: split.commission, sign: "debit" },
        ]}
        total={{ label: `Versé à ${studentName}`, value: split.student }}
      />
      <p className="note2 note2--box">
        <Icon name="i-lock" />
        <span>
          <b>Aucun nouveau paiement.</b> Ces fonds sont déjà bloqués : vous ne payez rien de plus.
        </span>
      </p>
      <label className="check">
        <input ref={checkRef} type="checkbox" checked={checked} onChange={(e) => onCheck(e.target.checked)} disabled={pending} />
        <span>J&apos;ai reçu le travail et il me convient</span>
      </label>
      <p className="note2">
        <Icon name="i-flag" />
        <span>
          Un souci avec le travail ? <Link className="link2" href={REPORT_HREF}>Signaler un problème</Link> plutôt que de confirmer.
        </span>
      </p>
    </Modal>
  )
}

function ConfirmEndDialogOpen({ missionId, title, studentName, split, since, onClose, onPaid }) {
  const [checked, setChecked] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(null)
  const lock = useRef({ busy: false })
  const checkRef = useRef(null)

  async function submit() {
    if (!checked) return
    setPending(true)
    setError(null)
    const result = await releaseOnce(lock.current, confirmMission, missionId)
    if (result.skipped) return
    if (result.error) {
      setError(result.error)
      setPending(false)
      return
    }
    onPaid(result.amount)
  }

  return (
    <ConfirmEndDialogView
      title={title}
      studentName={studentName}
      split={split}
      since={since}
      checked={checked}
      pending={pending}
      error={error}
      checkRef={checkRef}
      onCheck={setChecked}
      onSubmit={submit}
      onCancel={() => {
        if (!pending) onClose()
      }}
    />
  )
}

export function ConfirmEndDialog({ open, ...props }) {
  if (!open) return null
  return <ConfirmEndDialogOpen {...props} />
}

/**
 * Succès : carte centrée avec le montant versé (renvoyé par l'action ; à défaut, la part calculée par
 * escrowSplit), « Noter <prénom> » et retour à la mission.
 */
export function ConfirmEndSuccess({ missionId, studentName, split, paid, onBack }) {
  const versed = paid > 0 ? paid : split.student
  return (
    <section className="card2 done2" aria-label="Paiement libéré">
      <span className="done2__mark">
        <Icon name="i-check-circle" />
      </span>
      <div className="done2__title">Paiement libéré</div>
      <p className="done2__text">
        {studentName} reçoit <b>{formatAmount(versed)}</b> sur son portefeuille EduCash. La mission passe « Terminée ».
      </p>
      <Lines
        rows={[
          { label: "Prélevé du séquestre", value: split.total },
          { label: commissionLabel(), value: split.commission, sign: "debit" },
        ]}
        total={{ label: `Versé à ${studentName}`, value: versed }}
      />
      <div className="actions2">
        <Link className="btn btn--dark" href={clientReviewHref(missionId)}>
          <Icon name="i-star" />
          Noter {studentName}
        </Link>
        <button type="button" className="btn btn--soft" onClick={onBack}>
          Retour à la mission
        </button>
      </div>
    </section>
  )
}

export default ConfirmEndDialog
