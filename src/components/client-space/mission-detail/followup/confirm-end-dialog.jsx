"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/design/icon"
import { Modal } from "@/components/app-ui/modal"
import { Lines } from "@/components/app-ui/lines"
import { confirmMission } from "@/lib/actions/mission.actions"
import { formatAmount } from "@/lib/app/format"
import { clientReviewHref } from "@/lib/app/client-routes"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { commissionLabel } from "./escrow-card"
import { PaidPurchaseRow, paidRequests } from "./receipt"

const FALLBACK_ERROR = "Une erreur est survenue. Réessayez dans un instant."
const REPORT_HREF = "/contact?sujet=question"
const PAID_CODES = new Set(["already_done", "already_released"])
const DONE_MESSAGE = "Cette mission a déjà été payée. Actualisez la page pour voir le reçu."
const UNCONFIRMED_MESSAGE = "Le paiement n'a pas pu être confirmé. Vérifiez l'état de la mission avant de réessayer."

/** Vrai quand le code d'erreur de l'action indique que l'argent est déjà parti (rien à réessayer). */
export function isAlreadyPaid(code) {
  return PAID_CODES.has(code)
}

/** « Actualiser » recharge les données de la page puis ferme la modale (la mission affichée est celle à jour). */
export function refreshAndClose(refresh, close) {
  refresh()
  close()
}

/** Bloc d'erreur d'un paiement déjà parti : `already_done` renvoie au reçu, `already_released` (statut non enregistré) à l'aide. */
function PaidNotice({ code }) {
  if (code === "already_released") {
    return (
      <>
        <div className="banner__title">Paiement déjà libéré</div>
        Le paiement a déjà été libéré. Si la mission n&apos;apparaît pas terminée après actualisation,{" "}
        <Link className="link2" href={REPORT_HREF}>contactez l&apos;aide</Link>.
      </>
    )
  }
  return (
    <>
      <div className="banner__title">Paiement déjà effectué</div>
      {DONE_MESSAGE}
    </>
  )
}

const count = (n) => (Number.isInteger(n) && n > 0 ? n : 0)
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

/**
 * Avertissement NON BLOQUANT des demandes d'achats en attente ou signalées (`detail.purchases.confirmWarning`). Il
 * informe seulement : la confirmation de fin n'en dépend jamais et le séquestre ne bouge que sur la libération explicite par le client.
 * Rien n'est affiché si `show` n'est pas vrai (mission sans achats, script 94 absent, rien en attente).
 */
export function PurchasesWarning({ warning }) {
  if (warning?.show !== true) return null
  const pending = count(warning.pending)
  const reported = count(warning.reported)
  const parts = []
  if (pending > 0) parts.push(`${plural(pending, "demande", "demandes")} de paiement d'achats en attente`)
  if (reported > 0) parts.push(`${plural(reported, "demande", "demandes")} d'achats ${reported === 1 ? "signalée" : "signalées"}`)
  const title = parts.length > 0 ? parts.join(" et ") : "Une demande d'achats n'est pas réglée"
  return (
    <div className="banner banner--alerte" role="status">
      <Icon name={pending === 0 && reported > 0 ? "i-flag" : "i-clock"} />
      <div className="banner__body">
        <div className="banner__title">{title}</div>
        Vous pouvez confirmer la fin : ces achats restent hors EduCash.
        {reported > 0
          ? " Confirmer la fin libère le service mais ne clôt pas le signalement : l'équipe EduCash continue de l'examiner."
          : ""}
      </div>
    </div>
  )
}

/** Achats payés en direct, listés à part, hors séquestre : le service seul est libéré. Aucun achat payé : rien. */
function PaidPurchasesList({ purchases }) {
  const rows = paidRequests(purchases)
  if (rows.length === 0) return null
  return (
    <>
      <div className="sub2">
        <span>Achats payés en direct</span>
        <StatusBadge label="Hors séquestre" icon="i-banknote" />
      </div>
      <div>
        {rows.map((request) => (
          <PaidPurchaseRow key={request.id} request={request} />
        ))}
      </div>
      <p className="note2">
        <Icon name="i-info" />
        <span>Ces montants ne sont ni libérés ni remboursés par EduCash : ils sont déjà chez les vendeurs.</span>
      </p>
    </>
  )
}

/**
 * Libération du paiement, une seule à la fois : tant qu'un appel est en cours, un second clic est ignoré.
 * `lock` est un objet `{ busy }` conservé entre les rendus (useRef). Renvoie
 * `{ skipped: true }`, `{ error, code }` ou `{ amount }` (montant versé renvoyé par l'action).
 * @param {{ busy: boolean }} lock
 * @param {(missionId: string) => Promise<{ success?: boolean, amountStudent?: number, error?: string, code?: string }>} confirm
 * @param {string} missionId
 */
export async function releaseOnce(lock, confirm, missionId) {
  if (lock.busy) return { skipped: true }
  lock.busy = true
  try {
    const result = await confirm(missionId)
    if (result?.error) return { error: result.error, code: result.code ?? "generic" }
    if (!result?.success) return { error: FALLBACK_ERROR, code: "generic" }
    return { amount: Number(result.amountStudent) || 0 }
  } catch {
    return { error: FALLBACK_ERROR, code: "generic" }
  } finally {
    lock.busy = false
  }
}

/**
 * Vue pure de la modale C09. Le bouton de libération est inactif tant que la case n'est pas cochée
 * et pendant l'envoi. En cas d'échec, la modale n'affirme jamais qu'aucun argent n'a été versé : si le
 * code indique que la mission est déjà payée, « Actualiser » remplace « Réessayer » ; sinon texte neutre.
 */
export function ConfirmEndDialogView({
  title,
  studentName,
  split,
  since,
  checked,
  pending,
  error,
  errorCode,
  onCheck,
  onRefresh,
  onSubmit,
  onCancel,
  checkRef,
  purchases,
}) {
  const alreadyPaid = Boolean(error) && isAlreadyPaid(errorCode)
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
          {alreadyPaid ? (
            <button type="button" className="btn btn--dark" onClick={onRefresh}>
              <Icon name="i-refresh" />
              Actualiser
            </button>
          ) : (
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
          )}
        </>
      }
    >
      {error ? (
        <div className="banner banner--erreur" role="alert">
          <Icon name="i-alert-triangle" />
          <div className="banner__body">
            {alreadyPaid ? (
              <PaidNotice code={errorCode} />
            ) : (
              <>
                <div className="banner__title">La libération n&apos;a pas pu être confirmée</div>
                {UNCONFIRMED_MESSAGE}
              </>
            )}
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
      <PaidPurchasesList purchases={purchases} />
      <PurchasesWarning warning={purchases?.available === true ? purchases.confirmWarning : null} />
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

function ConfirmEndDialogOpen({ missionId, title, studentName, split, since, purchases, onClose, onPaid }) {
  const [checked, setChecked] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(null)
  const [errorCode, setErrorCode] = useState(null)
  const router = useRouter()
  const lock = useRef({ busy: false })
  const checkRef = useRef(null)

  async function submit() {
    if (!checked) return
    setPending(true)
    setError(null)
    setErrorCode(null)
    const result = await releaseOnce(lock.current, confirmMission, missionId)
    if (result.skipped) return
    if (result.error) {
      setError(result.error)
      setErrorCode(result.code ?? "generic")
      setPending(false)
      router.refresh()
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
      errorCode={errorCode}
      purchases={purchases}
      onRefresh={() => refreshAndClose(router.refresh, onClose)}
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
